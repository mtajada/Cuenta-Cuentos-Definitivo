// supabase/functions/ai/generate-audio/index.ts
// Lógica CORREGIDA: Verifica créditos ANTES de TTS y actualiza DB. Permite a gratuitos usar créditos comprados.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"; // O la versión que uses
import { OpenAI } from "https://esm.sh/openai@4.40.0"; // O versión más reciente
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts'; // Asume que está en la carpeta renombrada 'functions'

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
// --- Fin Configuración ---

serve(async (req: Request) => {
  // Manejo Preflight OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('[GENERATE_AUDIO_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  let userId: string | null = null; // Para logging en caso de error temprano
  let creditSource: 'monthly' | 'purchased' | 'none' = 'none'; // Para saber qué actualizar

  try {
    // --- 1. Autenticación ---
    console.log('[GENERATE_AUDIO_DEBUG] Attempting authentication...');
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[GENERATE_AUDIO_WARN] Invalid or missing Authorization header.');
        return new Response(JSON.stringify({ error: 'Token inválido.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const token = authHeader.replace('Bearer ', '');

    // Usamos el cliente ADMIN para obtener el usuario asociado al token JWT
    // Esto es más seguro que crear un cliente por solicitud con el token del usuario
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        console.error('[GENERATE_AUDIO_ERROR] Authentication failed:', authError?.message || 'User not found for token.');
        return new Response(JSON.stringify({ error: 'No autenticado.' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    userId = user.id; // Asignamos userId para logging posterior
    console.log(`[GENERATE_AUDIO_INFO] User Authenticated: ${userId}`);
    // --- Fin Autenticación ---

    // --- 2. Obtener Perfil y Verificar Permiso/Límites/Créditos ---
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
        return new Response(JSON.stringify({ error: 'Error al actualizar el saldo de créditos.' }), { status: 500, headers: corsHeaders });
    }
    console.log(`[GENERATE_AUDIO_INFO] Credit/Usage count updated successfully for user ${userId}. Proceeding with TTS generation.`);

    // --- 5. Procesar Solicitud y Generar Audio (AHORA SÍ) ---
    const { text, voice = 'alloy', model = 'tts-1' } = await req.json(); // Proporcionar defaults
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        console.warn(`[GENERATE_AUDIO_WARN] Invalid request body for user ${userId}: Text is missing or empty.`);
        return new Response(JSON.stringify({ error: 'Texto inválido o ausente requerido.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[GENERATE_AUDIO_INFO] Generating audio via OpenAI for user ${userId} (Voice: ${voice}, Model: ${model})...`);
    const response = await openai.audio.speech.create({
        model: model,
        voice: voice,
        input: text.trim() // Usar texto sin espacios extra
    });

    // Verificar si la respuesta de OpenAI fue exitosa
    if (!response.ok) {
        const errorBody = await response.text(); // Intentar leer el cuerpo del error
        console.error(`[GENERATE_AUDIO_ERROR] OpenAI API error for user ${userId}: ${response.status} ${response.statusText}`, errorBody);
        // Devolver un error genérico al cliente, pero loguear el detalle
        return new Response(JSON.stringify({ error: 'Error al contactar el servicio de generación de voz.' }), { status: 502, headers: corsHeaders }); // 502 Bad Gateway
    }

    const audioBuffer = await response.arrayBuffer();
    console.log(`[GENERATE_AUDIO_INFO] Audio generated successfully via OpenAI for user ${userId}.`);
    // --- Fin Generar Audio ---

    // --- 6. Devolver Respuesta de Audio ---
    // Nota: Ya no actualizamos créditos aquí, se hizo antes.
    console.log(`[GENERATE_AUDIO_INFO] Returning audio buffer to user ${userId}.`);
    return new Response(audioBuffer, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg' // O el tipo correcto devuelto por OpenAI
        },
        status: 200
    });
    // --- Fin Devolver Respuesta ---

  } catch (error) {
    // Captura errores generales (JSON parse, errores inesperados, etc.)
    console.error(`[GENERATE_AUDIO_ERROR] Unhandled error in generate-audio function for user ${userId || 'UNKNOWN'}:`, error);
    let errorMessage = 'Error interno del servidor al generar el audio.';
    // Evitar exponer detalles internos en producción
    // if (error instanceof Error) errorMessage = error.message;
    // Usar 500 Internal Server Error para errores no manejados específicamente
    return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});