// src/services/ai/GenerateStoryService.ts
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { StoryOptions, Story, StoryScenes } from "../../types"; // Importar Story si no está
import { supabase } from "../../supabaseClient";

export interface GenerateStoryParams {
  options: Partial<StoryOptions> & {
    creationMode?: 'standard' | 'image';
    imageStyle?: string;
  }; // O el tipo completo si siempre está completo
  includeScenes?: boolean;
  language: string; // Required field for story generation
  childAge?: number;
  specialNeed?: string;
  additionalDetails?: string; // <-- Añadir nueva propiedad
  storyId?: string;
}

// Definir el tipo de respuesta esperada de la Edge Function
export interface GenerateStoryResponse {
  content: string;
  title: string;
  scenes?: StoryScenes; // prompts de imágenes generados por IA (solo modo ilustrado)
  imageStyle?: string;
  creationMode?: 'standard' | 'image';
  includeScenes?: boolean;
  storyId?: string;
}

type SupabaseFunctionError = FunctionsHttpError | FunctionsRelayError | FunctionsFetchError;

const formatFunctionsError = (error: SupabaseFunctionError): string => {
  if ('context' in error && error.context) {
    return `${error.message} - ${JSON.stringify(error.context)}`;
  }
  return error.message;
};

export class GenerateStoryService {
  /**
   * Generates initial story content and title using the 'generate-story' Edge Function.
   */
  public static async generateStoryWithAI(params: GenerateStoryParams): Promise<GenerateStoryResponse> {
    try {
      console.log('Enviando solicitud a la Edge Function generate-story con params:', params); // Loguear parámetros

      // Asegúrate de pasar el token de autenticación si la función lo requiere (lo requiere)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error(sessionError?.message || 'Usuario no autenticado.');
      }
      const token = sessionData.session.access_token;

      // DEBUG: Log the exact payload being sent including character info
      const charactersInfo = `Characters (${params.options.characters?.length || 0}): ${params.options.characters?.map(c => c.name).join(', ') || 'None'}`;
      const expectsScenes = params.includeScenes ?? params.options.creationMode !== 'standard';

      const { data, error } = await supabase.functions.invoke<GenerateStoryResponse>('generate-story', { // Especificar tipo de respuesta <T>
        body: {
          ...params,
          includeScenes: params.includeScenes ?? expectsScenes,
        }, // El cuerpo ya contiene las opciones, idioma, etc. y additionalDetails
        headers: {
          'Authorization': `Bearer ${token}` // Pasar el token
        }
      });

      if (error) {
        console.error('Error en Edge Function generate-story:', error);
        const message = formatFunctionsError(error);
        throw new Error(message);
      }

      // Validar que la respuesta tiene el formato esperado { content: string, title: string, scenes?: object }
      if (!data || typeof data.content !== 'string' || typeof data.title !== 'string') {
        console.error('Respuesta inesperada de generate-story:', data);
        throw new Error('La respuesta de generate-story no contiene contenido y título válidos.');
      }

      if (expectsScenes && !data.scenes) {
        console.error('Respuesta de generate-story sin scenes cuando eran esperados:', data);
        throw new Error('La respuesta de generate-story no incluye scenes en modo con imágenes.');
      }

      console.log('Respuesta de generate-story recibida (título):', data.title);
      if (data.scenes) {
        console.log('Respuesta de generate-story recibida (scenes):', Object.keys(data.scenes));
      }
      return data; // Devolver el objeto { content, title, scenes } completo

    } catch (error) {
      console.error('Error en GenerateStoryService.generateStoryWithAI:', error);
      // Relanzar para que el llamador (storyGenerator) pueda manejarlo
      throw error;
    }
  }
}
