// src/services/ai/ttsService.ts
import { SYSTEM_PROMPT } from '@/constants/story-voices.constant';
import { supabase } from '@/supabaseClient';

/**
 * Secure TTS service that uses Supabase Edge Function
 * Maintains exact same functionality as the original direct OpenAI implementation
 * All OpenAI API keys are stored securely in Supabase secrets
 */
export type OpenAIVoiceType =
  | 'alloy'
  | 'echo'
  | 'fable'
  | 'onyx'
  | 'nova'
  | 'shimmer'
  | 'coral'
  | 'sage'
  | 'ash';

export interface TTSOptions {
  text: string;
  voice?: OpenAIVoiceType;
  model?: string;
  instructions?: string;
}

interface OpenAIError {
  status?: number;
  code?: string | number;
  message?: string;
}

function isOpenAIError(error: unknown): error is OpenAIError {
  return typeof error === 'object' && error !== null;
}

// Voces disponibles en OpenAI
export const OPENAI_VOICES = [
  { id: 'alloy' as const, name: 'Alloy', description: 'Alloy (Neutral)' },
  { id: 'echo' as const, name: 'Echo', description: 'Echo (Masculino)' },
  { id: 'fable' as const, name: 'Fable', description: 'Fable (Fantasía)' },
  { id: 'onyx' as const, name: 'Onyx', description: 'Onyx (Masculino)' },
  { id: 'nova' as const, name: 'Nova', description: 'Nova (Femenina)' },
  { id: 'shimmer' as const, name: 'Shimmer', description: 'Shimmer (Femenina)' },
  { id: 'coral' as const, name: 'Coral', description: 'Coral (Femenina)' },
  { id: 'sage' as const, name: 'Sage', description: 'Sage (Narrador)' },
  { id: 'ash' as const, name: 'Ash', description: 'Ash (Juvenil)' }
];

// Edge Function handles OpenAI client securely on the server side

// Función para obtener las voces disponibles
export const getAvailableVoices = async () => {
  return OPENAI_VOICES;
};

/**
 * Generates audio from text using secure Supabase Edge Function
 * Maintains exact same interface and behavior as the original direct OpenAI implementation
 * @param options TTS configuration options
 * @returns Promise<Blob> Audio blob from secure edge function
 */
export const generateSpeech = async ({
  text,
  voice = 'nova',
  model,
  instructions
}: TTSOptions): Promise<Blob> => {
  if (!text || text.trim() === '') {
    throw new Error('El texto es requerido');
  }

  // Limpiar el texto antes de procesarlo
  const cleanedText = cleanTextForSpeech(text);

  // Combinar el system prompt con las instrucciones específicas del narrador
  const fullInstructions = instructions 
    ? `${SYSTEM_PROMPT} ${instructions}`
    : SYSTEM_PROMPT;

  console.log(`Iniciando generación de audio... Texto: ${cleanedText.length} caracteres`);
  
  try {
    // Verificar autenticación antes de hacer la llamada
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
      throw new Error('Usuario no autenticado para generar audio');
    }

    // Preparar el body que se va a enviar
    const requestBody = {
      text: cleanedText,
      voice: voice,
      model: model,
      instructions: fullInstructions
    };

    // Obtener la URL de la Edge Function
    const functionsUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-audio`;

    // Usar fetch directo como solución al problema del body vacío en supabase.functions.invoke
    const response = await fetch(functionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionData.session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en Edge Function:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Obtener el audio como blob
    const data = await response.arrayBuffer();
    const error = null; // No hay error si llegamos aquí

    if (error) {
      throw new Error(error.message || 'Error al generar el audio');
    }

    // La Edge Function devuelve el audio como ArrayBuffer
    if (!data) {
      throw new Error('No se recibió audio del servicio');
    }

    // Convertir la respuesta a Blob
    const audioBlob = new Blob([data], { type: 'audio/mpeg' });
    
    console.log('Audio generado correctamente:', audioBlob.size, 'bytes');
    
    return audioBlob;
  } catch (error: unknown) {
    console.error('Error en generación de voz:', error);
    
    const openAIError = isOpenAIError(error) ? error as OpenAIError : null;
    
    // Mantener el mismo manejo de errores que tu servicio original
    if (openAIError?.status === 429 || openAIError?.code === 429) {
      throw new Error('Alcanzaste el máximo de créditos para generar un audio');
    }
    
    if (openAIError?.status === 401 || openAIError?.code === 'invalid_api_key') {
      throw new Error('Error de autenticación con el servicio de voz');
    }
    
    if (openAIError?.status === 400) {
      throw new Error('El texto proporcionado no es válido para generar audio');
    }
    
    if (openAIError?.status && openAIError.status >= 500) {
      throw new Error('El servicio de voz no está disponible temporalmente');
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Error inesperado al generar el audio';
    throw new Error(errorMessage);
  }
};

function cleanTextForSpeech(text: string): string {
  return text
    // Mantener caracteres especiales españoles
    .replace(/[^\w\s.,!?áéíóúñÁÉÍÓÚÑ-]/g, '')
    // Normalizar espacios
    .replace(/\s+/g, ' ')
    // Agregar pausas naturales
    .replace(/([.!?])\s+/g, '$1\n')
    .replace(/([.,])\s+/g, '$1 ')
    // Eliminar líneas vacías múltiples
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
