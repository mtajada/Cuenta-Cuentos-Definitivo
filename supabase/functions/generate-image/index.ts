import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai@4.40.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { getCorsHeaders } from '../_shared/cors.ts';
import { GEMINI_PREFERRED_ASPECT_RATIO, getImageLayout } from '../_shared/image-layout.ts';
import { generateWithGemini, generateWithOpenAI, ProviderError, ProviderResult } from './providers.ts';
import { normalizeForLayout } from './normalize.ts';

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openaiApiKey) {
  console.error("[GENERATE_IMAGE_ERROR] CRITICAL: OPENAI_API_KEY environment variable not set.");
  throw new Error("OPENAI_API_KEY environment variable not set");
}
const openai = new OpenAI({ apiKey: openaiApiKey });

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
if (!supabaseUrl || !serviceRoleKey) {
  console.error("[GENERATE_IMAGE_ERROR] CRITICAL: Supabase URL or Service Role Key not set.");
  throw new Error("Supabase URL or Service Role Key not set");
}
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

interface ImageGenerationRequest {
  prompt: string;
  model?: string;
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  background?: 'opaque';
  desiredAspectRatio?: string;
  storyId?: string;
  chapterId?: string;
  imageType?: string;
  providerTimeoutMs?: number;
}

interface UploadResponsePayload {
  success?: boolean;
  publicUrl?: string;
  storagePath?: string;
  mimeType?: string;
  providerUsed?: string;
}

function encodeUint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const subset = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...subset);
  }
  return btoa(binary);
}

function formatResolution(resolution?: { width: number; height: number } | null): string | null {
  if (!resolution) return null;
  return `${resolution.width}x${resolution.height}`;
}

function isValidUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function upsertStoryImageMetadata(input: {
  storyId: string;
  chapterId: string | null;
  imageType: string;
  storagePath: string;
  provider: 'gemini' | 'openai';
  fallbackUsed: boolean;
  mimeType: string;
  originalResolution: string | null;
  finalResolution: string | null;
  resizedFrom: string | null;
  resizedTo: string | null;
  latencyMs: number;
  userId: string;
}) {
  const { storyId, chapterId, imageType, ...rest } = input;
  const normalizedChapterId =
    isValidUuid(chapterId) && chapterId !== storyId ? chapterId : null;

  const insertPayload = {
    story_id: storyId,
    chapter_id: normalizedChapterId,
    image_type: imageType,
    storage_path: rest.storagePath,
    provider: rest.provider,
    fallback_used: rest.fallbackUsed,
    mime_type: rest.mimeType,
    original_resolution: rest.originalResolution,
    final_resolution: rest.finalResolution,
    resized_from: rest.resizedFrom,
    resized_to: rest.resizedTo,
    latency_ms: rest.latencyMs,
    user_id: rest.userId,
  };

  const { error: insertError } = await supabaseAdmin.from('story_images').insert(insertPayload);
  if (!insertError) {
    return;
  }

  if (insertError.code !== '23505') {
    console.error('[GENERATE_IMAGE_ERROR] Failed to insert story_images metadata:', insertError);
    if (insertError.code === '23503' && normalizedChapterId !== null) {
      console.warn('[GENERATE_IMAGE_WARN] Falling back to null chapter_id after FK violation for story_images insert');
      const retryPayload = { ...insertPayload, chapter_id: null };
      const { error: retryError } = await supabaseAdmin.from('story_images').insert(retryPayload);
      if (!retryError || retryError.code === '23505') {
        if (!retryError) {
          return;
        }
      } else if (retryError) {
        console.error('[GENERATE_IMAGE_ERROR] Retry insert with null chapter_id failed:', retryError);
      }
    }
    return;
  }

  const updatePayload = { ...insertPayload };
  const query = supabaseAdmin
    .from('story_images')
    .update(updatePayload)
    .eq('story_id', storyId)
    .eq('image_type', imageType);

  if (normalizedChapterId === null) {
    query.is('chapter_id', null);
  } else {
    query.eq('chapter_id', normalizedChapterId);
  }

  const { error: updateError } = await query;
  if (updateError) {
    console.error('[GENERATE_IMAGE_ERROR] Failed to update story_images metadata after conflict:', updateError);
  }
}

serve(async (req: Request) => {
  const dynamicCorsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: dynamicCorsHeaders });
  }

  let userId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn('[GENERATE_IMAGE_WARN] Invalid or missing Authorization header.');
      return new Response(JSON.stringify({ success: false, error: 'Token inválido.' }), {
        status: 401,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('[GENERATE_IMAGE_ERROR] Authentication failed:', authError?.message || 'User not found for token.');
      return new Response(JSON.stringify({ success: false, error: 'No autenticado.' }), {
        status: 401,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userId = user.id;
    console.log(`[GENERATE_IMAGE_INFO] User Authenticated: ${userId}`);

    let requestBody: ImageGenerationRequest;
    try {
      requestBody = await req.json();
    } catch (_parseError) {
      console.warn('[GENERATE_IMAGE_WARN] Invalid JSON payload received.');
      return new Response(JSON.stringify({ success: false, error: 'JSON inválido.' }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      prompt,
      model = 'gpt-image-1',
      quality = 'standard',
      style = 'vivid',
      background,
      desiredAspectRatio = GEMINI_PREFERRED_ASPECT_RATIO,
      storyId,
      chapterId,
      imageType,
      providerTimeoutMs,
    } = requestBody;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.warn(`[GENERATE_IMAGE_WARN] Invalid request body for user ${userId}: Prompt is missing or empty.`);
      return new Response(JSON.stringify({ success: false, error: 'Prompt inválido o ausente.' }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const layout = getImageLayout({ aspectRatio: desiredAspectRatio });
    console.log('[GENERATE_IMAGE_INFO] Layout resolved', layout);

    let providerResult: ProviderResult;
    let fallbackUsed = false;

    try {
      providerResult = await generateWithGemini({
        prompt: prompt.trim(),
        desiredAspectRatio,
        timeoutMs: providerTimeoutMs,
        logPrefix: `[GEMINI_IMAGE][user:${userId}]`,
      });
    } catch (error) {
      if (error instanceof ProviderError && error.provider === 'gemini' && error.shouldFallback) {
        console.warn('[GENERATE_IMAGE_WARN] Gemini failed, attempting OpenAI fallback:', error.message);
        fallbackUsed = true;
        providerResult = await generateWithOpenAI({
          prompt: prompt.trim(),
          desiredAspectRatio,
          client: openai,
          model,
          quality,
          style,
          background,
          logPrefix: `[OPENAI_IMAGE][user:${userId}]`,
        });
      } else {
        throw error;
      }
    }

    const normalized = await normalizeForLayout(providerResult.buffer, providerResult.mimeType);
    console.log('[GENERATE_IMAGE_INFO] Normalized image', {
      original: normalized.originalResolution,
      resizedFrom: normalized.resizedFrom,
      resizedTo: normalized.resizedTo,
      final: normalized.finalResolution,
    });

    const normalizedBase64 = encodeUint8ToBase64(normalized.buffer);

    let publicUrl: string | null = null;
    let storagePath: string | null = null;

    if (storyId && imageType) {
      try {
        const { data: uploadData, error: uploadError } = await supabaseAdmin.functions.invoke<UploadResponsePayload>('upload-story-image', {
          body: {
            imageBase64: normalizedBase64,
            mimeType: normalized.mimeType,
            imageType,
            storyId,
            chapterId: chapterId ?? null,
            providerUsed: providerResult.provider,
          },
        });

        if (uploadError) {
          console.error('[GENERATE_IMAGE_ERROR] Failed to upload image to storage:', uploadError);
        } else if (uploadData?.success) {
          publicUrl = uploadData.publicUrl ?? null;
          storagePath = uploadData.storagePath ?? null;
          console.log('[GENERATE_IMAGE_INFO] Image uploaded to storage successfully');
        }
      } catch (uploadError) {
        console.error('[GENERATE_IMAGE_ERROR] Exception during image upload:', uploadError);
      }
    }

    if (publicUrl && storagePath && storyId && imageType && userId) {
      await upsertStoryImageMetadata({
        storyId,
        chapterId: chapterId ?? null,
        imageType,
        storagePath,
        provider: providerResult.provider,
        fallbackUsed,
        mimeType: normalized.mimeType,
        originalResolution: formatResolution(normalized.originalResolution),
        finalResolution: formatResolution(normalized.finalResolution),
        resizedFrom: formatResolution(normalized.resizedFrom ?? null),
        resizedTo: formatResolution(normalized.resizedTo ?? null),
        latencyMs: providerResult.latencyMs,
        userId,
      });
    }

    const responseMetadata = {
      providerUsed: providerResult.provider,
      fallbackUsed,
      latencyMs: providerResult.latencyMs,
      requestedAspectRatio: providerResult.requestedAspectRatio,
      effectiveAspectRatio: providerResult.effectiveAspectRatio ?? layout.resolvedAspectRatio,
      requestSize: providerResult.requestSize,
      originalResolution: formatResolution(normalized.originalResolution),
      resizedFrom: formatResolution(normalized.resizedFrom ?? null),
      resizedTo: formatResolution(normalized.resizedTo ?? null),
      finalResolution: formatResolution(normalized.finalResolution),
      mimeType: normalized.mimeType,
      storagePath,
      storyId,
      chapterId,
      imageType,
    };

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        storagePath,
        metadata: responseMetadata,
        providerUsed: providerResult.provider,
        fallbackUsed,
        latencyMs: providerResult.latencyMs,
        imageBase64: publicUrl ? undefined : normalizedBase64,
      }),
      {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error) {
    console.error(`[GENERATE_IMAGE_ERROR] Unhandled error in generate-image function for user ${userId || 'UNKNOWN'}:`, error);

    if (error instanceof ProviderError) {
      const statusCode = error.status ?? 502;
      const message = error.provider === 'gemini'
        ? 'El proveedor principal rechazó la solicitud de imagen.'
        : 'El proveedor de respaldo falló al generar la imagen.';

      return new Response(JSON.stringify({ success: false, error: message, provider: error.provider }), {
        status: statusCode,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let errorMessage = 'Error interno del servidor al generar la imagen.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('content_policy')) {
        errorMessage = 'El contenido no cumple con las políticas de seguridad.';
        statusCode = 400;
      } else if (error.message.includes('billing')) {
        errorMessage = 'Error de facturación del servicio de imágenes.';
        statusCode = 402;
      } else if (error.message.includes('rate_limit')) {
        errorMessage = 'Se excedió el límite de solicitudes. Intenta de nuevo más tarde.';
        statusCode = 429;
      }
    }

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: statusCode,
      headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
