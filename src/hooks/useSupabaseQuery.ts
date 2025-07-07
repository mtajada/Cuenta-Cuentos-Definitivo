import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import { queryKeys } from '@/services/queryKeys';

// Tipos para errores de Supabase
export interface SupabaseError {
  message: string;
  code?: string;
  details?: string;
}

// Opciones por defecto para queries de Supabase
const defaultQueryOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutos
  retry: (failureCount: number, error: unknown) => {
    // No reintentar errores de autenticación
    const err = error as { code?: number };
    if (err?.code === 401 || err?.code === 403) {
      return false;
    }
    return failureCount < 3;
  },
};

// Hook genérico para queries de Supabase
export function useSupabaseQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  options?: Omit<UseQueryOptions<T, SupabaseError>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T, SupabaseError>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await queryFn();
      
      if (error) {
        console.error(`Query error for ${queryKey}:`, error);
        throw error;
      }
      
      if (data === null) {
        throw new Error('No data returned from query');
      }
      
      return data;
    },
    ...defaultQueryOptions,
    ...options,
  });
}

// Hook para mutations de Supabase
export function useSupabaseMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<{ data: TData | null; error: unknown }>,
  options?: UseMutationOptions<TData, SupabaseError, TVariables>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, SupabaseError, TVariables>({
    mutationFn: async (variables) => {
      const { data, error } = await mutationFn(variables);
      
      if (error) {
        console.error('Mutation error:', error);
        throw error;
      }
      
      if (data === null) {
        throw new Error('No data returned from mutation');
      }
      
      return data;
    },
    onError: (error) => {
      console.error('Mutation failed:', error);
    },
    ...options,
  });
}

// Hook especializado para autenticación
export function useAuthQuery<T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<{ data: T | null; error: unknown }>,
  options?: Omit<UseQueryOptions<T, SupabaseError>, 'queryKey' | 'queryFn'>
) {
  return useSupabaseQuery(queryKey, queryFn, {
    ...options,
    // Queries de auth no deben hacer retry automático
    retry: false,
    // Cache más corto para datos de autenticación
    staleTime: 1 * 60 * 1000, // 1 minuto
  });
}

// Hook para verificar el estado de autenticación
export function useAuthState() {
  return useAuthQuery(
    queryKeys.user.all,
    async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      return { data: user, error };
    },
    {
      // Refetch cuando la ventana gana foco
      refetchOnWindowFocus: true,
      // Mantener datos previos mientras se refetch
      placeholderData: (previousData) => previousData,
    }
  );
}

// Hook para datos del perfil de usuario
export function useUserProfile(userId: string | undefined) {
  return useSupabaseQuery(
    queryKeys.user.profile(userId || ''),
    async () => {
      if (!userId) throw new Error('User ID required');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      return { data, error };
    },
    {
      enabled: !!userId,
      // Refetch al ganar foco para datos de suscripción
      refetchOnWindowFocus: true,
    }
  );
}

// Hook para invalidar queries relacionadas con autenticación
export function useInvalidateAuth() {
  const queryClient = useQueryClient();
  
  return {
    invalidateUser: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.all }),
    invalidateProfile: (userId: string) => 
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(userId) }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}