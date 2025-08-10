// src/store/user/userStore.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserState } from "../types/storeTypes";
import { ProfileSettings, User } from "../../types";
import { setCurrentAuthUser } from "../core/createStore";
import { getCurrentUser, logout } from "../../supabaseAuth";
import {
  getUserProfile,
  syncQueue,
  syncUserProfile,
} from "../../services/supabase";
import { supabase } from "../../supabaseClient";
import { useChaptersStore } from '../stories/chapters/chaptersStore';

const PREMIUM_MONTHLY_VOICE_ALLOWANCE = 10; // Max free monthly voice generations for premium

// Estado inicial
const initialState: Pick<UserState, "user" | "profileSettings" | "intendedRedirectPath"> = {
  user: null,
  profileSettings: null,
  intendedRedirectPath: null, // Inicializado
};

// Create userStore directly with zustand persist instead of createPersistentStore
// This ensures the userStore persists globally and doesn't depend on currentAuthUserId timing
export const useUserStore = create<UserState>()(
  persist(
  (set, get) => ({
      ...initialState,
      
    loginUser: async (user: User): Promise<void> => { // Revertido a Promise<void>
      // Actualizar usuario en el store global
      setCurrentAuthUser(user.id);

      // Establecer el usuario en el store
      set({ user, intendedRedirectPath: null }); // Reset path on new login attempt

      let redirectPath = '/login'; // Default path

      // Al iniciar sesión, cargar datos desde Supabase
      try {
        // 1. Cargar perfil
        console.log(`Cargando perfil para usuario ${user.id} desde Supabase`);
        const { success, profile } = await getUserProfile(user.id);
        if (success && profile) {
          console.log("Perfil cargado con éxito:", profile);
          set({ profileSettings: profile });
          // Determinar ruta de redirección basado en setup
          redirectPath = profile.has_completed_setup ? '/home' : '/profile-config';
        } else {
          console.warn("No se encontró perfil para el usuario logueado o hubo un error, redirigiendo a setup:", user.id);
          // Podría ser un usuario nuevo o un error. Dirigir a setup como fallback seguro.
          redirectPath = '/profile-config';
        }

        // 2. Iniciar sincronización de otros datos (no bloqueante para la redirección)
        syncAllUserData(user.id);

      } catch (error) {
        console.error("Error cargando datos de usuario desde Supabase:", error);
        redirectPath = '/login'; // En caso de error, volver a login
      }
      set({ intendedRedirectPath: redirectPath }); // Establecer el path en el estado
    },

    logoutUser: async () => {
      // Guardar una referencia al usuario actual antes de cerrar sesión
      const currentUser = get().user;

      // Intentar sincronizar datos pendientes antes de cerrar sesión
      if (currentUser) {
        await syncQueue.processQueue();
      }

      // Cerrar sesión en Supabase
      await logout();

      // Limpiar el estado del store
      set({ user: null, profileSettings: null, intendedRedirectPath: null });

      // Actualizar usuario en el store global (ningún usuario autenticado)
      setCurrentAuthUser(null);
    },

    setProfileSettings: async (settings: Partial<ProfileSettings>) => {
      // 1. Merge partial settings with current state
      set((state) => ({
        profileSettings: {
          // Ensure we have a base object even if profileSettings was null
          ...(state.profileSettings || { has_completed_setup: false }), // Default has_completed_setup if null
          ...settings,
        } as ProfileSettings // Assert as ProfileSettings after merge
      }));

      // 2. Sincronizar solo los campos proporcionados con Supabase
      const user = get().user;
      if (user) {
        // 3. Construir objeto solo con los campos presentes en 'settings'
          const syncData: Partial<ProfileSettings> & { [key: string]: unknown } = {};
        // Mapeo de camelCase (TypeScript) a snake_case (Supabase)
        const keyMap: { [K in keyof ProfileSettings]?: string } = {
          childAge: 'child_age',
          specialNeed: 'special_need',
          language: 'language',
          has_completed_setup: 'has_completed_setup', // Añadir mapeo si alguna vez se actualiza por aquí
          // Añadir otros campos editables si es necesario
        };

        for (const key in settings) {
          if (Object.prototype.hasOwnProperty.call(settings, key)) {
            const mappedKey = keyMap[key as keyof ProfileSettings];
            if (mappedKey) {
              // Asegurar que el valor no sea undefined antes de asignarlo
              const value = settings[key as keyof ProfileSettings];
              if (value !== undefined) {
                syncData[mappedKey] = value;
              }
            }
          }
        }

        // No sincronizar si no hay datos válidos para enviar
        if (Object.keys(syncData).length === 0) {
          console.log("setProfileSettings: No hay datos editables válidos para sincronizar.");
          return;
        }

        try {
          // 4. Intentar la sincronización directa
            const { success, error: syncError } = await syncUserProfile(user.id, syncData);
          if (!success) {
            console.warn("Sincronización directa fallida, añadiendo a la cola:", syncError);
            // 5. Si falla, agregarlo a la cola de sincronización
            syncQueue.addToQueue("profiles", "update", { id: user.id, ...syncData });
          }
        } catch (error) {
          console.error("Error sincronizando perfil con Supabase:", error);
          // 6. Agregar a la cola de sincronización en caso de error
          syncQueue.addToQueue("profiles", "update", { id: user.id, ...syncData });
        }
      }
    },

    hasCompletedProfile: () => {
      const profile = get().profileSettings;
        console.log('[hasCompletedProfile_DEBUG] Profile settings:', profile);
      // Considerar el perfil completado si existe y el flag es true
        const isCompleted = !!profile && profile.has_completed_setup;
        console.log('[hasCompletedProfile_DEBUG] Is completed:', isCompleted);
        return isCompleted;
    },

    // --- Selectores Actualizados/Nuevos ---
    isPremium: () => {
      const status = get().profileSettings?.subscription_status;
      return status === 'active' || status === 'trialing';
    },

    getRemainingMonthlyStories: () => {
      const settings = get().profileSettings;
      // Si es premium, devuelve infinito (o un número grande), si no, calcula el restante de 10.
      if (get().isPremium() || !settings) return Infinity;
      return Math.max(0, 10 - (settings.monthly_stories_generated || 0));
    },

    canCreateStory: () => {
      return get().getRemainingMonthlyStories() > 0;
    },

    getRemainingMonthlyVoiceGenerations: () => {
      const settings = get().profileSettings;
      // Solo aplica a premium, devuelve 0 si no lo es.
      if (!get().isPremium() || !settings) return 0;
        // 10 generaciones gratis al mes para premium
        return Math.max(0, PREMIUM_MONTHLY_VOICE_ALLOWANCE - (settings.monthly_voice_generations_used || 0));
    },

    getAvailableVoiceCredits: () => {
      return get().profileSettings?.voice_credits || 0;
    },

    canGenerateVoice: () => {
      const settings = get().profileSettings;
      console.log('[canGenerateVoice_DEBUG] Checking canGenerateVoice. Settings:', settings);

      // a. Handle missing profile
      if (!settings) {
        console.warn('[canGenerateVoice_DEBUG] No profile settings found. Denying voice generation.');
        return false;
      }

      // b. Get values safely
      const subscriptionStatus = settings.subscription_status;
      const monthlyGenerationsUsed = settings.monthly_voice_generations_used ?? 0;
      const voiceCredits = settings.voice_credits ?? 0;

      // c. Determine if premium
      const isPremium = subscriptionStatus === 'active' || subscriptionStatus === 'trialing';
      console.log(`[canGenerateVoice_DEBUG] User Status: ${subscriptionStatus}, Is Premium: ${isPremium}`);

      // d. Main logic
      if (isPremium) {
        const hasMonthlyGenerations = monthlyGenerationsUsed < PREMIUM_MONTHLY_VOICE_ALLOWANCE;
        const hasPurchasedCredits = voiceCredits > 0;
        const allowed = hasMonthlyGenerations || hasPurchasedCredits;
        console.log(`[canGenerateVoice_DEBUG] Premium Check - Monthly Used: ${monthlyGenerationsUsed}/${PREMIUM_MONTHLY_VOICE_ALLOWANCE}, Credits: ${voiceCredits}. Allowed: ${allowed}`);
        return allowed;
      } else {
        // Non-premium (Free, Canceled, etc.)
        const hasPurchasedCredits = voiceCredits > 0;
        console.log(`[canGenerateVoice_DEBUG] Non-Premium Check - Credits: ${voiceCredits}. Allowed: ${hasPurchasedCredits}`);
        return hasPurchasedCredits; // Only allowed if they have purchased credits
      }
    },

    canContinueStory: (storyId: string) => {
      if (get().isPremium()) return true; // Premium puede continuar ilimitadamente

      // Gratuito: obtener capítulos y contar
      const chapters = useChaptersStore.getState().getChaptersByStoryId(storyId);
      // Permite si hay menos de 2 capítulos (Cap 1 inicial + 1 continuación)
      return chapters.length < 2;
    },

    checkAuth: async (): Promise<User | null> => {
      let authenticatedUser: User | null = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();

        const { user, error } = await getCurrentUser();

        if (user && !error) {
            // Set currentAuthUser immediately to ensure proper store namespacing for other stores
            setCurrentAuthUser(user.id);
            
          set({ user });
          authenticatedUser = user;
          // Cargar perfil SI hay usuario
          const { success, profile } = await getUserProfile(user.id);
          if (success && profile) {
              console.log('[checkAuth_DEBUG] Profile loaded successfully:', profile);
            set({ profileSettings: profile });
            // Sincronizar el resto en segundo plano
            syncAllUserData(user.id);
          } else {
            // Aún autenticado, pero sin perfil o error al cargarlo.
            // La redirección a profile-config se manejará en la página de destino o AuthGuard si es necesario
            console.warn("checkAuth: Usuario autenticado pero perfil no encontrado o error al cargar:", user.id);
            set({ profileSettings: null });
          }

        } else {
          // No hay usuario o hubo error
          if (error) console.error("Error en getCurrentUser:", error);
          set({ user: null, profileSettings: null });
          authenticatedUser = null;
            // Clear currentAuthUser
            setCurrentAuthUser(null);
        }
      } catch (e) {
        console.error("Error crítico durante checkAuth:", e);
        set({ user: null, profileSettings: null });
        authenticatedUser = null;
          setCurrentAuthUser(null);
      }
      return authenticatedUser;
    },
  }),
    {
      name: 'story-app-user-global', // Fixed name that doesn't depend on userId
      partialize: (state) => ({
        user: state.user,
        profileSettings: state.profileSettings,
        // Don't persist intendedRedirectPath as it's only needed during session
      }),
    }
  )
);

// Función para sincronizar todos los datos del usuario desde Supabase
async function syncAllUserData(userId: string) {
  console.log(`Iniciando carga completa para usuario: ${userId}`);

  // 1. Limpiar todos los datos locales primero
  const otherStores = [
    { store: (await import('../stories/storiesStore')).useStoriesStore, method: 'loadStoriesFromSupabase' },
    { store: (await import('../character/characterStore')).useCharacterStore, method: 'loadCharactersFromSupabase' },
    // Agrega otros stores aquí
  ];

  // 2. Cargar secuencialmente
  for (const { store, method } of otherStores) {
    try {
      console.log(`Cargando datos con método: ${method}`);
      await store.getState()[method](userId);
    } catch (error) {
      console.error(`Error cargando datos con ${method}:`, error);
    }
  }

  console.log("Sincronización completa");
}