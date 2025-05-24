import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient'; // Assuming supabaseClient.ts is in src/
import { getUserProfile, syncUserProfileService } from '../services/supabase'; // Functions to be adapted
import { ProfileSettings } from '../types'; // Assuming ProfileSettings is in src/types/index.ts

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profileSettings: ProfileSettings | null;
  isLoading: boolean;
  hasCompletedProfileSetup: boolean | null;
  updateProfileSettings: (newSettings: Partial<ProfileSettings>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const WorkspaceProfile = useCallback(async (userId: string) => {
    console.log(`AuthContext: Fetching profile for user ${userId}`);
    setIsLoading(true);
    try {
      // TODO: Ensure getUserProfile is adapted to not use Zustand and accepts (client, userId)
      const { data: profileData, error } = await getUserProfile(supabase, userId);
      if (error) throw error;
      setProfileSettings(profileData);
      console.log('AuthContext: Profile fetched', profileData);
    } catch (error) {
      console.error('AuthContext: Error fetching user profile:', error);
      setProfileSettings(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchSession = async () => {
      console.log("AuthContext: Attempting to fetch initial session.");
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("AuthContext: Error fetching initial session:", error);
          throw error;
        }
        console.log("AuthContext: Initial session fetched", initialSession);
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        if (initialSession?.user) {
          await WorkspaceProfile(initialSession.user.id);
        }
      } catch (error) {
        console.error('AuthContext: Error during initial session fetch or profile load:', error);
        setSession(null);
        setUser(null);
        setProfileSettings(null);
      } finally {
        // Only set isLoading to false after the initial auth check AND profile load attempt.
        console.log("AuthContext: Initial session and profile processing complete.");
        setIsLoading(false);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log(`AuthContext: onAuthStateChange event: ${event}`, newSession);
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);

      if (event === 'SIGNED_IN' && currentUser) {
        console.log("AuthContext: User SIGNED_IN, fetching profile.");
        await WorkspaceProfile(currentUser.id);
      } else if (event === 'SIGNED_OUT') {
        console.log("AuthContext: User SIGNED_OUT, clearing profile.");
        setProfileSettings(null);
        // No need to setIsLoading here as it's for login/logout transitions, not initial load.
      } else if (event === 'USER_UPDATED' && currentUser) {
        // This event can be triggered for various reasons, e.g. password change, email change.
        // Re-fetch profile if necessary, or rely on specific actions to update profile.
        // For now, let's re-fetch to be safe, but this could be optimized.
        console.log("AuthContext: User data UPDATED, re-fetching profile.");
        await WorkspaceProfile(currentUser.id);
      }
    });

    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
        console.log("AuthContext: Unsubscribed from onAuthStateChange.");
      }
    };
  }, [WorkspaceProfile]);

  const updateProfileSettings = async (newSettings: Partial<ProfileSettings>) => {
    if (!user) {
      console.error('AuthContext: Cannot update profile settings, no user logged in.');
      throw new Error('User must be logged in to update profile settings.');
    }
    console.log('AuthContext: Updating profile settings for user', user.id, newSettings);
    setIsLoading(true); // Optional: set loading state during profile update
    try {
      // TODO: Ensure syncUserProfileService is adapted to not use Zustand and accepts (client, userId, settings)
      const { error } = await syncUserProfileService(supabase, user.id, newSettings);
      if (error) throw error;
      // Refresh profile settings from DB after successful update
      await WorkspaceProfile(user.id);
      console.log('AuthContext: Profile settings updated successfully.');
    } catch (error) {
      console.error('AuthContext: Error updating profile settings:', error);
      // Optionally, revert to previous settings or handle error state in UI
      throw error; // Re-throw error to be caught by the calling component
    } finally {
      setIsLoading(false); // Optional: clear loading state
    }
  };

  const logout = async () => {
    console.log('AuthContext: Logging out user.');
    setIsLoading(true); // Optional: set loading state during logout
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // onAuthStateChange will handle setting user and profileSettings to null
      console.log('AuthContext: Logout successful.');
    } catch (error) {
      console.error('AuthContext: Error logging out:', error);
    } finally {
      setIsLoading(false); // Optional: clear loading state
    }
  };

  const hasCompletedProfileSetup = profileSettings ? profileSettings.has_completed_setup : null;

  return (
    <AuthContext.Provider value={{ user, session, profileSettings, isLoading, hasCompletedProfileSetup, updateProfileSettings, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
