import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UploadImageRequest {
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
  imageType: string;
  storyId: string;
  chapterId?: string | null;
  providerUsed?: string;
}

const VALID_IMAGE_TYPES = new Set(['cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing', 'character']);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function base64ToUint8Array(base64: string): Uint8Array {
  const cleaned = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function resolveExtension(mimeType?: string): { extension: string; contentType: string } {
  const normalized = mimeType?.toLowerCase();
  if (normalized && MIME_EXTENSION_MAP[normalized]) {
    return { extension: MIME_EXTENSION_MAP[normalized], contentType: normalized };
  }
  return { extension: 'jpeg', contentType: 'image/jpeg' };
}

function buildStoragePath(storyId: string, chapterId: string | null, imageType: string, extension: string): string {
  const sanitizedStoryId = storyId.trim();
  const sanitizedImageType = imageType.trim();
  if (chapterId && chapterId.trim().length > 0) {
    return `${sanitizedStoryId}/${chapterId.trim()}/${sanitizedImageType}.${extension}`;
  }
  return `${sanitizedStoryId}/${sanitizedImageType}.${extension}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[UPLOAD_STORY_IMAGE] Starting image upload process...');

    const body: UploadImageRequest = await req.json();
    const { imageUrl, imageBase64, mimeType, imageType, storyId, chapterId, providerUsed } = body;

    if (!imageType || !storyId) {
      console.error('[UPLOAD_STORY_IMAGE] Missing imageType or storyId.');
      return new Response(JSON.stringify({ error: 'Missing required fields: imageType, storyId' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!VALID_IMAGE_TYPES.has(imageType)) {
      console.error('[UPLOAD_STORY_IMAGE] Invalid image type:', imageType);
      return new Response(JSON.stringify({ error: `Invalid imageType. Must be one of: ${Array.from(VALID_IMAGE_TYPES).join(', ')}` }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    if (!imageBase64 && !imageUrl) {
      console.error('[UPLOAD_STORY_IMAGE] Missing image data (base64 or URL).');
      return new Response(JSON.stringify({ error: 'Missing required fields: imageBase64 or imageUrl' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let imageBuffer: Uint8Array;

    if (imageBase64) {
      console.log('[UPLOAD_STORY_IMAGE] Processing base64 image data...');
      imageBuffer = base64ToUint8Array(imageBase64);
      console.log(`[UPLOAD_STORY_IMAGE] Processed base64 image: ${imageBuffer.byteLength} bytes`);
    } else {
      console.log('[UPLOAD_STORY_IMAGE] Downloading image from URL...');
      const imageResponse = await fetch(imageUrl!);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBuffer = new Uint8Array(arrayBuffer);
      console.log(`[UPLOAD_STORY_IMAGE] Downloaded image: ${imageBuffer.byteLength} bytes`);
    }

    const { extension, contentType } = resolveExtension(mimeType);
    const rawChapterId = typeof chapterId === 'string' ? chapterId : chapterId ?? '';
    const normalizedChapterId = rawChapterId.trim().length > 0 ? rawChapterId.trim() : null;
    const storagePath = buildStoragePath(storyId, normalizedChapterId, imageType, extension);

    console.log('[UPLOAD_STORY_IMAGE] Uploading to path:', storagePath, 'provider:', providerUsed ?? 'unknown');

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('images-stories')
      .upload(storagePath, imageBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('[UPLOAD_STORY_IMAGE] Upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log('[UPLOAD_STORY_IMAGE] Upload successful:', uploadData);

    const { data: urlData } = supabaseAdmin.storage.from('images-stories').getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;
    console.log('[UPLOAD_STORY_IMAGE] Public URL generated:', publicUrl);

    return new Response(
      JSON.stringify({
        success: true,
        publicUrl,
        storagePath,
        mimeType: contentType,
        providerUsed: providerUsed ?? null,
        storyId,
        chapterId: normalizedChapterId,
        imageType,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[UPLOAD_STORY_IMAGE] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to upload story image',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
