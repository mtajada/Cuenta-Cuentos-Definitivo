// supabase/edge-functions/story-continuation/prompt.ts
// v7.1 (JSON Output + Full Chapter Context): Prompts para la continuación de historias.
// Ahora incluye el contenido COMPLETO de los capítulos anteriores en el contexto.

// --- Tipos (asumidos/definidos según el uso en index.ts) ---
export interface CharacterOptions {
    name: string;
    profession?: string;
    hobbies?: string[];
    personality?: string;
}

export interface StoryOptions {
    characters: CharacterOptions[];   // Unified: array de personajes (1-4)
    genre: string;
    moral: string;
    duration?: string; // 'short', 'medium', 'long'
    language?: string;
    childAge?: number;
    specialNeed?: string;
}

export interface Story {
    id: string;
    title: string; // Título general de la historia
    content: string; // Contenido del capítulo inicial (o la historia base si no hay capítulos)
    options: StoryOptions;
}

export interface Chapter {
    id: string;
    chapter_number: number;
    title: string;
    content: string;
}

export interface ContinuationContextType {
    optionSummary?: string;
    userDirection?: string;
}

// --- Funciones de Prompt ---

/**
 * Crea el prompt para generar opciones de continuación.
 * Ahora incluye el contenido completo de la historia y capítulos anteriores.
 */
export function createContinuationOptionsPrompt(
    story: Story,
    chapters: Chapter[],
    language: string = 'es',
    childAge: number = 7,
    specialNeed: string | null = null,
): string {
    const functionVersion = "v7.1 (JSON Output + Full Context)";
    console.log(`[Prompt Helper ${functionVersion}] createContinuationOptionsPrompt for story ID: ${story.id}, lang: ${language}`);

    let prompt = `Eres un asistente creativo experto en generar continuaciones interesantes y coherentes para cuentos infantiles.
  Idioma Principal del Cuento: ${language}. Edad orientativa de los niños: ${childAge} años.`;

    if (specialNeed && specialNeed !== 'Ninguna') {
        prompt += `\nConsidera adaptaciones sutiles para la necesidad: "${specialNeed}", manteniendo claridad y tono positivo.`;
    }

    prompt += `\n\n--- CONTEXTO COMPLETO DE LA HISTORIA HASTA AHORA ---`;
    prompt += `\n\n**Historia Original (Título General: "${story.title}")**`;
    
    // Unified character system - always use characters array
    const characters = story.options.characters || [];
    
    if (characters.length > 1) {
        prompt += `\nPersonajes Principales (${characters.length}): `;
        characters.forEach((char, index) => {
            prompt += `${index + 1}. ${char.name}`;
            if (char.profession) prompt += ` (${char.profession})`;
            if (index < characters.length - 1) prompt += ', ';
        });
        prompt += `.`;
    } else if (characters.length === 1) {
        prompt += `\nPersonaje Principal: ${characters[0].name}.`;
    }
    
    prompt += `\n\n**Inicio del Cuento:**\n${story.content}\n`; // Contenido completo de la historia inicial

    if (chapters && chapters.length > 0) {
        prompt += `\n\n**Capítulos Anteriores:**`;
        chapters.forEach((chap) => {
            prompt += `\n\n**Capítulo ${chap.chapter_number}: "${chap.title}"**\n${chap.content}\n`; // Contenido completo de cada capítulo
        });
    }
    prompt += `\n--- FIN DEL CONTEXTO COMPLETO ---\n`;
    // NOTA: Proveer el contexto completo puede consumir muchos tokens.

    prompt += `\n\nBasándote en el estado actual de la historia (considerando TODO el contexto provisto arriba), genera 3 opciones concisas y atractivas para continuar el cuento. Cada opción debe ser un resumen breve (10-20 palabras) de un posible siguiente paso en la aventura.`;
    prompt += `\nLas opciones deben ser variadas, ofreciendo diferentes caminos o enfoques para la continuación.`;
    prompt += `\nAsegúrate de que las opciones exploren temas o acciones claramente distintos entre sí (por ejemplo: una opción sobre exploración, otra sobre la aparición de un nuevo personaje, y otra sobre usar un objeto existente de una manera novedosa).`;
    prompt += `\nDeben estar escritas en ${language}.`;

    prompt += `\n\n**Instrucciones de formato de respuesta (¡MUY IMPORTANTE!):**`;
    prompt += `\n* Debes responder con un ÚNICO objeto JSON.`;
    prompt += `\n* El objeto JSON debe tener una sola clave (key) llamada "options".`;
    prompt += `\n* El valor de la clave "options" debe ser un array (lista) de exactamente 3 objetos.`;
    prompt += `\n* Cada objeto dentro del array "options" debe tener una única clave (key) llamada "summary".`;
    prompt += `\n* El valor de la clave "summary" debe ser una cadena de texto (string) con el resumen de la opción de continuación (10-20 palabras en ${language}).`;
    prompt += `\n* Ejemplo del formato JSON esperado:`;
    prompt += `\n{`;
    prompt += `\n  "options": [`;
    prompt += `\n    { "summary": "El personaje decide explorar el bosque misterioso." },`;
    prompt += `\n    { "summary": "Aparece un nuevo amigo que necesita ayuda." },`;
    prompt += `\n    { "summary": "El personaje recuerda un objeto mágico que podría usar." }`;
    prompt += `\n  ]`;
    prompt += `\n}`;
    prompt += `\n* NO incluyas NADA antes del carácter '{' que inicia el objeto JSON.`;
    prompt += `\n* NO incluyas NADA después del carácter '}' que finaliza el objeto JSON.`;
    prompt += `\n* Asegúrate de que el JSON sea válido y completo.`;

    return prompt;
}

/**
 * Crea el prompt para generar la continuación de un capítulo.
 * Ahora incluye el contenido completo de la historia y capítulos anteriores.
 */
export function createContinuationPrompt(
    action: 'freeContinuation' | 'optionContinuation' | 'directedContinuation',
    story: Story,
    chapters: Chapter[],
    context: ContinuationContextType,
    language: string = 'es',
    childAge: number = 7,
    specialNeed: string | null = null,
    storyDuration: string = 'medium'
): string {
    const functionVersion = "v7.1 (JSON Output + Full Context)";
    console.log(`[Prompt Helper ${functionVersion}] createContinuationPrompt for story ID: ${story.id}, action: ${action}, lang: ${language}`);

    let prompt = `Eres un escritor experto continuando cuentos infantiles educativos y creativos.
  Escribe siempre en ${language}, con un estilo adecuado para niños de ${childAge} años.
  La historia original tiene un género de '${story.options.genre}' y una moraleja principal de '${story.options.moral}'.`;

    // Guía de longitud de capítulo
    prompt += `\n\n**Guía de longitud del capítulo:**`;
    if (storyDuration === 'short') prompt += `\n* Capítulo corto: ~800 tokens (aprox. 600-700 palabras).`;
    else if (storyDuration === 'long') prompt += `\n* Capítulo largo: ~2150 tokens (aprox. 1600-1800 palabras).`;
    else prompt += `\n* Capítulo de longitud media: ~1350 tokens (aprox. 1000-1200 palabras).`;
    prompt += `\nEstas cifras son aproximadas y sirven como referencia para la extensión esperada.`;

    if (specialNeed && specialNeed !== 'Ninguna') {
        prompt += `\nLa adaptación para "${specialNeed}" debe ser sutil, priorizando siempre la claridad, la comprensión y un tono positivo en la narración.`;
        prompt += ` A continuación, algunas guías específicas para "${specialNeed}":\n`;
        switch (specialNeed) {
            case 'TEA':
                prompt += `   - **Lenguaje Claro y Literal:** Usa frases cortas, directas y concretas. Evita el lenguaje figurado (metáforas, ironía) y las ambigüedades. Si es necesario introducir conceptos abstractos, explícalos de forma muy sencilla dentro de la narrativa.\n`;
                prompt += `   - **Estructura Predecible:** Mantén una secuencia narrativa muy clara y lógica. Puedes usar elementos o frases clave que se repitan para ayudar a anticipar eventos de forma natural.\n`;
                prompt += `   - **Descripciones Explícitas de Emociones e Interacciones Sociales:** Describe las emociones de los personajes de manera explícita y sencilla. Las interacciones sociales deben ser claras y directas.\n`;
                prompt += `   - **Enfoque en Detalles Concretos:** Céntrate en detalles observables y acciones concretas.\n`;
                prompt += `   - **Tono Positivo y Calmado:** Asegura un tono general tranquilizador y positivo.\n`;
                break;
            case 'TDAH':
                prompt += `   - **Inicio Atractivo y Trama Dinámica:** Comienza el capítulo de forma que capte el interés rápidamente. Mantén una trama con buen ritmo y elementos de sorpresa o curiosidad.\n`;
                prompt += `   - **Lenguaje Estimulante pero Conciso:** Utiliza un lenguaje vívido y atractivo. Alterna frases de diferentes longitudes, pero prioriza la concisión.\n`;
                prompt += `   - **Estructura Clara:** Asegura que el hilo conductor del capítulo sea fácil de seguir.\n`;
                prompt += `   - **Fomentar la Conexión:** Incluye preguntas retóricas cortas, onomatopeyas y exclamaciones.\n`;
                break;
            case 'Dislexia':
                prompt += `   - **Lenguaje Sencillo y Accesible:** Opta por vocabulario común y frases cortas. Prefiere la voz activa.\n`;
                prompt += `   - **Evitar Complejidad Lingüística Innecesaria:** Reduce el uso de palabras con ortografía compleja o poco fonéticas.\n`;
                prompt += `   - **Repetición Natural de Palabras Clave:** Reintroduce palabras importantes de forma sutil.\n`;
                prompt += `   - **Narrativa Clara y Lineal:** La progresión de eventos debe ser lógica y fácil de seguir.\n`;
                break;
            case 'Ansiedad':
                prompt += `   - **Tono General Tranquilizador y Optimista:** Mantén un ambiente narrativo calmado y consistentemente positivo.\n`;
                prompt += `   - **Resolución Clara y Segura del Conflicto (si aplica en el capítulo):** Si se introduce un mini-conflicto, debe resolverse de manera que refuerce la seguridad.\n`;
                prompt += `   - **Evitar Ambigüedades y Elementos Perturbadores:** No incluyas elementos que puedan ser fácilmente interpretados como amenazantes.\n`;
                prompt += `   - **Modelado Sutil de Afrontamiento Positivo:** Muestra personajes manejando pequeños desafíos con calma.\n`;
                break;
            case 'Down':
                prompt += `   - **Lenguaje Muy Concreto y Literal:** Usa palabras que se refieran a objetos, acciones y emociones observables.\n`;
                prompt += `   - **Frases Cortas y Estructura Simple:** Construye oraciones breves y con una estructura gramatical sencilla.\n`;
                prompt += `   - **Repetición de Información Clave:** Incorpora la repetición natural de nombres o acciones clave del capítulo.\n`;
                prompt += `   - **Secuencia Narrativa Muy Clara y Lineal:** El capítulo debe seguir un orden de eventos simple y cronológico.\n`;
                break;
            case 'Comprension':
                prompt += `   - **Frases Muy Claras y Sencillas:** Usa oraciones cortas, directas y con una estructura gramatical simple.\n`;
                prompt += `   - **Vocabulario Controlado y Explícito:** Utiliza palabras comunes. Si es necesario introducir una palabra nueva, clarifica su significado.\n`;
                prompt += `   - **Repetición Estratégica de Conceptos Clave:** Reitera información importante del capítulo.\n`;
                prompt += `   - **Conexiones Lógicas Explícitas:** Asegúrate de que las relaciones de causa-efecto sean muy evidentes.\n`;
                break;
            default:
                prompt += `   - Dado que "${specialNeed}" es una necesidad específica no listada, enfócate en principios generales: maximiza la claridad, asegura una estructura sencilla y comprensible, y mantén un tono positivo.\n`;
                break;
        }
    }

    prompt += `\n\n--- CONTEXTO COMPLETO DE LA HISTORIA HASTA AHORA ---`;
    prompt += `\n\n**Historia Original (Título General: "${story.title}")**`;
    
    // Unified character system - always use characters array
    const characters = story.options.characters || [];
    
    if (characters.length > 1) {
        prompt += `\nPersonajes Principales (${characters.length}): `;
        characters.forEach((char, index) => {
            prompt += `${index + 1}. ${char.name}`;
            if (char.profession) prompt += `, Profesión: ${char.profession}`;
            if (char.personality) prompt += `, Personalidad: ${char.personality}`;
            if (index < characters.length - 1) prompt += '; ';
        });
        prompt += `.`;
        
        // Add instructions for maintaining multiple character consistency
        prompt += `\n\n**IMPORTANTE para múltiples personajes:** En este capítulo, asegúrate de que todos los personajes mantengan su consistencia y que cada uno tenga participación relevante según el desarrollo de la historia.`;
    } else if (characters.length === 1) {
        const char = characters[0];
        prompt += `\nPersonaje Principal: ${char.name}`;
        if (char.profession) prompt += `, Profesión: ${char.profession}`;
        if (char.personality) prompt += `, Personalidad: ${char.personality}`;
        prompt += `.`;
    }
    
    prompt += `\n\n**Inicio del Cuento:**\n${story.content}\n`; // Contenido completo de la historia inicial

    if (chapters && chapters.length > 0) {
        prompt += `\n\n**Capítulos Anteriores:**`;
        chapters.forEach((chap) => {
            prompt += `\n\n**Capítulo ${chap.chapter_number}: "${chap.title}"**\n${chap.content}\n`; // Contenido completo de cada capítulo
        });
    }
    prompt += `\n--- FIN DEL CONTEXTO COMPLETO ---\n`;
    // NOTA: Proveer el contexto completo puede consumir muchos tokens.

    prompt += `\n\n--- TU TAREA ---`;
    prompt += `\nConsiderando TODO el contexto provisto arriba, escribe el PRÓXIMO CAPÍTULO de esta historia.`;

    if (action === 'optionContinuation' && context.optionSummary) {
        prompt += `\nLa continuación debe basarse en la siguiente opción elegida por el usuario: "${context.optionSummary}"`;
    } else if (action === 'directedContinuation' && context.userDirection) {
        prompt += `\nLa continuación debe seguir esta dirección específica proporcionada por el usuario: "${context.userDirection}"`;
    } else {
        prompt += `\nContinúa la historia de forma libre y creativa, manteniendo la coherencia con los eventos y personajes anteriores.`;
    }

    prompt += `\n\nGuías para el Nuevo Capítulo:`;
    prompt += `\n1. **Longitud del Capítulo:** Apunta a una longitud '${storyDuration}'.`;
    // INICIO DE CAMBIOS *****
    if (storyDuration === 'short') prompt += ` (aproximadamente 600-700 palabras).`;
    else if (storyDuration === 'long') prompt += ` (aproximadamente 1600-1800 palabras).`;
    else prompt += ` (aproximadamente 1000-1200 palabras).`;
    // FIN DE CAMBIOS *****

    prompt += `\n2. **Estructura del Capítulo:** Debe tener un flujo narrativo claro, conectando con el capítulo anterior y avanzando la trama general. Puede introducir un nuevo pequeño desafío o desarrollo.`;
    prompt += `\n3. **Tono y Estilo:** Mantén el tono y estilo del cuento original. Usa un lenguaje sencillo, pero emocionalmente resonante. Emplea onomatopeyas o pequeñas preguntas si es apropiado.`;
    prompt += `\n4. **Coherencia:** Asegúrate de que los personajes se comporten de manera consistente y que los nuevos eventos encajen lógicamente en la historia.`;
    prompt += `\n5. **Título del Capítulo:** Genera un título breve, atractivo y relevante para el contenido de este nuevo capítulo. Debe estar en ${language} y en "Sentence case".`;

    prompt += `\n\n**Instrucciones de formato de respuesta (¡MUY IMPORTANTE!):**`;
    prompt += `\n* Debes responder con un ÚNICO objeto JSON.`;
    prompt += `\n* El objeto JSON debe tener exactamente dos claves (keys): "title" y "content".`;
    prompt += `\n* El valor de la clave "title" debe ser una cadena de texto (string) que contenga ÚNICAMENTE el título generado para este nuevo capítulo, respetando las indicaciones del punto 5 de las "Guías para el Nuevo Capítulo".`;
    prompt += `\n* El valor de la clave "content" debe ser una cadena de texto (string) con TODO el contenido de este nuevo capítulo, comenzando directamente con la primera frase.`;
    // Create example with appropriate character reference
    const exampleCharacterName = characters.length > 0 ? characters[0].name : 'el protagonista';
    prompt += `\n* Ejemplo del formato JSON esperado: {"title": "El Desafío Inesperado", "content": "Al día siguiente, ${exampleCharacterName} se despertó sintiendo una extraña energía en el aire..."}`;
    prompt += `\n* NO incluyas NADA antes del carácter '{' que inicia el objeto JSON.`;
    prompt += `\n* NO incluyas NADA después del carácter '}' que finaliza el objeto JSON.`;
    prompt += `\n* Asegúrate de que el JSON sea válido y completo.`;
    prompt += `\n* NO uses markdown ni ningún otro formato DENTRO de los strings del JSON a menos que sea parte natural del texto del cuento.`;

    return prompt;
}