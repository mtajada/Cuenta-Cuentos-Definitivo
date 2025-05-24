import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getCurrentVoice as fetchUserVoicePreferenceService } from '../../../services/supabase'; // Adjusted path, function to be adapted
import { useAuth } from '../../../contexts/AuthContext'; // Adjusted path

export function useUserVoicePreference() {
  const { user } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState<string | null>(null); // Stores the voiceId or null
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentUserId: string) => {
    console.log(`useUserVoicePreference: Fetching voice preference for user ${currentUserId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchUserVoicePreferenceService' will be adapted later
      // to accept (client, userId) and return { voiceId?: string | null; error?: any; success: boolean }
      const { voiceId, error: fetchError, success } = await fetchUserVoicePreferenceService(supabase, currentUserId);
      
      if (fetchError || !success) {
        const err = fetchError ? (fetchError.message || fetchError) : new Error("Failed to fetch voice preference");
        console.error('useUserVoicePreference: Error fetching voice preference - service indicated failure or error:', err);
        throw err;
      }
      
      setData(voiceId || null); // voiceId can be null if no preference is set
      console.log('useUserVoicePreference: Voice preference fetched successfully', voiceId);
    } catch (err: any) {
      console.error('useUserVoicePreference: Catch block error while fetching voice preference:', err);
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
      console.log('useUserVoicePreference: No user ID, clearing data.');
    }
  }, [userId, fetchData]);

  const refetch = useCallback(() => {
    if (userId) {
      console.log('useUserVoicePreference: Refetching voice preference for user', userId);
      fetchData(userId);
    } else {
      console.log('useUserVoicePreference: Refetch called but no user ID available.');
      setData(null);
      setIsLoading(false);
    }
  }, [userId, fetchData]);

  return { data, isLoading, error, refetch };
}
