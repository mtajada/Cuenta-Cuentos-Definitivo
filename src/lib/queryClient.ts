import { QueryClient, DefaultOptions } from '@tanstack/react-query';

// Configuración por defecto para todas las queries
const queryConfig: DefaultOptions = {
  queries: {
    // Tiempo de vida de datos en cache (5 minutos)
    staleTime: 5 * 60 * 1000,
    // Tiempo antes de garbage collection (10 minutos)  
    gcTime: 10 * 60 * 1000,
    // Reintentos en caso de error
    retry: (failureCount, error: any) => {
      // No reintentar errores de autenticación
      if (error?.code === 401 || error?.code === 403) {
        return false;
      }
      // Máximo 3 reintentos para otros errores
      return failureCount < 3;
    },
    // Intervalo de reintento exponencial
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch automático cuando la ventana gana foco
    refetchOnWindowFocus: true,
    // Refetch cuando se reconecta
    refetchOnReconnect: true,
  },
  mutations: {
    // Reintentos para mutations críticas
    retry: 1,
  },
};

// Cliente de query único para toda la aplicación
export const queryClient = new QueryClient({
  defaultOptions: queryConfig,
});

// Función para invalidar queries relacionadas con usuario
export const invalidateUserQueries = () => {
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const queryKey = query.queryKey;
      return queryKey.includes('user') || 
             queryKey.includes('profile') || 
             queryKey.includes('subscription');
    }
  });
};

// Función para invalidar queries relacionadas con personajes
export const invalidateCharacterQueries = (userId?: string) => {
  queryClient.invalidateQueries({ 
    queryKey: ['characters', userId] 
  });
};

// Función para invalidar queries relacionadas con historias
export const invalidateStoryQueries = (userId?: string) => {
  queryClient.invalidateQueries({ 
    queryKey: ['stories', userId] 
  });
};

// Función para invalidar todas las queries de un usuario
export const invalidateAllUserData = (userId: string) => {
  queryClient.invalidateQueries({ 
    predicate: (query) => {
      const queryKey = query.queryKey;
      return queryKey.includes(userId);
    }
  });
};

// Función para limpiar cache al logout
export const clearQueryCache = () => {
  queryClient.clear();
};