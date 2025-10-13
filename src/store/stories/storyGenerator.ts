// src/store/stories/storyGenerator.ts
import { toast } from "sonner";
import { Story, StoryOptions, StoryChapter } from "../../types"; 
import { useStoriesStore } from "./storiesStore";
import { useUserStore } from "../user/userStore";
import { useCharacterStore } from "../character/characterStore";
import { useStoryOptionsStore } from "../storyOptions/storyOptionsStore"; 
import { generateId } from "../core/utils"; 
import { GenerateStoryService, GenerateStoryParams } from "@/services/ai/GenerateStoryService";
import { useChaptersStore } from "./chapters/chaptersStore"; 

/**
 * Genera una historia completa (Capítulo 1 + Título) a partir de las opciones
 */
export const generateStory = async (options: Partial<StoryOptions>): Promise<Story | null> => { 
  const storiesStore = useStoriesStore.getState();
  const chaptersStore = useChaptersStore.getState(); 
  const characterStore = useCharacterStore.getState();
  const storyOptionsState = useStoryOptionsStore.getState();

  storiesStore.setIsGeneratingStory(true);

  try {
    const storyId = generateId(); 
    const profileSettings = useUserStore.getState().profileSettings; 
    const selectedCharacters = storyOptionsState.getSelectedCharactersForStory(); 
    const additionalDetails = storyOptionsState.additionalDetails; 

    if (!profileSettings) throw new Error("Perfil de usuario no cargado.");
    if (!selectedCharacters || selectedCharacters.length === 0) throw new Error("No hay personajes seleccionados.");
    
    // Validate language has a valid value
    const language = profileSettings.language?.trim() || 'Español'; // Default to Spanish if empty
    if (!language) {
      throw new Error("El idioma del perfil no está configurado.");
    }

    // --- Llamada ÚNICA al servicio que invoca la EF 'generate-story' ---
    const payload: GenerateStoryParams = {
      options: {
        characters: selectedCharacters,
        genre: options.genre, 
        moral: options.moral, 
        duration: storyOptionsState.currentStoryOptions.duration, 
      },
      language, 
      childAge: profileSettings.childAge ?? 5, 
      specialNeed: profileSettings.specialNeed, 
      additionalDetails: additionalDetails || undefined, 
    };

    console.log("Enviando solicitud a la Edge Function generate-story con params:", payload);

    const storyResponse = await GenerateStoryService.generateStoryWithAI(payload);
    // storyResponse ahora es { content: string, title: string }
    console.log(`[storyGenerator_DEBUG] Title received from Service: "${storyResponse.title}"`);

    // Los personajes seleccionados ya están guardados, no necesitamos save individual
    // Solo guardamos currentCharacter si se usó para creación de personaje nuevo
    
    // Crear el objeto historia con título y contenido de la respuesta
    const story: Story = {
      id: storyId,
      title: storyResponse.title, 
      content: storyResponse.content, 
      options: { 
        moral: options.moral || "Ser amable", 
        characters: selectedCharacters,
        genre: options.genre || "aventura",
        duration: options.duration || "medium",
        language,
      },
      additional_details: additionalDetails, 
      createdAt: new Date().toISOString(),
      // audioUrl se añadirá después si se genera
    };

    console.log("🔍 DEBUG - Historia Creada:", JSON.stringify(story.options, null, 2));
    console.log(`[storyGenerator_DEBUG] Title being saved to store: "${story.title}"`);

    // 1. Guardar la historia principal (como antes)
    // Guardar la historia generada en el store
    await storiesStore.addGeneratedStory(story); 

    // 2. Crear y guardar el Capítulo 1
    const firstChapter: StoryChapter = {
      id: generateId(),
      chapterNumber: 1,
      title: story.title, 
      content: story.content, 
      generationMethod: 'free', 
      createdAt: new Date().toISOString(),
      // customInput no aplica aquí
    };
    await chaptersStore.addChapter(story.id, firstChapter); 

    // Limpiar las opciones de la historia temporalmente almacenadas
    storyOptionsState.resetStoryOptions(); 

    return story; 

  } catch (error: unknown) {
    console.error("Error al generar historia en storyGenerator:", error);
    const errorMessage = error instanceof Error ? error.message : "Inténtalo de nuevo.";
    toast.error("Error al generar la historia", {
      description: errorMessage,
    });
    // Considera si también deberías llamar a resetStoryOptions aquí
    storyOptionsState.resetStoryOptions(); 
    return null; 
  } finally {
    storiesStore.setIsGeneratingStory(false);
  }
};