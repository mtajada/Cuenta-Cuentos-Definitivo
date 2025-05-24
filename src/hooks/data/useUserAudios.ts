import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getUserAudios as fetchUserAudiosService } from '../../../services/supabase'; // Adjusted path, function to be adapted
// No specific Audio type in src/types/index.ts, using any[] for now
import { useAuth } from '../../../contexts/AuthContext'; // Adjusted path

// Define a basic Audio type here if needed, or use any[]
interface UserAudio {
  // Define structure based on what 'audio_files' table contains
  // Example:
  id: string;
  user_id: string;
  story_id: string;
  chapter_id: string | number;
  voice_id: string;
  url: string;
  created_at: string;
  // Add other relevant fields
}

export function useUserAudios() {
  const { user } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState<UserAudio[] | null>(null); // Using UserAudio[]
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentUserId: string) => {
    console.log(`useUserAudios: Fetching audio files for user ${currentUserId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchUserAudiosService' will be adapted later
      // to accept (client, userId) and return { audios?: UserAudio[]; error?: any; success: boolean }
      const { audios: audiosData, error: fetchError, success } = await fetchUserAudiosService(supabase, currentUserId);
      
      if (fetchError || !success) {
        const err = fetchError ? (fetchError.message || fetchError) : new Error("Failed to fetch audio files");
        console.error('useUserAudios: Error fetching audio files - service indicated failure or error:', err);
        throw err;
      }
      
      setData(audiosData || []);
      console.log('useUserAudios: Audio files fetched successfully', audiosData);
    } catch (err: any) {
      console.error('useUserAudios: Catch block error while fetching audio files:', err);
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchData(userId);
    } else {
      setData(null);
      setIsLoading(false);
      console.log('useUserAudios: No user ID, clearing data.');
    }
  }, [userId, fetchData]);

  const refetch = useCallback(() => {
    if (userId) {
      console.log('useUserAudios: Refetching audio files for user', userId);
      fetchData(userId);
    } else {
      console.log('useUserAudios: Refetch called but no user ID available.');
      setData(null);
      setIsLoading(false);
    }
  }, [userId, fetchData]);

  return { data, isLoading, error, refetch };
}
