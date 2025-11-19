// supabase/functions/generate-illustrated-pdf/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`[GENERATE_ILLUSTRATED_PDF_DEBUG] Function generate-illustrated-pdf initializing...`);

const IMAGE_BUCKET = 'images-stories';
const LEGACY_IMAGE_BUCKET = 'story-images';
const REQUIRED_IMAGE_TYPES = ['cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing'] as const;

type RequiredImageType = typeof REQUIRED_IMAGE_TYPES[number];

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

interface StorageObject {
  name: string;
  metadata?: {
    mimetype?: string | null;
  } | null;
}

async function findLegacyImageFromStorage(
  supabaseAdmin: SupabaseClient,
  storyId: string,
  normalizedChapterId: string | null,
  imageType: RequiredImageType,
): Promise<StoryImageRecord | null> {
  const searchPrefixes = normalizedChapterId ? [`${storyId}/${normalizedChapterId}`, storyId] : [storyId];
  const bucketsToCheck = [LEGACY_IMAGE_BUCKET, IMAGE_BUCKET];

  for (const bucket of bucketsToCheck) {
    for (const prefix of searchPrefixes) {
      const directory = prefix.trim();
      const { data, error } = await supabaseAdmin.storage.from(bucket).list(directory, { limit: 50 });

      if (error) {
        console.warn(
          `[GENERATE_ILLUSTRATED_PDF_WARN] Unable to list storage objects for ${bucket}/${directory}:`,
          error.message ?? error,
        );
        continue;
      }

      const objects = Array.isArray(data) ? (data as StorageObject[]) : [];
      const match = objects.find((item) => typeof item.name === 'string' && item.name.startsWith(`${imageType}.`));

      if (match) {
        const storagePath = directory.length > 0 ? `${directory}/${match.name}` : match.name;
        const fromChapterFolder = normalizedChapterId !== null && directory.includes(`/${normalizedChapterId}`);

        return {
          image_type: imageType,
          storage_path: storagePath,
          storage_bucket: bucket,
          provider: bucket === LEGACY_IMAGE_BUCKET ? 'storage_legacy' : 'storage_normalized',
          fallback_used: true,
          mime_type: match.metadata?.mimetype ?? null,
          original_resolution: null,
          final_resolution: null,
          resized_from: null,
          resized_to: null,
          latency_ms: null,
          chapter_id: fromChapterFolder ? normalizedChapterId : null,
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
    const { storyId, chapterId, title, author, content, userId } = requestBody;

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
        'image_type, storage_path, provider, fallback_used, mime_type, original_resolution, final_resolution, resized_from, resized_to, latency_ms, chapter_id'
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
        '[GENERATE_ILLUSTRATED_PDF_WARN] Normalized metadata missing for some images, attempting storage fallback:',
        missingTypes,
      );

      for (const imageType of missingTypes) {
        const fallbackRecord = await findLegacyImageFromStorage(supabaseAdmin, storyId, normalizedChapterId, imageType);
        if (fallbackRecord?.storage_path) {
          console.log(
            `[GENERATE_ILLUSTRATED_PDF_INFO] Found legacy storage image for ${imageType} at ${fallbackRecord.storage_path}`,
          );
          selectedRecords[imageType] = fallbackRecord;
        }
      }

      missingTypes = REQUIRED_IMAGE_TYPES.filter((imageType) => {
        const record = selectedRecords[imageType];
        return !record || !record.storage_path;
      });
    }

    if (missingTypes.length > 0) {
      console.warn('[GENERATE_ILLUSTRATED_PDF_WARN] Missing normalized images after storage fallback:', missingTypes);
      return new Response(
        JSON.stringify({
          error: 'Faltan ilustraciones normalizadas para generar el PDF',
          missingImages: missingTypes,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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

      const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(storagePath);
      const publicUrl = publicData?.publicUrl ?? null;

      imageUrls[imageType] = publicUrl ?? signedData.signedUrl;
      imageMetadata[imageType] = {
        bucket,
        storagePath,
        signedUrl: signedData.signedUrl,
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

    const { error: dbError } = await supabaseAdmin
      .from('illustrated_pdfs')
      .insert({
        story_id: storyId,
        chapter_id: chapterId,
        user_id: userId,
        title,
        author: author || null,
        pdf_url: null,
        status: 'completed',
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
