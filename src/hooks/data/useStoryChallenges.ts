import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getStoryChallenges as fetchStoryChallengesService } from '../../../services/supabase'; // Adjusted path, function to be adapted
import { Challenge } from '../../../types'; // Adjusted path

export function useStoryChallenges(storyId: string | null | undefined) {
  const [data, setData] = useState<Challenge[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentStoryId: string) => {
    console.log(`useStoryChallenges: Fetching challenges for story ${currentStoryId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchStoryChallengesService' will be adapted later
      // to accept (client, storyId) and return { challenges?: Challenge[]; error?: any; success: boolean }
      const { challenges: challengesData, error: fetchError, success } = await fetchStoryChallengesService(supabase, currentStoryId);
      
      if (fetchError || !success) {
        const err = fetchError ? (fetchError.message || fetchError) : new Error(`Failed to fetch challenges for story ${currentStoryId}`);
        console.error(`useStoryChallenges: Error fetching challenges for story ${currentStoryId} - service indicated failure or error:`, err);
        throw err;
      }
      
      setData(challengesData || []);
      console.log(`useStoryChallenges: Challenges for story ${currentStoryId} fetched successfully`, challengesData);
    } catch (err: any) {
      console.error(`useStoryChallenges: Catch block error while fetching challenges for story ${currentStoryId}:`, err);
      setError(err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (storyId) {
      fetchData(storyId);
    } else {
      setData(null);
      setIsLoading(false);
      console.log('useStoryChallenges: No story ID provided, clearing data.');
    }
  }, [storyId, fetchData]);

  const refetch = useCallback(() => {
    if (storyId) {
      console.log('useStoryChallenges: Refetching challenges for story', storyId);
      fetchData(storyId);
    } else {
      console.log('useStoryChallenges: Refetch called but no story ID available.');
      setData(null);
      setIsLoading(false);
    }
  }, [storyId, fetchData]);

  return { data, isLoading, error, refetch };
}
