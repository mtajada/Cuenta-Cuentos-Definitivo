import { StoriesState } from "../types/storeTypes";
import { createPersistentStore } from "../core/createStore";
import { getUserStories, syncQueue, syncStory } from "../../services/supabase";
import { useUserStore } from "../user/userStore";

// Estado inicial
const initialState: Pick<
  StoriesState,
  "generatedStories" | "isGeneratingStory" | "isLoadingStories"
> = {
  generatedStories: [],
  isGeneratingStory: false,
  isLoadingStories: false,
};

export const useStoriesStore = createPersistentStore<StoriesState>(
  initialState,
  (set, get) => ({
    setIsGeneratingStory: (isGenerating) =>
      set({
        isGeneratingStory: isGenerating,
      }),

    addGeneratedStory: async (story) => {
      console.log("🚀 ~ addGeneratedStory: ~ story:", story)
      // Guardar localmente primero
      set((state) => ({
        generatedStories: [story, ...state.generatedStories],
      }));

      // Luego sincronizar con Supabase
      try {
        const user = useUserStore.getState().user;

        if (user) {
          const { success } = await syncStory(user.id, story);

          if (!success) {
            // Si falla, agregar a la cola de sincronización
            syncQueue.addToQueue("stories", "insert", {
              id: story.id,
              user_id: user.id,
              title: story.title,
              content: story.content,
              audio_url: story.audioUrl,
              moral: story.options.moral,
              genre: story.options.genre,
              duration: story.options.duration,
              character_id: story.options.characters[0]?.id, // Primary character
              additional_details: story.additional_details,
            });
          }
        }
      } catch (error) {
        console.error("Error sincronizando historia con Supabase:", error);
      }
    },

    getStoryById: (id) => {
      return get().generatedStories.find((story) => story.id === id);
    },

    loadStoriesFromSupabase: async (userId?: string) => {
      const user = useUserStore.getState().user;
      if (!user) return;

      set({ isLoadingStories: true });
      try {
        console.log(`Cargando historias para usuario ${user.id}`);

        // IMPORTANTE: Limpiar antes de cargar
        set({ generatedStories: [] });

        const { success, stories } = await getUserStories(user.id);

        if (success && stories) {
          console.log(`Cargadas ${stories.length} historias de Supabase`);
          set({ generatedStories: stories });
        } else {
          console.warn("No se encontraron historias o hubo un error");
        }
      } catch (error) {
        console.error("Error al cargar historias:", error);
      } finally {
        set({ isLoadingStories: false });
      }
    },
  }),
  "stories",
);
