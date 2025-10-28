import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UploadImageRequest {
  imageUrl?: string;  // Para URLs de OpenAI (método antiguo)
  imageBase64?: string; // Para datos base64 del nuevo método
  imageType: string;
  storyId: string;
  chapterId: string;
}

/**
 * Edge Function to upload story images to Supabase storage
 * Path structure: images-stories/storyId/chapterId/imageType.jpeg
 */
serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[UPLOAD_STORY_IMAGE] Starting image upload process...');

    // Get request data
    const { imageUrl, imageBase64, imageType, storyId, chapterId }: UploadImageRequest = await req.json();

    // Validate required fields
    if ((!imageUrl && !imageBase64) || !imageType || !storyId || !chapterId) {
      console.error('[UPLOAD_STORY_IMAGE] Missing required fields:', { 
        imageUrl: !!imageUrl, 
        imageBase64: !!imageBase64, 
        imageType, 
        storyId, 
        chapterId 
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: (imageUrl or imageBase64), imageType, storyId, chapterId' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate imageType
    const validImageTypes = ['cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing', 'character'];
    if (!validImageTypes.includes(imageType)) {
      console.error('[UPLOAD_STORY_IMAGE] Invalid image type:', imageType);
      return new Response(
        JSON.stringify({ error: `Invalid imageType. Must be one of: ${validImageTypes.join(', ')}` }),
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[UPLOAD_STORY_IMAGE] Processing ${imageType} for story ${storyId}, chapter ${chapterId}`);

    // Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Process image data (either from URL or base64)
    let imageBuffer: ArrayBuffer;
    
    if (imageBase64) {
      console.log('[UPLOAD_STORY_IMAGE] Processing base64 image data...');
      // Convert base64 to buffer
      const binaryString = atob(imageBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBuffer = bytes.buffer;
      console.log(`[UPLOAD_STORY_IMAGE] Processed base64 image: ${imageBuffer.byteLength} bytes`);
    } else if (imageUrl) {
      console.log('[UPLOAD_STORY_IMAGE] Downloading image from URL...');
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
      }

      const imageBlob = await imageResponse.blob();
      imageBuffer = await imageBlob.arrayBuffer();
      console.log(`[UPLOAD_STORY_IMAGE] Downloaded image: ${imageBuffer.byteLength} bytes`);
    } else {
      throw new Error('No image data provided');
    }

    // Define storage path: images-stories/storyId/chapterId/imageType.jpeg
    const storagePath = `${storyId}/${chapterId}/${imageType}.jpeg`;
    console.log(`[UPLOAD_STORY_IMAGE] Uploading to path: ${storagePath}`);
    console.log(`[UPLOAD_STORY_IMAGE_DEBUG] storyId: ${storyId}, chapterId: ${chapterId}, imageType: ${imageType}`);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('images-stories')
      .upload(storagePath, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('[UPLOAD_STORY_IMAGE] Upload error:', uploadError);
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    console.log('[UPLOAD_STORY_IMAGE] Upload successful:', uploadData);

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('images-stories')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;
    console.log(`[UPLOAD_STORY_IMAGE] Public URL generated: ${publicUrl}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        publicUrl: publicUrl,
        path: storagePath,
        imageType: imageType,
        storyId: storyId,
        chapterId: chapterId
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[UPLOAD_STORY_IMAGE] Error:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to upload story image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}) 