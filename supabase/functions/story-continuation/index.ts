// supabase/edge-functions/story-continuation/index.ts
// v7.0 (OpenAI Client + JSON Output): Uses OpenAI client for Gemini, expects structured JSON.
import { serve } from "std/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "supabase";
import OpenAI from "openai";

import {
  createContinuationOptionsPrompt,
  createContinuationPrompt,
  type Story, // Assuming Story type is defined in prompt.ts
  type Chapter, // Assuming Chapter type is defined in prompt.ts
  type ContinuationContextType,
} from './prompt.ts';

type ContinuationActionType = 'freeContinuation' | 'optionContinuation' | 'directedContinuation';

interface ContinuationRequestBody {
  action?: string;
  story?: Story;
  chapters?: Chapter[] | null;
  selectedOptionSummary?: string;
  userDirection?: string;
  language?: string;
  childAge?: number;
  specialNeed?: string | null;
  storyDuration?: string;
}

function getRequiredEnvVar(key: string, errorMessage: string): string {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(errorMessage);
  }
  return value;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isContinuationActionType(action: string): action is ContinuationActionType {
  return action === 'freeContinuation' || action === 'optionContinuation' || action === 'directedContinuation';
}

// --- Configuración Global ---
const GEMINI_API_KEY = getRequiredEnvVar("GEMINI_API_KEY", "GEMINI_API_KEY environment variable not set");
const GEMINI_COMPATIBLE_ENDPOINT = Deno.env.get("GEMINI_COMPATIBLE_ENDPOINT") || 'https://generativelanguage.googleapis.com/v1beta/openai/';
const TEXT_MODEL_GENERATE = getRequiredEnvVar('TEXT_MODEL_GENERATE', "TEXT_MODEL_GENERATE environment variable not set for OpenAI client.");

if (!GEMINI_COMPATIBLE_ENDPOINT) throw new Error("GEMINI_COMPATIBLE_ENDPOINT environment variable not set");

const openai = new OpenAI({
  apiKey: GEMINI_API_KEY,
  baseURL: GEMINI_COMPATIBLE_ENDPOINT.endsWith('/') ? GEMINI_COMPATIBLE_ENDPOINT : GEMINI_COMPATIBLE_ENDPOINT + '/',
});
const functionVersion = "v7.0 (OpenAI Client + JSON)";
console.log(`story-continuation ${functionVersion}: Using model ${TEXT_MODEL_GENERATE} via ${openai.baseURL}`);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const APP_SERVICE_ROLE_KEY = Deno.env.get('APP_SERVICE_ROLE_KEY');
if (!SUPABASE_URL || !APP_SERVICE_ROLE_KEY) throw new Error("Supabase URL or Service Role Key not set");
const supabaseAdmin = createClient(SUPABASE_URL, APP_SERVICE_ROLE_KEY);

// --- Interfaces for AI JSON Responses ---
interface AiContinuationOption {
  summary: string;
}
interface AiContinuationOptionsResponse {
  options: AiContinuationOption[];
}
interface AiContinuationResponse {
  title: string;
  content: string;
}

type ContinuationResponsePayload =
  | AiContinuationOptionsResponse
  | { content: string; title: string };

function isAiContinuationOption(option: unknown): option is AiContinuationOption {
  if (typeof option !== 'object' || option === null) return false;
  const candidate = option as { summary?: unknown };
  return typeof candidate.summary === 'string' && candidate.summary.trim() !== '';
}

// --- Validation functions for AI responses ---
function isValidOptionsResponse(data: unknown): data is AiContinuationOptionsResponse {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as { options?: unknown };
  if (!Array.isArray(candidate.options)) return false;
  return candidate.options.every(isAiContinuationOption);
}

function isValidContinuationResponse(data: unknown): data is AiContinuationResponse {
  if (typeof data !== 'object' || data === null) return false;
  const candidate = data as { title?: unknown; content?: unknown };
  return typeof candidate.title === 'string' && // Title can be empty initially, cleanExtractedText handles default
    typeof candidate.content === 'string' && candidate.content.trim() !== '';
}


// --- Funciones Helper ---
async function generateContinuationOptions(
  story: Story,
  chapters: Chapter[],
  language: string = 'Español',
  childAge: number = 7,
  specialNeed: string | null = null,
  userId?: string,
): Promise<AiContinuationOptionsResponse> {
  console.log(`[${functionVersion}] generateContinuationOptions for story ${story?.id}`);

  if (!story || !story.id || !story.title || !story.content || !story.options) {
    throw new Error("Datos de historia inválidos/incompletos para generar opciones.");
  }
  if (!Array.isArray(chapters)) {
    throw new Error("Datos de capítulos inválidos para generar opciones.");
  }

  const prompt = createContinuationOptionsPrompt(story, chapters, language, childAge, specialNeed);
  console.log(`[${functionVersion}] Prompt para generación de opciones (lang: ${language}):\n---\n${prompt.substring(0, 300)}...\n---`);

  let aiResponseContent: string | null = null;
  try {
    const chatCompletion = await openai.chat.completions.create({
      model: TEXT_MODEL_GENERATE,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7, // Adjusted temperature for option generation (can be tuned)
      max_tokens: 8192, // Sufficient for a few options
    });

    aiResponseContent = chatCompletion.choices[0]?.message?.content;
    const finishReason = chatCompletion.choices[0]?.finish_reason;

    console.log(`[${functionVersion}] Raw AI JSON for options (first 200 chars): ${aiResponseContent?.substring(0, 200) || '(No content received)'}... Finish Reason: ${finishReason}`);

    if (finishReason === 'length') {
      console.warn(`[${functionVersion}] AI option generation may have been truncated.`);
    }
    if (!aiResponseContent) {
      throw new Error("Respuesta vacía de la IA para las opciones.");
    }

    // First try: Normal JSON parsing
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(aiResponseContent);
      console.log(`[${functionVersion}] Options JSON parsed successfully on first try`);
    } catch (parseError) {
      const errorObj = asError(parseError);
      const errorMsg = errorObj.message;
      console.error(`[${functionVersion}] Failed to parse options JSON${userId ? ` (User: ${userId})` : ''}. Error: ${errorMsg}. Trying aggressive cleaning...`);
      console.log(`[${functionVersion}] Problematic JSON (first 500 chars): ${aiResponseContent.substring(0, 500)}`);
      
      // Fallback 1: More aggressive cleaning of control characters within JSON string values
      try {
        let cleanedContent = aiResponseContent;
        
        // Fix unescaped control characters within JSON string values
        cleanedContent = cleanedContent.replace(
          /"(summary|title|content)"\s*:\s*"((?:[^"\\]|\\.)*)"/gs,
          (_match: string, key: string, value: string) => {
            // Fix unescaped control characters
            let fixedValue = value
              .replace(/\r\n/g, '\\n')  // Windows line endings
              .replace(/\n/g, '\\n')     // Unix line endings
              .replace(/\r/g, '\\r')     // Mac line endings
              .replace(/\t/g, '\\t');    // Tabs
            
            // Remove other control characters
            fixedValue = fixedValue.split('').filter((char: string) => {
              const code = char.charCodeAt(0);
              return code >= 32 || code === 9 || code === 10 || code === 13;
            }).join('');
            
            return `"${key}": "${fixedValue}"`;
          }
        );
        
        console.log(`[${functionVersion}] Cleaned JSON (first 400 chars): ${cleanedContent.substring(0, 400)}`);
        parsedResponse = JSON.parse(cleanedContent);
        console.log(`[${functionVersion}] Options JSON parsed successfully with aggressive cleaning`);
      } catch (fallbackError) {
        const fallbackMsg = asError(fallbackError).message;
        console.error(`[${functionVersion}] Aggressive cleaning parsing also failed${userId ? ` (User: ${userId})` : ''}: ${fallbackMsg}`);
        console.error(`[${functionVersion}] Raw response that failed${userId ? ` (User: ${userId})` : ''}: ${aiResponseContent}`);
        throw new Error(`No se pudo parsear la respuesta JSON de opciones: ${errorMsg}`);
      }
    }

    if (isValidOptionsResponse(parsedResponse)) {
      console.log(`[${functionVersion}] Opciones JSON parseadas y validadas:`, parsedResponse.options);
      return parsedResponse; // Return the whole object: { options: [...] }
    }
    console.error(`[${functionVersion}] Formato de opciones inválido después de parsear. Data:`, parsedResponse);
    throw new Error("Formato de opciones inválido después de parsear el JSON de la IA.");

  } catch (error: unknown) {
    const normalizedError = asError(error);
    console.error(
      `[${functionVersion}] Error procesando la respuesta de la IA para las opciones: ${normalizedError.message}. Raw response: ${aiResponseContent?.substring(0, 500)}`,
      normalizedError,
    );
    // Fallback
    const defaultOptions: AiContinuationOption[] = [
      { summary: language.startsWith('en') ? "Continue the adventure" : "Continuar la aventura" },
      { summary: language.startsWith('en') ? "Explore something new" : "Explorar algo nuevo" },
      { summary: language.startsWith('en') ? "Meet a new friend" : "Encontrar un amigo" }
    ].map((opt): AiContinuationOption => ({
      summary: `${opt.summary} (${language.startsWith('en') ? 'default option' : 'opción por defecto'})`
    }));
    return { options: defaultOptions };
  }
}

// cleanExtractedText: Se mantiene, ya que procesa strings provenientes de la IA (dentro del JSON).
function cleanExtractedText(text: string | undefined | null, type: 'title' | 'content'): string {
  const defaultText = type === 'title' ? `Un Nuevo Capítulo` : 'La historia continúa de forma misteriosa...';
  if (text === null || text === undefined || typeof text !== 'string') { // Allow empty string from AI, will return default
    console.warn(`[${functionVersion}] cleanExtractedText (${type}): Input null, undefined, or not a string.`);
    return defaultText;
  }
  // No console.log BEFORE for potentially very long content strings.
  let cleaned = text;
  // Markdown fences around the *whole string* should not happen with response_format: json_object,
  // but if AI puts them *inside* a JSON string value, this might be useful.
  // However, the primary instruction is AI should not use markdown *inside* string values unless natural.
  // cleaned = cleaned.replace(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/gm, '$1').trim(); // Less likely needed now

  cleaned = cleaned.trim(); // Trim first
  cleaned = cleaned.replace(/^(Título|Title|Contenido|Content|Respuesta|Response):\s*/i, '').trim();
  cleaned = cleaned.replace(/^(Aquí tienes el (título|contenido|cuento|capítulo)|Claro, aquí está el (título|contenido|cuento|capítulo)):\s*/i, '').trim();
  cleaned = cleaned.replace(/\n\n\(Espero que te guste.*$/i, '').trim();
  cleaned = cleaned.replace(/\n\n\[.*?\]$/i, '').trim();

  if (type === 'content') {
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');
    cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '');
  }
  if (type === 'title') {
    cleaned = cleaned.replace(/^["'“‘](.*)["'”’]$/s, '$1').trim();
  }
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  // console.log(`[${functionVersion}] cleanExtractedText (${type}) - AFTER: "${cleaned.substring(0, 150)}..."`);
  return cleaned.trim() || defaultText; // Ensure it returns default if cleaning results in empty
}
// --- Fin Funciones Helper ---

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método no permitido. Usar POST.' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let requestedAction = 'unknown';
  let userId: string | null = null;

  try {
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

    let body: ContinuationRequestBody;
    try {
      const parsedBody = await req.json() as unknown;
      if (!parsedBody || typeof parsedBody !== 'object') throw new Error("Parsed body is not an object.");
      body = parsedBody as ContinuationRequestBody;
    } catch (error: unknown) {
      const parseError = asError(error);
      console.error(`[${functionVersion}] Failed to parse JSON body for user ${userId}. Error:`, parseError);
      throw new Error(`Invalid/empty JSON in body: ${parseError.message}.`);
    }

    const rawAction = body.action;
    if (typeof rawAction !== 'string' || !rawAction.trim()) {
      throw new Error("'action' es requerida.");
    }
    const action = rawAction;
    requestedAction = action;

    const story = body.story;
    const rawChapters = body.chapters;
    if (rawChapters !== undefined && !Array.isArray(rawChapters)) {
      throw new Error(`Array 'chapters' requerido (puede ser vacío) para la acción '${action}'.`);
    }
    const chapters = (Array.isArray(rawChapters) ? rawChapters : []) as Chapter[];
    const { selectedOptionSummary, userDirection } = body;

    const isContinuationAction = isContinuationActionType(action);
    const requiresStoryForContext = isContinuationAction || action === 'generateOptions';

    // Validaciones de entrada (largely same as v6.1)
    let validatedStory: Story | undefined;
    if (requiresStoryForContext) {
      if (!story || typeof story !== 'object' || typeof story.id !== 'string') {
        throw new Error(`Objeto 'story' (con 'id') inválido/ausente para la acción '${action}'.`);
      }
      validatedStory = story;
      const hasCharacterData = (story.options.characters && story.options.characters.length > 0) || (story.options as { character?: { name?: string } }).character?.name;
      const hasContent = typeof story.content === 'string' && story.content.trim() !== '';
      const hasTitle = typeof story.title === 'string' && story.title.trim() !== '';
      // Validate story has required content and at least one character
      if (!hasContent || !story.options || !hasCharacterData || !hasTitle) {
        console.error("Story validation failed:", {
          hasContent,
          hasOptions: !!story.options,
          hasCharacterData,
          hasTitle,
          charactersCount: story.options.characters?.length || 0,
          primaryCharacterName: story.options.characters?.[0]?.name
        });
        throw new Error("Datos incompletos en el objeto 'story' recibido (content, options con al menos un personaje, title son necesarios).");
      }
    }
    if (action === 'optionContinuation' && (typeof selectedOptionSummary !== 'string' || !selectedOptionSummary.trim())) {
      throw new Error("'selectedOptionSummary' (string no vacío) requerido para 'optionContinuation'.");
    }
    if (action === 'directedContinuation' && (typeof userDirection !== 'string' || !userDirection.trim())) {
      throw new Error("'userDirection' (string no vacío) requerido para 'directedContinuation'.");
    }

    const baseStoryOptions = validatedStory?.options ?? story?.options;
    const language = typeof body.language === 'string' && body.language.trim().length > 0
      ? body.language
      : (baseStoryOptions?.language ?? 'Español');
    const childAge = typeof body.childAge === 'number' ? body.childAge : baseStoryOptions?.childAge || 7;
    const specialNeed = typeof body.specialNeed === 'string' && body.specialNeed.trim().length > 0
      ? body.specialNeed
      : (baseStoryOptions?.specialNeed ?? 'Ninguna');
    const storyDuration = typeof body.storyDuration === 'string' && body.storyDuration.trim().length > 0
      ? body.storyDuration
      : (baseStoryOptions?.duration ?? 'medium');
    const storyId = validatedStory?.id;

    // Límites (largely same logic as v6.1)
    if (isContinuationAction) {
      if (!storyId) {
        throw new Error("Historia inválida para verificar límites de continuación.");
      }
      const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('subscription_status').eq('id', userId).maybeSingle();
      if (profileError) throw new Error("Error al verificar el perfil de usuario para límites.");

      const isPremium = profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
      if (!isPremium) {
        const { count: chapterCount, error: countError } = await supabaseAdmin.from('story_chapters')
          .select('*', { count: 'exact', head: true })
          .eq('story_id', storyId);
        if (countError) throw new Error("Error al verificar límites de continuación.");

        const FREE_CHAPTER_LIMIT = 2; // Límite de capítulos *adicionales* generables (no se si el capitulo 0 lo cuenta)
        if (chapterCount !== null && chapterCount >= FREE_CHAPTER_LIMIT) {
          return new Response(JSON.stringify({ error: 'Límite de continuaciones gratuitas alcanzado.' }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
    }

    // --- Ejecutar Acción Principal ---
    let responsePayload: ContinuationResponsePayload;
    console.log(`[${functionVersion}] Executing action: ${action} for user ${userId}, story ${storyId || 'N/A'}`);

    if (action === 'generateOptions') {
      if (!validatedStory) {
        throw new Error("Historia inválida para generar opciones de continuación.");
      }
      const optionsResponse = await generateContinuationOptions(validatedStory, chapters, language, childAge, specialNeed, userId || undefined);
      responsePayload = optionsResponse;
    } else if (isContinuationActionType(action)) {
      if (!validatedStory) {
        throw new Error("Historia inválida para generar una continuación.");
      }
      const continuationContext: ContinuationContextType = {};
      if (action === 'optionContinuation') continuationContext.optionSummary = selectedOptionSummary;
      if (action === 'directedContinuation') continuationContext.userDirection = userDirection;

      const continuationPrompt = createContinuationPrompt(
        action,
        validatedStory,
        chapters,
        continuationContext,
        language,
        childAge,
        specialNeed,
        storyDuration
      );

      console.log(`[${functionVersion}] Calling AI for continuation. Prompt start: ${continuationPrompt.substring(0, 200)}...`);

      const chatCompletion = await openai.chat.completions.create({
        model: TEXT_MODEL_GENERATE,
        messages: [{ role: "user", content: continuationPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.8, // from v6.1
        top_p: 0.95,      // from v6.1
        max_tokens: 8192  // from v6.1
      });

      const aiResponseContent = chatCompletion.choices[0]?.message?.content;
      const finishReason = chatCompletion.choices[0]?.finish_reason;
      console.log(`[${functionVersion}] Raw AI JSON for continuation (first 200 chars): ${aiResponseContent?.substring(0, 200) || '(No content received)'}... Finish Reason: ${finishReason}`);

      if (finishReason === 'content_filter') {
        console.error(`[${functionVersion}] AI Continuation Generation BLOCKED due to content filter.`);
        throw new Error(`Generación de continuación bloqueada por seguridad: filtro de contenido.`);
      }
      if (finishReason === 'length') {
        console.warn(`[${functionVersion}] AI continuation generation may have been truncated.`);
      }
      if (!aiResponseContent) {
        throw new Error("Fallo al generar continuación: Respuesta IA vacía (sin bloqueo explícito).");
      }

      let finalTitle = 'Un Nuevo Capítulo'; // Default
      let finalContent = '';
      let parsedSuccessfully = false;

      try {
        // First try: Normal JSON parsing
        const parsedResponse = JSON.parse(aiResponseContent);
        if (isValidContinuationResponse(parsedResponse)) {
          finalTitle = cleanExtractedText(parsedResponse.title, 'title');
          finalContent = cleanExtractedText(parsedResponse.content, 'content');
          parsedSuccessfully = true;
          console.log(`[${functionVersion}] Parsed AI continuation JSON successfully on first try.`);
        } else {
          console.warn(`[${functionVersion}] AI continuation response JSON structure invalid. Data:`, parsedResponse);
        }
      } catch (parseError) {
        const errorObj = asError(parseError);
        const errorMsg = errorObj.message;
        console.error(`[${functionVersion}] Failed to parse JSON from AI continuation response${userId ? ` (User: ${userId})` : ''}. Error: ${errorMsg}. Trying aggressive cleaning...`);
        console.log(`[${functionVersion}] Problematic continuation JSON (first 500 chars): ${aiResponseContent.substring(0, 500)}`);
        
        // Fallback 1: More aggressive cleaning of control characters within JSON string values
        try {
          let cleanedContent = aiResponseContent;
          
          // Fix unescaped control characters within JSON string values
          cleanedContent = cleanedContent.replace(
            /"(title|content)"\s*:\s*"((?:[^"\\]|\\.)*)"/gs,
            (_match: string, key: string, value: string) => {
              // Fix unescaped control characters
              let fixedValue = value
                .replace(/\r\n/g, '\\n')  // Windows line endings
                .replace(/\n/g, '\\n')     // Unix line endings
                .replace(/\r/g, '\\r')     // Mac line endings
                .replace(/\t/g, '\\t');    // Tabs
              
              // Remove other control characters
              fixedValue = fixedValue.split('').filter((char: string) => {
                const code = char.charCodeAt(0);
                return code >= 32 || code === 9 || code === 10 || code === 13;
              }).join('');
              
              return `"${key}": "${fixedValue}"`;
            }
          );
          
          console.log(`[${functionVersion}] Cleaned continuation JSON (first 400 chars): ${cleanedContent.substring(0, 400)}`);
          
          const parsedResponse = JSON.parse(cleanedContent);
          if (isValidContinuationResponse(parsedResponse)) {
            finalTitle = cleanExtractedText(parsedResponse.title, 'title');
            finalContent = cleanExtractedText(parsedResponse.content, 'content');
            parsedSuccessfully = true;
            console.log(`[${functionVersion}] Parsed AI continuation JSON successfully with aggressive cleaning.`);
          }
        } catch (fallbackError) {
          const fallbackMsg = asError(fallbackError).message;
          console.error(`[${functionVersion}] Aggressive cleaning parsing also failed${userId ? ` (User: ${userId})` : ''}: ${fallbackMsg}`);
          
          // Fallback 2: Manual extraction using more robust regex
          try {
            console.log(`[${functionVersion}] Attempting manual extraction with regex${userId ? ` (User: ${userId})` : ''}...`);
            
            // Extract title and content with better regex
            const titleMatch = aiResponseContent.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
            const contentMatch = aiResponseContent.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s);
            
            if (titleMatch && contentMatch) {
              const rawTitle = titleMatch[1];
              const rawContent = contentMatch[1];
              
              // Decode escaped sequences
              finalTitle = cleanExtractedText(
                rawTitle
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\'),
                'title'
              );
              
              finalContent = cleanExtractedText(
                rawContent
                  .replace(/\\n/g, '\n')
                  .replace(/\\r/g, '\r')
                  .replace(/\\t/g, '\t')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\'),
                'content'
              );
              
              parsedSuccessfully = true;
              console.log(`[${functionVersion}] Extracted continuation content using robust regex. Title: "${finalTitle.substring(0, 50)}..."`);
            } else {
              console.warn(`[${functionVersion}] Regex extraction failed${userId ? ` (User: ${userId})` : ''}. TitleMatch: ${!!titleMatch}, ContentMatch: ${!!contentMatch}`);
              console.error(`[${functionVersion}] Raw response that failed all parsing attempts${userId ? ` (User: ${userId})` : ''}: ${aiResponseContent}`);
            }
          } catch (regexError) {
            const regexMsg = asError(regexError).message;
            console.error(`[${functionVersion}] Regex extraction also failed${userId ? ` (User: ${userId})` : ''}: ${regexMsg}`);
            console.error(`[${functionVersion}] Complete raw response${userId ? ` (User: ${userId})` : ''}: ${aiResponseContent}`);
          }
        }
      }

      if (!parsedSuccessfully) {
        console.warn(`[${functionVersion}] Using fallback for continuation: Default title, full raw response as content (if available).`);
        finalContent = cleanExtractedText(aiResponseContent, 'content'); // aiResponseContent might be the non-JSON string
      }

      if (!finalContent) { // If content is still empty after parsing/fallback and cleaning
        console.error(`[${functionVersion}] Critical error: Final continuation content is empty after all processing.`);
        finalContent = "La historia no pudo continuar esta vez. Intenta con otra opción o una nueva dirección.";
        // Optionally throw, but providing a message might be better UX for continuations
      }

      console.log(`[${functionVersion}] Final Title: "${finalTitle}", Final Content Length: ${finalContent.length}`);
      responsePayload = { content: finalContent, title: finalTitle };

    } else {
      throw new Error(`Acción no soportada: ${action}`);
    }

    console.log(`[${functionVersion}] Action ${action} completed successfully for ${userId}.`);
    return new Response(JSON.stringify(responsePayload), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const normalizedError = asError(error);
    console.error(`Error in ${functionVersion} (User: ${userId || 'UNKNOWN'}, Action: ${requestedAction}):`, normalizedError.message, normalizedError.stack);
    let statusCode = 500;
    const lowerMessage = normalizedError.message.toLowerCase();

    if (lowerMessage.includes("token inválido") || lowerMessage.includes("no autenticado")) statusCode = 401;
    else if (lowerMessage.includes("límite de continuaciones")) statusCode = 403;
    else if (lowerMessage.includes("json in body") || lowerMessage.includes("inválido/ausente") || lowerMessage.includes("requerido")) statusCode = 400;
    else if (lowerMessage.includes("bloqueada por seguridad") || lowerMessage.includes("respuesta ia vacía") || lowerMessage.includes("filtro de contenido")) statusCode = 502;
    else if (lowerMessage.includes("acción no soportada")) statusCode = 400;

    return new Response(JSON.stringify({ error: `Error procesando solicitud (${requestedAction}): ${normalizedError.message}` }), {
      status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
