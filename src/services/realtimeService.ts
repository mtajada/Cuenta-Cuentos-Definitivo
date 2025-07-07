import { useState, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { queryClient } from '@/lib/queryClient';
import { queryKeys } from './queryKeys';

// Tipos para eventos de tiempo real
export interface RealtimeEvent<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: T | null;
  table: string;
}

// Clase para gestionar subscripciones de tiempo real
class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();
  private userId: string | null = null;

  // Establecer el usuario actual
  setUser(userId: string | null) {
    if (this.userId !== userId) {
      // Limpiar subscripciones anteriores si cambia el usuario
      this.cleanup();
      this.userId = userId;
      
      if (userId) {
        this.setupUserSubscriptions(userId);
      }
    }
  }

  // Configurar subscripciones para un usuario específico
  private setupUserSubscriptions(userId: string) {
    console.log(`Configurando subscripciones tiempo real para usuario: ${userId}`);

    // Subscripción a cambios en el perfil
    this.subscribeToTable('profiles', {
      filter: `id=eq.${userId}`,
      onEvent: (event) => {
        console.log('Profile updated:', event);
        // Invalidar queries relacionadas con el perfil
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.user.profile(userId) 
        });
      }
    });

    // Subscripción a cambios en personajes
    this.subscribeToTable('characters', {
      filter: `user_id=eq.${userId}`,
      onEvent: (event) => {
        console.log('Character updated:', event);
        // Invalidar queries de personajes
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.characters.byUser(userId) 
        });
      }
    });

    // Subscripción a cambios en historias
    this.subscribeToTable('stories', {
      filter: `user_id=eq.${userId}`,
      onEvent: (event) => {
        console.log('Story updated:', event);
        // Invalidar queries de historias
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.stories.byUser(userId) 
        });
      }
    });

    // Subscripción a cambios en capítulos
    this.subscribeToTable('story_chapters', {
      filter: `story_id=in.(select id from stories where user_id = '${userId}')`,
      onEvent: (event) => {
        console.log('Chapter updated:', event);
        // Invalidar queries de capítulos si tenemos el story_id
        if (event.new?.story_id || event.old?.story_id) {
          const storyId = event.new?.story_id || event.old?.story_id;
          queryClient.invalidateQueries({ 
            queryKey: queryKeys.stories.chapters(storyId) 
          });
        }
      }
    });

    // Subscripción a archivos de audio
    this.subscribeToTable('audio_files', {
      filter: `user_id=eq.${userId}`,
      onEvent: (event) => {
        console.log('Audio file updated:', event);
        // Invalidar cache de audio
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.audio.byUser(userId) 
        });
      }
    });
  }

  // Subscribirse a una tabla específica
  private subscribeToTable(
    table: string, 
    options: {
      filter?: string;
      onEvent: (event: RealtimeEvent) => void;
    }
  ) {
    const channelName = `${table}_${this.userId}`;
    
    // Verificar si ya existe la subscripción
    if (this.channels.has(channelName)) {
      console.warn(`Ya existe subscripción para ${channelName}`);
      return;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: options.filter,
        },
        (payload) => {
          options.onEvent({
            eventType: payload.eventType as any,
            new: payload.new,
            old: payload.old,
            table: table,
          });
        }
      )
      .subscribe((status) => {
        console.log(`Subscripción ${channelName}:`, status);
      });

    this.channels.set(channelName, channel);
  }

  // Subscripción personalizada para una query específica
  subscribeToQuery(
    queryKey: readonly unknown[],
    table: string,
    filter?: string
  ) {
    const channelName = `custom_${queryKey.join('_')}`;
    
    if (this.channels.has(channelName)) {
      return; // Ya existe
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter,
        },
        () => {
          // Invalidar la query específica
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    
    return () => {
      // Función de cleanup
      const channel = this.channels.get(channelName);
      if (channel) {
        supabase.removeChannel(channel);
        this.channels.delete(channelName);
      }
    };
  }

  // Limpiar todas las subscripciones
  cleanup() {
    console.log('Limpiando subscripciones tiempo real');
    
    for (const [name, channel] of this.channels) {
      console.log(`Removiendo canal: ${name}`);
      supabase.removeChannel(channel);
    }
    
    this.channels.clear();
  }

  // Pausar subscripciones (útil cuando la app va a background)
  pause() {
    for (const channel of this.channels.values()) {
      channel.unsubscribe();
    }
  }

  // Reanudar subscripciones
  resume() {
    for (const channel of this.channels.values()) {
      channel.subscribe();
    }
  }

  // Obtener estado de las subscripciones
  getStatus() {
    const status: Record<string, string> = {};
    
    for (const [name, channel] of this.channels) {
      status[name] = channel.state;
    }
    
    return status;
  }
}

// Instancia singleton del servicio
export const realtimeService = new RealtimeService();

// Hook para usar el servicio de tiempo real
export function useRealtimeSubscription(
  queryKey: readonly unknown[],
  table: string,
  filter?: string
) {
  const [unsubscribe, setUnsubscribe] = useState<(() => void) | null>(null);

  useEffect(() => {
    const cleanup = realtimeService.subscribeToQuery(queryKey, table, filter);
    setUnsubscribe(() => cleanup);

    return () => {
      if (cleanup) cleanup();
    };
  }, [queryKey, table, filter]);

  return { unsubscribe };
}

// Inicializar el servicio cuando cambie la autenticación
export function initializeRealtimeService() {
  // Escuchar cambios de autenticación
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      realtimeService.setUser(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      realtimeService.setUser(null);
    }
  });

  // Manejar visibilidad de la página
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        realtimeService.resume();
      } else {
        realtimeService.pause();
      }
    });
  }

  // Manejar conectividad
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      realtimeService.resume();
    });
    
    window.addEventListener('offline', () => {
      realtimeService.pause();
    });
  }
}

// Re-exportar para conveniencia
export { realtimeService as default };