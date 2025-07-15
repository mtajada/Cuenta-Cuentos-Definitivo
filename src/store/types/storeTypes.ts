import {
  Challenge,
  ProfileSettings,
  Story,
  StoryChapter,
  StoryCharacter,
  StoryDuration,
  StoryOptions,
  StoryWithChapters,
  User,
} from "../../types";

// Tipos específicos para los stores
export interface UserState {
  user: User | null;
  profileSettings: ProfileSettings | null;
  intendedRedirectPath: string | null; // Añadido para gestionar redirecciones

  loginUser: (user: User) => void;
  logoutUser: () => void;
  setProfileSettings: (settings: Partial<ProfileSettings>) => void;
  hasCompletedProfile: () => boolean;
  checkAuth: () => Promise<User | null>;

  // Nuevos selectores para suscripción y límites
  isPremium: () => boolean;
  getRemainingMonthlyStories: () => number;
  canCreateStory: () => boolean;
  getRemainingMonthlyVoiceGenerations: () => number;
  getAvailableVoiceCredits: () => number;
  canGenerateVoice: () => boolean;
  canContinueStory: (storyId: string) => boolean;
}

export interface CharacterState {
  savedCharacters: StoryCharacter[];
  selectedCharacters: StoryCharacter[];
  maxCharacters: number;
  currentCharacter: StoryCharacter;

  updateCharacter: (updates: Partial<StoryCharacter>) => void;
  resetCharacter: () => void;
  setCurrentCharacter: (character: StoryCharacter) => void;
  saveCurrentCharacter: () => Promise<{ success: boolean; error?: string }>;
  deleteCharacter: (characterId: string) => void;
  loadCharactersFromSupabase: () => Promise<void>;
  
  // Multiple character selection functions
  toggleCharacterSelection: (characterId: string) => void;
  clearSelectedCharacters: () => void;
  getSelectedCharacters: () => StoryCharacter[];
  isCharacterSelected: (characterId: string) => boolean;
  canSelectMoreCharacters: () => boolean;
  setSelectedCharacters: (characters: StoryCharacter[]) => void;
}

export interface StoryOptionsState {
  currentStoryOptions: Partial<StoryOptions>;
  additionalDetails?: string | null;
  // Multiple character selection support
  selectedCharacterIds: string[];

  updateStoryOptions: (options: Partial<StoryOptions>) => void;
  resetStoryOptions: () => void;
  setDuration: (duration: StoryDuration) => void;
  setMoral: (moral: string) => void;
  setGenre: (genre: string) => void;
  setAdditionalDetails: (details?: string | null) => void;
  
  // Multiple character selection functions
  setSelectedCharacterIds: (characterIds: string[]) => void;
  getSelectedCharactersForStory: () => StoryCharacter[];
  updateSelectedCharacters: (characters: StoryCharacter[]) => void;
}

export interface StoriesState {
  generatedStories: Story[];
  isGeneratingStory: boolean;
  isLoadingStories: boolean;

  setIsGeneratingStory: (isGenerating: boolean) => void;
  addGeneratedStory: (story: Story) => void;
  getStoryById: (id: string) => Story | undefined;
  loadStoriesFromSupabase: () => Promise<void>;
}

export interface ChaptersState {
  storyChapters: StoryWithChapters[];

  getChaptersByStoryId: (storyId: string) => StoryChapter[];
  addChapter: (storyId: string, chapter: StoryChapter) => void;
  getLastChapterByStoryId: (storyId: string) => StoryChapter | undefined;
  loadChaptersFromSupabase: (storyId: string) => Promise<void>;
}

export interface ChallengesState {
  challenges: Challenge[];

  addChallenge: (challenge: Challenge) => void;
  getChallengesByStoryId: (storyId: string) => Challenge[];
  loadChallengesFromSupabase: (storyId: string) => Promise<void>;
}

export interface AudioState {
  audioCache: {
    [key: string]: {
      url: string;
      timestamp: string;
    };
  };
  generationStatus: {
    [key: string]: {
      status: "idle" | "generating" | "completed" | "error";
      progress: number;
    };
  };
  currentVoice: string | null;

  addAudioToCache: (
    storyId: string,
    chapterId: string | number,
    voiceId: string,
    audioUrl: string,
  ) => void;
  getAudioFromCache: (
    storyId: string,
    chapterId: string | number,
    voiceId: string,
  ) => string | null;
  setGenerationStatus: (
    storyId: string,
    chapterId: string | number,
    status: "idle" | "generating" | "completed" | "error",
    progress?: number,
  ) => void;
  getGenerationStatus: (
    storyId: string,
    chapterId: string | number,
  ) => { status: string; progress: number };
  setCurrentVoice: (voiceId: string) => void;
  getCurrentVoice: () => string | null;
  clearOldAudioCache: (olderThanDays?: number) => void;
  loadAudioFromSupabase: () => Promise<void>;
}

// StoryState legacy interface removed - using individual state interfaces instead
