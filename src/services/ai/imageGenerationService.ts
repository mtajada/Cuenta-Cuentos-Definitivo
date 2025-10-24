import { SYSTEM_PROMPT_BASE, IMAGES_TYPE } from '@/constants/story-images.constant';
import { supabase } from '@/supabaseClient';

interface ImageGenerationOptions {
  title: string;
  content: string;
  storyId: string;
  chapterId?: string | number;
}

interface GeneratedImage {
  type: string;
  url: string;
  prompt: string;
  base64?: string;
}

interface ImageGenerationResult {
  success: boolean;
  images: GeneratedImage[];
  error?: string;
}

/**
 * Secure service for generating story images using Supabase Edge Function
 * All OpenAI API keys are stored securely in Supabase secrets
 */
export class ImageGenerationService {
  private static readonly MODEL = 'gpt-image-1';
  private static readonly SIZE = '1024x1536' as const;
  private static readonly QUALITY = 'medium' as const;

  /**
   * Generates all story images (cover, scenes, character) with optimized performance and fallback
   * @param options Story data for image generation
   * @returns Promise with generation results
   */
  static async generateStoryImages(options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    const { title, content, storyId, chapterId = 1 } = options;
    
    try {
      console.log('[ImageGeneration] Starting optimized image generation for story:', storyId);
      
      // Create optimized prompts for each image type
      const prompts = this.createOptimizedImagePrompts(title, content);
      
      // Strategy: Generate base image first, then variations for scenes to save costs
      const imageTypes = [IMAGES_TYPE.COVER, IMAGES_TYPE.SCENE_1, IMAGES_TYPE.SCENE_2, IMAGES_TYPE.SCENE_3, IMAGES_TYPE.SCENE_4, IMAGES_TYPE.CLOSING];
      const successfulImages: GeneratedImage[] = [];
      const errors: string[] = [];
      
      // Generate images sequentially to allow for optimization based on previous results
      for (const imageType of imageTypes) {
        try {
          console.log(`[ImageGeneration] Generating ${imageType}...`);
          const result = await this.generateSingleImageWithFallback(
            imageType, 
            prompts[imageType], 
            storyId, 
            chapterId
          );
          
          if (result.success && result.image) {
            successfulImages.push(result.image);
            console.log(`[ImageGeneration] ✅ Successfully generated ${imageType}`);
          } else {
            errors.push(`${imageType}: ${result.error || 'Failed to generate'}`);
            console.warn(`[ImageGeneration] ⚠️ Failed to generate ${imageType}, but continuing with others`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${imageType}: ${errorMsg}`);
          console.error(`[ImageGeneration] ❌ Error generating ${imageType}:`, error);
        }
        
        // Small delay between generations to avoid rate limits
        if (imageType !== imageTypes[imageTypes.length - 1]) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`[ImageGeneration] Completed generation: ${successfulImages.length}/${imageTypes.length} images successful`);
      
      return {
        success: successfulImages.length > 0,
        images: successfulImages,
        error: errors.length > 0 ? `Algunas imágenes fallaron: ${errors.join('; ')}` : undefined
      };
      
    } catch (error) {
      console.error('[ImageGeneration] Critical error in image generation:', error);
      return {
        success: false,
        images: [],
        error: error instanceof Error ? error.message : 'Error crítico en generación de imágenes'
      };
    }
  }

  /**
   * Creates optimized prompts that maintain story context while ensuring visual consistency
   * Combines full story context with extracted elements for consistency
   */
  private static createOptimizedImagePrompts(title: string, content: string): Record<string, string> {
    // Extract key elements for visual consistency
    const contentSummary = this.extractStoryElements(content);
    
    // Enhanced base style with consistency instructions
    const baseStyle = `Estilo acuarela tradicional infantil, colores suaves y cálidos, técnica de acuarela con bordes difuminados, paleta de colores pasteles, fondo luminoso, ambiente mágico y acogedor.

IMPORTANTE: Mantener consistencia visual - ${contentSummary.character} debe aparecer con las mismas características físicas en todas las imágenes (mismos colores, rasgos, vestimenta básica). El ${contentSummary.setting} debe mantener la misma paleta de colores y estilo arquitectónico/natural.`;

    // Base context with full story content but optimized structure
    const storyContext = `**Contexto del Cuento:**
Título: "${title}"
Personaje Principal: ${contentSummary.character}
Escenario: ${contentSummary.setting}
Ambiente: ${contentSummary.mood}

**Historia Completa:**
${content}`;

    return {
      [IMAGES_TYPE.COVER]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA PORTADA:**
Genera una imagen de PORTADA que capture la esencia del cuento. Debe incluir el título "${title}" de manera artística y elementos visuales que representen la historia principal. El ${contentSummary.character} debe ser prominente y establecer el estilo visual que se mantendrá en las escenas.

${baseStyle}`,

      [IMAGES_TYPE.SCENE_1]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA PRIMERA ESCENA:**
Genera una imagen de la PRIMERA ESCENA más importante del cuento, donde el ${contentSummary.character} debe ser el elemento central de la composición. Muestra un momento clave de la historia con el protagonista en acción, MANTENIENDO EXACTAMENTE las mismas características visuales establecidas (colores, rasgos físicos, vestimenta).

${baseStyle}`,

      [IMAGES_TYPE.SCENE_2]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA SEGUNDA ESCENA:**
Genera una imagen de la SEGUNDA ESCENA más importante del cuento, donde el ${contentSummary.character} debe ser prominente. Representa otro momento crucial diferente al anterior, mostrando al protagonista en una situación distinta pero MANTENIENDO PERFECTAMENTE las características visuales establecidas en las imágenes anteriores.

${baseStyle}`,

      [IMAGES_TYPE.SCENE_3]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA TERCERA ESCENA:**
Genera una imagen de la TERCERA ESCENA importante del cuento. El ${contentSummary.character} debe continuar siendo el foco principal. Ilustra un momento de desarrollo o giro en la historia, MANTENIENDO EXACTAMENTE la misma apariencia del personaje y estilo visual de las escenas anteriores.

${baseStyle}`,

      [IMAGES_TYPE.SCENE_4]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA CUARTA ESCENA:**
Genera una imagen de la ESCENA FINAL o desenlace del cuento. El ${contentSummary.character} debe aparecer en el momento culminante o conclusión de la historia. Mantén perfecta consistencia visual con todas las imágenes anteriores, mostrando la resolución del cuento de forma visualmente satisfactoria.

${baseStyle}`,

      [IMAGES_TYPE.CLOSING]: `${SYSTEM_PROMPT_BASE}

${storyContext}

**INSTRUCCIONES PARA IMAGEN DE CIERRE:**
Genera una imagen de CIERRE del cuento que muestre ${contentSummary.characterCount > 1 ? 'a los personajes principales' : `al ${contentSummary.character}`} de ESPALDAS caminando hacia el horizonte. ${contentSummary.characterCount > 1 ? 'Los personajes deben ir TOMADOS DE LA MANO, mostrando su vínculo y compañerismo.' : 'El personaje camina solo pero con confianza hacia su futuro.'} 

La composición debe ser:
- Vista posterior (back view) mostrando la espalda del/los personaje(s)
- Caminando hacia un horizonte luminoso y prometedor
- El escenario debe reflejar el ${contentSummary.setting} del cuento
- Ambiente cálido de despedida y esperanza
- Transmite un sentimiento de conclusión, paz y nuevas aventuras por venir

La imagen debe mantener PERFECTAMENTE el estilo visual y las características físicas del/los personaje(s) establecidas en las imágenes anteriores. Esta es la despedida visual del cuento, debe ser emotiva y esperanzadora.

${baseStyle}`
    };
  }

  /**
   * Extracts key story elements for consistent image generation
   */
  private static extractStoryElements(content: string): { character: string; setting: string; mood: string; characterCount: number } {
    // Simple extraction logic - can be enhanced with AI analysis later
    const lowercaseContent = content.toLowerCase();
    
    // Detect character count (for closing image)
    let characterCount = 1;
    const multipleCharacterIndicators = ['dos personajes', 'ambos', 'juntos', 'acompañ', 'amigos', 'hermanos', 'compañeros'];
    if (multipleCharacterIndicators.some(indicator => lowercaseContent.includes(indicator))) {
      characterCount = 2;
    }
    
    // Detect character types
    let character = 'personaje principal';
    if (lowercaseContent.includes('niño') || lowercaseContent.includes('niña')) character = 'niño protagonista';
    else if (lowercaseContent.includes('animal')) character = 'animal protagonista';
    else if (lowercaseContent.includes('dragón')) character = 'dragón amigable';
    else if (lowercaseContent.includes('princesa')) character = 'princesa';
    else if (lowercaseContent.includes('príncipe')) character = 'príncipe';
    
    // Detect settings
    let setting = 'lugar mágico';
    if (lowercaseContent.includes('bosque')) setting = 'bosque encantado';
    else if (lowercaseContent.includes('jardín')) setting = 'jardín colorido';
    else if (lowercaseContent.includes('casa')) setting = 'hogar acogedor';
    else if (lowercaseContent.includes('escuela')) setting = 'escuela';
    else if (lowercaseContent.includes('parque')) setting = 'parque';
    
    // Detect mood
    let mood = 'atmósfera de aventura y alegría';
    if (lowercaseContent.includes('feliz') || lowercaseContent.includes('alegría')) mood = 'ambiente alegre y festivo';
    else if (lowercaseContent.includes('misterio')) mood = 'atmósfera misteriosa pero segura';
    else if (lowercaseContent.includes('amistad')) mood = 'ambiente cálido de amistad';
    
    return { character, setting, mood, characterCount };
  }

  /**
   * Creates specific prompts for each image type (legacy method, keep for compatibility)
   * CHARACTER is generated first to establish visual consistency for scenes
   */
  private static createImagePrompts(title: string, content: string): Record<string, string> {
    const baseContext = `**Cuento:**
Título: ${title}
Cuento: ${content}`;

    return {
    [IMAGES_TYPE.COVER]: `${SYSTEM_PROMPT_BASE}

${baseContext}

Genera una imagen de PORTADA que capture la esencia del cuento. Debe incluir el título de manera artística y elementos visuales que representen la historia principal, manteniendo la misma estética del personaje principal. Estilo acuarela tradicional de cuento infantil.`,

      [IMAGES_TYPE.SCENE_1]: `${SYSTEM_PROMPT_BASE}

${baseContext}

Genera una imagen de la PRIMERA ESCENA más importante del cuento, donde el PERSONAJE PRINCIPAL debe ser el elemento central de la composición. Debe mostrar un momento clave de la historia con el protagonista en acción, manteniendo las características visuales establecidas del personaje. Estilo acuarela tradicional de cuento infantil.`,

      [IMAGES_TYPE.SCENE_2]: `${SYSTEM_PROMPT_BASE}

${baseContext}

Genera una imagen de la SEGUNDA ESCENA más importante del cuento, donde el PERSONAJE PRINCIPAL debe ser prominente en la escena. Debe representar otro momento crucial diferente al anterior, mostrando al protagonista en una situación distinta pero manteniendo continuidad visual y las características del personaje establecidas. Estilo acuarela tradicional de cuento infantil.`
    };
  }

  /**
   * Generates a single image with fallback logic - does not stop PDF generation if images fail
   */
  private static async generateSingleImageWithFallback(
    imageType: string, 
    prompt: string, 
    storyId: string, 
    chapterId: string | number
  ): Promise<{ success: boolean; image?: GeneratedImage; error?: string }> {
    try {
      console.log(`[ImageGeneration] Attempting to generate ${imageType}...`);
      
      // Try to generate the image
      const result = await this.generateSingleImage(imageType, prompt, storyId, chapterId);
      
      if (result.success) {
        return result;
      }
      
      // If generation failed, log and return fallback information
      console.warn(`[ImageGeneration] ⚠️ Image generation failed for ${imageType}, PDF will use fallback styling`);
      return {
        success: false,
        error: `${imageType} generation failed: ${result.error}. PDF will use white background.`
      };
      
    } catch (error) {
      console.error(`[ImageGeneration] ❌ Critical error generating ${imageType}:`, error);
      return {
        success: false,
        error: `Critical error in ${imageType}: ${error instanceof Error ? error.message : 'Unknown error'}. PDF will use fallback.`
      };
    }
  }

  /**
   * Generates a single image and uploads it to Supabase (original method)
   */
  private static async generateSingleImage(
    imageType: string, 
    prompt: string, 
    storyId: string, 
    chapterId: string | number
  ): Promise<{ success: boolean; image?: GeneratedImage; error?: string }> {
    try {
      console.log(`[ImageGeneration] Generating ${imageType} image...`);
      
      // Generate image with OpenAI
      const imageBase64 = await this.callOpenAIImageGeneration(prompt);
      
      if (!imageBase64) {
        throw new Error('No image data returned from OpenAI');
      }
      
      // Upload to Supabase via Edge Function
      const uploadResult = await this.uploadImageToSupabase(imageBase64, imageType, storyId, chapterId);
      
      if (!uploadResult.success) {
        throw new Error(`Upload failed: ${uploadResult.error}`);
      }
      
      console.log(`[ImageGeneration] Successfully generated and uploaded ${imageType}`);
      
      return {
        success: true,
        image: {
          type: imageType,
          url: uploadResult.publicUrl!,
          prompt: prompt
        }
      };
      
    } catch (error) {
      console.error(`[ImageGeneration] Error generating ${imageType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Calls secure Edge Function to generate image using OpenAI DALL-E
   * @param prompt Image generation prompt
   * @returns Promise<string | null> Base64 image data or null if failed
   */
  private static async callOpenAIImageGeneration(prompt: string): Promise<string | null> {
    try {
      console.log('[ImageGeneration] Calling secure generate-image Edge Function...');
      
      // Usar supabase.functions.invoke para mejor integración
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: prompt.trim(),
          model: this.MODEL,
          size: this.SIZE,
          n: 1,
          quality: this.QUALITY,
          background: "opaque"
        }
      });

      if (error) {
        console.error('[ImageGeneration] Edge Function error:', error);
        
        // Manejar errores específicos
        const errorMessage = error.message || String(error);
        if (errorMessage.includes('content_policy')) {
          throw new Error('El contenido no cumple con las políticas de seguridad');
        } else if (errorMessage.includes('billing')) {
          throw new Error('Error de facturación del servicio de imágenes');
        } else if (errorMessage.includes('rate_limit')) {
          throw new Error('Se excedió el límite de solicitudes. Intenta de nuevo más tarde');
        }
        
        throw new Error(`Error en Edge Function: ${errorMessage}`);
      }
      
      if (!data?.success || !data?.imageBase64) {
        throw new Error('No se recibió imagen del servicio');
      }

      console.log('[ImageGeneration] Image generated successfully via Edge Function');
      
      return data.imageBase64;
    } catch (error) {
      console.error('[ImageGeneration] Secure image generation error:', error);
      throw new Error(`Error seguro de generación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  /**
   * Uploads generated image to Supabase storage via Edge Function
   */
  private static async uploadImageToSupabase(
    imageBase64: string, 
    imageType: string, 
    storyId: string, 
    chapterId: string | number
  ): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
    try {
      console.log(`[ImageGeneration] Uploading ${imageType} via Edge Function...`);

      // Usar supabase.functions.invoke para mejor integración
      const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
        'upload-story-image',
        {
          body: {
            imageBase64,
            imageType,
            storyId,
            chapterId: chapterId.toString()
          }
        }
      );

      if (functionError) {
        console.error('[ImageGeneration] Function error:', functionError);
        throw new Error(`Function error: ${functionError.message}`);
      }

      if (!functionResponse?.success) {
        const errorMsg = functionResponse?.error || functionResponse?.details || 'Unknown upload error';
        throw new Error(`Upload failed: ${errorMsg}`);
      }

      console.log(`[ImageGeneration] Successfully uploaded ${imageType}:`, functionResponse.publicUrl);

      return {
        success: true,
        publicUrl: functionResponse.publicUrl
      };
      
    } catch (error) {
      console.error('[ImageGeneration] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de subida'
      };
    }
  }
} 