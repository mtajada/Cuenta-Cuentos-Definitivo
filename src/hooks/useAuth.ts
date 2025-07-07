import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/services/queryKeys';
import { ProfileSettings } from '@/types';
import { getUserProfile, syncUserProfile } from '@/services/supabase';

// Re-exportar el hook del context para conveniencia
export { useAuth } from '@/contexts/AuthContext';

// Hook específico para funciones de autenticación con TanStack Query
export function useAuthOperations() {
  const { user, signIn, signUp, signOut, loading } = useAuthContext();
  const queryClient = useQueryClient();

  // Mutation para login
  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await signIn(email, password);
      if (result.error) throw result.error;
      return result;
    },
    onSuccess: () => {
      // Invalidar queries relacionadas con usuario
      queryClient.invalidateQueries({ queryKey: queryKeys.user.all });
    },
  });

  // Mutation para registro
  const signupMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const result = await signUp(email, password);
      if (result.error) throw result.error;
      return result;
    },
  });

  // Mutation para logout
  const logoutMutation = useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Limpiar todas las queries al cerrar sesión
      queryClient.clear();
    },
  });

  return {
    user,
    loading,
    login: loginMutation.mutateAsync,
    signup: signupMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isSigningUp: signupMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}

// Hook para gestión del perfil de usuario
export function useUserProfile() {
  const { user, profile, updateProfile, refreshProfile } = useAuthContext();
  const queryClient = useQueryClient();

  // Query para el perfil (con sincronización desde context)
  const profileQuery = useQuery({
    queryKey: queryKeys.user.profile(user?.id || ''),
    queryFn: async () => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { success, profile: userProfile } = await getUserProfile(user.id);
      if (!success || !userProfile) {
        throw new Error('No se pudo cargar el perfil');
      }
      
      return userProfile;
    },
    enabled: !!user,
    // Usar datos del context como placeholder
    placeholderData: profile || undefined,
  });

  // Mutation para actualizar perfil
  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<ProfileSettings>) => {
      if (!user) throw new Error('Usuario no autenticado');
      
      const { success, error } = await syncUserProfile(user.id, updates as Record<string, unknown>);
      if (!success) throw error;
      
      return updates;
    },
    onSuccess: (updates) => {
      // Actualizar cache optimísticamente
      queryClient.setQueryData(
        queryKeys.user.profile(user?.id || ''),
        (old: ProfileSettings | undefined) => old ? { ...old, ...updates } : undefined
      );
      
      // Refrescar context
      refreshProfile();
    },
  });

  return {
    profile: profileQuery.data || profile,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
    refreshProfile,
  };
}

// Hook para verificar permisos y límites
export function useUserPermissions() {
  const { profile, isPremium } = useAuthContext();

  const canCreateStory = () => {
    if (isPremium) return true;
    if (!profile) return false;
    return (profile.monthly_stories_generated || 0) < 10;
  };

  const canGenerateVoice = () => {
    if (!profile) return false;
    
    if (isPremium) {
      const monthlyUsed = profile.monthly_voice_generations_used || 0;
      const hasMonthlyAllowance = monthlyUsed < 20; // Premium monthly allowance
      const hasCredits = (profile.voice_credits || 0) > 0;
      return hasMonthlyAllowance || hasCredits;
    }
    
    // Free users only with purchased credits
    return (profile.voice_credits || 0) > 0;
  };

  const canContinueStory = (chapterCount: number) => {
    if (isPremium) return true;
    return chapterCount < 2; // Free users: 1 initial + 1 continuation
  };

  const getRemainingStories = () => {
    if (isPremium) return Infinity;
    if (!profile) return 0;
    return Math.max(0, 10 - (profile.monthly_stories_generated || 0));
  };

  const getRemainingVoiceCredits = () => {
    return profile?.voice_credits || 0;
  };

  const getRemainingMonthlyVoice = () => {
    if (!isPremium || !profile) return 0;
    return Math.max(0, 20 - (profile.monthly_voice_generations_used || 0));
  };

  return {
    isPremium,
    canCreateStory,
    canGenerateVoice,
    canContinueStory,
    getRemainingStories,
    getRemainingVoiceCredits,
    getRemainingMonthlyVoice,
  };
}