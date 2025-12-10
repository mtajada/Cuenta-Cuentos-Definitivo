// src/services/StoryContinuationService.ts
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { Story, StoryChapter } from "../../types"; // Importa tus tipos
import { supabase } from "../../supabaseClient";

// Definir el tipo de respuesta esperada para continuaciones
interface ContinuationResponse {
  content: string;
  title: string;
}
// Definir tipo para opciones generadas
interface OptionsResponse {
  options: { summary: string }[];
}

type SupabaseFunctionError = FunctionsHttpError | FunctionsRelayError | FunctionsFetchError;

const formatFunctionsError = (error: SupabaseFunctionError): string => {
  if ('context' in error && error.context) {
    return `${error.message} - ${JSON.stringify(error.context)}`;
  }
  return error.message;
};

export class StoryContinuationService {

  /**
   * Llama a la Edge Function 'story-continuation' para diferentes acciones.
   * @param action La acción a realizar ('generateOptions', 'freeContinuation', etc.)
   * @param payload Los datos específicos para esa acción.
   * @returns La respuesta de la Edge Function (depende de la acción).
   */
  private static async invokeContinuationFunction<T = unknown>(action: string, payload: object): Promise<T> {
    console.log(`Enviando solicitud a la Edge Function story-continuation (action: ${action})...`);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error(sessionError?.message || 'Usuario no autenticado.');
    }
    const token = sessionData.session.access_token;

    const bodyPayload = {
      action: action,
      ...payload // Incluir el resto de los datos (story, chapters, etc.)
    };

    const { data, error } = await supabase.functions.invoke<T>('story-continuation', { // Usar tipo genérico o específico
      body: bodyPayload, // PASAR EL OBJETO DIRECTAMENTE
      headers: {
        'Authorization': `Bearer ${token}`
        // 'Content-Type': 'application/json' // DEJAR QUE INVOKE LO MANEJE
      }
    });

    if (error) {
      console.error(`Error en Edge Function story-continuation (action: ${action}):`, error);
      const message = formatFunctionsError(error);
      throw new Error(message);
    }

    console.log(`Respuesta recibida de story-continuation (action: ${action})`);
    return data as T; // Devolver datos (casteo puede ser necesario)
  }

  /**
   * Genera opciones de continuación.
   */
  public static async generateContinuationOptions(
    story: Story, 
    chapters: StoryChapter[],
    childAge?: number,
    specialNeed?: string | null
  ): Promise<OptionsResponse> {
    const response = await this.invokeContinuationFunction<OptionsResponse>('generateOptions', { 
      story, 
      chapters, 
      language: story.options.language,
      childAge,
      specialNeed
    });
    if (!response || !Array.isArray(response.options)) {
      console.error("Respuesta inválida para generateOptions:", response);
      throw new Error("No se pudieron generar las opciones de continuación.");
    }
    return response;
  }

  /**
   * Genera una continuación libre (contenido y título).
   */
  public static async generateFreeContinuation(story: Story, chapters: StoryChapter[]): Promise<ContinuationResponse> {
    const response = await this.invokeContinuationFunction<ContinuationResponse>('freeContinuation', { 
      story, 
      chapters, 
      language: story.options.language 
    });
    if (!response || typeof response.content !== 'string' || typeof response.title !== 'string') {
      console.error("Respuesta inválida para freeContinuation:", response);
      throw new Error("No se pudo generar la continuación libre.");
    }
    return response;
  }

  /**
   * Genera una continuación basada en una opción seleccionada (contenido y título).
   */
  public static async generateOptionContinuation(story: Story, chapters: StoryChapter[], selectedOptionSummary: string): Promise<ContinuationResponse> {
    const response = await this.invokeContinuationFunction<ContinuationResponse>('optionContinuation', { 
      story, 
      chapters, 
      selectedOptionSummary, 
      language: story.options.language 
    });
    if (!response || typeof response.content !== 'string' || typeof response.title !== 'string') {
      console.error("Respuesta inválida para optionContinuation:", response);
      throw new Error("No se pudo generar la continuación de opción.");
    }
    return response;
  }

  /**
   * Genera una continuación basada en la dirección del usuario (contenido y título).
   */
  public static async generateDirectedContinuation(story: Story, chapters: StoryChapter[], userDirection: string): Promise<ContinuationResponse> {
    const response = await this.invokeContinuationFunction<ContinuationResponse>('directedContinuation', { 
      story, 
      chapters, 
      userDirection, 
      language: story.options.language 
    });
    if (!response || typeof response.content !== 'string' || typeof response.title !== 'string') {
      console.error("Respuesta inválida para directedContinuation:", response);
      throw new Error("No se pudo generar la continuación dirigida.");
    }
    return response;
  }

  // generateChapterTitle ya no es necesaria para el flujo principal
  // public static async generateChapterTitle(content: string): Promise<{ title: string }> {
  //    // ... (código anterior si quieres mantenerla por alguna razón, pero no se llamará desde generateStory)
  // }
}
