import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getUserCharacters as fetchUserCharactersService } from '../../../services/supabase'; // Adjusted path, function to be adapted
import { StoryCharacter } from '../../../types'; // Adjusted path
import { useAuth } from '../../../contexts/AuthContext'; // Adjusted path

export function useUserCharacters() {
  const { user } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState<StoryCharacter[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentUserId: string) => {
    console.log(`useUserCharacters: Fetching characters for user ${currentUserId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchUserCharactersService' will be adapted later
      // to accept (client, userId). For now, we pass supabase and currentUserId.
      const { characters: charactersData, error: fetchError, success } = await fetchUserCharactersService(supabase, currentUserId);
      
      if (fetchError || !success) {
        // Throw an error that includes the original error if available
        const err = fetchError ? (fetchError.message || fetchError) : new Error("Failed to fetch characters");
        console.error('useUserCharacters: Error fetching characters - service indicated failure or error:', err);
        throw err;
      }
      
      setData(charactersData || []);
      console.log('useUserCharacters: Characters fetched successfully', charactersData);
    } catch (err: any) {
      console.error('useUserCharacters: Catch block error while fetching characters:', err);
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
      // No user, so clear data and set loading to false.
      setData(null);
      setIsLoading(false); // Set to false as there's no active fetching if no user.
      console.log('useUserCharacters: No user ID, clearing data.');
    }
  }, [userId, fetchData]);

  const refetch = useCallback(() => {
    if (userId) {
      console.log('useUserCharacters: Refetching characters for user', userId);
      fetchData(userId);
    } else {
      console.log('useUserCharacters: Refetch called but no user ID available.');
      // Optionally set an error or do nothing
      setData(null);
      setIsLoading(false);
    }
  }, [userId, fetchData]);

  return { data, isLoading, error, refetch };
}
