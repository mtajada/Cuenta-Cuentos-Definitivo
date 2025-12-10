import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const ADMIN_CODE = 'TaleMe2025';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-code',
};

interface AdminRequestPayload {
  storyId?: string;
  adminCode?: string;
  chapterId?: string | null;
  imageTypes?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storyId, adminCode, chapterId, imageTypes }: AdminRequestPayload = await req.json();

    if (adminCode !== ADMIN_CODE) {
      return new Response(
        JSON.stringify({ error: 'Código de administrador inválido' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!storyId || typeof storyId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Story ID inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    let query = supabaseAdmin
      .from('story_images')
      .select(
        'image_type, storage_path, storage_bucket, provider, fallback_used, mime_type, original_resolution, final_resolution, resized_from, resized_to, latency_ms, chapter_id, status, style_id, openai_style'
      )
      .eq('story_id', storyId);

    if (Array.isArray(imageTypes) && imageTypes.length > 0) {
      query = query.in('image_type', imageTypes);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[admin-get-story-images] Error fetching metadata:', error);
      return new Response(
        JSON.stringify({ error: 'Error al obtener los metadatos de imágenes' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(
      `[admin-get-story-images] ✅ Metadata fetched for story ${storyId} (chapter: ${chapterId ?? 'all'})`
    );

    return new Response(
      JSON.stringify({ metadata: data ?? [] }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[admin-get-story-images] Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
