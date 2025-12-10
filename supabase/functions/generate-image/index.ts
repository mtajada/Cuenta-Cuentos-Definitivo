import { serve } from "std/http/server.ts";
import { OpenAI } from "openai";
import { createClient } from 'supabase';
import { getCorsHeaders } from '../_shared/cors.ts';
import { GEMINI_PREFERRED_ASPECT_RATIO, formatCanvasLayout, getImageLayout } from '../_shared/image-layout.ts';
import {
  getOpenAiStyleForStyleId,
  getValidIllustrationStyleIds,
  isValidIllustrationStyleId,
  normalizeIllustrationStyleId,
} from '../_shared/illustration-styles.ts';
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
  styleId?: string;
  background?: 'opaque';
  desiredAspectRatio?: string;
  storyId?: string;
  chapterId?: string;
  imageType?: string;
  providerTimeoutMs?: number;
  providerDefault?: 'gemini' | 'openai';
  providerFallback?: 'gemini' | 'openai';
}

interface UploadResponsePayload {
  success?: boolean;
  publicUrl?: string;
  storagePath?: string;
  mimeType?: string;
  providerUsed?: string;
  styleId?: string | null;
  openAiStyle?: 'vivid' | 'natural' | null;
}

type ImageProviderId = 'gemini' | 'openai';
const PROVIDER_VALUES: ImageProviderId[] = ['gemini', 'openai'];

function normalizeProvider(value: string | null | undefined): ImageProviderId | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  return PROVIDER_VALUES.includes(normalized as ImageProviderId)
    ? (normalized as ImageProviderId)
    : null;
}

function resolveProviderConfig(input?: {
  requestedDefault?: string | null;
  requestedFallback?: string | null;
}): { defaultProvider: ImageProviderId; fallbackProvider: ImageProviderId } {
  const envDefault = normalizeProvider(Deno.env.get('IMAGE_PROVIDER_DEFAULT'));
  const envFallback = normalizeProvider(Deno.env.get('IMAGE_PROVIDER_FALLBACK'));

  const defaultProvider = normalizeProvider(input?.requestedDefault) ?? envDefault ?? 'gemini';
  let fallbackProvider =
    normalizeProvider(input?.requestedFallback) ??
    envFallback ??
    (defaultProvider === 'gemini' ? 'openai' : 'gemini');

  if (fallbackProvider === defaultProvider) {
    fallbackProvider = defaultProvider === 'gemini' ? 'openai' : 'gemini';
  }

  return {
    defaultProvider,
    fallbackProvider,
  };
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

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function resolveStorageExtension(mimeType?: string | null): { extension: string; contentType: string } {
  const normalized = mimeType?.toLowerCase();
  if (normalized && MIME_EXTENSION_MAP[normalized]) {
    return { extension: MIME_EXTENSION_MAP[normalized], contentType: normalized };
  }
  return { extension: 'jpeg', contentType: 'image/jpeg' };
}

function buildStoragePath(storyId: string, chapterId: string | null, imageType: string, extension: string): string {
  const sanitizedStoryId = storyId.trim();
  const sanitizedImageType = imageType.trim();
  const trimmedChapterId = chapterId?.trim();
  const normalizedChapterId = trimmedChapterId && trimmedChapterId.length > 0 ? trimmedChapterId : null;

  if (normalizedChapterId) {
    return `${sanitizedStoryId}/${normalizedChapterId}/${sanitizedImageType}.${extension}`;
  }
  return `${sanitizedStoryId}/${sanitizedImageType}.${extension}`;
}

function resolveStoragePath(input: {
  storyId?: string | null;
  chapterId?: string | null;
  imageType?: string | null;
  mimeType?: string | null;
}): string | null {
  const { storyId, chapterId, imageType, mimeType } = input;
  if (!storyId || !imageType) {
    return null;
  }

  const { extension } = resolveStorageExtension(mimeType);
  return buildStoragePath(storyId, chapterId ?? null, imageType, extension);
}

function isValidUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type StoryImageStatus = 'uploaded' | 'inline_base64';

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
  status?: StoryImageStatus;
  styleId?: string | null;
  openAiStyle?: 'vivid' | 'natural' | null;
}): Promise<boolean> {
  const {
    storyId,
    chapterId,
    imageType,
    storagePath,
    status,
    provider,
    fallbackUsed,
    mimeType,
    originalResolution,
    finalResolution,
    resizedFrom,
    resizedTo,
    latencyMs,
    userId,
    styleId,
    openAiStyle,
  } = input;

  const normalizedChapterId =
    isValidUuid(chapterId) && chapterId !== storyId ? chapterId : null;
  const resolvedStatus: StoryImageStatus = status ?? 'uploaded';

  const insertPayload = {
    story_id: storyId,
    chapter_id: normalizedChapterId,
    image_type: imageType,
    storage_path: storagePath,
    provider,
    fallback_used: fallbackUsed,
    mime_type: mimeType,
    original_resolution: originalResolution,
    final_resolution: finalResolution,
    resized_from: resizedFrom,
    resized_to: resizedTo,
    latency_ms: latencyMs,
    status: resolvedStatus,
    user_id: userId,
    style_id: styleId ?? null,
    openai_style: openAiStyle ?? null,
  };

  const { error: insertError } = await supabaseAdmin.from('story_images').insert(insertPayload);
  if (!insertError) {
    return true;
  }

  let effectiveChapterId = normalizedChapterId;

  if (insertError.code !== '23505') {
    console.error('[GENERATE_IMAGE_ERROR] Failed to insert story_images metadata:', insertError);
    if (insertError.code === '23503' && normalizedChapterId !== null) {
      console.warn('[GENERATE_IMAGE_WARN] Falling back to null chapter_id after FK violation for story_images insert');
      const retryPayload = { ...insertPayload, chapter_id: null };
      const { error: retryError } = await supabaseAdmin.from('story_images').insert(retryPayload);
      if (!retryError) {
        return true;
      }
      if (retryError.code === '23505') {
        effectiveChapterId = null;
      } else {
        console.error('[GENERATE_IMAGE_ERROR] Retry insert with null chapter_id failed:', retryError);
        return false;
      }
    } else {
      return false;
    }
  }

  if (insertError.code === '23505' || effectiveChapterId === null) {
    const updatePayload = { ...insertPayload, chapter_id: effectiveChapterId };
    const query = supabaseAdmin
      .from('story_images')
      .update(updatePayload)
      .eq('story_id', storyId)
      .eq('image_type', imageType);

    if (effectiveChapterId === null) {
      query.is('chapter_id', null);
    } else {
      query.eq('chapter_id', effectiveChapterId);
    }

    const { error: updateError } = await query;
    if (updateError) {
      console.error('[GENERATE_IMAGE_ERROR] Failed to update story_images metadata after conflict:', updateError);
      return false;
    }
  }

  return true;
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
      style: openAiStyleRequest,
      styleId,
      background,
      desiredAspectRatio = GEMINI_PREFERRED_ASPECT_RATIO,
      storyId,
      chapterId,
      imageType,
      providerTimeoutMs,
      providerDefault,
      providerFallback,
    } = requestBody;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.warn(`[GENERATE_IMAGE_WARN] Invalid request body for user ${userId}: Prompt is missing or empty.`);
      return new Response(JSON.stringify({ success: false, error: 'Prompt inválido o ausente.' }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const requestedStyleId = typeof styleId === 'string' ? styleId : null;
    if (requestedStyleId && !isValidIllustrationStyleId(requestedStyleId)) {
      console.warn(
        `[GENERATE_IMAGE_WARN] Invalid styleId received (${requestedStyleId}). Allowed: ${getValidIllustrationStyleIds().join(', ')}`,
      );
      return new Response(JSON.stringify({ success: false, error: 'styleId inválido.' }), {
        status: 400,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const resolvedStyleId = normalizeIllustrationStyleId(requestedStyleId);
    const mappedOpenAiStyle = getOpenAiStyleForStyleId(resolvedStyleId);
    const requestedOpenAiStyle =
      openAiStyleRequest === 'vivid' || openAiStyleRequest === 'natural' ? openAiStyleRequest : null;
    const resolvedOpenAiStyle = requestedStyleId ? mappedOpenAiStyle : (requestedOpenAiStyle ?? mappedOpenAiStyle);
    console.log(
      `[GENERATE_IMAGE_INFO] Style resolved for request: styleId=${resolvedStyleId}, openAiStyle=${resolvedOpenAiStyle}`,
    );

    const layout = getImageLayout({ aspectRatio: desiredAspectRatio });
    console.log('[GENERATE_IMAGE_INFO] Layout resolved', layout);

    const providerConfig = resolveProviderConfig({
      requestedDefault: providerDefault,
      requestedFallback: providerFallback,
    });
    console.log(
      `[GENERATE_IMAGE_INFO] Provider order resolved: default=${providerConfig.defaultProvider}, fallback=${providerConfig.fallbackProvider}`,
    );

    const providerOrder: ImageProviderId[] = [
      providerConfig.defaultProvider,
      providerConfig.fallbackProvider,
    ];

    let providerResult: ProviderResult | null = null;
    let fallbackUsed = false;

    for (let i = 0; i < providerOrder.length; i++) {
      const provider = providerOrder[i];
      const isFallbackAttempt = i > 0;
      try {
        if (provider === 'gemini') {
          providerResult = await generateWithGemini({
            prompt: prompt.trim(),
            desiredAspectRatio,
            timeoutMs: providerTimeoutMs,
            logPrefix: `[GEMINI_IMAGE][user:${userId}]`,
          });
        } else {
          providerResult = await generateWithOpenAI({
            prompt: prompt.trim(),
            desiredAspectRatio,
            client: openai,
            model,
            quality,
            style: resolvedOpenAiStyle,
            background,
            logPrefix: `[OPENAI_IMAGE][user:${userId}]`,
          });
        }
        fallbackUsed = isFallbackAttempt;
        break;
      } catch (error) {
        const hasAnotherProvider = i < providerOrder.length - 1;
        const shouldTryFallback =
          hasAnotherProvider &&
          (!(error instanceof ProviderError) || error.shouldFallback);

        console.error(
          `[GENERATE_IMAGE_ERROR] ${provider.toUpperCase()} failed${error instanceof Error ? `: ${error.message}` : ''}`,
        );

        if (shouldTryFallback) {
          console.warn(
            `[GENERATE_IMAGE_WARN] Attempting fallback provider ${providerOrder[i + 1]} after ${provider} error`,
          );
          continue;
        }

        throw error;
      }
    }

    if (!providerResult) {
      throw new Error('No se pudo resolver un proveedor de imágenes');
    }

    const normalized = await normalizeForLayout(providerResult.buffer, providerResult.mimeType);
    console.log('[GENERATE_IMAGE_INFO] Normalized image', {
      original: normalized.originalResolution,
      resizedFrom: normalized.resizedFrom,
      resizedTo: normalized.resizedTo,
      final: normalized.finalResolution,
    });

    const finalResolutionPx = formatResolution(normalized.finalResolution);
    const finalResolutionLabel = formatCanvasLayout(normalized.finalResolution, layout.layoutLabel);

    const normalizedBase64 = encodeUint8ToBase64(normalized.buffer);

    let publicUrl: string | null = null;
    let storagePath: string | null = null;
    let metadataStatus: StoryImageStatus = 'inline_base64';
    let uploadErrorMessage: string | null = null;
    const expectedStoragePath = resolveStoragePath({
      storyId,
      chapterId: chapterId ?? null,
      imageType,
      mimeType: normalized.mimeType,
    });

    if (storyId && imageType) {
      try {
        const { data: uploadData, error: uploadError } = await supabaseAdmin.functions.invoke<UploadResponsePayload>(
          'upload-story-image',
          {
            body: {
              imageBase64: normalizedBase64,
              mimeType: normalized.mimeType,
              imageType,
              storyId,
              chapterId: chapterId ?? null,
              providerUsed: providerResult.provider,
              fallbackUsed,
              latencyMs: providerResult.latencyMs,
              originalResolution: formatResolution(normalized.originalResolution),
              finalResolution: finalResolutionLabel,
              resizedFrom: formatResolution(normalized.resizedFrom ?? null),
              resizedTo: formatResolution(normalized.resizedTo ?? null),
              userId,
              styleId: resolvedStyleId,
              openAiStyle: resolvedOpenAiStyle,
            },
          },
        );

        if (uploadError) {
          console.error('[GENERATE_IMAGE_ERROR] Failed to upload image to storage:', uploadError);
          uploadErrorMessage = uploadError.message ?? 'Storage upload failed';
        } else if (!uploadData?.success) {
          uploadErrorMessage = 'upload-story-image responded without success';
          console.error('[GENERATE_IMAGE_ERROR] upload-story-image responded without success flag');
        } else {
          publicUrl = uploadData.publicUrl ?? null;
          storagePath = uploadData.storagePath ?? null;
          metadataStatus = storagePath ? 'uploaded' : 'inline_base64';
          if (!publicUrl || !storagePath) {
            uploadErrorMessage = 'Storage upload missing publicUrl or storagePath';
            console.error('[GENERATE_IMAGE_ERROR] Storage upload missing publicUrl or storagePath');
          } else {
            console.log('[GENERATE_IMAGE_INFO] Image uploaded to storage successfully');
          }
        }
      } catch (uploadError) {
        console.error('[GENERATE_IMAGE_ERROR] Exception during image upload:', uploadError);
        uploadErrorMessage = uploadError instanceof Error ? uploadError.message : 'Unexpected upload error';
      }
    }

    const shouldPersistMetadata = Boolean(storyId && imageType && userId);
    const uploadCompleted = Boolean(storagePath && publicUrl && metadataStatus === 'uploaded');

    if (shouldPersistMetadata && !uploadCompleted) {
      const errorMessage = uploadErrorMessage ?? 'No se pudo subir la imagen al almacenamiento.';
      console.error('[GENERATE_IMAGE_ERROR] Skipping success response because upload failed:', errorMessage);
      return new Response(JSON.stringify({
        success: false,
        error: 'No se pudo subir la imagen al almacenamiento.',
        providerUsed: providerResult.provider,
        fallbackUsed,
        latencyMs: providerResult.latencyMs,
      }), {
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
        status: 502,
      });
    }

    if (shouldPersistMetadata && storagePath && publicUrl) {
      if (!storyId || !imageType || !userId) {
        console.error('[GENERATE_IMAGE_ERROR] Missing metadata identifiers despite shouldPersistMetadata flag');
      } else {
        const metadataPersisted = await upsertStoryImageMetadata({
          storyId,
          chapterId: chapterId ?? null,
          imageType,
          storagePath,
          status: metadataStatus,
          provider: providerResult.provider,
          fallbackUsed,
          mimeType: normalized.mimeType,
          originalResolution: formatResolution(normalized.originalResolution),
          finalResolution: finalResolutionLabel,
          resizedFrom: formatResolution(normalized.resizedFrom ?? null),
          resizedTo: formatResolution(normalized.resizedTo ?? null),
          latencyMs: providerResult.latencyMs,
          userId,
          styleId: resolvedStyleId,
          openAiStyle: resolvedOpenAiStyle,
        });

        if (!metadataPersisted) {
          console.error('[GENERATE_IMAGE_ERROR] Failed to persist story_images metadata after successful upload');
          return new Response(JSON.stringify({
            success: false,
            error: 'No se pudieron guardar los metadatos de la imagen.',
            providerUsed: providerResult.provider,
            fallbackUsed,
            latencyMs: providerResult.latencyMs,
          }), {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }
      }
    }

    const responseStoragePath = storagePath ?? expectedStoragePath;

    const responseMetadata = {
      providerUsed: providerResult.provider,
      fallbackUsed,
      latencyMs: providerResult.latencyMs,
      defaultProvider: providerConfig.defaultProvider,
      fallbackProvider: providerConfig.fallbackProvider,
      requestedAspectRatio: providerResult.requestedAspectRatio,
      effectiveAspectRatio: providerResult.effectiveAspectRatio ?? layout.resolvedAspectRatio,
      requestSize: providerResult.requestSize,
      originalResolution: formatResolution(normalized.originalResolution),
      resizedFrom: formatResolution(normalized.resizedFrom ?? null),
      resizedTo: formatResolution(normalized.resizedTo ?? null),
      finalResolution: finalResolutionLabel,
      finalResolutionPx,
      finalLayout: layout.layoutLabel,
      canvasLabel: layout.canvasLabel,
      mimeType: normalized.mimeType,
      storagePath: responseStoragePath,
      storyId,
      chapterId,
      imageType,
      styleId: resolvedStyleId,
      openAiStyle: resolvedOpenAiStyle,
    };

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        storagePath: responseStoragePath,
        metadata: responseMetadata,
        providerUsed: providerResult.provider,
        fallbackUsed,
        latencyMs: providerResult.latencyMs,
        imageBase64: publicUrl ? undefined : normalizedBase64,
        styleId: resolvedStyleId,
        openAiStyle: resolvedOpenAiStyle,
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
