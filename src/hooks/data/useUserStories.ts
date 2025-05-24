import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getUserStories as fetchUserStoriesService } from '../../../services/supabase'; // Adjusted path, function to be adapted
import { Story } from '../../../types'; // Adjusted path
import { useAuth } from '../../../contexts/AuthContext'; // Adjusted path

export function useUserStories() {
  const { user } = useAuth();
  const userId = user?.id;

  const [data, setData] = useState<Story[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentUserId: string) => {
    console.log(`useUserStories: Fetching stories for user ${currentUserId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchUserStoriesService' will be adapted later
      // to accept (client, userId) and return { stories?: Story[]; error?: any; success: boolean }
      const { stories: storiesData, error: fetchError, success } = await fetchUserStoriesService(supabase, currentUserId);
      
      if (fetchError || !success) {
        const err = fetchError ? (fetchError.message || fetchError) : new Error("Failed to fetch stories");
        console.error('useUserStories: Error fetching stories - service indicated failure or error:', err);
        throw err;
      }
      
      setData(storiesData || []);
      console.log('useUserStories: Stories fetched successfully', storiesData);
    } catch (err: any) {
      console.error('useUserStories: Catch block error while fetching stories:', err);
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
      console.log('useUserStories: No user ID, clearing data.');
    }
  }, [userId, fetchData]);

  const refetch = useCallback(() => {
    if (userId) {
      console.log('useUserStories: Refetching stories for user', userId);
      fetchData(userId);
    } else {
      console.log('useUserStories: Refetch called but no user ID available.');
      setData(null);
      setIsLoading(false);
    }
  }, [userId, fetchData]);

  return { data, isLoading, error, refetch };
}
