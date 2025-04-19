import { toast } from "sonner";

// Tipos para la API de MiniMaxi
export interface MiniMaxiTTSOptions {
  text: string;
  voiceId?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  model?: string;
}

// Voces disponibles en MiniMaxi
export const MINIMAXI_VOICES = [
  { id: 'Spanish_Narrator', name: 'Narrador Español', description: 'Voz masculina de narrador en español' },
  { id: 'Spanish_Female_1', name: 'Española 1', description: 'Voz femenina en español' },
  { id: 'Spanish_Male_1', name: 'Español 1', description: 'Voz masculina en español' },
];

// Credenciales - En producción deberían estar en variables de entorno
const API_KEY = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiJJdmFubyBHYXJjaWEiLCJVc2VyTmFtZSI6Ikl2YW5vIEdhcmNpYSIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTEzNjY3MDM1NzgzNDk5ODcxIiwiUGhvbmUiOiIiLCJHcm91cElEIjoiMTkxMzY2NzAzNTc3OTMwNTU2NyIsIlBhZ2VOYW1lIjoiIiwiTWFpbCI6Iml2YW5vZ2FyY2lhLnNwYW5AZ21haWwuY29tIiwiQ3JlYXRlVGltZSI6IjIwMjUtMDQtMjAgMDM6MjU6MjUiLCJUb2tlblR5cGUiOjEsImlzcyI6Im1pbmltYXgifQ.i9OZ9ZRCsRxmp5BxsehWfeki-n_0SYu4CyNcphiAounHQb5z2FQ34iHRY8IxtNwgL6hjT7efmI6BT0Lj6wFb5Pmx59yQxiALcERAviKJvrxOQKe8LCBrtFFRrT8zGg76QtAJ5dcomYXQi78cMxUyz1U6PgMzcHrmuJg5A_gJaoRUanbevSCX9ckFiOYkvsre-5k7itsGzZooGKHTmNC9VERxHsKnOuwp_eXzXjUpt4xjxw5wctaz4-huU_0EjwnNcse9daybtOOLZVTe4W8OVBWUBAHv4R50ff5dlrGmsHHiqH2wEaPwZsVZDFIKYOITZS2mFQ1c-dyWP_eGzdYwJA";  // TODO: Reemplazar con tu API_KEY real de MiniMaxi
const GROUP_ID = "1913667035779305567"; // TODO: Reemplazar con tu GROUP_ID real de MiniMaxi

/**
 * Genera audio a partir de texto usando la API de MiniMaxi
*/
export const generateMiniMaxiSpeech = async ({
    text,
    voiceId = 'Spanish_Narrator',
    speed = 1,
    volume = 1,
    pitch = 0,
    model = 'speech-02-hd',
}: MiniMaxiTTSOptions): Promise<Blob> => {
    if (!text || text.trim() === '') {
        throw new Error('El texto es requerido');
    }
    
console.log("🚀 ~ API_KEY:", API_KEY)
  console.log(`Iniciando generación de audio con MiniMaxi... Texto: ${text.length} caracteres`);
  console.log(`Configuración: Voz=${voiceId}, Modelo=${model}`);
  
  try {
    // Preparar los datos para la API de MiniMaxi
    const requestData = {
      model: model,
      text: text,
      stream: false,
      voice_setting: {
        voice_id: voiceId,
        speed: speed,
        vol: volume,
        pitch: pitch
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: "mp3",
        channel: 1
      }
    };

    // Llamar a la API de MiniMaxi
    const response = await fetch(`https://api.minimaxi.chat/v1/t2a_v2?GroupId=${GROUP_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error en la API de MiniMaxi:', errorText);
      throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
    }
    
    // Parsear la respuesta JSON de la API
    const jsonResponse = await response.json();
    console.log("Respuesta de la API:", jsonResponse);
    
    // Verificar que la respuesta tenga el formato esperado
    if (!jsonResponse.data || !jsonResponse.data.audio) {
      console.error('Respuesta inesperada de la API:', jsonResponse);
      throw new Error('Formato de respuesta inesperado de la API');
    }
    
    // Extraer la información del audio
    const { audio } = jsonResponse.data;
    const { audio_format } = jsonResponse.extra_info || { audio_format: "mp3" };
    
    // Convertir la cadena hexadecimal en un array de bytes
    const byteArray = hexStringToUint8Array(audio);
    
    // Crear un blob a partir del array de bytes
    const audioBlob = new Blob([byteArray], { 
      type: `audio/${audio_format}`
    });
    
    console.log("Blob de audio creado:", audioBlob.size, "bytes, tipo:", audioBlob.type);
    console.log("Información adicional:", jsonResponse.extra_info);
    
    return audioBlob;
  } catch (error) {
    console.error('Error en generación de voz con MiniMaxi:', error);
    toast.error(`Error al generar audio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    throw error;
  }
};

// Función auxiliar para convertir una cadena hexadecimal en un array de bytes
function hexStringToUint8Array(hexString: string): Uint8Array {
  // Eliminar posibles prefijos '0x' y espacios
  hexString = hexString.replace(/^0x/, '').replace(/\s/g, '');
  
  // Si la longitud es impar, añadir un 0 al principio
  if (hexString.length % 2 !== 0) {
    hexString = '0' + hexString;
  }
  
  // Crear un array de bytes del tamaño adecuado
  const bytes = new Uint8Array(hexString.length / 2);
  
  // Convertir cada par de caracteres hex en un byte
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
  }
  
  return bytes;
}

// Función para mapear voces de la aplicación a voces de MiniMaxi
export const mapVoiceToMiniMaxi = (appVoiceId: string): string => {
  const voiceMapping: {[key: string]: string} = {
    "el-sabio": "Spanish_Narrator",
    "el-capitan": "Spanish_Male_1",
    "el-animado": "Spanish_Male_1",
    "el-elegante": "Spanish_Narrator",
    "el-aventurero": "Spanish_Male_1",
    "el-enigmatico": "Spanish_Narrator",
    "el-risueno": "Spanish_Male_1",
    "el-tierno": "Spanish_Female_1"
  };
  
  return voiceMapping[appVoiceId] || "Spanish_Narrator";
}; 