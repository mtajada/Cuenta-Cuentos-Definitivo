import { StoryOptionsState } from '../types/storeTypes';
import { StoryOptions, StoryCharacter } from '../../types';
import { createPersistentStore } from '../core/createStore';
import { useCharacterStore } from '../character/characterStore';
import { DEFAULT_IMAGE_STYLE_ID, normalizeImageStyleId } from '@/lib/image-styles';

const DEFAULT_CREATION_MODE: StoryOptions['creationMode'] = 'standard';

const applyDefaults = (
  state: StoryOptionsState,
  overrides: Partial<StoryOptions> = {},
): Partial<StoryOptions> => {
  const creationMode = overrides.creationMode ?? state.currentStoryOptions.creationMode ?? DEFAULT_CREATION_MODE;
  const imageStyle = normalizeImageStyleId(
    overrides.imageStyle ?? state.currentStoryOptions.imageStyle ?? DEFAULT_IMAGE_STYLE_ID,
  );

  return {
    ...state.currentStoryOptions,
    ...overrides,
    creationMode,
    imageStyle,
  };
};

// Estado inicial
const initialState: Pick<StoryOptionsState, 'currentStoryOptions' | 'additionalDetails' | 'selectedCharacterIds'> = {
  currentStoryOptions: {
    creationMode: DEFAULT_CREATION_MODE,
    imageStyle: DEFAULT_IMAGE_STYLE_ID,
  },
  additionalDetails: null,
  selectedCharacterIds: [],
};

export const useStoryOptionsStore = createPersistentStore<StoryOptionsState>(
  initialState,
  (set) => ({
    updateStoryOptions: (options) => set((state) => ({
      currentStoryOptions: applyDefaults(state, options),
    })),
    
    resetStoryOptions: () => set((state) => ({ 
      currentStoryOptions: { 
        creationMode: state.currentStoryOptions.creationMode ?? DEFAULT_CREATION_MODE,
        imageStyle: normalizeImageStyleId(
          state.currentStoryOptions.imageStyle ?? DEFAULT_IMAGE_STYLE_ID,
        ),
      }, 
      additionalDetails: null,
      selectedCharacterIds: []
    })),
    
    setDuration: (duration) => set((state) => ({
      currentStoryOptions: applyDefaults(state, { duration }),
    })),
    
    setMoral: (moral) => set((state) => ({
      currentStoryOptions: applyDefaults(state, { moral }),
    })),
    
    setGenre: (genre) => set((state) => ({
      currentStoryOptions: applyDefaults(state, { genre }),
    })),

    setCreationMode: (mode) => set((state) => ({
      currentStoryOptions: applyDefaults(state, { creationMode: mode }),
    })),

    setImageStyle: (style) => set((state) => ({
      currentStoryOptions: applyDefaults(state, { imageStyle: style }),
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
        currentStoryOptions: applyDefaults(state, { characters }),
      }));
    },
  }),
  'story-options'
);
