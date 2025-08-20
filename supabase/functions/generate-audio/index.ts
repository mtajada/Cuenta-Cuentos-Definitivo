// supabase/functions/ai/generate-audio/index.ts
// Lógica CORREGIDA: Verifica créditos ANTES de TTS y actualiza DB. Permite a gratuitos usar créditos comprados.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"; // O la versión que uses
import { OpenAI } from "https://esm.sh/openai@4.40.0"; // O versión más reciente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders, getCorsHeaders } from '../_shared/cors.ts'; // Asume que está en la carpeta renombrada 'functions'

// --- Configuración ---
console.log(`[GENERATE_AUDIO_DEBUG] Function generate-audio initializing...`);

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openaiApiKey) {
    console.error("[GENERATE_AUDIO_ERROR] CRITICAL: OPENAI_API_KEY environment variable not set.");
    // Lanzar error para detener la función si falta la clave
    throw new Error("OPENAI_API_KEY environment variable not set");
}
const openai = new OpenAI({ apiKey: openaiApiKey });

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); // O APP_SERVICE_ROLE_KEY si ese es el nombre
if (!supabaseUrl || !serviceRoleKey) {
    console.error("[GENERATE_AUDIO_ERROR] CRITICAL: Supabase URL or Service Role Key not set.");
    throw new Error("Supabase URL or Service Role Key not set");
}
// Cliente Admin para operaciones críticas (consulta de perfil, actualización de créditos)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

// Constante para el límite mensual (mejor si viene de env vars)
const PREMIUM_MONTHLY_ALLOWANCE = 10;

console.log(`[GENERATE_AUDIO_DEBUG] Function generate-audio initialized successfully.`);

/**
 * Cleans text for speech generation (exact replica from ttsService.ts)
 * @param text Raw text to clean  
 * @returns Cleaned text optimized for TTS
 */
function cleanTextForSpeech(text: string): string {
  return text
    // Mantener caracteres especiales españoles
    .replace(/[^\w\s.,!?áéíóúñÁÉÍÓÚÑ-]/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    // Agregar pausas naturales
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([.,])\s+/g, '$1 ')
    // Eliminar líneas vacías múltiples
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// --- Fin Configuración ---

serve(async (req: Request) => {
  // Get dynamic CORS headers for this request
  const dynamicCorsHeaders = getCorsHeaders(req);
  
  // Manejo Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: dynamicCorsHeaders });
  }

  let userId: string | null = null; // Para logging en caso de error temprano
  let creditSource: 'monthly' | 'purchased' | 'none' = 'none'; // Para saber qué actualizar

  try {
    // --- 1. Autenticación ---
    console.log('[GENERATE_AUDIO_DEBUG] Attempting authentication...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[GENERATE_AUDIO_WARN] Invalid or missing Authorization header.');
        return new Response(JSON.stringify({ error: 'Token inválido.' }), { status: 401, headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');

    // Usamos el cliente ADMIN para obtener el usuario asociado al token JWT
    // Esto es más seguro que crear un cliente por solicitud con el token del usuario
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        console.error('[GENERATE_AUDIO_ERROR] Authentication failed:', authError?.message || 'User not found for token.');
        return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } });
    }
    userId = user.id; // Asignamos userId para logging posterior
    console.log(`[GENERATE_AUDIO_INFO] User Authenticated: ${userId}`);
    // --- Fin Autenticación ---

    // --- 2. Leer y Validar Request Body ---
    let requestBody;
    try {
        // Verificar que la request tenga contenido
        if (!req.body) {
            console.error(`[GENERATE_AUDIO_ERROR] No body in request for user ${userId}`);
            return new Response(JSON.stringify({ error: 'No se encontró cuerpo en la solicitud' }), { 
                status: 400, 
                headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
            });
        }

        // Parsear el JSON
        requestBody = await req.json();
        
    } catch (jsonError) {
        console.error(`[GENERATE_AUDIO_ERROR] Failed to parse JSON for user ${userId}:`, jsonError);
        
        return new Response(JSON.stringify({ 
            error: 'Error al procesar el formato de la solicitud',
            details: jsonError.message 
        }), { 
            status: 400, 
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // Validar que el texto sea válido
    const { text, voice = 'nova', model, instructions } = requestBody;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn(`[GENERATE_AUDIO_WARN] Invalid request body for user ${userId}: Text is missing or empty.`);
        return new Response(JSON.stringify({ error: 'El texto es requerido' }), { 
            status: 400, 
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    // --- 3. Obtener Perfil y Verificar Permiso/Límites/Créditos ---
    console.log(`[GENERATE_AUDIO_DEBUG] Fetching profile for user ${userId}...`);
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('subscription_status, voice_credits, monthly_voice_generations_used')
        .eq('id', userId)
        .single(); // Usar single() para que falle si no hay exactamente 1 perfil

    if (profileError) {
        console.error(`[GENERATE_AUDIO_ERROR] Failed to fetch profile for user ${userId}:`, profileError);
        // No lanzar error aquí, devolver respuesta controlada
        return new Response(JSON.stringify({ error: 'Error al obtener perfil de usuario.' }), { status: 500, headers: corsHeaders });
    }
    // No necesitamos chequear !profile porque .single() ya daría error si no existe

    console.log(`[GENERATE_AUDIO_DEBUG] Profile data for ${userId}:`, profile);

    let canGenerate = false;
    const isPremium = profile.subscription_status === 'active' || profile.subscription_status === 'trialing';
    const monthlyUsed = profile.monthly_voice_generations_used ?? 0;
    const purchasedCredits = profile.voice_credits ?? 0;

    // --- Lógica de decisión ---
    if (isPremium) {
        console.log(`[GENERATE_AUDIO_DEBUG] User ${userId} is Premium/Trialing.`);
        if (monthlyUsed < PREMIUM_MONTHLY_ALLOWANCE) {
            console.log(`[GENERATE_AUDIO_INFO] Authorizing via monthly allowance for user ${userId}. Used: ${monthlyUsed}/${PREMIUM_MONTHLY_ALLOWANCE}.`);
            canGenerate = true;
            creditSource = 'monthly';
        } else if (purchasedCredits > 0) {
            console.log(`[GENERATE_AUDIO_INFO] Monthly allowance used. Authorizing via purchased credit for user ${userId}. Purchased available: ${purchasedCredits}.`);
            canGenerate = true;
            creditSource = 'purchased';
        } else {
            console.log(`[GENERATE_AUDIO_WARN] Denying - Premium user ${userId} has no monthly allowance or purchased credits remaining.`);
        }
    } else { // Usuario Gratuito, Cancelado, etc.
        console.log(`[GENERATE_AUDIO_DEBUG] User ${userId} is not Premium (Status: ${profile.subscription_status}). Checking purchased credits...`);
        if (purchasedCredits > 0) {
            console.log(`[GENERATE_AUDIO_INFO] Authorizing via purchased credit for non-premium user ${userId}. Purchased available: ${purchasedCredits}.`);
            canGenerate = true;
            creditSource = 'purchased';
        } else {
            console.log(`[GENERATE_AUDIO_WARN] Denying - Non-premium user ${userId} has no purchased credits.`);
            // Podríamos devolver 403 si NUNCA pudieran generar, pero como pueden comprar, 402 es mejor.
        }
    }

    // --- 3. Devolver error si no hay créditos ANTES de actualizar DB o llamar a TTS ---
    if (!canGenerate) {
        console.log(`[GENERATE_AUDIO_INFO] Denying audio generation for user ${userId} due to insufficient credits.`);
        return new Response(JSON.stringify({ error: 'Créditos de voz insuficientes.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); // 402 Payment Required
    }

    // --- 4. Actualizar Contador/Crédito (ANTES de llamar a OpenAI) ---
    console.log(`[GENERATE_AUDIO_DEBUG] Attempting to update usage/credits for user ${userId} (Source: ${creditSource})...`);
    let dbUpdateError = null;
    let rpcResultData: number | null = null; // Para almacenar el resultado de decrement_voice_credits si es necesario

    if (creditSource === 'monthly') {
        const { error: rpcError } = await supabaseAdmin.rpc('increment_monthly_voice_usage', { user_uuid: userId });
        dbUpdateError = rpcError;
        if (!dbUpdateError) console.log(`[GENERATE_AUDIO_INFO] DB OK: Monthly usage incremented for ${userId}.`);

    } else if (creditSource === 'purchased') {
        // Llamamos a decrement y guardamos el resultado (podría ser el nuevo saldo o -1)
        const { data, error: rpcError } = await supabaseAdmin.rpc('decrement_voice_credits', { user_uuid: userId });
        dbUpdateError = rpcError;
        rpcResultData = data; // Guardamos el resultado (puede ser null si la función no devuelve nada o el valor devuelto)
        if (!dbUpdateError && typeof rpcResultData === 'number' && rpcResultData !== -1) {
             console.log(`[GENERATE_AUDIO_INFO] DB OK: Purchased credit decremented for ${userId}. Approx new balance: ${rpcResultData}`);
        } else if (!dbUpdateError && rpcResultData === -1) {
             // Esto no debería pasar si canGenerate fue true, pero es un check de seguridad
             console.warn(`[GENERATE_AUDIO_WARN] DB WARN: decrement_voice_credits returned -1 unexpectedly for user ${userId}.`);
             // Considerar fallar aquí ya que el estado podría ser inconsistente
             // dbUpdateError = new Error("Inconsistent state: decrement returned -1 after check passed.");
        } else if (!dbUpdateError) {
             console.log(`[GENERATE_AUDIO_INFO] DB OK: Purchased credit decremented for ${userId} (RPC did not return new balance).`);
        }
    }

    // Si la actualización de la DB falló, no continuamos
    if (dbUpdateError) {
        console.error(`[GENERATE_AUDIO_ERROR] CRITICAL FAIL: Failed to update ${creditSource} count via RPC for user ${userId}:`, dbUpdateError);
        return new Response(JSON.stringify({ error: 'Error al actualizar el saldo de créditos.' }), { status: 500, headers: dynamicCorsHeaders });
    }
    console.log(`[GENERATE_AUDIO_INFO] Credit/Usage count updated successfully for user ${userId}. Proceeding with TTS generation.`);
    
    // --- 5. Procesar Solicitud y Generar Audio ---
    console.log(`[GENERATE_AUDIO_INFO] Processing TTS generation for user ${userId}...`);

    // Limpiar el texto antes de procesarlo
    const cleanedText = cleanTextForSpeech(text);

    // Combinar el system prompt con las instrucciones específicas del narrador
    const SYSTEM_PROMPT = "Eres un narrador profesional de cuentos infantiles. Narra de forma expresiva, clara y envolvente, adaptando el tono y ritmo para captar la atención de los niños.";
    const fullInstructions = instructions 
        ? `${SYSTEM_PROMPT} ${instructions}`
        : SYSTEM_PROMPT;
    
    const response = await openai.audio.speech.create({
        model: model,
        voice: voice,
        input: cleanedText,
        instructions: fullInstructions
    });

    // Verificar si la respuesta de OpenAI fue exitosa
    if (!response.ok) {
        const errorBody = await response.text(); // Intentar leer el cuerpo del error
        console.error(`[GENERATE_AUDIO_ERROR] OpenAI API error for user ${userId}: ${response.status} ${response.statusText}`, errorBody);
        // Devolver un error genérico al cliente, pero loguear el detalle
        return new Response(JSON.stringify({ error: 'Error al contactar el servicio de generación de voz.' }), { status: 502, headers: dynamicCorsHeaders }); // 502 Bad Gateway
    }

    // Convertir la respuesta a un Blob usando arrayBuffer
    const buffer = await response.arrayBuffer();
    
    console.log(`[GENERATE_AUDIO_INFO] Audio generated successfully for user ${userId}: ${buffer.byteLength} bytes`);
    return new Response(buffer, {
        headers: {
            ...dynamicCorsHeaders,
            'Content-Type': 'audio/mpeg'
        },
        status: 200
    });
    // --- Fin Devolver Respuesta ---

  } catch (error: unknown) {
    console.error('Error en generación de voz:', error);
    
    // Type guard para OpenAI errors (exacto como ttsService)
    function isOpenAIError(error: unknown): error is { status?: number; code?: string | number; message?: string } {
      return typeof error === 'object' && error !== null;
    }
    
    const openAIError = isOpenAIError(error) ? error : null;
    
    // Manejar específicamente el error 429 (Too Many Requests) - exacto como ttsService
    if (openAIError?.status === 429 || openAIError?.code === 429) {
      return new Response(JSON.stringify({ error: 'Alcanzaste el máximo de créditos para generar un audio' }), {
        status: 429,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (openAIError?.status === 401 || openAIError?.code === 'invalid_api_key') {
      return new Response(JSON.stringify({ error: 'Error de autenticación con el servicio de voz' }), {
        status: 401,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (openAIError?.status === 400) {
      return new Response(JSON.stringify({ error: 'El texto proporcionado no es válido para generar audio' }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    if (openAIError?.status && openAIError.status >= 500) {
      return new Response(JSON.stringify({ error: 'El servicio de voz no está disponible temporalmente' }), {
        status: 500,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Error inesperado al generar el audio';
    console.error(`[GENERATE_AUDIO_ERROR] Final error for user ${userId || 'UNKNOWN'}:`, errorMessage);
    
    return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});