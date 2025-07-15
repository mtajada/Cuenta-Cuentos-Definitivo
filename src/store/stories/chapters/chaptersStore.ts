import { ChaptersState } from "../../types/storeTypes";
import { StoryWithChapters } from "../../../types";
import { createPersistentStore } from "../../core/createStore";
import { useStoriesStore } from "../storiesStore";
import {
  getStoryChapters,
  syncChapter,
  syncQueue,
} from "../../../services/supabase";

// Estado inicial
const initialState: Pick<ChaptersState, "storyChapters"> = {
  storyChapters: [],
};

export const useChaptersStore = createPersistentStore<ChaptersState>(
  initialState,
  (set, get) => ({
    getChaptersByStoryId: (storyId) => {
      const storyWithChapters = get().storyChapters.find((s) =>
        s.id === storyId
      );
      return storyWithChapters ? storyWithChapters.chapters : [];
    },

    addChapter: async (storyId, chapter) => {
      try {
        // 1. Intentar sincronizar con Supabase PRIMERO
        const { success } = await syncChapter(chapter, storyId);

        if (success) {
          // 2. SI la sincronización es exitosa, AHORA actualizar el store local
          set((state) => {
            const storyWithChapters = state.storyChapters.find((s) =>
              s.id === storyId
            );

            if (storyWithChapters) {
              // Actualizar los capítulos existentes
              return {
                storyChapters: state.storyChapters.map((s) =>
                  s.id === storyId
                    ? { ...s, chapters: [...s.chapters, chapter] }
                    : s
                ),
              };
            } else {
              // Crear nueva entrada para la historia
              const storiesStore = useStoriesStore.getState();
              const story = storiesStore.getStoryById(storyId);

              if (!story) return state; // Historia no encontrada

              const newStoryWithChapters: StoryWithChapters = {
                id: storyId,
                title: story.title,
                content: story.content,
                options: story.options,
                createdAt: story.createdAt,
                audioUrl: story.audioUrl,
                chapters: [chapter],
              };

              return {
                storyChapters: [...state.storyChapters, newStoryWithChapters],
              };
            }
          });
        } else {
           // 3. Si falla la sincronización directa, agregar a la cola SIN actualizar el estado local
           console.warn("Sincronización directa de capítulo fallida, añadiendo a la cola.");
           syncQueue.addToQueue("story_chapters", "insert", {
             story_id: storyId,
             chapter_number: chapter.chapterNumber,
             title: chapter.title,
             content: chapter.content,
             generation_method: chapter.generationMethod,
             custom_input: chapter.customInput,
           });
           // Lanzar un error para que el frontend sepa que no se guardó (opcional pero recomendado)
           throw new Error("No se pudo guardar el capítulo en la base de datos.");
        }
      } catch (error) {
        console.error("Error sincronizando capítulo con Supabase:", error);
        // 4. Si hay un error en el try, agregar a la cola SIN actualizar el estado local
        syncQueue.addToQueue("story_chapters", "insert", {
          story_id: storyId,
          chapter_number: chapter.chapterNumber,
          title: chapter.title,
          content: chapter.content,
          generation_method: chapter.generationMethod,
          custom_input: chapter.customInput,
        });
        // Propagar el error para que el frontend pueda manejarlo
        throw error;
      }
    },

    getLastChapterByStoryId: (storyId) => {
      const chapters = get().getChaptersByStoryId(storyId);
      if (chapters.length === 0) return undefined;

      // Ordenar capítulos y devolver el último
      return [...chapters].sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
    },

    loadChaptersFromSupabase: async (storyId) => {
      try {
        const { success, chapters } = await getStoryChapters(storyId);

        if (success && chapters && chapters.length > 0) {
          const storiesStore = useStoriesStore.getState();
          const story = storiesStore.getStoryById(storyId);

          if (!story) return; // Historia no encontrada

          set((state) => {
            const existingStoryIndex = state.storyChapters.findIndex((s) =>
              s.id === storyId
            );

            if (existingStoryIndex >= 0) {
              // Actualizar capítulos de la historia existente
              const updatedStoryChapters = [...state.storyChapters];
              updatedStoryChapters[existingStoryIndex] = {
                ...updatedStoryChapters[existingStoryIndex],
                chapters,
              };

              return { storyChapters: updatedStoryChapters };
            } else {
              // Crear nueva entrada para la historia
              const newStoryWithChapters: StoryWithChapters = {
                id: storyId,
                title: story.title,
                content: story.content,
                options: story.options,
                createdAt: story.createdAt,
                audioUrl: story.audioUrl,
                chapters,
              };

              return {
                storyChapters: [...state.storyChapters, newStoryWithChapters],
              };
            }
          });
        }
      } catch (error) {
        console.error("Error cargando capítulos desde Supabase:", error);
      }
    },
  }),
  "chapters",
);
