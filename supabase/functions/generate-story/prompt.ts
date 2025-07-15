// supabase/edge-functions/generate-story/prompt.ts
// v7.0 (JSON Output): Contiene las funciones para generar los prompts.
// createUserPrompt_JsonFormat ahora instruye a la IA para devolver JSON.

// createSystemPrompt: El contenido textual de la guía para la IA no cambia.
export function createSystemPrompt(language: string, childAge?: number, specialNeed?: string): string {
    console.log(`[Helper v7.0] createSystemPrompt: lang=${language}, age=${childAge}, need=${specialNeed}`); // Log version actualizada

    let base = `Eres un escritor experto en crear cuentos infantiles educativos y creativos. Escribe siempre en ${language}, con un estilo adecuado para niños de ${childAge ?? 7} años.`;
    if (specialNeed && specialNeed !== 'Ninguna') {
        base += ` La adaptación para "${specialNeed}" debe ser sutil, priorizando siempre la claridad, la comprensión y un tono positivo en la narración.`;
        base += ` A continuación, algunas guías específicas para "${specialNeed}":\n`;

        switch (specialNeed) {
            case 'TEA': // Trastorno del Espectro Autista
                base += `   - **Lenguaje Claro y Literal:** Usa frases cortas, directas y concretas. Evita el lenguaje figurado (metáforas, ironía) y las ambigüedades. Si es necesario introducir conceptos abstractos, explícalos de forma muy sencilla dentro de la narrativa.\n`;
                base += `   - **Estructura Predecible:** Mantén una secuencia narrativa muy clara y lógica (inicio, desarrollo con un problema claro, final con resolución). Puedes usar elementos o frases clave que se repitan para ayudar a anticipar eventos de forma natural.\n`;
                base += `   - **Descripciones Explícitas de Emociones e Interacciones Sociales:** Describe las emociones de los personajes de manera explícita y sencilla (ej. 'Lucas se sintió alegre cuando...'). Las interacciones sociales deben ser claras y directas.\n`;
                base += `   - **Enfoque en Detalles Concretos:** Céntrate en detalles observables y acciones concretas en lugar de pensamientos o intenciones internas muy complejas, a menos que se expliquen de forma simple.\n`;
                base += `   - **Tono Positivo y Calmado:** Asegura un tono general tranquilizador y positivo.\n`;
                break;
            case 'TDAH': // Déficit de Atención e Hiperactividad
                base += `   - **Inicio Atractivo y Trama Dinámica:** Comienza la historia de forma que capte el interés rápidamente. Mantén una trama con buen ritmo y elementos de sorpresa o curiosidad para sostener la atención.\n`;
                base += `   - **Lenguaje Estimulante pero Conciso:** Utiliza un lenguaje vívido y atractivo. Alterna frases de diferentes longitudes, pero prioriza la concisión para facilitar el seguimiento. Evita descripciones excesivamente largas o pasajes muy densos sin acción.\n`;
                base += `   - **Estructura Clara:** Asegura que el hilo conductor de la historia sea fácil de seguir, con transiciones claras entre las partes.\n`;
                base += `   - **Fomentar la Conexión (a través del texto):** Incluye preguntas retóricas cortas (ej. '¿Adivinas qué pasó después?'), onomatopeyas y exclamaciones que hagan la narración más viva.\n`;
                break;
            case 'Dislexia': // Dislexia o Dificultad en Lectura
                base += `   - **Lenguaje Sencillo y Accesible:** Opta por vocabulario común y frases cortas. Prefiere la voz activa y estructuras gramaticales directas (Sujeto-Verbo-Predicado).\n`;
                base += `   - **Evitar Complejidad Lingüística Innecesaria:** Reduce el uso de palabras con ortografía muy compleja o poco fonéticas si existen alternativas más simples. No uses jerga ni lenguaje excesivamente formal.\n`;
                base += `   - **Repetición Natural de Palabras Clave:** Reintroduce palabras importantes de forma sutil en diferentes contextos para facilitar su reconocimiento y afianzamiento, sin que suene forzado.\n`;
                base += `   - **Narrativa Clara y Lineal:** La progresión de eventos debe ser lógica y fácil de seguir, sin saltos temporales o argumentales confusos.\n`;
                break;
            case 'Ansiedad': // Ansiedad o Miedos Específicos
                base += `   - **Tono General Tranquilizador y Optimista:** Mantén un ambiente narrativo calmado, amable y consistentemente positivo durante toda la historia.\n`;
                base += `   - **Resolución Clara y Segura del Conflicto:** El problema central debe resolverse de manera completa, positiva y que refuerce la sensación de seguridad. Evita finales ambiguos o abiertos que puedan generar inquietud.\n`;
                base += `   - **Evitar Ambigüedades y Elementos Perturbadores:** No incluyas elementos narrativos que puedan ser fácilmente interpretados como amenazantes. Sé cuidadoso con el suspense; si lo usas, que sea leve y se resuelva rápidamente de forma positiva.\n`;
                base += `   - **Modelado Sutil de Afrontamiento Positivo:** Si los personajes enfrentan pequeños desafíos o preocupaciones (comunes, no miedos intensos a menos que el usuario lo especifique), muéstralos manejándolos con calma, buscando ayuda de forma constructiva o encontrando soluciones prácticas y positivas.\n`;
                base += `   - **Previsibilidad Reconfortante:** Una estructura narrativa clara y con cierta previsibilidad en cuanto a su tono y resolución puede ser beneficiosa.\n`;
                break;
            case 'Down': // Síndrome de Down
                base += `   - **Lenguaje Muy Concreto y Literal:** Usa palabras que se refieran a objetos, acciones y emociones observables y concretas. Evita abstracciones y lenguaje figurado.\n`;
                base += `   - **Frases Cortas y Estructura Simple:** Construye oraciones breves y con una estructura gramatical sencilla (Sujeto-Verbo-Objeto).\n`;
                base += `   - **Repetición de Información Clave:** Incorpora la repetición natural de nombres de personajes, lugares importantes, acciones clave o frases pegadizas para reforzar la memoria y la comprensión.\n`;
                base += `   - **Secuencia Narrativa Muy Clara y Lineal:** La historia debe seguir un orden de eventos simple, cronológico y fácil de anticipar. Divide la historia en partes claras si es posible (ej. primero pasó esto, luego esto otro, y al final...). \n`;
                base += `   - **Temas Familiares y Relevantes:** Utiliza situaciones, personajes y temas que puedan ser fácilmente relacionados con experiencias cotidianas o intereses comunes de los niños.\n`;
                break;
            case 'Comprension': // Dificultades de Comprensión Auditiva o Lingüística
                base += `   - **Frases Muy Claras y Sencillas:** Usa oraciones cortas, directas y con una estructura gramatical simple. Evita la voz pasiva y las oraciones subordinadas complejas.\n`;
                base += `   - **Vocabulario Controlado y Explícito:** Utiliza palabras comunes y de alta frecuencia. Si es necesario introducir una palabra nueva, intenta que el contexto inmediato clarifique su significado de forma natural o usa una breve paráfrasis sencilla.\n`;
                base += `   - **Repetición Estratégica de Conceptos Clave:** Reitera información importante (nombres, lugares, ideas principales) de manera sutil y en diferentes momentos para facilitar su asimilación.\n`;
                base += `   - **Conexiones Lógicas Explícitas:** Asegúrate de que las relaciones de causa-efecto y las secuencias temporales sean muy evidentes. Puedes usar conectores sencillos y claros (ej. 'porque', 'entonces', 'después').\n`;
                base += `   - **Lenguaje Altamente Descriptivo (Visualizable):** Aunque la salida es texto, usa un lenguaje que ayude a crear imágenes mentales claras y vívidas de los personajes, escenarios y acciones.\n`;
                break;
            default:
                base += `   - Dado que "${specialNeed}" es una necesidad específica no listada en las guías detalladas, enfócate en aplicar principios generales de adaptación: maximiza la claridad del lenguaje, asegura una estructura narrativa sencilla y comprensible, y mantén un tono consistentemente positivo y alentador.\n`;
                break;
        }
    }
    base += ` La historia debe seguir una estructura narrativa clara: un inicio que capte la atención, un desarrollo con un conflicto claro y un final que resuelva el problema de manera positiva y educativa.`;
    base += ` Sé creativo, asegurándote de que la trama sea coherente y atractiva. Utiliza un lenguaje sencillo, pero emocionalmente resonante.`;
    base += ` Recuerda, la historia debe ser adecuada para su edad y debe ofrecer un aprendizaje valioso al final, manteniendo siempre un enfoque amigable y accesible para los niños.`;
    return base;
}

// Definición de tipos para las opciones del prompt de usuario (actualizado para múltiples personajes)
interface CharacterOptions {
    name: string;
    profession?: string;
    hobbies?: string[];
    personality?: string;
}

interface UserPromptOptions {
    characters: CharacterOptions[];   // Unified: array de personajes (1-4)
    genre: string;
    moral: string;
    duration?: string;
    language?: string;
}

interface CreateUserPromptParams {
    options: UserPromptOptions;
    additionalDetails?: string;
}

// createUserPrompt_JsonFormat: Anteriormente createUserPrompt_SeparatorFormat.
// Modificada para instruir a la IA a devolver un objeto JSON.
// El contenido textual de la guía para la IA no cambia, solo el formato de respuesta.
export function createUserPrompt_JsonFormat({ options, additionalDetails }: CreateUserPromptParams): string {
    console.log(`[Helper v7.0] createUserPrompt_JsonFormat: options=`, options, `details=`, additionalDetails); // Log version actualizada
    const storyDuration = options.duration || 'medium';
    const language = options.language || 'es';

    // Unified character system - always use characters array (1-4 characters)
    const characters = options.characters || [];
    const isMultipleCharacters = characters.length > 1;

    // Create base request with character handling
    let request = `Crea un cuento infantil. Género: ${options.genre}. Moraleja: ${options.moral}. `;
    
    if (isMultipleCharacters) {
        request += `Personajes principales (${characters.length}): `;
        characters.forEach((char, index) => {
            request += `${index + 1}. ${char.name}`;
            if (char.profession) request += `, profesión: ${char.profession}`;
            if (char.hobbies?.length) request += `, hobbies: ${char.hobbies.join(', ')}`;
            if (char.personality) request += `, personalidad: ${char.personality}`;
            if (index < characters.length - 1) request += '; ';
        });
        request += `.\n\n`;
        
        // Add specific instructions for multiple characters
        request += `**Instrucciones para múltiples personajes:**\n`;
        request += `- Asegúrate de que TODOS los personajes tengan participación significativa en la historia.\n`;
        request += `- Cada personaje debe contribuir de manera única según su profesión, hobbies y personalidad.\n`;
        request += `- Crea interacciones naturales y dinámicas entre los personajes.\n`;
        request += `- Mantén la historia enfocada y coherente a pesar de múltiples protagonistas.\n`;
        request += `- Los personajes deben trabajar juntos hacia la resolución del conflicto central.\n\n`;
    } else {
        const char = characters[0];
        request += `Personaje principal: ${char.name}`;
        if (char.profession) request += `, profesión: ${char.profession}`;
        if (char.hobbies?.length) request += `, hobbies: ${char.hobbies.join(', ')}`;
        if (char.personality) request += `, personalidad: ${char.personality}`;
        request += `.\n\n`;
    }

    // Content, length and structure instructions (sin cambios en el texto respecto a v6.1)
    request += `**Instrucciones de Contenido, Longitud y Estructura:**\n`;
    request += `1. **Duración objetivo:** '${storyDuration}'.\n`;

    if (storyDuration === 'short') request += `    * Guía (Corta): ~800 tokens.\n`; // Espaciado consistente con v6.1
    else if (storyDuration === 'long') request += `    * Guía (Larga): ~2150 tokens.\n`; // Espaciado consistente con v6.1
    else request += `    * Guía (Media): ~1350 tokens.\n`; // Espaciado consistente con v6.1

    // Additional user details (if any) (sin cambios en el texto respecto a v6.1)
    if (additionalDetails && typeof additionalDetails === 'string' && additionalDetails.trim()) {
        request += `\n**Instrucciones adicionales del usuario:**\n${additionalDetails.trim()}\n`;
    }

    // Story structure instructions (sin cambios en el texto respecto a v6.1)
    request += `2. **Estructura completa:** Inicio, desarrollo y final claros.\n`;

    // Tone and style (sin cambios en el texto respecto a v6.1)
    request += `3. **Tono y estilo:** Emplea onomatopeyas o pequeñas preguntas como: “¿Te imaginas…?”, “¡Splash!”, etc., para mantener la atención de los niños.\n`;
    request += `   Además, usa ocasionalmente la estructura de fábula, especialmente si el género lo permite (aventura, fantasía, etc.).\n`; // Espaciado consistente con v6.1

    // **Inspiration** (sin cambios en el texto respecto a v6.1)
    request += `4. **Inspiración:** Toma elementos de la tradición oral y de los clásicos de Disney (magia, amistad, humor inocente), pero crea personajes y situaciones originales. Evita copiar y busca innovar con ideas frescas y emocionantes.\n`;

    // Title request (texto general sin cambios, se adapta al formato JSON abajo)
    request += `5. **Título:** Genera un título extraordinario (memorable, original, etc.). El título debe seguir el estilo "Sentence case", donde solo la primera palabra y los nombres propios comienzan con mayúscula. El título debe estar escrito en el mismo idioma seleccionado para la historia: ${language}.\n`;

    // Response format instructions (MODIFICADO PARA JSON)
    request += `\n**Instrucciones de formato de respuesta (¡MUY IMPORTANTE!):**\n`;
    request += `* Debes responder con un ÚNICO objeto JSON.\n`;
    request += `* El objeto JSON debe tener exactamente dos claves (keys): "title" y "content".\n`;
    request += `* El valor de la clave "title" debe ser una cadena de texto (string) que contenga ÚNICAMENTE el título generado (idealmente entre 4 y 7 palabras), respetando las indicaciones del punto 5 sobre el título (idioma ${language}, "Sentence case").\n`;
    request += `* El valor de la clave "content" debe ser una cadena de texto (string) con TODO el contenido del cuento, comenzando directamente con la primera frase de la historia.\n`;
    request += `* Ejemplo del formato JSON esperado: {"title": "Un título extraordinario aquí", "content": "Había una vez en un lugar muy lejano..."}\n`;
    request += `* NO incluyas NADA antes del carácter '{' que inicia el objeto JSON.\n`;
    request += `* NO incluyas NADA después del carácter '}' que finaliza el objeto JSON.\n`;
    request += `* Asegúrate de que el JSON sea válido y completo.\n`;
    request += `* NO uses markdown ni ningún otro formato DENTRO de los strings del JSON a menos que sea parte natural del texto del cuento.\n`;

    return request;
}