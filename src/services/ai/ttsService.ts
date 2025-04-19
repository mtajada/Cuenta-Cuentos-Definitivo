import { supabase } from '../../supabaseClient';

// Definir un tipo para las voces de OpenAI
export type OpenAIVoiceType = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'coral' | 'sage' | 'ash' | 'ballad';

interface TTSOptions {
  text: string;
  voice?: OpenAIVoiceType;
  model?: string;
  instructions?: string;
}

// Sistema de instrucciones - Prompt común para todos los narradores
const SYSTEM_PROMPT = "Eres un narrador de cuentos infantiles. Narra con un ritmo adecuado, haciendo pausas en los momentos correctos y enfatizando las partes importantes. Adapta tu narración para que sea adecuada para niños.";

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
  { id: 'ash' as const, name: 'Ash', description: 'Ash (Juvenil)' },
  { id: 'ballad' as const, name: 'Ballad', description: 'Ballad (Emocional)' }
];

// Función para obtener las voces disponibles
export const getAvailableVoices = async () => {
  // En OpenAI, las voces son fijas y no necesitamos hacer una llamada a la API
  return OPENAI_VOICES;
};

/**
 * Genera audio a partir de texto usando la Edge Function de Supabase que conecta con OpenAI
 */
export const generateSpeech = async ({
  text,
  voice = 'nova', // Nova por defecto (voz femenina)
  model = 'gpt-4o-mini-tts', // Usando el modelo más reciente
  instructions,
}: TTSOptions): Promise<Blob> => {
  if (!text || text.trim() === '') {
    throw new Error('El texto es requerido');
  }

  console.log('Verificando conexión a Supabase...');
  
  // Limpiar el texto antes de procesarlo
  const cleanedText = cleanTextForSpeech(text);
  
  // Combinar el system prompt con las instrucciones específicas del narrador
  const fullInstructions = instructions 
    ? `${SYSTEM_PROMPT} ${instructions}`
    : SYSTEM_PROMPT;

  console.log(`Iniciando generación de audio... Texto: ${cleanedText.length} caracteres`);
  console.log(`Configuración: Voz=${voice}, Modelo=${model}`);
  
  try {
    // Llamar a la Edge Function de Supabase
    const { data, error } = await supabase.functions.invoke('generate-audio', {
      body: {
        text: cleanedText,
        voice,
        model,
        instructions: fullInstructions
      }
    });
    
    if (error) {
      console.error('Error en la Edge Function:', error);
      throw new Error(`Error en la Edge Function: ${error.message}`);
    }
    
    // Verificar si la respuesta es válida
    if (!data) {
      throw new Error('No se recibieron datos de la Edge Function');
    }
    
    // Convertir la respuesta a un Blob
    // Safari requiere un manejo especial para los blobs de audio
    console.log("Recibidos datos de audio, creando blob...");
    
    // Asegurarse de que el tipo MIME sea compatible con Safari
    const audioBlob = new Blob([data], { 
      type: 'audio/mpeg' 
    });
    
    console.log("Blob de audio creado:", audioBlob.size, "bytes, tipo:", audioBlob.type);
    console.log('Audio generado correctamente');
    
    return audioBlob;
  } catch (error) {
    console.error('Error en generación de voz:', error);
    throw error;
  }
};

// Función auxiliar para limpiar el texto
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
