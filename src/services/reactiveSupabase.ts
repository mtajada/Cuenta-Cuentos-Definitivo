// Extensiones reactivas para los servicios de Supabase existentes
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { 
  getUserProfile, 
  syncUserProfile, 
  getUserCharacters, 
  syncCharacter, 
  deleteCharacter,
  getUserStories,
  syncStory,
  getStoryChapters,
  syncChapter,
  getStoryChallenges,
  syncChallenge,
  getUserAudios,
  syncAudioFile,
  getCurrentVoice,
  setCurrentVoice
} from './supabase';
import { ProfileSettings, StoryCharacter, Story, StoryChapter, Challenge } from '@/types';

// Hook para el perfil de usuario con reactividad
export function useUserProfileQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.user.profile(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const { success, profile, error } = await getUserProfile(userId);
      if (!success) throw error || new Error('Failed to fetch profile');
      if (!profile) throw new Error('Profile not found');
      
      return profile;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutos para datos de perfil
    refetchOnWindowFocus: true, // Importante para datos de suscripción
  });
}

// Mutation para actualizar perfil
export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Partial<ProfileSettings> }) => {
      const { success, error } = await syncUserProfile(userId, updates as Record<string, unknown>);
      if (!success) throw error || new Error('Failed to update profile');
      return updates;
    },
    onSuccess: (updates, { userId }) => {
      // Actualización optimista del cache
      queryClient.setQueryData(
        queryKeys.user.profile(userId),
        (old: ProfileSettings | undefined) => 
          old ? { ...old, ...updates } : undefined
      );
      
      // También invalidar para refrescar datos del servidor
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.user.profile(userId) 
      });
    },
  });
}

// Hook para personajes de usuario
export function useUserCharactersQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.characters.byUser(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const { success, characters, error } = await getUserCharacters(userId);
      if (!success) throw error || new Error('Failed to fetch characters');
      
      return characters || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}

// Mutation para crear/actualizar personaje
export function useUpsertCharacterMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, character }: { userId: string; character: StoryCharacter }) => {
      const { success, error } = await syncCharacter(userId, character);
      if (!success) throw error || new Error('Failed to save character');
      return character;
    },
    onSuccess: (character, { userId }) => {
      // Actualización optimista
      queryClient.setQueryData(
        queryKeys.characters.byUser(userId),
        (old: StoryCharacter[] | undefined) => {
          if (!old) return [character];
          
          const existingIndex = old.findIndex(c => c.id === character.id);
          if (existingIndex >= 0) {
            // Actualizar existente
            const updated = [...old];
            updated[existingIndex] = character;
            return updated;
          } else {
            // Agregar nuevo
            return [...old, character];
          }
        }
      );
      
      // Invalidar también para sincronizar con servidor
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.characters.byUser(userId) 
      });
    },
  });
}

// Mutation para eliminar personaje
export function useDeleteCharacterMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, characterId }: { userId: string; characterId: string }) => {
      const { success, error } = await deleteCharacter(characterId);
      if (!success) throw error || new Error('Failed to delete character');
      return characterId;
    },
    onSuccess: (characterId, { userId }) => {
      // Remover del cache optimísticamente
      queryClient.setQueryData(
        queryKeys.characters.byUser(userId),
        (old: StoryCharacter[] | undefined) => 
          old ? old.filter(c => c.id !== characterId) : []
      );
    },
  });
}

// Hook para historias de usuario
export function useUserStoriesQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.stories.byUser(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const { success, stories, error } = await getUserStories(userId);
      if (!success) throw error || new Error('Failed to fetch stories');
      
      return stories || [];
    },
    enabled: !!userId,
    staleTime: 3 * 60 * 1000, // 3 minutos
  });
}

// Mutation para crear historia
export function useCreateStoryMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, story }: { userId: string; story: Story }) => {
      const { success, error } = await syncStory(userId, story);
      if (!success) throw error || new Error('Failed to save story');
      return story;
    },
    onSuccess: (story, { userId }) => {
      // Agregar al cache optimísticamente
      queryClient.setQueryData(
        queryKeys.stories.byUser(userId),
        (old: Story[] | undefined) => 
          old ? [story, ...old] : [story]
      );
    },
  });
}

// Hook para capítulos de una historia
export function useStoryChaptersQuery(storyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.stories.chapters(storyId || ''),
    queryFn: async () => {
      if (!storyId) throw new Error('Story ID required');
      
      const { success, chapters, error } = await getStoryChapters(storyId);
      if (!success) throw error || new Error('Failed to fetch chapters');
      
      return chapters || [];
    },
    enabled: !!storyId,
    staleTime: 2 * 60 * 1000, // 2 minutos
  });
}

// Mutation para agregar capítulo
export function useAddChapterMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ storyId, chapter }: { storyId: string; chapter: StoryChapter }) => {
      const { success, error } = await syncChapter(chapter, storyId);
      if (!success) throw error || new Error('Failed to save chapter');
      return chapter;
    },
    onSuccess: (chapter, { storyId }) => {
      // Agregar al cache
      queryClient.setQueryData(
        queryKeys.stories.chapters(storyId),
        (old: StoryChapter[] | undefined) => 
          old ? [...old, chapter] : [chapter]
      );
    },
  });
}

// Hook para desafíos de una historia
export function useStoryChallengesQuery(storyId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.stories.challenges(storyId || ''),
    queryFn: async () => {
      if (!storyId) throw new Error('Story ID required');
      
      const { success, challenges, error } = await getStoryChallenges(storyId);
      if (!success) throw error || new Error('Failed to fetch challenges');
      
      return challenges || [];
    },
    enabled: !!storyId,
    staleTime: 10 * 60 * 1000, // 10 minutos (challenges cambian poco)
  });
}

// Mutation para crear desafío
export function useCreateChallengeMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ challenge }: { challenge: Challenge }) => {
      const { success, error } = await syncChallenge(challenge);
      if (!success) throw error || new Error('Failed to save challenge');
      return challenge;
    },
    onSuccess: (challenge) => {
      // Agregar al cache
      queryClient.setQueryData(
        queryKeys.stories.challenges(challenge.storyId),
        (old: Challenge[] | undefined) => 
          old ? [...old, challenge] : [challenge]
      );
    },
  });
}

// Hook para archivos de audio de usuario
export function useUserAudiosQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.audio.byUser(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const { success, audios, error } = await getUserAudios(userId);
      if (!success) throw error || new Error('Failed to fetch audio files');
      
      return audios || [];
    },
    enabled: !!userId,
    staleTime: 1 * 60 * 1000, // 1 minuto para archivos de audio
  });
}

// Mutation para subir archivo de audio
export function useSyncAudioMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      userId, 
      storyId, 
      chapterId, 
      voiceId, 
      audioUrl 
    }: { 
      userId: string; 
      storyId: string; 
      chapterId: string | number; 
      voiceId: string; 
      audioUrl: string; 
    }) => {
      const { success, error } = await syncAudioFile(userId, storyId, chapterId, voiceId, audioUrl);
      if (!success) throw error || new Error('Failed to sync audio file');
      
      return { userId, storyId, chapterId, voiceId, audioUrl };
    },
    onSuccess: ({ userId }) => {
      // Invalidar cache de audios
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.audio.byUser(userId) 
      });
    },
  });
}

// Hook para voz actual del usuario
export function useCurrentVoiceQuery(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.voices.current(userId || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID required');
      
      const { success, voiceId, error } = await getCurrentVoice(userId);
      if (!success) throw error || new Error('Failed to fetch current voice');
      
      return voiceId;
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

// Mutation para establecer voz actual
export function useSetCurrentVoiceMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, voiceId }: { userId: string; voiceId: string }) => {
      const { success, error } = await setCurrentVoice(userId, voiceId);
      if (!success) throw error || new Error('Failed to set current voice');
      return voiceId;
    },
    onSuccess: (voiceId, { userId }) => {
      // Actualizar cache
      queryClient.setQueryData(
        queryKeys.voices.current(userId),
        voiceId
      );
    },
  });
}