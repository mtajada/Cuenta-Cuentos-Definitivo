import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { OpenAI } from "https://esm.sh/openai@4.40.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { getCorsHeaders } from '../_shared/cors.ts';

// Configuration
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
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  background?: 'opaque';
  model?: string;
  n?: number;
  storyId?: string;
  chapterId?: string;
  imageType?: string;
}

type ImageParams = {
  model: string;
  prompt: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
  quality: 'standard' | 'hd';
  n: number;
  background?: 'opaque';
  style?: 'vivid' | 'natural';
  response_format?: 'b64_json';
};

/**
 * Secure Edge Function to generate images using OpenAI DALL-E
 * All API keys are stored securely in Supabase secrets
 */
serve(async (req: Request) => {
  // Get dynamic CORS headers for this request
  const dynamicCorsHeaders = getCorsHeaders(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: dynamicCorsHeaders });
  }

  let userId: string | null = null;

  try {
    // 1. Authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        console.warn('[GENERATE_IMAGE_WARN] Invalid or missing Authorization header.');
        return new Response(JSON.stringify({ error: 'Token inválido.' }), { 
          status: 401, 
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    const token = authHeader.replace('Bearer ', '');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
        console.error('[GENERATE_IMAGE_ERROR] Authentication failed:', authError?.message || 'User not found for token.');
        return new Response(JSON.stringify({ error: 'No autenticado.' }), { 
          status: 401, 
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }
    userId = user.id;
    console.log(`[GENERATE_IMAGE_INFO] User Authenticated: ${userId}`);

    // 2. Parse request body
    const requestBody: ImageGenerationRequest = await req.json();
    const { 
      prompt, 
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      model = 'gpt-image-1',
      storyId,
      chapterId,
      imageType
    } = requestBody;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.warn(`[GENERATE_IMAGE_WARN] Invalid request body for user ${userId}: Prompt is missing or empty.`);
        return new Response(JSON.stringify({ error: 'Prompt inválido o ausente.' }), { 
          status: 400, 
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    console.log(`[GENERATE_IMAGE_INFO] Generating image for user ${userId}...`);

    // 3. Generate image with OpenAI 
    const imageParams: ImageParams = {
        model: model,
        prompt: prompt.trim(),
        size: size,
        quality: quality,
        n: requestBody.n || 1
    };

    // Agregar parámetros opcionales si existen
    if (requestBody.background) {
        imageParams.background = requestBody.background;
    }
    if (requestBody.style) {
        imageParams.style = requestBody.style;
    }

    // Solo agregar response_format si NO es gpt-image-1
    if (model !== 'gpt-image-1') {
        imageParams.response_format = 'b64_json';
    }

    console.log(`[GENERATE_IMAGE_DEBUG] Image params:`, JSON.stringify(imageParams, null, 2));

    const response = await openai.images.generate(imageParams);

    if (!response.data || response.data.length === 0) {
        console.error(`[GENERATE_IMAGE_ERROR] OpenAI returned no image data for user ${userId}`);
        return new Response(JSON.stringify({ error: 'No se pudo generar la imagen.' }), { 
          status: 502, 
          headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
        });
    }

    const imageData = response.data[0];
    let base64Image = imageData.b64_json;

    console.log(`[GENERATE_IMAGE_INFO] Image generated successfully for user ${userId}`);

    // 4. Optionally upload to storage if story details provided
    let publicUrl: string | null = null;
    let storagePath: string | null = null;

    if (storyId && chapterId && imageType) {
        try {
            const { data: uploadData, error: uploadError } = await supabaseAdmin.functions.invoke('upload-story-image', {
                body: imageData.url && !base64Image ? {
                    imageUrl: imageData.url,
                    imageType: imageType,
                    storyId: storyId,
                    chapterId: chapterId
                } : {
                    imageBase64: base64Image || undefined,
                    imageType: imageType,
                    storyId: storyId,
                    chapterId: chapterId
                }
            });

            if (uploadError) {
                console.error(`[GENERATE_IMAGE_ERROR] Failed to upload image to storage:`, uploadError);
            } else {
                publicUrl = uploadData?.publicUrl || null;
                storagePath = uploadData?.path || null;
                console.log(`[GENERATE_IMAGE_INFO] Image uploaded to storage successfully`);
            }
        } catch (uploadError) {
            console.error(`[GENERATE_IMAGE_ERROR] Exception during image upload:`, uploadError);
        }
    }
    
    // If we didn't upload, ensure we can return something useful
    if (!publicUrl) {
        // If base64 is not available but URL exists, try to convert now for response compatibility
        if (!base64Image && imageData.url) {
            try {
                const imageResponse = await fetch(imageData.url);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                }
                const imageBuffer = await imageResponse.arrayBuffer();
                base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
            } catch (urlError) {
                console.error(`[GENERATE_IMAGE_ERROR] Failed to convert URL to base64 for response:`, urlError);
            }
        }
        if (!base64Image && !imageData.url) {
            console.error(`[GENERATE_IMAGE_ERROR] No image data available for user ${userId}`);
            return new Response(JSON.stringify({ error: 'No se recibió imagen del servicio.' }), { 
              status: 502, 
              headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' } 
            });
        }
    }

    return new Response(
        JSON.stringify({
            success: true,
            imageBase64: publicUrl ? undefined : base64Image,
            imageUrl: publicUrl ? undefined : imageData.url,
            revisedPrompt: imageData.revised_prompt || prompt,
            publicUrl: publicUrl,
            storagePath: storagePath,
            metadata: {
                model: model,
                size: size,
                quality: quality,
                style: style,
                storyId: storyId,
                chapterId: chapterId,
                imageType: imageType
            }
        }),
        {
            headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' },
            status: 200
        }
    );

  } catch (error) {
    console.error(`[GENERATE_IMAGE_ERROR] Unhandled error in generate-image function for user ${userId || 'UNKNOWN'}:`, error);
    
    let errorMessage = 'Error interno del servidor al generar la imagen.';
    let statusCode = 500;
    
    // Handle specific OpenAI errors
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
    
    return new Response(JSON.stringify({ 
        error: errorMessage,
        success: false 
    }), {
        status: statusCode,
        headers: { ...dynamicCorsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
