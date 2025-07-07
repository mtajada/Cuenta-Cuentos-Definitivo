import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/supabaseClient';
import { ProfileSettings } from '@/types';
import { getUserProfile } from '@/services/supabase';
import { clearQueryCache } from '@/lib/queryClient';

// Tipos para el contexto de autenticación
interface AuthContextType {
  // Estado de autenticación
  user: User | null;
  session: Session | null;
  profile: ProfileSettings | null;
  loading: boolean;
  
  // Funciones de autenticación
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  
  // Funciones de perfil
  updateProfile: (updates: Partial<ProfileSettings>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  
  // Estado derivado
  isAuthenticated: boolean;
  isSetupComplete: boolean;
  isPremium: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props para el provider
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar perfil del usuario
  const loadProfile = async (userId: string) => {
    try {
      const { success, profile: userProfile } = await getUserProfile(userId);
      if (success && userProfile) {
        setProfile(userProfile);
      } else {
        console.warn('No se pudo cargar el perfil del usuario');
        setProfile(null);
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
      setProfile(null);
    }
  };

  // Inicializar autenticación
  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadProfile(session.user.id);
      }
      
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          clearQueryCache(); // Limpiar cache al cerrar sesión
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Función de login
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      
      if (error) {
        console.error('Error en signIn:', error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('Error inesperado en signIn:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Función de registro
  const signUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signUp({ email, password });
      
      if (error) {
        console.error('Error en signUp:', error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('Error inesperado en signUp:', error);
      return { error };
    } finally {
      setLoading(false);
    }
  };

  // Función de logout
  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      // El estado se limpiará automáticamente en onAuthStateChange
    } catch (error) {
      console.error('Error en signOut:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar perfil
  const updateProfile = async (updates: Partial<ProfileSettings>) => {
    if (!user) {
      return { error: new Error('Usuario no autenticado') };
    }

    try {
      // Actualizar estado local optimísticamente
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      
      // TODO: Implementar syncUserProfile cuando esté disponible
      // const { success, error } = await syncUserProfile(user.id, updates);
      
      return { error: null };
    } catch (err) {
      const error = err as Error;
      console.error('Error actualizando perfil:', error);
      
      // Revertir cambio optimista
      if (profile) {
        setProfile(profile);
      }
      
      return { error };
    }
  };

  // Refrescar perfil
  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  // Estado derivado
  const isAuthenticated = !!user;
  const isSetupComplete = !!profile?.has_completed_setup;
  const isPremium = profile?.subscription_status === 'active' || 
                   profile?.subscription_status === 'trialing';

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    refreshProfile,
    isAuthenticated,
    isSetupComplete,
    isPremium,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook para usar el contexto de autenticación
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  
  return context;
};