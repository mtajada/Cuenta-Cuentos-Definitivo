// Claves estándar para TanStack Query
// Siguiendo las mejores prácticas de query keys jerarquicas

export const queryKeys = {
  // Usuario y autenticación
  user: {
    all: ['user'] as const,
    profile: (userId: string) => ['user', 'profile', userId] as const,
    subscription: (userId: string) => ['user', 'subscription', userId] as const,
    settings: (userId: string) => ['user', 'settings', userId] as const,
  },

  // Personajes
  characters: {
    all: ['characters'] as const,
    byUser: (userId: string) => ['characters', userId] as const,
    detail: (characterId: string) => ['characters', 'detail', characterId] as const,
    validation: (userId: string) => ['characters', 'validation', userId] as const,
  },

  // Historias
  stories: {
    all: ['stories'] as const,
    byUser: (userId: string) => ['stories', userId] as const,
    detail: (storyId: string) => ['stories', 'detail', storyId] as const,
    chapters: (storyId: string) => ['stories', 'chapters', storyId] as const,
    challenges: (storyId: string) => ['stories', 'challenges', storyId] as const,
  },

  // Audio
  audio: {
    all: ['audio'] as const,
    byUser: (userId: string) => ['audio', userId] as const,
    byStory: (storyId: string) => ['audio', 'story', storyId] as const,
    cache: (storyId: string, chapterId: string, voiceId: string) => 
      ['audio', 'cache', storyId, chapterId, voiceId] as const,
  },

  // Voces
  voices: {
    all: ['voices'] as const,
    current: (userId: string) => ['voices', 'current', userId] as const,
    preview: (voiceId: string) => ['voices', 'preview', voiceId] as const,
  },

  // Configuración temporal (story options)
  storyOptions: {
    session: ['storyOptions', 'session'] as const,
    draft: (sessionId: string) => ['storyOptions', 'draft', sessionId] as const,
  },
} as const;

// Tipos derivados para type safety
export type UserQueryKeys = typeof queryKeys.user;
export type CharacterQueryKeys = typeof queryKeys.characters;
export type StoryQueryKeys = typeof queryKeys.stories;
export type AudioQueryKeys = typeof queryKeys.audio;
export type VoiceQueryKeys = typeof queryKeys.voices;
export type StoryOptionsQueryKeys = typeof queryKeys.storyOptions;