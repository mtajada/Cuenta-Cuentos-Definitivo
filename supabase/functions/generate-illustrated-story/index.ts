// supabase/functions/generate-illustrated-story/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Function generate-illustrated-story initializing...`);

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[GENERATE_ILLUSTRATED_STORY_DEBUG] Handling OPTIONS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Handling ${req.method} request`);

  try {
    // 1. Initialize Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Parse request body
    const requestBody = await req.json();
    const { storyId, chapterId, title, author, userId } = requestBody;

    console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Received request for story ${storyId}, chapter ${chapterId}, user ${userId}`);

    // 3. Validate required parameters
    if (!storyId || !chapterId || !title || !userId) {
      console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Missing required parameters`);
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch story content from database
    console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Fetching story content from database...`);
    console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] StoryId: ${storyId}, ChapterId: ${chapterId}`);
    
    let content: string;
    let actualChapterId = chapterId;

    // First, get the story data to check if it has content
    const { data: storyData, error: storyError } = await supabaseAdmin
      .from('stories')
      .select('content, id')
      .eq('id', storyId)
      .single();

    if (storyError || !storyData) {
      console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Story not found:`, storyError);
      return new Response(JSON.stringify({ error: 'Story not found in database' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to get content from story_chapters first
    const { data: chapterData, error: chapterError } = await supabaseAdmin
      .from('story_chapters')
      .select('content, id')
      .eq('id', chapterId)
      .single();

    if (chapterError || !chapterData) {
      console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Chapter not found in story_chapters (this is normal for initial stories), using story content...`);
      
      if (!storyData.content) {
        console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] No content found in story or chapters`);
        return new Response(JSON.stringify({ error: 'No content found for this story' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      content = storyData.content;
      actualChapterId = storyId; // Use storyId as chapter identifier for initial stories
      console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Using story content (${content.length} characters), actualChapterId: ${actualChapterId}`);
    } else {
      content = chapterData.content;
      console.log(`[GENERATE_ILLUSTRATED_STORY_DEBUG] Using chapter content (${content.length} characters), chapterId: ${chapterId}`);
    }

    // 5. Generate images for the story
    console.log(`[GENERATE_ILLUSTRATED_STORY_INFO] Starting image generation for story ${storyId}, chapter ${actualChapterId}`);

    // Call the image generation function
    const { error: imageError } = await supabaseAdmin.functions.invoke('upload-story-image', {
      body: {
        storyId,
        chapterId: actualChapterId,
        imageType: 'cover',
        prompt: `Create a beautiful, colorful cover illustration for a children's story titled "${title}". The illustration should be vibrant, engaging, and suitable for children. Style: digital art, bright colors, magical atmosphere.`
      }
    });

    if (imageError) {
      console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Error generating cover image:`, imageError);
      return new Response(JSON.stringify({ error: 'Failed to generate cover image' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate scene images
    const scenePrompts = [
      `Create a beautiful, colorful illustration for a children's story scene. The scene should be vibrant, engaging, and suitable for children. Style: digital art, bright colors, magical atmosphere.`,
      `Create a beautiful, colorful illustration for a children's story scene. The scene should be vibrant, engaging, and suitable for children. Style: digital art, bright colors, magical atmosphere.`
    ];

    for (let i = 0; i < scenePrompts.length; i++) {
      const { error: sceneError } = await supabaseAdmin.functions.invoke('upload-story-image', {
        body: {
          storyId,
          chapterId: actualChapterId,
          imageType: `scene_${i + 1}`,
          prompt: scenePrompts[i]
        }
      });

      if (sceneError) {
        console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Error generating scene ${i + 1} image:`, sceneError);
        return new Response(JSON.stringify({ error: `Failed to generate scene ${i + 1} image` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 6. Generate the illustrated PDF
    console.log(`[GENERATE_ILLUSTRATED_STORY_INFO] All images generated successfully. Now generating illustrated PDF...`);

    // Call the PDF generation function
    const { error: pdfError } = await supabaseAdmin.functions.invoke('generate-illustrated-pdf', {
      body: {
        storyId,
        chapterId: actualChapterId,
        title,
        author,
        content,
        userId
      }
    });

    if (pdfError) {
      console.error(`[GENERATE_ILLUSTRATED_STORY_ERROR] Error generating illustrated PDF:`, pdfError);
      return new Response(JSON.stringify({ error: 'Failed to generate illustrated PDF' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[GENERATE_ILLUSTRATED_STORY_INFO] Illustrated story generation completed successfully for user ${userId}`);

    // 6. Return success response
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Illustrated story generated successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: unknown) {
    console.error('[GENERATE_ILLUSTRATED_STORY_ERROR] Unhandled error in generate-illustrated-story:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: `Error interno del servidor: ${errorMessage}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}); 