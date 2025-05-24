import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient'; // Adjusted path
import { getStoryChapters as fetchStoryChaptersService } from '../../../services/supabase'; // Adjusted path, function to be adapted
import { StoryChapter } from '../../../types'; // Adjusted path
// import { useAuth } from '../../../contexts/AuthContext'; // Not directly using useAuth here, storyId is the primary key

export function useStoryChapters(storyId: string | null | undefined) {
  // const { user } = useAuth(); // If needed for service call, but service should handle auth via RLS or passed userId
  // const userId = user?.id;

  const [data, setData] = useState<StoryChapter[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  const fetchData = useCallback(async (currentStoryId: string) => {
    console.log(`useStoryChapters: Fetching chapters for story ${currentStoryId}`);
    setIsLoading(true);
    setError(null);
    try {
      // The service function 'fetchStoryChaptersService' will be adapted later
      // to accept (client, storyId, potentially userId) and return { chapters?: StoryChapter[]; error?: any; success: boolean }
      // For now, assuming it takes supabase and storyId.
      const { chapters: chaptersData, error: fetchError, success } = await fetchStoryChaptersService(supabase, currentStoryId);
      
      if (fetchError || !success) {
        const err = fetchError ? (fetchError.message || fetchError) : new Error(`Failed to fetch chapters for story ${currentStoryId}`);
        console.error(`useStoryChapters: Error fetching chapters for story ${currentStoryId} - service indicated failure or error:`, err);
        throw err;
      }
      
      setData(chaptersData || []);
      console.log(`useStoryChapters: Chapters for story ${currentStoryId} fetched successfully`, chaptersData);
    } catch (err: any) {
      console.error(`useStoryChapters: Catch block error while fetching chapters for story ${currentStoryId}:`, err);
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
      setIsLoading(false); // Set to false as no fetching if no storyId
      console.log('useStoryChapters: No story ID provided, clearing data.');
    }
  }, [storyId, fetchData]);

  const refetch = useCallback(() => {
    if (storyId) {
      console.log('useStoryChapters: Refetching chapters for story', storyId);
      fetchData(storyId);
    } else {
      console.log('useStoryChapters: Refetch called but no story ID available.');
      setData(null);
      setIsLoading(false);
    }
  }, [storyId, fetchData]);

  return { data, isLoading, error, refetch };
}
