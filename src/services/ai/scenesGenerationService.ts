import { supabase } from '../../supabaseClient';
import { StoryScenes } from '../../types';
import { DEFAULT_IMAGE_STYLE_ID, getImageStyleById } from '@/lib/image-styles';

interface GenerateScenesParams {
  storyId: string;
  content: string;
  title: string;
  language?: string;
  imageStyle?: string;
}

interface GenerateScenesResponse {
  scenes: StoryScenes;
  message?: string;
}

/**
 * Service for generating scenes structure from existing story content
 * Uses the generate-scenes-from-content edge function
 */
export class ScenesGenerationService {
  /**
   * Generates scenes structure from existing story content using AI
   * @param params Generation parameters
   * @returns Promise with generated scenes
   * @throws Error if generation fails
   */
  public static async generateScenesFromContent(params: GenerateScenesParams): Promise<StoryScenes> {
    console.log(`[ScenesGenerationService] Generating scenes for story ${params.storyId}`);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No hay sesión activa. Por favor, inicia sesión.');
      }

      const token = session.access_token;
      const edgeFunctionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-scenes-from-content`;
      const imageStyle = getImageStyleById(params.imageStyle)?.id ?? DEFAULT_IMAGE_STYLE_ID;

      console.log(`[ScenesGenerationService] Calling edge function: ${edgeFunctionUrl}`);

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          storyId: params.storyId,
          content: params.content,
          title: params.title,
          language: params.language || 'Español',
          imageStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
        const errorMessage = errorData.error || `HTTP Error: ${response.status}`;
        console.error('[ScenesGenerationService] Edge function error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data: GenerateScenesResponse = await response.json();

      // Validate response structure
      if (!data || !data.scenes || typeof data.scenes !== 'object') {
        console.error('[ScenesGenerationService] Invalid response structure:', data);
        throw new Error('La respuesta de generate-scenes-from-content no contiene scenes válidos.');
      }

      // Validate all required fields
      const requiredFields = ['character', 'cover', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'closing'];
      for (const field of requiredFields) {
        if (!data.scenes[field as keyof StoryScenes] || typeof data.scenes[field as keyof StoryScenes] !== 'string') {
          console.error(`[ScenesGenerationService] Missing or invalid field: ${field}`);
          throw new Error(`Scenes inválidos: falta el campo ${field}`);
        }
      }

      console.log('[ScenesGenerationService] Scenes generated successfully:', Object.keys(data.scenes));
      
      if (data.message) {
        console.log(`[ScenesGenerationService] Message: ${data.message}`);
      }

      return data.scenes;

    } catch (error) {
      console.error('[ScenesGenerationService] Error generating scenes:', error);
      
      // Re-throw with more context
      if (error instanceof Error) {
        throw error;
      }
      
      throw new Error('Error desconocido al generar scenes.');
    }
  }
}
