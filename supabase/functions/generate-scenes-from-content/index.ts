// supabase/functions/generate-scenes-from-content/index.ts
// Edge Function to generate scenes structure from existing story content
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import OpenAI from "npm:openai@^4.33.0";
import { createScenesPrompt } from './prompt.ts';

// Interface for request body
interface GenerateScenesRequestBody {
  storyId: string;
  content: string;
  title: string;
  language?: string;
}

// Interface for scenes structure
interface StoryScenes {
  character: string;
  cover: string;
  scene_1: string;
  scene_2: string;
  scene_3: string;
  scene_4: string;
  closing: string;
}

/**
 * Validates that the response has the correct scenes structure
 */
function isValidScenesResult(data: unknown): data is StoryScenes {
  const record = data as Record<string, unknown>;
  return !!data &&
    typeof record.character === 'string' &&
    typeof record.cover === 'string' &&
    typeof record.scene_1 === 'string' &&
    typeof record.scene_2 === 'string' &&
    typeof record.scene_3 === 'string' &&
    typeof record.scene_4 === 'string' &&
    typeof record.closing === 'string';
}

serve(async (req: Request) => {
  const functionVersion = "v1.0 (Scenes Generator)";
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log(`[${functionVersion}] Handling OPTIONS preflight request...`);
    return new Response("ok", { headers: corsHeaders });
  }

  // Configuration
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const GEMINI_COMPATIBLE_ENDPOINT = Deno.env.get("GEMINI_COMPATIBLE_ENDPOINT") || 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const TEXT_MODEL_GENERATE = Deno.env.get('TEXT_MODEL_GENERATE');

  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY environment variable not set");
  if (!GEMINI_COMPATIBLE_ENDPOINT) throw new Error("GEMINI_COMPATIBLE_ENDPOINT environment variable not set");
  if (!TEXT_MODEL_GENERATE) throw new Error("TEXT_MODEL_GENERATE environment variable not set");

  // Initialize OpenAI Client for Gemini
  const openai = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: GEMINI_COMPATIBLE_ENDPOINT.endsWith('/') ? GEMINI_COMPATIBLE_ENDPOINT : GEMINI_COMPATIBLE_ENDPOINT + '/',
  });
  console.log(`[${functionVersion}] OpenAI client configured for Gemini model '${TEXT_MODEL_GENERATE}'`);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const APP_SERVICE_ROLE_KEY = Deno.env.get('APP_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !APP_SERVICE_ROLE_KEY) {
    throw new Error("Supabase URL or Service Role Key not set");
  }
  const supabaseAdmin = createClient(SUPABASE_URL, APP_SERVICE_ROLE_KEY);

  // Verify POST method
  if (req.method !== 'POST') {
    console.log(`[${functionVersion}] Method ${req.method} not allowed.`);
    return new Response(JSON.stringify({ error: 'Método no permitido. Usar POST.' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let userId: string | null = null;

  try {
    // Authentication
    console.log(`[${functionVersion}] Handling POST request...`);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Authorization header missing or invalid.");
      return new Response(JSON.stringify({ error: 'Token inválido o ausente.' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth Error:", authError);
      return new Response(JSON.stringify({ error: authError?.message || 'No autenticado.' }), {
        status: authError?.status || 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    userId = user.id;
    console.log(`[${functionVersion}] User Auth: ${userId}`);

    // Parse and validate request body
    let params: GenerateScenesRequestBody;
    try {
      params = await req.json();
      console.log(`[${functionVersion}] Params received for story: ${params.storyId}`);
      
      if (!params.storyId || !params.content || !params.title) {
        throw new Error("Parámetros inválidos: se requiere storyId, content y title.");
      }
      
      if (typeof params.content !== 'string' || params.content.length < 50) {
        throw new Error("El contenido del cuento es demasiado corto o inválido.");
      }
      
      if (typeof params.title !== 'string' || params.title.length < 2) {
        throw new Error("El título del cuento es inválido.");
      }
      
    } catch (error) {
      console.error(`[${functionVersion}] Failed to parse/validate JSON body. Error:`, error);
      const message = error instanceof Error ? error.message : "Error desconocido al procesar JSON.";
      throw new Error(`Invalid request body: ${message}`);
    }

    // Verify story ownership
    const { data: storyData, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('user_id, scenes')
      .eq('id', params.storyId)
      .single();

    if (storyError || !storyData) {
      console.error(`[${functionVersion}] Story not found: ${params.storyId}`);
      return new Response(JSON.stringify({ error: 'Historia no encontrada.' }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (storyData.user_id !== userId) {
      console.error(`[${functionVersion}] User ${userId} does not own story ${params.storyId}`);
      return new Response(JSON.stringify({ error: 'No tienes permiso para modificar esta historia.' }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Check if scenes already exist (idempotency)
    if (storyData.scenes && typeof storyData.scenes === 'object') {
      console.log(`[${functionVersion}] Story ${params.storyId} already has scenes. Skipping generation.`);
      return new Response(JSON.stringify({ 
        scenes: storyData.scenes,
        message: 'Scenes already exist for this story.'
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Generate scenes using AI
    const language = params.language || 'Español';
    const prompt = createScenesPrompt(params.title, params.content, language);

    console.log(`[${functionVersion}] Calling AI (${TEXT_MODEL_GENERATE}) to generate scenes. Prompt length: ${prompt.length}`);

    const chatCompletion = await openai.chat.completions.create({
      model: TEXT_MODEL_GENERATE,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 8000
    });

    const aiResponseContent = chatCompletion.choices[0]?.message?.content;
    const finishReason = chatCompletion.choices[0]?.finish_reason;

    console.log(`[${functionVersion}] AI response received (first 200 chars): ${aiResponseContent?.substring(0, 200) || '(No text)'}... Finish: ${finishReason}`);

    if (finishReason === 'length') {
      console.warn(`[${functionVersion}] AI generation may have been truncated.`);
    }

    // Parse AI response
    let scenes: StoryScenes | null = null;

    if (aiResponseContent) {
      try {
        const parsedScenes = JSON.parse(aiResponseContent);
        if (isValidScenesResult(parsedScenes)) {
          scenes = parsedScenes;
          console.log(`[${functionVersion}] Successfully parsed scenes. Keys: ${Object.keys(scenes).join(', ')}`);
        } else {
          console.error(`[${functionVersion}] Invalid scenes structure received:`, parsedScenes);
          throw new Error('La estructura de scenes generada es inválida.');
        }
      } catch (parseError) {
        const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
        console.error(`[${functionVersion}] Failed to parse JSON from AI: ${errorMsg}`);
        console.log(`[${functionVersion}] Problematic JSON: ${aiResponseContent.substring(0, 500)}`);
        throw new Error(`Error al parsear respuesta de IA: ${errorMsg}`);
      }
    } else {
      console.error(`[${functionVersion}] AI response was empty. Finish reason: ${finishReason}`);
      throw new Error('La IA no generó contenido válido.');
    }

    if (!scenes) {
      throw new Error('No se pudieron generar las scenes.');
    }

    // Return scenes (the client will update the database)
    return new Response(JSON.stringify({ scenes }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[${functionVersion}] Error (User: ${userId || 'UNKNOWN'}):`, error);
    let statusCode = 500;
    const message = error instanceof Error ? error.message : "Error interno desconocido.";

    if (error instanceof Error) {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes("autenticado") || lowerMessage.includes("token")) statusCode = 401;
      else if (lowerMessage.includes("permiso")) statusCode = 403;
      else if (lowerMessage.includes("no encontrada") || lowerMessage.includes("not found")) statusCode = 404;
      else if (lowerMessage.includes("inválido") || lowerMessage.includes("invalid")) statusCode = 400;
      else if (lowerMessage.includes("blocked") || lowerMessage.includes("filter")) statusCode = 502;
    }

    return new Response(JSON.stringify({
      error: `Error generando scenes: ${message}`
    }), {
      status: statusCode,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

