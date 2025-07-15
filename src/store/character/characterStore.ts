import { CharacterState } from "../types/storeTypes";
import { StoryCharacter } from "../../types";
import { createPersistentStore, registerStoreRefresh } from "../core/createStore";
import { generateId } from "../core/utils";
import {
  deleteCharacter as deleteSupabaseCharacter,
  getUserCharacters,
  syncCharacter,
  syncQueue,
} from "../../services/supabase";
import { useUserStore } from "../user/userStore";
import { validateCharacterSelection, validateMultipleCharacterSelection, CHARACTER_LIMITS } from "./characterValidation";

// Estado inicial
const initialState: Pick<
  CharacterState,
  "savedCharacters" | "selectedCharacters" | "maxCharacters" | "currentCharacter"
> = {
  savedCharacters: [],
  selectedCharacters: [],
  maxCharacters: 4, // Límite máximo de personajes según especificación
  currentCharacter: {
    id: "",
    name: "",
    hobbies: [],
    description: "",
    profession: "",
    characterType: "",
    personality: "",
  },
};

export const useCharacterStore = createPersistentStore<CharacterState>(
  initialState,
  (set, get) => {
    // Cargar personajes desde Supabase al inicializar el store
    setTimeout(() => {
      const user = useUserStore.getState().user;
      if (user) {
        console.log("Inicializando characterStore - cargando personajes desde Supabase");
        loadCharactersFromSupabase(user.id);
      }
    }, 100);
    
    // Función auxiliar para cargar personajes (fuera del objeto para poder usarla en el timeout)
    const loadCharactersFromSupabase = async (userId: string) => {
      try {
        console.log(`Cargando personajes para usuario ${userId} desde Supabase`);
        
        // Primero, limpiar el array existente para evitar mezclar personajes
        set({ savedCharacters: [] });
        
        // Log para depuración
        console.log(`[DEBUG] Consultando personajes SOLO para el usuario con ID: ${userId}`);
        
        const { success, characters } = await getUserCharacters(userId);

        if (success && characters) {
          console.log(`Se encontraron ${characters.length} personajes para usuario ${userId}`);
          
          // Establecer solo los personajes recuperados de Supabase
          set({ savedCharacters: characters });
          console.log(`Lista actualizada: ${characters.length} personajes para usuario ${userId}`);
        } else {
          console.log(`No se encontraron personajes para el usuario ${userId} o hubo un error`);
        }
      } catch (error) {
        console.error(`Error cargando personajes desde Supabase para usuario ${userId}:`, error);
      }
    };
    
    return {
      updateCharacter: (updates) => {
        // Si actualizamos un personaje sin ID, asegurarnos de que tenga uno único
        set((state) => {
          const current = state.currentCharacter;
          
          // Verificar si estamos editando un personaje nuevo sin ID propio o con ID vacío
          if (!current.id || current.id === "") {
            console.log("Personaje sin ID detectado, generando uno nuevo");
            const newId = generateId("char");
            console.log(`ID generado para nuevo personaje: ${newId}`);
            return {
              currentCharacter: {
                ...current,
                ...updates,
                id: newId
              }
            };
          }
          
          // Actualización normal si ya tiene ID
          return {
            currentCharacter: {
              ...current,
              ...updates,
            },
          };
        });
      },

      resetCharacter: () => {
        console.log("Reseteando personaje actual con nuevo ID");
        const newId = generateId("char");
        console.log(`Nuevo ID generado: ${newId}`);
        
        // Crear un personaje completamente vacío con un nuevo ID
        set({
          currentCharacter: {
            id: newId,
            name: "",
            hobbies: [],
            description: "",
            profession: "",
            characterType: "",
            personality: "",
          }
        });
      },

      setCurrentCharacter: (character: StoryCharacter) => {
        set({ currentCharacter: character });
      },

      saveCurrentCharacter: async () => {
        // Guardar primero localmente
        const user = useUserStore.getState().user;
        if (!user) {
          console.error("No se puede guardar el personaje: usuario no autenticado");
          return { success: false, error: "Usuario no autenticado" };
        }

        // Generar el ID una sola vez para asegurar consistencia
        let characterToSave: StoryCharacter | null = null;
        let nameExists = false;

        set((state) => {
          const character = state.currentCharacter;

          if (!character || !character.name) {
            return state;
          }

          // Verificar si hay algún personaje existente con el mismo nombre
          const existingWithSameName = state.savedCharacters.find(
            c => c.name.toLowerCase() === character.name.toLowerCase() && c.id !== character.id
          );

          if (existingWithSameName) {
            console.log(`ADVERTENCIA: Ya existe un personaje con el nombre "${character.name}"`);
            nameExists = true;
            // No modificar el estado si hay un duplicado
            return state;
          }

          // Generar ID solo si es necesario
          const characterId = character.id || generateId("char");
          console.log(`Guardando personaje "${character.name}" con ID: ${characterId}`);
          
          // Guardar localmente el personaje con su ID
          characterToSave = {
            ...character,
            id: characterId,
          };

          // Check if character already exists
          const existingCharIndex = state.savedCharacters.findIndex(
            (char) => char.id === characterId,
          );

          if (existingCharIndex >= 0) {
            // Update existing character
            const updatedCharacters = [...state.savedCharacters];
            updatedCharacters[existingCharIndex] = characterToSave;
            console.log(`Actualizando personaje existente con ID: ${characterId}`);
            return { 
              savedCharacters: updatedCharacters,
              currentCharacter: characterToSave  // Actualizar currentCharacter con el ID
            };
          } else {
            // Add new character
            console.log(`Agregando nuevo personaje con ID: ${characterId}`);
            return {
              savedCharacters: [...state.savedCharacters, characterToSave],
              currentCharacter: characterToSave  // Actualizar currentCharacter con el ID
            };
          }
        });

        // Si se detectó un nombre duplicado, retornar error
        if (nameExists) {
          return { 
            success: false, 
            error: `Ya existe un personaje con el nombre "${get().currentCharacter.name}". Por favor, elige otro nombre.` 
          };
        }

        // Si no hay personaje para guardar, retornar error
        if (!characterToSave) {
          return { success: false, error: "No hay datos válidos para guardar" };
        }

        // Ahora sincronizar con Supabase
        try {
          // Usar el objeto que ya tiene el ID asignado
          if (characterToSave && characterToSave.name) {
            console.log(`Sincronizando personaje ${characterToSave.name} (ID: ${characterToSave.id}) para usuario ${user.id}`);
            const { success, error } = await syncCharacter(user.id, characterToSave);

            if (!success) {
              console.log("Falló la sincronización directa, agregando a la cola");
              // Si falla, agregarlo a la cola de sincronización
              syncQueue.addToQueue("characters", "update", {
                id: characterToSave.id,
                user_id: user.id,
                name: characterToSave.name,
                hobbies: characterToSave.hobbies,
                description: characterToSave.description,
                profession: characterToSave.profession,
                character_type: characterToSave.characterType,
                personality: characterToSave.personality,
              });
              return { success: false, error };
            }
            return { success: true };
          }
          return { success: false, error: "Datos de personaje inválidos" };
        } catch (error) {
          console.error("Error sincronizando personaje con Supabase:", error);
          return { success: false, error };
        }
      },


      deleteCharacter: async (characterId) => {
        const user = useUserStore.getState().user;
        if (!user) {
          console.error("No se puede eliminar el personaje: usuario no autenticado");
          return;
        }

        // Eliminar localmente primero
        set((state) => ({
          savedCharacters: state.savedCharacters.filter((char) =>
            char.id !== characterId
          ),
          // También eliminar de selectedCharacters si está seleccionado
          selectedCharacters: state.selectedCharacters.filter((char) =>
            char.id !== characterId
          )
        }));

        // Luego sincronizar con Supabase
        try {
          console.log(`Eliminando personaje ${characterId} para usuario ${user.id}`);
          const { success } = await deleteSupabaseCharacter(characterId);

          if (!success) {
            console.log("Falló la eliminación directa, agregando a la cola");
            // Si falla, agregar a la cola de sincronización
            syncQueue.addToQueue("characters", "delete", { 
              id: characterId,
              user_id: user.id
            });
          }
        } catch (error) {
          console.error("Error eliminando personaje de Supabase:", error);
          // Agregar a la cola de sincronización
          syncQueue.addToQueue("characters", "delete", { 
            id: characterId,
            user_id: user.id
          });
        }
      },

      loadCharactersFromSupabase: async (userId?: string) => {
        const user = useUserStore.getState().user;

        if (!user) {
          console.error("No se pueden cargar los personajes: usuario no autenticado");
          return;
        }
        
        await loadCharactersFromSupabase(user.id);
      },

      // Multiple character selection functions
      toggleCharacterSelection: (characterId: string) => {
        set((state) => {
          const character = state.savedCharacters.find(char => char.id === characterId);
          if (!character) {
            console.warn(`Personaje con ID ${characterId} no encontrado`);
            return state;
          }

          const isSelected = state.selectedCharacters.some(char => char.id === characterId);
          
          if (isSelected) {
            // Deseleccionar personaje
            return {
              selectedCharacters: state.selectedCharacters.filter(char => char.id !== characterId)
            };
          } else {
            // Validar selección antes de añadir
            const validation = validateCharacterSelection(state.selectedCharacters, character);
            
            if (!validation.isValid) {
              console.warn(`Error al seleccionar personaje: ${validation.errors.join(", ")}`);
              return state;
            }
            
            if (validation.warnings.length > 0) {
              console.info(`Advertencias: ${validation.warnings.join(", ")}`);
            }
            
            return {
              selectedCharacters: [...state.selectedCharacters, character]
            };
          }
        });
      },

      clearSelectedCharacters: () => {
        set({ selectedCharacters: [] });
      },

      getSelectedCharacters: () => {
        return get().selectedCharacters;
      },

      isCharacterSelected: (characterId: string) => {
        return get().selectedCharacters.some(char => char.id === characterId);
      },

      canSelectMoreCharacters: () => {
        const state = get();
        return state.selectedCharacters.length < state.maxCharacters;
      },

      setSelectedCharacters: (characters: StoryCharacter[]) => {
        set((state) => {
          // Validar la selección múltiple
          const validation = validateMultipleCharacterSelection(characters);
          
          if (!validation.isValid) {
            console.warn(`Error en selección múltiple: ${validation.errors.join(", ")}`);
            // Filtrar solo personajes válidos que existen en savedCharacters
            const validCharacters = characters
              .filter(char => state.savedCharacters.some(saved => saved.id === char.id))
              .slice(0, state.maxCharacters);
            return { selectedCharacters: validCharacters };
          }
          
          if (validation.warnings.length > 0) {
            console.info(`Advertencias: ${validation.warnings.join(", ")}`);
          }
          
          // Validar que todos los personajes existen en savedCharacters
          const validCharacters = characters.filter(char => 
            state.savedCharacters.some(saved => saved.id === char.id)
          );
          
          return { selectedCharacters: validCharacters };
        });
      },
    };
  },
  "characters",
);

// Exportar función para poder forzar una recarga de personajes desde cualquier parte
export const reloadCharacters = () => {
  const user = useUserStore.getState().user;
  if (user) {
    console.log("Forzando recarga de personajes desde Supabase");
    useCharacterStore.getState().loadCharactersFromSupabase();
  }
};

// Registrar la función de recarga para que se ejecute cuando cambie el usuario
registerStoreRefresh("characters", reloadCharacters);

// Re-export validation functions for UI components
export { 
  validateCharacterSelection, 
  validateMultipleCharacterSelection, 
  validateStoryGeneration,
  getCharacterSelectionMessage,
  CHARACTER_LIMITS 
} from "./characterValidation";

