import { serve } from 'std/http/server.ts';
import { createClient, type SupabaseClient } from 'supabase';
import { corsHeaders } from '../_shared/cors.ts';

// Tipado para los datos de la base de datos (opcional pero recomendado)
interface ChapterAudioFile {
  id?: string;
  chapter_id: string;
  user_id: string;
  story_id: string;
  voice_id: string;
  storage_path: string;
  public_url: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

serve(async (req: Request) => {
  // Manejo de CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Variables de entorno del servidor no configuradas.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const supabaseClient: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const formData = await req.formData();

    const chapterId = formData.get('chapterId');
    const voiceId = formData.get('voiceId');
    const audioFile = formData.get('audioFile');
    const userId = formData.get('userId');
    const storyId = formData.get('storyId');

    if (
      typeof chapterId !== 'string' ||
      typeof voiceId !== 'string' ||
      !(audioFile instanceof File) ||
      typeof storyId !== 'string' ||
      typeof userId !== 'string'
    ) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros: storyId, chapterId, voiceId, userId o audioFile' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const bucketName = 'narrations'; 
    // Estructura de ruta mejorada: bucket/storyId/chapterId/voiceId.mp3
    const filePath = `${storyId}/${chapterId}/${voiceId}.mp3`; 

    console.log(`Subiendo archivo a: ${bucketName}/${filePath}`);

    const { error: uploadError } = await supabaseClient.storage
      .from(bucketName)
      .upload(filePath, audioFile, {
        cacheControl: '3600',
        upsert: true, 
        contentType: 'audio/mpeg',
      });

    if (uploadError) {
      console.error('Error subiendo a Storage:', uploadError);
      // Si el error es 'Duplicate', significa que el archivo ya existe y upsert=true debería haberlo manejado.
      // Podría ser un problema de permisos o configuración del bucket si no es 'Duplicate'.
      // Para el caso específico de "The resource already exists" (cuando upsert=true),
      // podemos considerar que el archivo ya está y continuar para obtener su URL.
      if (uploadError.message !== 'The resource already exists') {
         throw uploadError;
      }
      console.warn(`El archivo en ${filePath} ya existía. Se intentará obtener su URL pública.`);
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error('Error obteniendo URL pública para:', filePath);
      throw new Error('No se pudo obtener la URL pública del archivo.');
    }
    const publicUrl = publicUrlData.publicUrl;
    console.log('URL Pública obtenida:', publicUrl);

    const chapterAudioInsert: Omit<ChapterAudioFile, 'id' | 'created_at'> = {
      chapter_id: chapterId,
      story_id: storyId,
      user_id: userId,
      voice_id: voiceId,
      storage_path: filePath, // Guardamos la ruta relativa al bucket
      public_url: publicUrl,
      // metadata: { fileSize: audioFile.size } // Opcional
    };

    const { data: dbData, error: dbError } = await supabaseClient
      .from('audio_files')
      .upsert(chapterAudioInsert, {
        onConflict: 'chapter_id, voice_id, user_id',
        // ignoreDuplicates: false, // Queremos que actualice si hay conflicto
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error guardando en base de datos:', dbError);
      throw dbError;
    }
    console.log('Registro en DB:', dbData);

    return new Response(JSON.stringify({ publicUrl, chapterAudioFile: dbData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    console.error('Error en Edge Function (upload-chapter-audio):', error);
    return new Response(JSON.stringify({ error: message || 'Error interno del servidor' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
