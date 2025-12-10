// supabase/functions/generate-illustrated-story/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';
import { GEMINI_PREFERRED_ASPECT_RATIO } from '../_shared/image-layout.ts';
import { normalizeIllustrationStyleId } from '../_shared/illustration-styles.ts';

console.log('[GENERATE_ILLUSTRATED_STORY_DEBUG] Function generate-illustrated-story initializing...');

const REQUIRED_IMAGE_TYPES = ['cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing'] as const;
type RequiredImageType = typeof REQUIRED_IMAGE_TYPES[number];

type ScenesPayload = Record<RequiredImageType, string> & { character?: string };

type GenerateImageResponse = {
  success?: boolean;
  publicUrl?: string | null;
  metadata?: Record<string, unknown> | null;
  error?: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveScenes(rawScenes: unknown): ScenesPayload | null {
  if (!rawScenes || typeof rawScenes !== 'object') return null;
  const data = rawScenes as Record<string, unknown>;
  for (const key of REQUIRED_IMAGE_TYPES) {
    if (!isNonEmptyString(data[key])) {
      return null;
    }
  }
  return {
    cover: (data.cover as string).trim(),
    scene_1: (data.scene_1 as string).trim(),
    scene_2: (data.scene_2 as string).trim(),
    scene_3: (data.scene_3 as string).trim(),
    scene_4: (data.scene_4 as string).trim(),
    closing: (data.closing as string).trim(),
    character: isNonEmptyString(data.character) ? (data.character as string).trim() : undefined,
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('[GENERATE_ILLUSTRATED_STORY_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Handling ${req.method} request`);

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Missing or invalid Authorization header');
    return new Response(JSON.stringify({ error: 'Token inválido o ausente' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );

    let requestBody: Record<string, unknown>;
    try {
      requestBody = await req.json();
    } catch (_parseError) {
      return new Response(JSON.stringify({ error: 'Cuerpo de la petición inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { storyId, chapterId, title, author } = requestBody as {
      storyId?: string;
      chapterId?: string;
      title?: string;
      author?: string | null;
    };

    if (!storyId || !chapterId || !title) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Missing required parameters');
      return new Response(JSON.stringify({ error: 'Faltan parámetros requeridos (storyId, chapterId, title)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !userData?.user) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Authentication failed', authError);
      return new Response(JSON.stringify({ error: 'No autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = userData.user.id;

    const { data: storyData, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('id, content, scenes, image_style, user_id')
      .eq('id', storyId)
      .single();

    if (storyError || !storyData) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Story not found', storyError);
      return new Response(JSON.stringify({ error: 'Historia no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (storyData.user_id && storyData.user_id !== userId) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] User does not own story', { storyUser: storyData.user_id, userId });
      return new Response(JSON.stringify({ error: 'No tienes permiso para esta historia' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: chapterData, error: chapterError } = await supabaseAdmin
      .from('story_chapters')
      .select('id, content, scenes')
      .eq('id', chapterId)
      .single();

    let content: string | null = null;
    let actualChapterId = chapterId;
    let scenesSource: unknown = storyData.scenes;

    if (chapterError || !chapterData) {
      console.log('[GENERATE_ILLUSTRATED_STORY_DEBUG] Chapter not found, using story content');
      if (typeof storyData.content === 'string' && storyData.content.length > 0) {
        content = storyData.content;
      }
      actualChapterId = storyId;
    } else {
      if (typeof chapterData.content === 'string' && chapterData.content.length > 0) {
        content = chapterData.content;
      }
      scenesSource = chapterData.scenes ?? storyData.scenes;
    }

    if (!content) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] No content found for story or chapter');
      return new Response(JSON.stringify({ error: 'No hay contenido disponible para ilustrar' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const scenes = resolveScenes(scenesSource);
    if (!scenes) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Scenes prompts missing or invalid');
      return new Response(JSON.stringify({ error: 'Faltan prompts de escenas; genera escenas antes de ilustrar' }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolvedStyleId = normalizeIllustrationStyleId(
      typeof (storyData as { image_style?: unknown }).image_style === 'string'
        ? (storyData as { image_style?: string }).image_style
        : null,
    );

    console.log(
      `[GENERATE_ILLUSTRATED_STORY_INFO] Starting image pipeline for story ${storyId}, chapter ${actualChapterId}, style ${resolvedStyleId ?? 'default'}`,
    );

    const generatedImages: { imageType: RequiredImageType; publicUrl: string; metadata?: Record<string, unknown> | null }[] = [];

    for (const imageType of REQUIRED_IMAGE_TYPES) {
      const prompt = scenes[imageType];
      const { data, error } = await supabaseAdmin.functions.invoke<GenerateImageResponse>('generate-image', {
        body: {
          prompt,
          storyId,
          chapterId: actualChapterId,
          imageType,
          desiredAspectRatio: GEMINI_PREFERRED_ASPECT_RATIO,
          styleId: resolvedStyleId ?? undefined,
        },
        headers: { Authorization: authHeader },
      });

      if (error) {
        console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Edge function generate-image failed for ${imageType}`, error);
        return new Response(JSON.stringify({ error: `Fallo al generar ${imageType}`, details: error.message ?? error }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!data?.success) {
        console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] generate-image returned failure for ${imageType}`, data);
        return new Response(JSON.stringify({ error: `No se pudo generar ${imageType}`, details: data?.error ?? null }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!data.publicUrl) {
        console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Missing publicUrl for ${imageType}; normalized upload is required`);
        return new Response(
          JSON.stringify({ error: `La ilustración ${imageType} no se subió al storage normalizado (images-stories)` }),
          {
            status: 502,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      generatedImages.push({
        imageType,
        publicUrl: data.publicUrl,
        metadata: data.metadata ?? null,
      });
    }

    console.log('[GENERATE_ILLUSTRATED_STORY_INFO] All images generated via generate-image. Invoking generate-illustrated-pdf...');

    const { error: pdfError, data: pdfData } = await supabaseAdmin.functions.invoke('generate-illustrated-pdf', {
      body: {
        storyId,
        chapterId: actualChapterId,
        title,
        author,
        content,
        userId,
      },
      headers: { Authorization: authHeader },
    });

    if (pdfError) {
      console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Error generating illustrated PDF', pdfError);
      return new Response(JSON.stringify({ error: 'Fallo al registrar PDF ilustrado', details: pdfError.message ?? pdfError }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[GENERATE_ILLUSTRATED_STORY_INFO] Illustrated story generation completed for user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Ilustraciones generadas y normalizadas con éxito',
        images: generatedImages,
        pdf: pdfData ?? null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error: unknown) {
    console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Unhandled error in generate-illustrated-story:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: `Error interno del servidor: ${errorMessage}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
