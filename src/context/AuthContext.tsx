import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { User, ProfileSettings } from "../types";
import { logout } from "../supabaseAuth";
import { getUserProfile, syncUserProfile, syncQueue } from "../services/supabase";
import { supabase } from "../supabaseClient";

interface AuthContextValue {
  user: User | null;
  profileSettings: ProfileSettings | null;
  loading: boolean;
  intendedRedirectPath: string | null;
  setIntendedRedirectPath: (path: string | null) => void;
  logoutUser: () => Promise<void>;
  setProfileSettings: (settings: Partial<ProfileSettings>) => Promise<void>;
  hasCompletedProfile: () => boolean;
  isPremium: () => boolean;
  getRemainingMonthlyStories: () => number;
  canCreateStory: () => boolean;
  getRemainingMonthlyVoiceGenerations: () => number;
  getAvailableVoiceCredits: () => number;
  canGenerateVoice: () => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profileSettings, setProfileSettingsState] = useState<ProfileSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [intendedRedirectPath, setIntendedRedirectPath] = useState<string | null>(null);

  const updateSession = useCallback(async (sessionUser: Parameters<typeof supabase.auth.onAuthStateChange>[0][1]['user'] | null) => {
    if (sessionUser) {
      const u: User = { id: sessionUser.id, email: sessionUser.email ?? "" };
      setUser(u);
      try {
        const { success, profile } = await getUserProfile(u.id);
        if (success && profile) {
          setProfileSettingsState(profile);
          setIntendedRedirectPath(profile.has_completed_setup ? "/home" : "/profile-config");
        } else {
          setProfileSettingsState(null);
          setIntendedRedirectPath("/profile-config");
        }
      } catch (error) {
        console.error("Error loading user profile", error);
        setProfileSettingsState(null);
        setIntendedRedirectPath("/login");
      }
    } else {
      setUser(null);
      setProfileSettingsState(null);
      setIntendedRedirectPath(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        await updateSession(session?.user ?? null);
        setLoading(false);
      }
    };
    init();
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      updateSession(session?.user ?? null);
    });
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [updateSession]);


  const logoutUser = useCallback(async () => {
    if (user) {
      await syncQueue.processQueue();
    }
    await logout();
    setUser(null);
    setProfileSettingsState(null);
    setIntendedRedirectPath(null);
  }, [user]);

  const setProfileSettings = useCallback(async (settings: Partial<ProfileSettings>) => {
    setProfileSettingsState((prev) => ({ ...prev, ...settings } as ProfileSettings));
    if (user) {
      try {
        const keyMap: { [key: string]: string } = {
          childAge: "child_age",
          specialNeed: "special_need",
          language: "language",
          has_completed_setup: "has_completed_setup",
        };
        const syncData: { [key: string]: any } = {};
        for (const key in settings) {
          const mapped = keyMap[key];
          if (mapped) {
            const value = (settings as any)[key];
            if (value !== undefined) syncData[mapped] = value;
          }
        }
        if (Object.keys(syncData).length > 0) {
          const { success } = await syncUserProfile(user.id, syncData as any);
          if (!success) syncQueue.addToQueue("profiles", "update", { id: user.id, ...syncData });
        }
      } catch (error) {
        console.error("Error syncing profile", error);
        syncQueue.addToQueue("profiles", "update", { id: user.id, ...settings });
      }
    }
  }, [user]);

  const hasCompletedProfile = useCallback(() => !!profileSettings?.has_completed_setup, [profileSettings]);

  const isPremium = useCallback(() => {
    const status = profileSettings?.subscription_status;
    return status === "active" || status === "trialing";
  }, [profileSettings]);

  const getRemainingMonthlyStories = useCallback(() => {
    if (isPremium() || !profileSettings) return Infinity;
    return Math.max(0, 10 - (profileSettings.monthly_stories_generated || 0));
  }, [profileSettings, isPremium]);

  const canCreateStory = useCallback(() => getRemainingMonthlyStories() > 0, [getRemainingMonthlyStories]);

  const getRemainingMonthlyVoiceGenerations = useCallback(() => {
    if (!isPremium() || !profileSettings) return 0;
    return Math.max(0, 20 - (profileSettings.monthly_voice_generations_used || 0));
  }, [profileSettings, isPremium]);

  const getAvailableVoiceCredits = useCallback(() => profileSettings?.voice_credits || 0, [profileSettings]);

  const canGenerateVoice = useCallback(() => {
    if (!profileSettings) return false;
    const premium = isPremium();
    const monthly = profileSettings.monthly_voice_generations_used ?? 0;
    const credits = profileSettings.voice_credits ?? 0;
    if (premium) return monthly < 20 || credits > 0;
    return credits > 0;
  }, [profileSettings, isPremium]);


  return (
    <AuthContext.Provider value={{
      user,
      profileSettings,
      loading,
      intendedRedirectPath,
      setIntendedRedirectPath,
      logoutUser,
      setProfileSettings,
      hasCompletedProfile,
      isPremium,
      getRemainingMonthlyStories,
      canCreateStory,
      getRemainingMonthlyVoiceGenerations,
      getAvailableVoiceCredits,
      canGenerateVoice,
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
