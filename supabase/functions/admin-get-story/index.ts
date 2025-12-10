import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const ADMIN_CODE = 'TaleMe2025';
const DEFAULT_IMAGE_STYLE_ID = 'watercolor_child';
const DEFAULT_CREATION_MODE = 'standard';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-code',
};

/**
 * Admin endpoint to retrieve any story by ID
 * Bypasses RLS using service_role key after validating admin code
 * 
 * @request POST /admin-get-story
 * @param {string} storyId - Story UUID
 * @param {string} adminCode - Admin access code
 * @returns Story with chapters or error
 */
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { storyId, adminCode } = await req.json();

    // Validate admin code
    if (adminCode !== ADMIN_CODE) {
      return new Response(
        JSON.stringify({ error: 'Código de administrador inválido' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate storyId
    if (!storyId || typeof storyId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Story ID inválido' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with service_role key (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch story (bypasses RLS)
    const { data: storyData, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('*, image_style, creation_mode')
      .eq('id', storyId)
      .single();

    if (storyError || !storyData) {
      console.error('[admin-get-story] Story not found:', storyError);
      return new Response(
        JSON.stringify({ error: 'Historia no encontrada' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch chapters (bypasses RLS)
    const { data: chaptersData, error: chaptersError } = await supabaseAdmin
      .from('story_chapters')
      .select('*')
      .eq('story_id', storyId)
      .order('chapter_number', { ascending: true });

    if (chaptersError) {
      console.error('[admin-get-story] Error fetching chapters:', chaptersError);
      // Continue without chapters rather than failing
    }

    // Parse options if it's stored as JSON string in database
    let parsedOptions = storyData.options;
    if (typeof storyData.options === 'string') {
      try {
        parsedOptions = JSON.parse(storyData.options);
      } catch (e) {
        console.error('[admin-get-story] Error parsing options:', e);
        parsedOptions = { 
          genre: 'Desconocido', 
          language: 'es', 
          characters: [], 
          moral: '', 
          duration: 'short' 
        };
      }
    }

    const creationMode =
      storyData.creation_mode ||
      (parsedOptions?.creationMode as string | undefined) ||
      DEFAULT_CREATION_MODE;
    const imageStyle =
      (parsedOptions?.imageStyle as string | undefined) ||
      storyData.image_style ||
      DEFAULT_IMAGE_STYLE_ID;

    const optionsWithStyle = {
      ...parsedOptions,
      creationMode,
      imageStyle: creationMode === 'image' ? imageStyle : undefined,
    };

    // Construct response
    const story = {
      id: storyData.id,
      title: storyData.title,
      content: storyData.content,
      audioUrl: storyData.audio_url,
      options: optionsWithStyle,
      createdAt: storyData.created_at,
      additional_details: storyData.additional_details,
      user_id: storyData.user_id,
      image_style: storyData.image_style ?? imageStyle ?? DEFAULT_IMAGE_STYLE_ID,
      creation_mode: creationMode,
      chapters: chaptersData || [],
      hasMultipleChapters: (chaptersData?.length || 0) > 0,
      chaptersCount: chaptersData?.length || 0
    };

    console.log(`[admin-get-story] ✅ Story retrieved: ${story.id} (${story.title})`);

    return new Response(
      JSON.stringify({ story }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[admin-get-story] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
