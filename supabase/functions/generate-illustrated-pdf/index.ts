// supabase/functions/generate-illustrated-pdf/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`[GENERATE_ILLUSTRATED_PDF_DEBUG] Function generate-illustrated-pdf initializing...`);

const IMAGE_BUCKET = 'images-stories';
// Temporary compatibility while backfill finishes: signed fallback to legacy bucket
const LEGACY_IMAGE_BUCKET = 'story-images';
const LEGACY_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp'] as const;
const REQUIRED_IMAGE_TYPES = ['cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing'] as const;

type RequiredImageType = typeof REQUIRED_IMAGE_TYPES[number];
type LegacyExtension = typeof LEGACY_EXTENSIONS[number];

interface StoryImageRecord {
  image_type: RequiredImageType | string;
  storage_path: string | null;
  storage_bucket?: string | null;
  provider: string | null;
  fallback_used: boolean | null;
  mime_type: string | null;
  original_resolution: string | null;
  final_resolution: string | null;
  resized_from: string | null;
  resized_to: string | null;
  latency_ms: number | null;
  chapter_id: string | null;
}

function isValidUuid(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeChapterId(chapterId: string | null | undefined, storyId: string): string | null {
  if (!isValidUuid(chapterId)) {
    return null;
  }
  return chapterId === storyId ? null : chapterId;
}

function inferMimeTypeFromExtension(extension: LegacyExtension): string {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

async function findLegacyImage(
  supabaseAdmin: ReturnType<typeof createClient>,
  storyId: string,
  normalizedChapterId: string | null,
  rawChapterId: string,
  imageType: RequiredImageType,
) {
  const chapterCandidates = new Set<string>();
  chapterCandidates.add(storyId);

  if (normalizedChapterId) {
    chapterCandidates.add(`${storyId}/${normalizedChapterId}`);
  }
  if (rawChapterId && normalizedChapterId !== rawChapterId) {
    chapterCandidates.add(`${storyId}/${rawChapterId}`);
  }

  for (const basePath of chapterCandidates) {
    for (const extension of LEGACY_EXTENSIONS) {
      const candidatePath = `${basePath}/${imageType}.${extension}`;
      const { data, error } = await supabaseAdmin.storage.from(LEGACY_IMAGE_BUCKET).createSignedUrl(candidatePath, 3600);

      if (!error && data?.signedUrl) {
        const { data: publicData } = supabaseAdmin.storage.from(LEGACY_IMAGE_BUCKET).getPublicUrl(candidatePath);

        return {
          record: {
            image_type: imageType,
            storage_path: candidatePath,
            storage_bucket: LEGACY_IMAGE_BUCKET,
            provider: 'legacy_storage',
            fallback_used: true,
            mime_type: inferMimeTypeFromExtension(extension),
            original_resolution: null,
            final_resolution: null,
            resized_from: null,
            resized_to: null,
            latency_ms: null,
            chapter_id: normalizedChapterId,
          },
          access: {
            signedUrl: data.signedUrl,
            publicUrl: publicData?.publicUrl ?? null,
          },
        };
      }
    }
  }

  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('[GENERATE_ILLUSTRATED_PDF_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[GENERATE_ILLUSTRATED_PDF_DEBUG] Handling ${req.method} request`);

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const requestBody = await req.json();
    const { storyId, chapterId, title, author, content, userId, pdfUrl } = requestBody;

    console.log(`[GENERATE_ILLUSTRATED_PDF_DEBUG] Received request for story ${storyId}, chapter ${chapterId}, user ${userId}`);

    if (!storyId || !chapterId || !title || !content || !userId) {
      console.error('[GENERATE_ILLUSTRATED_PDF_ERROR] Missing required parameters');
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const normalizedChapterId = normalizeChapterId(chapterId, storyId);

    console.log(`[GENERATE_ILLUSTRATED_PDF_INFO] Fetching normalized image metadata for story ${storyId} (chapter: ${normalizedChapterId ?? 'null'})`);

    const requiredImageFilters = [...REQUIRED_IMAGE_TYPES];

    const { data: metadataRows, error: metadataError } = await supabaseAdmin
      .from('story_images')
      .select(
        'image_type, storage_path, storage_bucket, provider, fallback_used, mime_type, original_resolution, final_resolution, resized_from, resized_to, latency_ms, chapter_id'
      )
      .eq('story_id', storyId)
      .in('image_type', requiredImageFilters);

    if (metadataError) {
      console.error('[GENERATE_ILLUSTRATED_PDF_ERROR] Failed to load story image metadata:', metadataError);
      return new Response(
        JSON.stringify({ error: 'No se pudieron obtener los metadatos de las ilustraciones' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const records = Array.isArray(metadataRows) ? (metadataRows as StoryImageRecord[]) : [];
    const selectedRecords: Record<RequiredImageType, StoryImageRecord> = {} as Record<RequiredImageType, StoryImageRecord>;
    let missingTypes: RequiredImageType[] = [];
    const preResolvedAccess: Partial<Record<RequiredImageType, { signedUrl: string; publicUrl: string | null }>> = {};
    const legacyFallbackUsed: RequiredImageType[] = [];

    for (const imageType of REQUIRED_IMAGE_TYPES) {
      const rowsForType = records.filter((row) => row.image_type === imageType);
      const exactMatch = rowsForType.find((row) => row.chapter_id === normalizedChapterId);
      const fallbackMatch = rowsForType.find((row) => row.chapter_id === null);
      const chosen = exactMatch ?? fallbackMatch ?? null;

      if (!chosen || !chosen.storage_path) {
        missingTypes.push(imageType);
        continue;
      }

      selectedRecords[imageType] = chosen;
    }

    if (missingTypes.length > 0) {
      console.warn(
        '[GENERATE_ILLUSTRATED_PDF_WARN] Missing normalized .jpeg images in images-stories; attempting legacy signed fallback.',
        { storyId, chapterId: normalizedChapterId, missingTypes },
      );

      for (const imageType of [...missingTypes]) {
        const legacy = await findLegacyImage(supabaseAdmin, storyId, normalizedChapterId, chapterId, imageType);
        if (legacy) {
          selectedRecords[imageType] = legacy.record;
          preResolvedAccess[imageType] = legacy.access;
          legacyFallbackUsed.push(imageType);
        }
      }

      missingTypes = missingTypes.filter((type) => !selectedRecords[type]);
    }

    if (missingTypes.length > 0) {
      console.warn(
        '[GENERATE_ILLUSTRATED_PDF_WARN] Normalized images missing and legacy storage did not have fallbacks:',
        { storyId, chapterId: normalizedChapterId, missingTypes, legacyFallbackUsed },
      );
      return new Response(
        JSON.stringify({
          error: 'Faltan ilustraciones normalizadas (.jpeg) en images-stories para generar el PDF',
          missingImages: missingTypes,
          bucket: IMAGE_BUCKET,
          expectedFormat: 'jpeg',
          legacyFallbackAttempted: true,
          action: 'Ejecuta el backfill a images-stories o regenera las ilustraciones antes de crear el PDF',
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (legacyFallbackUsed.length > 0) {
      console.log(
        '[GENERATE_ILLUSTRATED_PDF_INFO] Applied legacy story-images fallback for:',
        { storyId, chapterId: normalizedChapterId, legacyFallbackUsed },
      );
    }

    console.log('[GENERATE_ILLUSTRATED_PDF_INFO] Generating access URLs for normalized illustrations...');

    const imageUrls: Record<string, string> = {};
    const imageMetadata: Record<string, Record<string, unknown>> = {};

    for (const imageType of REQUIRED_IMAGE_TYPES) {
      const record = selectedRecords[imageType];
      if (!record) {
        continue;
      }
      const storagePath = record.storage_path!;
      const bucket = record.storage_bucket ?? IMAGE_BUCKET;

      let signedUrl = preResolvedAccess[imageType]?.signedUrl ?? null;
      let publicUrl = preResolvedAccess[imageType]?.publicUrl ?? null;

      if (!signedUrl) {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600);

        if (signedError || !signedData?.signedUrl) {
          console.error(`[GENERATE_ILLUSTRATED_PDF_ERROR] Unable to create signed URL for ${imageType}:`, signedError);
          return new Response(
            JSON.stringify({ error: `No se pudo generar acceso temporal a la ilustración ${imageType}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        signedUrl = signedData.signedUrl;
      }

      if (!publicUrl) {
        const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
        publicUrl = publicData?.publicUrl ?? null;
      }

      imageUrls[imageType] = publicUrl ?? signedUrl;
      imageMetadata[imageType] = {
        bucket,
        storagePath,
        signedUrl,
        publicUrl,
        provider: record.provider,
        fallbackUsed: record.fallback_used,
        mimeType: record.mime_type,
        originalResolution: record.original_resolution,
        finalResolution: record.final_resolution,
        resizedFrom: record.resized_from,
        resizedTo: record.resized_to,
        latencyMs: record.latency_ms,
        chapterId: record.chapter_id,
      };
    }

    console.log('[GENERATE_ILLUSTRATED_PDF_INFO] Normalized illustrations ready. Proceeding with PDF registration.');

    const resolvedPdfUrl = typeof pdfUrl === 'string' && pdfUrl.trim().length > 0 ? pdfUrl.trim() : null;
    const resolvedStatus = resolvedPdfUrl ? 'completed' : 'pending';

    if (!resolvedPdfUrl) {
      console.log('[GENERATE_ILLUSTRATED_PDF_INFO] No pdfUrl provided; recording request as pending');
    }

    const { error: dbError } = await supabaseAdmin
      .from('illustrated_pdfs')
      .insert({
        story_id: storyId,
        chapter_id: chapterId,
        user_id: userId,
        title,
        author: author || null,
        pdf_url: resolvedPdfUrl,
        status: resolvedStatus,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('[GENERATE_ILLUSTRATED_PDF_ERROR] Error storing PDF record:', dbError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Illustrated PDF metadata processed successfully',
        imageUrls,
        imageMetadata,
        legacyFallbackUsed,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('[GENERATE_ILLUSTRATED_PDF_ERROR] Unhandled error in generate-illustrated-pdf:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: `Error interno del servidor: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
