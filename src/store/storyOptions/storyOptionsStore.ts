import { StoryOptionsState } from '../types/storeTypes';
import { StoryOptions, StoryDuration, StoryCharacter } from '../../types';
import { createPersistentStore } from '../core/createStore';
import { useCharacterStore } from '../character/characterStore';

// Estado inicial
const initialState: Pick<StoryOptionsState, 'currentStoryOptions' | 'additionalDetails' | 'selectedCharacterIds'> = {
  currentStoryOptions: {},
  additionalDetails: null,
  selectedCharacterIds: [],
};

export const useStoryOptionsStore = createPersistentStore<StoryOptionsState>(
  initialState,
  (set) => ({
    updateStoryOptions: (options) => set((state) => ({
      currentStoryOptions: { ...state.currentStoryOptions, ...options }
    })),
    
    resetStoryOptions: () => set({ 
      currentStoryOptions: {}, 
      additionalDetails: null,
      selectedCharacterIds: []
    }),
    
    setDuration: (duration) => set((state) => ({
      currentStoryOptions: { ...state.currentStoryOptions, duration }
    })),
    
    setMoral: (moral) => set((state) => ({
      currentStoryOptions: { ...state.currentStoryOptions, moral }
    })),
    
    setGenre: (genre) => set((state) => ({
      currentStoryOptions: { ...state.currentStoryOptions, genre }
    })),
    
    setAdditionalDetails: (details) => set({ additionalDetails: details }),
    
    // Multiple character selection functions
    setSelectedCharacterIds: (characterIds: string[]) => set({ selectedCharacterIds: characterIds }),
    
    getSelectedCharactersForStory: () => {
      const state = useStoryOptionsStore.getState();
      const characterStore = useCharacterStore.getState();
      
      return state.selectedCharacterIds
        .map(id => characterStore.savedCharacters.find(char => char.id === id))
        .filter((char): char is StoryCharacter => char !== undefined);
    },
    
    updateSelectedCharacters: (characters: StoryCharacter[]) => {
      const characterIds = characters.map(char => char.id);
      set((state) => ({
        selectedCharacterIds: characterIds,
        currentStoryOptions: {
          ...state.currentStoryOptions,
          // Usar siempre el array de personajes (simplificado)
          characters: characters
        }
      }));
    },
  }),
  'story-options'
);