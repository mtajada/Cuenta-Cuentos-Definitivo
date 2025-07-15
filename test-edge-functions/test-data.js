// test-data.js - Datos de prueba realistas para Edge Functions
// Datos que simulan exactamente lo que enviaría el frontend

export const testCharacters = [
  {
    id: "char-luna-001",
    name: "Luna",
    profession: "Astronauta",
    hobbies: ["explorar", "leer"],
    personality: "valiente",
    description: "Una valiente astronauta que ama explorar el universo",
    characterType: "custom"
  },
  {
    id: "char-max-002", 
    name: "Chef Max",
    profession: "Cocinero",
    hobbies: ["cocinar", "jardinería"],
    personality: "creativo",
    description: "Un chef creativo que cultiva sus propios ingredientes",
    characterType: "custom"
  },
  {
    id: "char-ruby-003",
    name: "Dra. Ruby",
    profession: "Doctora",
    hobbies: ["ayudar", "estudiar"],
    personality: "amable",
    description: "Una doctora amable que siempre quiere ayudar a otros",
    characterType: "custom"
  }
];

// singleCharacter removed - now using unified multiple character system

// Payload para test de múltiples personajes (con compatibilidad temporal)
export const multipleCharactersPayload = {
  options: {
    characters: testCharacters,
    character: testCharacters[0], // Temporal: para compatibilidad con versión actual deployada
    genre: "aventura",
    moral: "La amistad y el trabajo en equipo son más valiosos que cualquier tesoro",
    duration: "medium"
  },
  language: "es",
  childAge: 7,
  additionalDetails: "Una historia donde Luna, Chef Max y Dra. Ruby trabajan juntos para resolver un misterio. Cada uno debe usar sus habilidades únicas."
};

// singleCharacterPayload removed - now using unified multiple character system

// Datos para test de continuación
export const mockStory = {
  id: "story-test-001",
  title: "La Gran Aventura de Luna, Chef Max y Dra. Ruby",
  content: `Había una vez tres amigos muy especiales que vivían en el pueblo de Estrella Dorada. Luna era una valiente astronauta que siempre miraba las estrellas con curiosidad. Chef Max era un cocinero creativo que preparaba los platos más deliciosos del pueblo. Y la Dra. Ruby era una doctora amable que cuidaba de todos los habitantes.

Un día, mientras Luna observaba el cielo con su telescopio, vio algo muy extraño: una luz brillante que caía del cielo como una estrella fugaz. "¡Amigos!" gritó Luna emocionada. "Tenemos que investigar esto juntos."

Chef Max dejó su cocina y la Dra. Ruby cerró su consulta. Los tres amigos se dirigieron hacia el lugar donde había caído la misteriosa luz. Al llegar, encontraron un pequeño meteorito que brillaba con colores mágicos.

"Esto es fascinante," dijo la Dra. Ruby examinando el objeto. "Nunca había visto algo así."
"Tal vez podamos usarlo para algo especial," sugirió Chef Max con una sonrisa.

Pero de repente, el meteorito comenzó a emitir una música misteriosa...`,
  options: {
    characters: testCharacters,
    character: testCharacters[0], // Compatibilidad hacia atrás
    genre: "aventura", 
    moral: "La amistad y el trabajo en equipo son más valiosos que cualquier tesoro",
    duration: "medium",
    language: "es"
  },
  createdAt: new Date().toISOString()
};

export const mockChapters = [
  {
    id: "chapter-001",
    chapter_number: 1,
    title: "El Descubrimiento del Meteorito Musical",
    content: `Los tres amigos se acercaron más al meteorito brillante. La música que emanaba de él era dulce y misteriosa, como si estuviera llamándolos.

"¿Creen que sea seguro?" preguntó la Dra. Ruby, sacando su estetoscopio para examinar el objeto.

Luna, con su valentía característica, se acercó primero. "Como astronauta, he estudiado muchos meteoritos. Este definitivamente no es normal, ¡pero parece amigable!"

Chef Max tuvo una idea brillante. "¿Y si preparamos algo especial para darle la bienvenida? En mi experiencia, la buena comida siempre ayuda a hacer amigos."

Mientras Chef Max sacaba ingredientes de su mochila de aventuras, la Dra. Ruby notó que el meteorito parecía responder a sus voces haciéndose más brillante.

"¡Creo que nos está escuchando!" exclamó Ruby con emoción.

De repente, del meteorito salió una pequeña criatura espacial del tamaño de una ardilla, con ojos grandes y brillantes como estrellas...`
  }
];

// Configuraciones de test variadas
export const testConfigurations = {
  multipleShort: {
    ...multipleCharactersPayload,
    options: {
      ...multipleCharactersPayload.options,
      duration: "short"
    }
  },
  multipleLong: {
    ...multipleCharactersPayload,
    options: {
      ...multipleCharactersPayload.options,
      duration: "long"
    }
  },
  multipleFantasy: {
    ...multipleCharactersPayload,
    options: {
      ...multipleCharactersPayload.options,
      genre: "fantasía",
      moral: "La magia está en la amistad verdadera"
    }
  },
  specialNeedTEA: {
    ...multipleCharactersPayload,
    specialNeed: "TEA",
    childAge: 6
  }
};

// URLs de Supabase (usando secrets disponibles en Supabase)
export const getSupabaseConfig = () => ({
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("APP_SERVICE_ROLE_KEY"),
  anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
  geminiApiKey: Deno.env.get("GEMINI_API_KEY"),
  textModel: Deno.env.get("TEXT_MODEL_GENERATE")
});

// Función helper para crear headers
export const createHeaders = (serviceRoleKey) => ({
  'Authorization': `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
  'apikey': serviceRoleKey
});

// Validadores de respuesta
export const validateStoryResponse = (response) => {
  const errors = [];
  
  if (!response.title || typeof response.title !== 'string') {
    errors.push('Título faltante o inválido');
  }
  
  if (!response.content || typeof response.content !== 'string') {
    errors.push('Contenido faltante o inválido');
  }
  
  if (response.content && response.content.length < 100) {
    errors.push('Contenido demasiado corto');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateContinuationOptionsResponse = (response) => {
  const errors = [];
  
  if (!response.options || !Array.isArray(response.options)) {
    errors.push('Opciones faltantes o no es array');
  } else {
    if (response.options.length !== 3) {
      errors.push(`Se esperaban 3 opciones, se recibieron ${response.options.length}`);
    }
    
    response.options.forEach((option, index) => {
      if (!option.summary || typeof option.summary !== 'string') {
        errors.push(`Opción ${index + 1}: summary faltante o inválido`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper para contar menciones de personajes
export const analyzeCharacterPresence = (content, characters) => {
  const analysis = {};
  
  characters.forEach(char => {
    const mentions = (content.match(new RegExp(char.name, 'gi')) || []).length;
    analysis[char.name] = {
      mentions,
      profession: char.profession,
      hasHobbies: char.hobbies.some(hobby => 
        content.toLowerCase().includes(hobby.toLowerCase())
      )
    };
  });
  
  return analysis;
};

// Payloads para Story Continuation Actions

// Payload para test de continuación con opción seleccionada
export const optionContinuationPayload = {
  action: 'optionContinuation',
  story: mockStory,
  chapters: mockChapters,
  selectedOptionSummary: "La pequeña criatura espacial emite sonidos curiosos. Los amigos intentan descubrir si puede hablar o necesita algo.",
  language: 'es',
  childAge: 7
};

// Payload para test de continuación libre
export const freeContinuationPayload = {
  action: 'freeContinuation',
  story: mockStory,
  chapters: mockChapters,
  language: 'es',
  childAge: 7
};

// Payload para test de continuación dirigida
export const directedContinuationPayload = {
  action: 'directedContinuation',
  story: mockStory,
  chapters: mockChapters,
  userDirection: "Los tres amigos descubren que la criatura espacial puede hablar y les cuenta que viene de un planeta lejano donde necesitan ayuda urgente.",
  language: 'es',
  childAge: 7
};

console.log('📦 Test data loaded successfully');
console.log(`🎭 ${testCharacters.length} test characters available`);
console.log(`⚙️ ${Object.keys(testConfigurations).length} test configurations ready`);