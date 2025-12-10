// supabase/functions/generate-scenes-from-content/prompt.ts
// Prompt especializado para generar scenes desde contenido existente

/**
 * Creates a specialized prompt to generate scenes structure from existing story content
 * @param title Story title
 * @param content Full story content
 * @param language Story language
 * @param imageStyleDescriptor Prompt descriptor for the selected illustration style
 * @returns Prompt string that instructs AI to generate only the scenes object
 */
export function createScenesPrompt(title: string, content: string, language: string, imageStyleDescriptor: string): string {
  console.log(`[ScenesPrompt] Creating prompt for: "${title}" (${language}), content length: ${content.length}`);
  const styleDescriptor = imageStyleDescriptor?.trim() || 'acuarela suave con paleta pastel, bordes difuminados y texturas de papel, estética amable para niños';
  const stylePrefix = styleDescriptor.endsWith('.') ? styleDescriptor : `${styleDescriptor}.`;

  let prompt = `**ANÁLISIS DE CUENTO EXISTENTE Y GENERACIÓN DE PROMPTS VISUALES**\n\n`;
  
  prompt += `Título del cuento: "${title}"\n`;
  prompt += `Idioma: ${language}\n\n`;
  
  prompt += `**Contenido completo del cuento:**\n`;
  prompt += `${content}\n\n`;
  
  prompt += `---\n\n`;
  
  prompt += `**TU TAREA:**\n`;
  prompt += `Debes analizar el cuento anterior y generar un objeto JSON con prompts detallados para 6 imágenes usando este estilo visual: ${styleDescriptor}.\n\n`;
  
  prompt += `**INSTRUCCIONES DE ANÁLISIS:**\n`;
  prompt += `1. Lee atentamente el cuento completo\n`;
  prompt += `2. Identifica el/los personaje(s) principal(es) y extrae sus características visuales:\n`;
  prompt += `   - Tipo (niño, niña, animal, criatura mágica, etc.)\n`;
  prompt += `   - Edad o apariencia\n`;
  prompt += `   - Características físicas (cabello, ojos, rasgos distintivos)\n`;
  prompt += `   - Vestimenta COMPLETA con colores específicos\n`;
  prompt += `   - Accesorios (si los menciona el cuento)\n`;
  prompt += `3. Identifica 4 momentos CLAVE del cuento que sean visualmente representativos:\n`;
  prompt += `   - Escena 1: Inicio o presentación del personaje/situación\n`;
  prompt += `   - Escena 2: Desarrollo del conflicto o aventura\n`;
  prompt += `   - Escena 3: Punto culminante o momento crucial\n`;
  prompt += `   - Escena 4: Resolución o momento final positivo\n\n`;
  
  prompt += `**IMPORTANTE - Si el cuento NO describe vestimenta:**\n`;
  prompt += `Si el cuento no especifica colores o prendas de vestir del personaje, debes CREAR una vestimenta apropiada:\n`;
  prompt += `- Usa colores pasteles cálidos típicos de cuentos infantiles\n`;
  prompt += `- La vestimenta debe ser coherente con el contexto del cuento (época, lugar, tipo de personaje)\n`;
  prompt += `- Mantén la misma vestimenta en TODAS las escenas\n`;
  prompt += `- Sé específico: "vestido azul claro hasta las rodillas", "camisa blanca con pantalón verde", etc.\n\n`;
  
  prompt += `**FORMATO DE RESPUESTA (JSON):**\n`;
  prompt += `Debes responder con un ÚNICO objeto JSON válido con exactamente 7 keys:\n\n`;
  
  prompt += `{\n`;
  prompt += `  "character": "Descripción visual EXHAUSTIVA del/los personaje(s) principal(es)",\n`;
  prompt += `  "cover": "Prompt completo para imagen de portada",\n`;
  prompt += `  "scene_1": "Prompt completo para primera escena",\n`;
  prompt += `  "scene_2": "Prompt completo para segunda escena",\n`;
  prompt += `  "scene_3": "Prompt completo para tercera escena",\n`;
  prompt += `  "scene_4": "Prompt completo para cuarta escena",\n`;
  prompt += `  "closing": "Prompt completo para imagen de cierre (personaje de espaldas)"\n`;
  prompt += `}\n\n`;
  
  prompt += `**INSTRUCCIONES DETALLADAS PARA "character":**\n`;
  prompt += `Genera una descripción visual COMPLETA que incluya:\n`;
  prompt += `- Tipo exacto de personaje y edad aproximada\n`;
  prompt += `- Cabello: color, estilo, largo\n`;
  prompt += `- Rasgos faciales distintivos\n`;
  prompt += `- Vestimenta COMPLETA y DETALLADA con colores específicos:\n`;
  prompt += `  * Prenda superior (color, tipo)\n`;
  prompt += `  * Prenda inferior (color, tipo)\n`;
  prompt += `  * Calzado (tipo y color)\n`;
  prompt += `  * Accesorios (si aplica)\n`;
  prompt += `- Si hay MÚLTIPLES personajes, describe cada uno con el mismo nivel de detalle\n\n`;
  
  prompt += `Ejemplo: "Niña de 8 años, cabello castaño largo con trenzas, ojos grandes color miel, sonrisa amable. Viste un vestido azul claro hasta las rodillas con detalles dorados en el borde, zapatos de tacón bajo marrones, corona pequeña de flores silvestres en la cabeza."\n\n`;
  
  prompt += `**INSTRUCCIONES PARA CADA PROMPT DE ESCENA:**\n`;
  prompt += `Cada prompt (cover, scene_1-4, closing) DEBE:\n\n`;
  
  prompt += `1. **Comenzar siempre con:** "${stylePrefix}"\n\n`;
  
  prompt += `2. **Incluir la descripción COMPLETA de "character"** para mantener consistencia visual\n\n`;
  
  prompt += `3. **Describir la escena específica:**\n`;
  prompt += `   - **cover**: Portada artística con el título "${title}" de manera decorativa, elementos que representen la historia, composición atractiva\n`;
  prompt += `   - **scene_1 a scene_4**: Describir el MOMENTO EXACTO del cuento que aparece en esa escena\n`;
  prompt += `     * Qué está haciendo el personaje\n`;
  prompt += `     * Dónde está (escenario/fondo)\n`;
  prompt += `     * Elementos importantes de la escena\n`;
  prompt += `     * Posición y composición visual\n\n`;
  
  prompt += `4. **Mantener coherencia absoluta:**\n`;
  prompt += `   - MISMA vestimenta en todas las escenas\n`;
  prompt += `   - MISMOS colores\n`;
  prompt += `   - MISMOS rasgos del personaje\n\n`;
  
  prompt += `**INSTRUCCIONES ESPECÍFICAS PARA "closing":**\n`;
  prompt += `El prompt de cierre debe mostrar:\n`;
  prompt += `1. Al/los personaje(s) de ESPALDAS (vista posterior, back view)\n`;
  prompt += `2. En una pose o acción similar a la portada pero visto desde atrás\n`;
  prompt += `3. Vestimenta RECONOCIBLE desde atrás (mismo vestido/ropa que en todas las escenas)\n`;
  prompt += `4. Escenario relacionado con el final del cuento\n`;
  prompt += `5. Atmósfera de despedida, conclusión, esperanza\n\n`;
  
  prompt += `Ejemplo closing: "${stylePrefix} [Descripción completa del personaje]. Vista de espaldas, la niña camina alejándose hacia el horizonte del bosque. Se ve claramente su vestido azul claro y su corona de flores desde atrás. El sol está poniéndose, creando un ambiente cálido de despedida. Atmósfera de paz y nuevas aventuras."\n\n`;
  
  prompt += `**RECORDATORIOS CRÍTICOS:**\n`;
  prompt += `- Escapa correctamente caracteres JSON: \\n para saltos de línea, \\" para comillas, \\\\ para barras\n`;
  prompt += `- NO incluyas NADA antes del '{' ni después del '}'\n`;
  prompt += `- Asegúrate de que el JSON sea válido y parseable\n`;
  prompt += `- CADA prompt de escena DEBE incluir la descripción completa del personaje\n`;
  prompt += `- La vestimenta DEBE ser idéntica en todas las escenas\n`;
  prompt += `- Usa el idioma ${language} para los prompts\n`;
  prompt += `- Basa las escenas en el contenido REAL del cuento, no inventes nueva trama\n\n`;
  
  prompt += `**GENERA AHORA EL OBJETO JSON CON LOS 7 CAMPOS:**\n`;

  return prompt;
}
