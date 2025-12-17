// supabase/functions/generate-story/index.ts
// v7.0 (OpenAI Client + JSON Output): Uses OpenAI client for Gemini, expects JSON.
// IMPORTANT: prompt.ts has been updated to instruct AI for JSON output.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import OpenAI from "npm:openai@^4.33.0"; // Using OpenAI client

// Importar funciones de prompt desde prompt.ts
// createUserPrompt_JsonFormat (antes createUserPrompt_SeparatorFormat) ahora genera un prompt que pide JSON.
import { createSystemPrompt, createUserPrompt_JsonFormat } from "./prompt.ts";

// --- Helper Function (remains largely the same, adapted for potentially cleaner inputs from JSON) ---
function cleanExtractedText(
  text: string | undefined | null,
  type: "title" | "content",
): string {
  const defaultText = type === "title"
    ? `Aventura Inolvidable`
    : "El cuento tiene un giro inesperado...";
  if (text === null || text === undefined || typeof text !== "string") {
    console.warn(
      `[Helper v7.0] cleanExtractedText (${type}): Input empty/not string.`,
    );
    return defaultText;
  }
  console.log(
    `[Helper v7.0] cleanExtractedText (${type}) - BEFORE: "${
      text.substring(0, 150)
    }..."`,
  );
  let cleaned = text.trim();

  // These might be less necessary if AI strictly adheres to JSON values, but good for robustness
  cleaned = cleaned.replace(/^Título:\s*/i, "").trim();
  cleaned = cleaned.replace(/^Contenido:\s*/i, "").trim();
  if (type === "content") {
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, ""); // Eliminar numeración de listas
    cleaned = cleaned.replace(/^\s*[-*]\s+/gm, ""); // Eliminar viñetas de listas
  }
  if (type === "title") {
    cleaned = cleaned.replace(/^["'"'](.*)["'"']$/s, "$1").trim(); // Quitar comillas alrededor del título
  }
  cleaned = cleaned.replace(
    /^(Respuesta|Aquí tienes el título|El título es):\s*/i,
    "",
  ).trim();
  cleaned = cleaned.replace(/^(Aquí tienes el cuento|El cuento es):\s*/i, "")
    .trim();

  console.log(
    `[Helper v7.0] cleanExtractedText (${type}) - AFTER: "${
      cleaned.substring(0, 150)
    }..."`,
  );
  return cleaned || defaultText; // Ensure non-empty string or default
}

// --- Interfaces for Request Parameters ---
interface StoryCharacter {
  name: string;
  [key: string]: unknown;
}

interface StoryOptionsInput {
  characters?: StoryCharacter[];
  character?: StoryCharacter;
  genre?: string;
  moral?: string;
  duration?: string;
  language?: string;
  [key: string]: unknown;
}

interface GenerateStoryRequestBody {
  language?: string;
  childAge?: number;
  specialNeed?: string;
  options?: StoryOptionsInput;
  additionalDetails?: string;
  [key: string]: unknown;
}

// --- Interface for Structured AI Response ---
interface StoryGenerationResult {
  title: string;
  content: string;
  scenes: {
    character: string;
    cover: string;
    scene_1: string;
    scene_2: string;
    scene_3: string;
    scene_4: string;
    closing: string;
  };
}

function isValidStoryResult(data: unknown): data is StoryGenerationResult {
  const record = data as Record<string, unknown>;
  return !!data &&
    typeof record.title === "string" &&
    typeof record.content === "string" &&
    !!record.scenes &&
    typeof record.scenes === "object" &&
    typeof (record.scenes as Record<string, unknown>).character === "string" &&
    typeof (record.scenes as Record<string, unknown>).cover === "string" &&
    typeof (record.scenes as Record<string, unknown>).scene_1 === "string" &&
    typeof (record.scenes as Record<string, unknown>).scene_2 === "string" &&
    typeof (record.scenes as Record<string, unknown>).scene_3 === "string" &&
    typeof (record.scenes as Record<string, unknown>).scene_4 === "string" &&
    typeof (record.scenes as Record<string, unknown>).closing === "string";
}

function pickRequestHeaders(
  headers: Headers,
  keys: string[],
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of keys) {
    const value = headers.get(key);
    if (value) result[key] = value;
  }
  return result;
}

function normalizeHeaderRecord(input: unknown): Record<string, string> {
  if (!input) return {};
  if (input instanceof Headers) {
    const out: Record<string, string> = {};
    for (const [k, v] of input.entries()) out[k] = v;
    return out;
  }
  if (typeof input === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v === "string") out[k] = v;
      else if (v != null) out[k] = String(v);
    }
    return out;
  }
  return { value: String(input) };
}

// --- Main Handler ---
serve(async (req: Request) => {
  const functionVersion = "v7.0 (OpenAI Client + JSON)";
  const requestId = crypto.randomUUID();
  const requestStartMs = Date.now();
  const requestUrl = new URL(req.url);
  console.log(
    `[${functionVersion}] Request start. reqId=${requestId} method=${req.method} path=${requestUrl.pathname}`,
  );
  console.log(
    `[${functionVersion}] Request headers (selected). reqId=${requestId}`,
    pickRequestHeaders(req.headers, [
      "x-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip",
      "cf-ipcountry",
      "cf-ray",
      "user-agent",
      "origin",
      "referer",
    ]),
  );
  // 1. MANEJAR PREFLIGHT PRIMERO
  if (req.method === "OPTIONS") {
    console.log(
      `[${functionVersion}] Handling OPTIONS preflight request... reqId=${requestId}`,
    );
    return new Response("ok", { headers: corsHeaders });
  }

  // --- Configuración ---
  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  const GEMINI_COMPATIBLE_ENDPOINT =
    Deno.env.get("GEMINI_COMPATIBLE_ENDPOINT") ||
    "https://generativelanguage.googleapis.com/v1beta/openai/";
  const TEXT_MODEL_GENERATE = Deno.env.get("TEXT_MODEL_GENERATE") || 'gemini-2.0-flash'; // Model name for Gemini via OpenAI endpoint

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable not set");
  }
  if (!GEMINI_COMPATIBLE_ENDPOINT) {
    throw new Error(
      "GEMINI_COMPATIBLE_ENDPOINT environment variable not set and no fallback could be used",
    );
  }
  if (!TEXT_MODEL_GENERATE) {
    throw new Error(
      "TEXT_MODEL_GENERATE environment variable not set for OpenAI client.",
    );
  }

  // --- Initialize OpenAI Client for Gemini ---
  const openai = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: GEMINI_COMPATIBLE_ENDPOINT.endsWith("/")
      ? GEMINI_COMPATIBLE_ENDPOINT
      : GEMINI_COMPATIBLE_ENDPOINT + "/",
  });
  console.log(
    `[${functionVersion}] OpenAI client configured. reqId=${requestId} model='${TEXT_MODEL_GENERATE}' baseURL=${openai.baseURL}`,
  );

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const APP_SERVICE_ROLE_KEY = Deno.env.get("APP_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !APP_SERVICE_ROLE_KEY) {
    console.error("Supabase URL or Service Role Key not set");
    throw new Error("Supabase URL or Service Role Key not set");
  }
  const supabaseAdmin = createClient(SUPABASE_URL, APP_SERVICE_ROLE_KEY);

  // 2. Verificar Método POST
  if (req.method !== "POST") {
    console.log(`[${functionVersion}] Method ${req.method} not allowed.`);
    return new Response(
      JSON.stringify({ error: "Método no permitido. Usar POST." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let userId: string | null = null;
  let userIdForIncrement: string | null = null;

  try {
    // 3. AUTENTICACIÓN
    console.log(
      `[${functionVersion}] Handling POST request... reqId=${requestId}`,
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Authorization header missing or invalid.");
      return new Response(
        JSON.stringify({ error: "Token inválido o ausente." }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth
      .getUser(token);

    if (authError || !user) {
      console.error("Auth Error:", authError);
      return new Response(
        JSON.stringify({ error: authError?.message || "No autenticado." }),
        {
          status: authError?.status || 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    userId = user.id;
    console.log(
      `[${functionVersion}] User Auth. reqId=${requestId} userId=${userId}`,
    );

    // 4. Perfil y Límites
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status, monthly_stories_generated")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.error(`Error fetching profile for ${userId}:`, profileError);
      throw new Error(
        `Error al obtener perfil de usuario: ${profileError.message}`,
      );
    }

    let isPremiumUser = false;
    if (profile) {
      isPremiumUser = profile.subscription_status === "active" ||
        profile.subscription_status === "trialing";
    } else {
      console.warn(
        `Perfil no encontrado para ${userId}. Tratando como gratuito.`,
      );
    }

    const currentStoriesGenerated = profile?.monthly_stories_generated ?? 0;
    const FREE_STORY_LIMIT = 10;

    if (!isPremiumUser) {
      userIdForIncrement = userId;
      console.log(
        `[${functionVersion}] Free user ${userId}. Stories: ${currentStoriesGenerated}/${FREE_STORY_LIMIT}`,
      );
      if (currentStoriesGenerated >= FREE_STORY_LIMIT) {
        return new Response(
          JSON.stringify({
            error: `Límite mensual (${FREE_STORY_LIMIT}) alcanzado.`,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else {
      console.log(`[${functionVersion}] Premium user ${userId}.`);
    }

    // 5. Body y Validación
    let params: GenerateStoryRequestBody;
    try {
      params = await req.json();
      console.log(
        `[${functionVersion}] Params Recibidos. reqId=${requestId}`,
        JSON.stringify(params, null, 2),
      );
      console.log(`[${functionVersion}] Validando estructura básica...`);
      console.log(
        `[${functionVersion}] params.language:`,
        params.language,
        typeof params.language,
      );
      console.log(
        `[${functionVersion}] params.childAge:`,
        params.childAge,
        typeof params.childAge,
      );
      console.log(`[${functionVersion}] params.options:`, params.options);
      if (params.options) {
        console.log(
          `[${functionVersion}] params.options.duration:`,
          params.options.duration,
          typeof params.options.duration,
        );
        console.log(
          `[${functionVersion}] params.options.genre:`,
          params.options.genre,
          typeof params.options.genre,
        );
        console.log(
          `[${functionVersion}] params.options.moral:`,
          params.options.moral,
          typeof params.options.moral,
        );
        console.log(
          `[${functionVersion}] params.options.characters:`,
          params.options.characters,
        );
        console.log(
          `[${functionVersion}] params.options.character:`,
          params.options.character,
        );
      }

      // More detailed validation with debugging
      console.log(`[${functionVersion}] Starting detailed validation...`);

      if (!params) {
        console.error("[VALIDATION ERROR] params is null/undefined");
        throw new Error("Parámetros inválidos: datos no recibidos.");
      }

      if (typeof params !== "object") {
        console.error(
          "[VALIDATION ERROR] params is not an object:",
          typeof params,
        );
        throw new Error("Parámetros inválidos: formato incorrecto.");
      }

      if (!params.options) {
        console.error("[VALIDATION ERROR] params.options is missing");
        throw new Error("Parámetros inválidos: falta 'options'.");
      }

      if (typeof params.options !== "object") {
        console.error(
          "[VALIDATION ERROR] params.options is not an object:",
          typeof params.options,
        );
        throw new Error("Parámetros inválidos: 'options' debe ser un objeto.");
      }

      // Validate individual fields with more detailed error messages
      const errors = [];

      if (typeof params.language !== "string" || !params.language) {
        errors.push("language debe ser un string no vacío");
        console.error(
          "[VALIDATION ERROR] language:",
          params.language,
          typeof params.language,
        );
      }

      if (params.childAge === undefined) {
        errors.push("childAge es requerido");
        console.error("[VALIDATION ERROR] childAge:", params.childAge);
      }

      if (
        typeof params.options.duration !== "string" || !params.options.duration
      ) {
        errors.push("options.duration debe ser un string no vacío");
        console.error(
          "[VALIDATION ERROR] duration:",
          params.options.duration,
          typeof params.options.duration,
        );
      }

      if (typeof params.options.genre !== "string" || !params.options.genre) {
        errors.push("options.genre debe ser un string no vacío");
        console.error(
          "[VALIDATION ERROR] genre:",
          params.options.genre,
          typeof params.options.genre,
        );
      }

      if (typeof params.options.moral !== "string" || !params.options.moral) {
        errors.push("options.moral debe ser un string no vacío");
        console.error(
          "[VALIDATION ERROR] moral:",
          params.options.moral,
          typeof params.options.moral,
        );
      }

      if (errors.length > 0) {
        console.error("[VALIDATION ERROR] Basic validation failed:", errors);
        throw new Error(`Parámetros básicos inválidos: ${errors.join(", ")}.`);
      }

      console.log(
        `[${functionVersion}] Basic validation passed! reqId=${requestId}`,
      );

      // Validate character data - support both legacy (character) and new (characters) formats
      const hasMultipleCharacters = params.options.characters &&
        Array.isArray(params.options.characters) &&
        params.options.characters.length > 0;
      const hasSingleCharacter = params.options.character &&
        typeof params.options.character === "object" &&
        params.options.character.name;

      if (!hasMultipleCharacters && !hasSingleCharacter) {
        console.error("Validation failed. No valid character data found:", {
          hasCharacters: !!params.options.characters,
          charactersIsArray: Array.isArray(params.options.characters),
          charactersLength: params.options.characters?.length,
          hasCharacter: !!params.options.character,
          hasCharacterName: !!params.options.character?.name,
        });
        throw new Error(
          "Se requiere al menos un personaje válido (options.character.name o options.characters[] con al menos un elemento).",
        );
      }

      // Normalize to characters array for internal processing
      let charactersArray: StoryCharacter[];
      if (hasMultipleCharacters && params.options?.characters) {
        charactersArray = params.options.characters;
        console.log(
          `[${functionVersion}] Multiple characters mode. reqId=${requestId} count=${charactersArray.length}`,
        );
      } else if (params.options?.character) {
        charactersArray = [params.options.character];
        console.log(
          `[${functionVersion}] Single character mode (legacy). reqId=${requestId} name=${params.options.character.name}`,
        );
      } else {
        throw new Error("No se pudo normalizar el array de personajes.");
      }

      // Validate characters array (1-4 characters)
      if (charactersArray.length > 4) {
        throw new Error("Máximo 4 personajes permitidos por historia.");
      }

      const invalidCharacters = charactersArray.filter((char) =>
        !char || !char.name || typeof char.name !== "string"
      );

      if (invalidCharacters.length > 0) {
        console.error(
          "Validation failed. Invalid characters found:",
          invalidCharacters,
        );
        throw new Error("Todos los personajes deben tener un nombre válido.");
      }

      console.log(
        `[${functionVersion}] Characters validated. reqId=${requestId} names=${
          charactersArray.map((c) => c.name).join(", ")
        }`,
      );

      // Store normalized characters array for use in prompts
      if (params.options) {
        params.options.characters = charactersArray;
      }
    } catch (error) {
      console.error(
        `[${functionVersion}] Failed to parse/validate JSON body. reqId=${requestId} userId=${userId}. Error:`,
        error,
      );
      const message = error instanceof Error
        ? error.message
        : "Error desconocido al procesar JSON.";
      throw new Error(`Invalid/empty/incomplete JSON in body: ${message}.`);
    }

    // 6. Generación IA con OpenAI Client y Esperando JSON
    const systemPrompt = createSystemPrompt(
      params.language || "Español",
      params.childAge,
      params.specialNeed,
    );
    const userPrompt = createUserPrompt_JsonFormat({ // Esta función ahora genera un prompt pidiendo JSON
      // Type assertion: we've validated the structure above
      options: params.options as unknown as {
        characters: { name: string }[];
        genre: string;
        moral: string;
        duration?: string;
      },
      additionalDetails: params.additionalDetails,
    });
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

    console.log(
      `[${functionVersion}] Calling AI. reqId=${requestId} userId=${userId} model=${TEXT_MODEL_GENERATE} promptLength=${combinedPrompt.length}`,
    );
    const aiStartMs = Date.now();

    let chatCompletion;
    try {
      chatCompletion = await openai.chat.completions.create({
        model: TEXT_MODEL_GENERATE,
        messages: [{ role: "user", content: combinedPrompt }],
        response_format: { type: "json_object" }, // Request JSON output
        temperature: 0.8, // From original generationConfig
        top_p: 0.95, // From original generationConfig
        max_tokens: 20000, // Increased to accommodate scenes generation
      });
    } catch (upstreamError) {
      const err = upstreamError as unknown as {
        status?: number;
        message?: string;
        headers?: unknown;
        request_id?: string;
      };
      const upstreamHeaders = normalizeHeaderRecord(err?.headers);
      console.error(
        `[${functionVersion}] Upstream AI error. reqId=${requestId} userId=${userId} status=${
          err?.status ?? "unknown"
        } request_id=${err?.request_id ?? "unknown"}`,
      );
      console.error(
        `[${functionVersion}] Upstream AI error headers (selected). reqId=${requestId}`,
        {
          "retry-after": upstreamHeaders["retry-after"],
          "x-request-id": upstreamHeaders["x-request-id"],
          "x-ratelimit-limit-requests":
            upstreamHeaders["x-ratelimit-limit-requests"],
          "x-ratelimit-remaining-requests":
            upstreamHeaders["x-ratelimit-remaining-requests"],
          "x-ratelimit-reset-requests":
            upstreamHeaders["x-ratelimit-reset-requests"],
          "x-ratelimit-limit-tokens":
            upstreamHeaders["x-ratelimit-limit-tokens"],
          "x-ratelimit-remaining-tokens":
            upstreamHeaders["x-ratelimit-remaining-tokens"],
          "x-ratelimit-reset-tokens":
            upstreamHeaders["x-ratelimit-reset-tokens"],
        },
      );
      console.error(
        `[${functionVersion}] Upstream AI error message. reqId=${requestId}`,
        err?.message ?? upstreamError,
      );
      throw upstreamError;
    } finally {
      console.log(
        `[${functionVersion}] AI call finished. reqId=${requestId} durationMs=${
          Date.now() - aiStartMs
        }`,
      );
    }

    const aiResponseContent = chatCompletion.choices[0]?.message?.content;
    const finishReason = chatCompletion.choices[0]?.finish_reason;

    console.log(
      `[${functionVersion}] Raw AI JSON response. reqId=${requestId} first200=${
        aiResponseContent?.substring(0, 200) || "(No text received)"
      }... finishReason=${finishReason}`,
    );

    if (finishReason === "length") {
      console.warn(
        `[${functionVersion}] AI generation may have been truncated due to 'length' finish_reason.`,
      );
    }
    // Nota: blockReason específico como en GoogleGenerativeAI no está directamente disponible.
    // Se confía en finish_reason o contenido vacío para problemas.

    // 7. Procesar Respuesta JSON de la IA
    let finalTitle = "Aventura Inolvidable"; // Default
    let finalContent = ""; // Default
    let finalScenes: StoryGenerationResult["scenes"] | null = null; // Nuevo
    let parsedSuccessfully = false;

    if (aiResponseContent) {
      try {
        // First try: Normal JSON parsing
        const storyResult: StoryGenerationResult = JSON.parse(
          aiResponseContent,
        );
        if (isValidStoryResult(storyResult)) {
          finalTitle = cleanExtractedText(storyResult.title, "title");
          finalContent = cleanExtractedText(storyResult.content, "content");
          finalScenes = storyResult.scenes; // Guardar scenes
          parsedSuccessfully = true;
          console.log(
            `[${functionVersion}] Parsed AI JSON successfully. Title: "${finalTitle}"`,
          );
          console.log(
            `[${functionVersion}] Scenes validated: ${
              Object.keys(storyResult.scenes).length
            } keys`,
          );
        } else {
          console.warn(
            `[${functionVersion}] AI response JSON structure is invalid. Received: ${
              aiResponseContent.substring(0, 500)
            }...`,
          );
        }
      } catch (parseError) {
        const errorMsg = parseError instanceof Error
          ? parseError.message
          : "Unknown error";
        console.error(
          `[${functionVersion}] Failed to parse JSON from AI response (User: ${userId}). Error: ${errorMsg}. Trying fallback parsing...`,
        );
        console.log(
          `[${functionVersion}] Problematic JSON (User: ${userId}, first 500 chars): ${
            aiResponseContent.substring(0, 500)
          }`,
        );

        // Fallback 1: More aggressive cleaning of control characters
        try {
          console.log(
            `[${functionVersion}] Attempting aggressive control character cleaning (User: ${userId})...`,
          );

          // Strategy: Fix control characters that are problematic in JSON strings
          // We need to be inside string values to escape them properly
          let cleanedContent = aiResponseContent;

          // First, handle common cases of unescaped newlines and tabs within JSON string values
          // Look for patterns like: "key": "value with\nnewline"
          cleanedContent = cleanedContent.replace(
            /"(title|content)"\s*:\s*"((?:[^"\\]|\\.)*)"/gs,
            (_match, key, value) => {
              // Fix unescaped control characters within the string value
              const fixedValue = value
                .replace(/\r\n/g, "\\n") // Windows line endings
                .replace(/\n/g, "\\n") // Unix line endings
                .replace(/\r/g, "\\r") // Mac line endings
                .replace(/\t/g, "\\t") // Tabs
                // eslint-disable-next-line no-control-regex
                .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ""); // Remove other control chars
              return `"${key}": "${fixedValue}"`;
            },
          );

          console.log(
            `[${functionVersion}] Cleaned content (first 400 chars): ${
              cleanedContent.substring(0, 400)
            }...`,
          );

          const storyResult: StoryGenerationResult = JSON.parse(cleanedContent);
          if (isValidStoryResult(storyResult)) {
            finalTitle = cleanExtractedText(storyResult.title, "title");
            finalContent = cleanExtractedText(storyResult.content, "content");
            finalScenes = storyResult.scenes; // Guardar scenes
            parsedSuccessfully = true;
            console.log(
              `[${functionVersion}] Parsed AI JSON successfully with aggressive cleaning. Title: "${finalTitle}"`,
            );
          }
        } catch (fallbackError) {
          const fallbackMsg = fallbackError instanceof Error
            ? fallbackError.message
            : "Unknown error";
          console.error(
            `[${functionVersion}] Aggressive cleaning parsing also failed (User: ${userId}): ${fallbackMsg}`,
          );

          // Fallback 2: Manual extraction using more robust regex
          try {
            console.log(
              `[${functionVersion}] Attempting manual extraction with regex (User: ${userId})...`,
            );

            // Extract title - handle escaped quotes and newlines
            const titleMatch = aiResponseContent.match(
              /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/s,
            );

            // Extract content - much more permissive, handle multiline
            const contentMatch = aiResponseContent.match(
              /"content"\s*:\s*"((?:[^"\\]|\\.)*?)"\s*[,}]/s,
            );

            if (titleMatch && contentMatch) {
              // Decode escaped sequences
              const rawTitle = titleMatch[1];
              const rawContent = contentMatch[1];

              // Fix common escape sequences
              finalTitle = cleanExtractedText(
                rawTitle
                  .replace(/\\n/g, "\n")
                  .replace(/\\r/g, "\r")
                  .replace(/\\t/g, "\t")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\"),
                "title",
              );

              finalContent = cleanExtractedText(
                rawContent
                  .replace(/\\n/g, "\n")
                  .replace(/\\r/g, "\r")
                  .replace(/\\t/g, "\t")
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, "\\"),
                "content",
              );

              parsedSuccessfully = true;
              console.log(
                `[${functionVersion}] Extracted content using robust regex. Title: "${
                  finalTitle.substring(0, 50)
                }..."`,
              );
            } else {
              console.warn(
                `[${functionVersion}] Regex extraction failed (User: ${userId}). TitleMatch: ${!!titleMatch}, ContentMatch: ${!!contentMatch}`,
              );

              // Log the problematic area
              if (!titleMatch) {
                console.log(
                  `[${functionVersion}] Could not find title in response (User: ${userId})`,
                );
              }
              if (!contentMatch) {
                console.log(
                  `[${functionVersion}] Could not find content in response (User: ${userId})`,
                );
                // Try to show what we got around position 774 (from error message)
                const problemArea = aiResponseContent.substring(
                  Math.max(0, 700),
                  Math.min(aiResponseContent.length, 850),
                );
                console.log(
                  `[${functionVersion}] Area around error position (User: ${userId}): "${problemArea}"`,
                );
              }
              console.error(
                `[${functionVersion}] Complete raw response that failed all parsing (User: ${userId}): ${aiResponseContent}`,
              );
            }
          } catch (regexError) {
            const regexMsg = regexError instanceof Error
              ? regexError.message
              : "Unknown error";
            console.error(
              `[${functionVersion}] Regex extraction also failed (User: ${userId}): ${regexMsg}`,
            );
            console.error(
              `[${functionVersion}] Complete raw response (User: ${userId}): ${aiResponseContent}`,
            );
          }
        }
      }
    } else {
      console.error(
        `[${functionVersion}] AI response was empty or text could not be extracted. Finish Reason: ${finishReason}`,
      );
    }

    if (!parsedSuccessfully) {
      console.warn(
        `[${functionVersion}] Using fallback: Default title, and attempting to use raw AI response (if any) as content (after cleaning).`,
      );
      finalContent = cleanExtractedText(aiResponseContent, "content"); // aiResponseContent could be null here
      // finalTitle remains the default 'Aventura Inolvidable'
    }

    if (!finalContent) {
      console.error(
        `[${functionVersion}] Content is empty even after JSON parsing/fallback and cleaning.`,
      );
      // Considerar devolver la respuesta cruda o un mensaje de error específico
      finalContent =
        "Hubo un problema al generar el contenido del cuento, pero aquí está la respuesta cruda de la IA (puede no estar formateada): " +
        (aiResponseContent || "No se recibió respuesta de la IA.");
    }

    console.log(
      `[${functionVersion}] Final result. reqId=${requestId} title="${finalTitle}" contentLength=${finalContent.length}`,
    );

    // 8. Incrementar Contador
    if (userIdForIncrement) {
      console.log(
        `[${functionVersion}] Incrementing count. reqId=${requestId} userId=${userIdForIncrement}...`,
      );
      const { error: incrementError } = await supabaseAdmin.rpc(
        "increment_story_count",
        {
          user_uuid: userIdForIncrement,
        },
      );
      if (incrementError) {
        console.error(
          `[${functionVersion}] CRITICAL: Failed count increment. reqId=${requestId} userId=${userIdForIncrement} error=${incrementError.message}`,
        );
      } else {
        console.log(
          `[${functionVersion}] Count incremented. reqId=${requestId} userId=${userIdForIncrement}.`,
        );
      }
    }

    // 9. Respuesta Final
    const response: {
      content: string;
      title: string;
      scenes?: StoryGenerationResult["scenes"];
    } = {
      content: finalContent,
      title: finalTitle,
    };

    // Include scenes if they were successfully parsed
    if (finalScenes) {
      response.scenes = finalScenes;
      console.log(
        `[${functionVersion}] Including scenes in response. reqId=${requestId}`,
      );
    } else {
      console.warn(
        `[${functionVersion}] WARNING: No scenes were parsed from AI response. reqId=${requestId} This will cause issues downstream.`,
      );
    }

    const totalDurationMs = Date.now() - requestStartMs;
    console.log(
      `[${functionVersion}] Request end (success). reqId=${requestId} status=200 durationMs=${totalDurationMs}`,
    );
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
    });
  } catch (error) {
    // 10. Manejo de Errores
    console.error(
      `[${functionVersion}] Error. reqId=${requestId} userId=${
        userId || "UNKNOWN"
      }:`,
      error,
    );
    let statusCode = 500;
    const message = error instanceof Error
      ? error.message
      : "Error interno desconocido.";

    if (error instanceof Error) {
      const lowerMessage = message.toLowerCase();
      if (
        lowerMessage.includes("autenticado") ||
        lowerMessage.includes("token inválido")
      ) statusCode = 401;
      else if (lowerMessage.includes("límite")) statusCode = 429;
      else if (
        lowerMessage.includes("inválido") ||
        lowerMessage.includes("json in body") ||
        lowerMessage.includes("parámetros")
      ) statusCode = 400;
      // Actualizado para errores de IA con JSON
      else if (
        lowerMessage.includes("ai response was not valid json") ||
        lowerMessage.includes("ai response was empty") ||
        lowerMessage.includes("ai response json structure is invalid") ||
        lowerMessage.includes("blocked") || lowerMessage.includes("filter")
      ) statusCode = 502; // Bad Gateway
    }

    const totalDurationMs = Date.now() - requestStartMs;
    console.log(
      `[${functionVersion}] Request end (error). reqId=${requestId} status=${statusCode} durationMs=${totalDurationMs}`,
    );
    return new Response(
      JSON.stringify({
        error: `Error procesando solicitud: ${message}`,
        requestId,
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "x-request-id": requestId,
        },
      },
    );
  }
});
