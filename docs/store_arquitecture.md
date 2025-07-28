# Store Architecture and Data Flow Guide (Zustand + Supabase)

**Document Version:** 1.0
**Date:** 2023-10-27 (Update with actual date)
**Target Audience:** Code Agent (e.g., Windsurf), Developers

## 1. Overview

This document details the state management architecture for the AI Storyteller web application, primarily located within the `src/store` directory. The application utilizes **Zustand** as its state management library, employing a modular approach where different aspects of the application state are handled by separate "stores."

**Key Goals of this Architecture:**

*   **Centralized State:** Provide a single source of truth for various application states.
*   **Modularity:** Separate concerns into logical units (user, characters, stories, etc.) for maintainability.
*   **Reactivity:** Enable UI components to react automatically to state changes.
*   **Persistence:** Persist user-specific state across browser sessions using `localStorage`.
*   **Supabase Integration:** Manage the flow of data between the frontend state and the Supabase backend (database and authentication).
*   **Multi-User Support:** Isolate the persisted state for different authenticated users.

## 2. Core Concepts & Mechanisms

Several core mechanisms underpin how the stores function:

### 2.1. Persistent Store Creation (`@store/core/createStore.ts`)

*   **`createPersistentStore<T>(initialState, storeLogic, storeName)`:** A custom wrapper around Zustand's `create` and `persist` middleware.
*   **User-Specific Persistence:**
    *   It automatically generates a unique `localStorage` key for each store *and* each authenticated user: `` `story-app-${userId}-${storeName}` `` (e.g., `story-app-user123-characters`). `userId` is 'anonymous' if no user is logged in.
    *   This ensures that data from different users does not mix in `localStorage`.
*   **`setCurrentAuthUser(userId: string | null)`:** **Crucial function.** Called by `@store/user/userStore.ts` during login/logout/auth check. It updates a global tracker for the current user ID, which `createPersistentStore` uses to generate the correct storage key.
*   **`cleanPreviousUserStores(currentUserId: string)`:** Called when the user changes (via `setCurrentAuthUser`). It iterates through `localStorage` and removes keys associated with *previous* users (keys matching `story-app-...` but *not* containing the `currentUserId` and not being the generic `story-app-user` key).
*   **`registerStoreRefresh(storeName: string, refreshFn: Function)` & `refreshAllStores()`:** A mechanism allowing stores to register a function (typically their `load...FromSupabase` method) that gets called automatically by `refreshAllStores` (triggered via `setCurrentAuthUser` on user change) to reload data relevant to the *new* user.

### 2.2. Data Loading & Synchronization Flow

The loading of user-specific data from Supabase upon login or app initialization follows a specific, centralized pattern orchestrated by `@store/user/userStore.ts`:

1.  **Initiation:** Triggered by:
    *   App load (`@main.ts` -> `@services/syncService.ts` -> `useUserStore.checkAuth()`).
    *   Explicit Login (`Login Page` -> `supabaseAuth.login` -> `useUserStore.loginUser()`).
    *   Coming back online (`online` event -> `@services/syncService.ts` -> `useUserStore.checkAuth()`).
2.  **`userStore.checkAuth()` / `userStore.loginUser()`:**
    *   Verifies authentication state with Supabase Auth (`supabase.auth.getSession`, `supabase.auth.getUser`).
    *   If authenticated, calls `setCurrentAuthUser(userId)` to set the global user ID.
    *   Calls `@services/supabase.ts -> getUserProfile(userId)` to fetch the user's *complete* profile data (including settings, subscription status, limits, credits).
    *   Updates its *own* state (`user` and `profileSettings`).
    *   **Crucially, calls the internal `syncAllUserData(userId)` function.**
3.  **`userStore.syncAllUserData(userId)`:**
    *   This function acts as the **central orchestrator** for loading data into *other* stores.
    *   It iterates through a predefined list (`otherStores`) of stores and their respective data-loading methods (e.g., `useCharacterStore.loadCharactersFromSupabase`, `useStoriesStore.loadStoriesFromSupabase`, `useAudioStore.loadAudioFromSupabase`).
    *   It calls these methods sequentially, passing the `userId`.
4.  **Individual Store `load...FromSupabase(userId)` Methods:**
    *   Each store's loading method (e.g., `@store/character/characterStore.ts -> loadCharactersFromSupabase`) uses the provided `userId` to call the relevant data-fetching function in `@services/supabase.ts` (e.g., `getUserCharacters`).
    *   **Important:** These methods should **first clear** the relevant part of their local state (e.g., `set({ savedCharacters: [] })`) before fetching and setting the fresh data from Supabase to prevent merging old/stale data.
    *   They update their own state upon successful data retrieval.

### 2.3. Offline Queue (`@services/supabase.ts -> syncQueue`)

*   **Purpose:** To handle situations where the application is offline or a direct Supabase operation fails temporarily.
*   **Mechanism:**
    *   When a direct Supabase write operation (e.g., `syncCharacter`, `syncUserProfile`) fails within its `try...catch` block, the operation details (table, operation type, data) are added to the `syncQueue` using `syncQueue.addToQueue(...)`.
    *   The `SyncQueueService` class persists this queue in `localStorage`.
    *   An `online` event listener triggers `syncQueue.processQueue()`.
    *   `processQueue()` attempts to execute the queued operations (using `upsert` for resilience) against Supabase. Successful operations are removed from the queue; failed ones are re-queued.
*   **Consideration:** Requires careful handling of data format, especially ensuring `id` is present for `delete` operations.

## 3. Store Breakdown

### 3.1. `@store/user/userStore.ts`

*   **Purpose:** Manages user authentication state, user profile settings (including subscription/limit data), and orchestrates the initial data loading for other stores.
*   **Key State:**
    *   `user: User | null`: Basic user info (id, email).
    *   `profileSettings: ProfileSettings | null`: Complete profile data fetched from the `profiles` table (language, age, need, subscription status, limits, credits, etc.). **Crucial for app logic.**
        *   Includes fields like `subscription_status`, `monthly_stories_generated`, `monthly_voice_generations_used`, `voice_credits`, `current_period_end`.
        *   Includes `has_completed_setup: boolean`: A flag indicating if the user has gone through the initial profile configuration (`ProfileConfigPage`) at least once. This flag is crucial for redirection logic.
*   **Key Selectors (Computed State):**
    *   `isPremium()`: Returns `true` if `subscription_status` indicates an active premium plan ('premium_monthly', 'premium_yearly', 'trialing').
    *   `getRemainingMonthlyStories()`: Calculates remaining stories for free users based on `monthly_stories_generated`.
    *   `getRemainingMonthlyVoiceGenerations()`: Returns the number of *included* monthly voice generations remaining for premium users (e.g., `10 - monthly_voice_generations_used`). Returns 0 for non-premium users.
    *   `getAvailableVoiceCredits()`: Returns the number of *purchased* `voice_credits`.
    *   `canGenerateStory()`: Checks if the user (free or premium) has available story generations (monthly limit or purchased credits, though story credits are not fully implemented yet).
    *   `canGenerateVoice()`: Determines if the user can generate voice based on subscription status and voice credits.
        * **Premium users (`active` or `trialing`):** Allowed if they have remaining monthly voice generations (quota) OR purchased voice credits.
        * **Non-premium users (`free`, `canceled`, etc.):** Allowed only if they have purchased voice credits.
    *   `hasCompletedProfile()`: A selector returning `true` if `profileSettings` exists and `profileSettings.has_completed_setup` is true. Used by components like `Home` and `AuthGuard` to check if the user needs to be sent to profile configuration.
*   **Important Distinction: Monthly Quota vs. Purchased Credits:**
    It's crucial to understand the difference in how voice generation allowances work:
    *   **Monthly Voice Generations (Premium):** Represented by tracking `monthly_voice_generations_used` against a fixed limit (e.g., 10). This is a *quota* that **resets to 0** at the start of each subscription period (handled by the Stripe webhook). This effectively makes the full quota available again each month. Unused generations from one month **do not roll over** to the next.
    *   **Purchased Voice Credits (`voice_credits`):** Represent a *balance* of credits bought separately. These credits **persist** across subscription periods and **do not reset** monthly. They are only consumed when used (either by free users or by premium users who have exhausted their monthly quota). This balance accumulates if more credits are purchased.

*   **Key Actions:**
    *   `checkAuth()`: Verifies auth, loads profile, triggers `syncAllUserData`. **Central function.** Determines initial redirect path (`/home` or `/profile-config`) based on `profileSettings.has_completed_setup`.
    *   `loginUser(user)`: Sets user state, loads profile, triggers `syncAllUserData`.
    *   `logoutUser()`: Processes sync queue, signs out via `@services/supabaseAuth.logout`, clears local state, calls `setCurrentAuthUser(null)`.
    *   `setProfileSettings(settings)`: 
        1. Recibe un objeto `settings` con las propiedades del perfil a actualizar (usando nombres en camelCase, ej. `childAge`).
        2. **Actualiza inmediatamente el estado local (`profileSettings`)** fusionando los nuevos `settings` para que la UI refleje los cambios al instante.
        3. **Mapea las claves del objeto `settings`** de camelCase (TypeScript) a snake_case (Supabase DB) usando un `keyMap` interno (ej., `childAge` -> `child_age`, `specialNeed` -> `special_need`). Solo se incluyen en el mapeo las propiedades presentes en el `settings` recibido.
        4. Construye un objeto `syncData` que contiene únicamente las propiedades mapeadas a snake_case con sus valores.
        5. Llama a `@services/supabase.syncUserProfile` pasándole el `userId` y el objeto `syncData` (con claves snake_case) para persistir los cambios en la base de datos.
        6. Utiliza `@services/syncQueue` como fallback si la sincronización directa falla.
        7. **Nota:** Cuando se llama desde `ProfileConfigPage` por primera vez, el objeto `settings` también incluye explícitamente `has_completed_setup: true` para marcar el perfil como configurado.
*   **Supabase Interaction:** Calls `getCurrentUser`, `logout`, `getUserProfile`, `syncUserProfile`, `syncQueue`.
*   **Notes:** Contains the vital `syncAllUserData` orchestrator function. Ensure all necessary stores are listed in its `otherStores` array.

### 3.2. `@store/character/characterStore.ts`

*   **Purpose:** Manages user-created characters.
*   **Key State:**
    *   `currentCharacter: StoryCharacter | null`: The character currently being edited or selected.
    *   `savedCharacters: StoryCharacter[]`: List of all characters saved by the user.
*   **Key Actions:**
    *   `updateCharacter(updates)`: Modifies `currentCharacter`.
    *   `resetCharacter()`: Clears `currentCharacter` for creating a new one.
    *   `saveCurrentCharacter()`: Adds/updates `currentCharacter` in `savedCharacters`, calls `@services/supabase.syncCharacter`, uses `syncQueue` on failure. Handles local duplicate name check.
    *   `selectCharacter(characterId)`: Sets `currentCharacter` from `savedCharacters`.
    *   `deleteCharacter(characterId)`: Removes character locally, calls `@services/supabase.deleteCharacter`, uses `syncQueue` on failure.
    *   `loadCharactersFromSupabase(userId)`: Clears `savedCharacters`, fetches via `@services/supabase.getUserCharacters`, updates state. Called by `syncAllUserData`.
*   **Supabase Interaction:** Calls `syncCharacter`, `getUserCharacters`, `deleteCharacter`, `syncQueue`.
*   **Notes:** The previous `setTimeout` for initial load was removed; relies solely on `syncAllUserData`.

### 3.3. `@store/stories/storiesStore.ts`

*   **Purpose:** Manages the list of generated stories (metadata and initial content).
*   **Key State:**
    *   `generatedStories: Story[]`: List of stories created by the user.
    *   `isGeneratingStory: boolean`: Flag for UI loading state during story generation.
*   **Key Actions:**
    *   `addGeneratedStory(story)`: Adds a new story locally, calls `@services/supabase.syncStory`, uses `syncQueue` on failure.
        *   **Note:** After this action is successfully called by `@store/stories/storyGenerator.ts`, the generator proceeds to create and save the initial chapter (Chapter 1) using `chaptersStore.addChapter`.
    *   `getStoryById(id)`: Retrieves a specific story from the local state.
    *   `loadStoriesFromSupabase(userId)`: Clears `generatedStories`, fetches via `@services/supabase.getUserStories`, updates state. Called by `syncAllUserData`.
*   **Supabase Interaction:** Calls `syncStory`, `getUserStories`, `syncQueue`.

### 3.4. `@store/storyOptions/storyOptionsStore.ts`

*   **Purpose:** Manages the temporary options selected by the user during the story creation flow *before* the story is generated.
*   **Key State:**
    *   `currentStoryOptions: Partial<StoryOptions>`: Holds selected duration, genre, moral, character.
    *   `additionalDetails: string | null | undefined`: Holds optional free-text details or instructions provided by the user to further customize the story generation.
*   **Key Actions:**
    *   `updateStoryOptions(options)`: Updates multiple options at once.
    *   `resetStoryOptions()`: Clears all selected options.
    *   `setDuration(duration)`: Sets the story duration.
    *   `setMoral(moral)`: Sets the story moral.
    *   `setGenre(genre)`: Sets the story genre.
    *   `setAdditionalDetails(details)`: Sets the optional additional details provided by the user. This is read by `storyGenerator.ts` before calling the generation service.
*   **Persistence:** This store is **not persistent** as the options are temporary for the current creation flow.

### 3.5. `@store/stories/chapters/chaptersStore.ts`

*   **Purpose:** Manages the individual chapters associated with each story.
*   **Key State:**
    *   `storyChapters: StoryWithChapters[]`: An array where each element represents a story and contains an array of its `chapters`. (Note: This duplicates some story metadata; consider if just storing chapters grouped by `storyId` is sufficient).
*   **Key Actions:**
    *   `addChapter(storyId, chapter)`: Adds a new chapter to the appropriate story in `storyChapters`, calls `@services/supabase.syncChapter`, uses `syncQueue` on failure.
        *   **Important State Update Logic:** To prevent inconsistencies (especially for free user limit checks), the local state (`storyChapters`) is **only updated *after* the `syncChapter` call successfully completes**.
        *   **Note:** This action is called both by `@store/stories/storyGenerator.ts` (for the initial Chapter 1, using the story's title/content) and by `@pages/StoryContinuation.tsx` (for subsequent chapters). The logic for determining the correct `chapterNumber` (either `1` or based on `getChapterCountForStory`) resides in the calling code *before* this action is invoked.
    *   `getChaptersByStoryId(storyId)`: Retrieves chapters for a specific story.
    *   `loadChaptersFromSupabase(storyId)`: Fetches chapters for a *specific story* via `@services/supabase.getStoryChapters`. This is typically called on demand when viewing a story, *not* by `syncAllUserData` initially.
*   **Supabase Interaction:** Calls `syncChapter`, `getStoryChapters`, `syncQueue`.

### 3.6. `@store/stories/audio/audioStore.ts`

*   **Purpose:** Manages generated audio files, generation status, and user voice preference.
*   **Key State:**
    *   `audioCache: { [key: string]: { url: string; timestamp: string } }`: Cache of generated audio URLs.
    *   `generationStatus: { [key: string]: { status: string; progress: number } }`: Tracks audio generation progress.
    *   `currentVoice: string | null`: The ID of the user's preferred voice.
*   **Key Actions:**
    *   `addAudioToCache(...)`: Adds audio URL locally, calls `@services/supabase.syncAudioFile`, uses `syncQueue` on failure.
    *   `setCurrentVoice(voiceId)`: Updates state, calls `@services/supabase.setCurrentVoice`.
    *   `loadAudioFromSupabase(userId)`: Fetches *existing* generated audio records and the user's current voice preference via `@services/supabase.getUserAudios` and `@services/supabase.getCurrentVoice`. Called by `syncAllUserData`.
*   **Supabase Interaction:** Calls `syncAudioFile`, `getUserAudios`, `setCurrentVoice`, `getCurrentVoice`, `syncQueue`.

### 3.7. `@store/stories/challenges/challengesStore.ts`

*   **Purpose:** Manages challenges and questions associated with stories.
*   **Key State:**
    *   `challenges: Challenge[]`: List of all challenges across stories.
*   **Key Actions:**
    *   `addChallenge(challenge)`: Adds challenge locally, calls `@services/supabase.syncChallenge` (which handles challenge and questions), uses `syncQueue` on failure.
    *   `getChallengesByStoryId(storyId)`: Filters challenges for a specific story.
    *   `loadChallengesFromSupabase(storyId)`: Fetches challenges for a *specific story* via `@services/supabase.getStoryChallenges`. Called on demand.
*   **Supabase Interaction:** Calls `syncChallenge`, `getStoryChallenges`, `syncQueue`.

## 4. Supabase Interaction Layer

*   **`@services/supabaseClient.ts`:** **Single source of truth.** Initializes and exports the `supabase` client instance. All other files needing the client *must* import it from here.
*   **`@services/supabaseAuth.ts`:** Handles **authentication** operations ONLY (`signUp`, `login`, `logout`, `signInWithGoogle`, `getCurrentUser`, `requestPasswordReset`). It imports and uses the client from `@supabaseClient.ts`. It *does not* handle profile data or manual state tracking anymore.
*   **`@services/supabase.ts`:** Handles **database operations** ONLY (CRUD for profiles, characters, stories, chapters, audio, challenges, voices). It imports and uses the client from `@supabaseClient.ts`. Relies heavily on Supabase RLS for security and data access control.
*   **Reliance on RLS:** Security and data access rules (e.g., "user can only see their own stories", "user can only insert profile if ID matches auth ID") are primarily enforced by **Row Level Security (RLS) policies** defined directly in the Supabase database, *not* by client-side checks (which were removed).

## 5. Context within the Application

*   **Initialization (`@main.ts`):** The entry point initializes the core app (`AppWithAuth`). `AppWithAuth` uses a `useEffect` hook to call `useUserStore.checkAuth()` on mount. After `checkAuth` completes, it calls `@services/syncService.initSyncService()`.
*   **Sync Service (`@services/syncService.ts`):**
    *   `initSyncService`: Called once by `main.ts`. Sets up listeners. Tries an initial sync.
    *   `initSyncListeners`: Listens for `online` and `visibilitychange` events.
    *   `syncUserData`: **Initiator function.** Called on initial load (if online) and by listeners. It verifies connection/session and then triggers the main loading flow by calling `useUserStore.checkAuth()`. **It no longer loads data directly.**
*   **UI Components (`@components/`, `@pages/`):**
    *   Interact with the state using Zustand hooks (e.g., `const { user, profileSettings } = useUserStore();`, `const { savedCharacters, saveCurrentCharacter } = useCharacterStore();`).
    *   Subscribe to state changes and re-render automatically.
    *   Call action functions from the stores (e.g., `saveCurrentCharacter()`, `setProfileSettings(...)`, `addGeneratedStory(...)`) to modify state and trigger backend synchronization.
    *   Use selectors/state data (e.g., `profileSettings.subscription_status`, `profileSettings.voice_credits`) for **Feature Gating**: enabling/disabling buttons, showing/hiding options, displaying limits based on the user's plan.

## 6. Common Issues & Pitfalls Encountered/Resolved

*   **RLS Policies:**
    *   **Missing `INSERT` Policy:** Forgetting to define an `INSERT` policy (e.g., for `profiles`) prevents record creation even if the user is authenticated. Solution: Add `CREATE POLICY ... FOR INSERT ... WITH CHECK (auth.uid() = id);`.
    *   **Incorrect Conditions:** Ensure `USING` (for SELECT/UPDATE/DELETE) and `WITH CHECK` (for INSERT/UPDATE) conditions correctly use `auth.uid()` and match the appropriate columns (`id` or `user_id`).
*   **Type Mismatches:**
    *   **`ProfileSettings`:** The type definition in `@types.ts` *must* accurately reflect *all* columns fetched from the `profiles` table by `getUserProfile`, including Stripe/limit fields. Failure leads to TS errors and missing data in the store.
    *   **DB Column Names:** Trying to insert/update a column name (e.g., `age_range`) in Supabase functions (`syncUserProfile`, `syncQueue.addToQueue`) or SQL Functions (`HandleNewUser`) that doesn't exist in the actual DB table causes runtime errors. Solution: Ensure code uses exact DB column names.
*   **Redundant Data Loading:**
    *   Avoid calling individual `load...FromSupabase` methods directly after `checkAuth` if `syncAllUserData` already handles it (e.g., removed in `syncService.ts`).
    *   Avoid using `setTimeout` for initial data loading in stores (e.g., removed in `characterStore.ts`). Rely on the `checkAuth` -> `syncAllUserData` flow.
*   **Supabase Client Initialization:**
    *   Having multiple `createClient` calls leads to confusion and potential errors. Solution: Centralize client creation in `@supabaseClient.ts` and import it everywhere else. Ensure all `import { supabase }` statements point to this single file.
*   **Timing Issues:**
    *   **Post-`signUp` Profile Creation:** Calling profile creation (`syncUserProfile`) *immediately* after `signUp` might fail due to RLS not recognizing the new `auth.uid()` yet. Solution: Integrate profile creation into the standard `checkAuth` / `loginUser` flow, which ensures the session is fully established, or add a small delay/retry if absolutely necessary.
*   **Forgetting Store Orchestration:**
    *   When adding a new store that needs initial data loading, remember to add it to the `otherStores` array within the `syncAllUserData` function in `@userStore.ts`.
*   **Offline Queue (`syncQueue`):**
    *   Ensure data passed to `addToQueue` for `delete` operations contains the necessary `id`.
    *   Stale/incorrect items stuck in `localStorage` can cause repeated errors. Solution: Clear the `sync_queue` key in `localStorage` during debugging if necessary.
*   **SQL Function Security:**
    *   Functions modifying sensitive data or called from untrusted contexts (like webhooks) should generally use `SECURITY DEFINER` (e.g., `increment_voice_credits`). Ensure appropriate `GRANT EXECUTE` permissions are set for the calling role (e.g., `service_role`). Trigger functions often use `INVOKER` or `DEFINER` depending on needs (`handle_new_user` needs `DEFINER`).

## 7. Conclusion

This modular Zustand architecture, coupled with a well-defined data synchronization flow orchestrated by `userStore` and reliant on Supabase RLS, provides a robust foundation for the application. Maintaining consistency in Supabase client usage, type definitions, and the central data loading pattern is key to stability. Understanding the interaction between frontend stores, the Supabase service layer, and RLS policies is crucial for debugging and future development. Remember to manage SQL functions via Supabase Migrations for proper version control.

## 8. Race Condition Fixes: Authentication and Story Loading

**Authentication Race Condition**

- Updated `checkAuth` signature to return `Promise<User | null>` instead of `Promise<boolean>`.
- Refactored `AuthGuard.tsx` to use an internal `authStatus` (`'pending' | 'authenticated' | 'unauthenticated'`), awaiting `checkAuth()` result before rendering or redirecting.
- Eliminated separate `authChecked` state and reliance on store `user` for decision-making.

**Story Loading Race Condition**

- Added `isLoadingStories: boolean` to `StoriesState` and initialized it in `storiesStore.ts`.
- In `storiesStore.ts`, `loadStoriesFromSupabase` sets `isLoadingStories` to `true` at start and resets it to `false` in `finally`.
- Updated `StoryViewer.tsx` to depend on `isLoadingStories` in its main `useEffect`, exiting early if `true`, and rendering a loading spinner until stories are loaded. Navigation to `/not-found` only occurs if the story remains `undefined` after loading.

## 9. Flujo de Parámetros Contextuales en la Generación de Opciones de Continuación

### 3.2. `@store/stories/storyGenerator.ts`

*   **Propósito:** Orquesta la generación de historias y la continuación de las mismas, gestionando tanto la creación inicial como la obtención de opciones de continuación adaptadas al usuario.
*   **Estado Clave:**
    *   `currentStory: Story | null`: Historia activa en el flujo.
    *   `storyChapters: StoryChapter[]`: Capítulos generados hasta el momento.
    *   `continuationOptions: Option[]`: Opciones generadas para continuar la historia, adaptadas al contexto del usuario.
*   **Acciones Clave:**
    *   `generateOptions()`: Llama a `StoryContinuationService.generateContinuationOptions`, pasando además de la historia y capítulos, los parámetros contextuales:
        - `childAge`: Edad del niño/a (desde `profileSettings`).
        - `specialNeed`: Necesidad especial del usuario (desde `profileSettings`).
        - `language`: Idioma preferido del usuario (desde `profileSettings` o historia).
    *   El store se encarga de obtener estos valores desde `userStore.profileSettings` y asegurarse de que se pasan correctamente al servicio y a la Edge Function.
*   **Flujo de Datos:**
    1. El usuario inicia la generación de opciones de continuación desde la UI.
    2. El store recupera los valores de contexto del perfil del usuario.
    3. Se invoca el método del servicio, que a su vez llama a la Edge Function con el prompt contextualizado.
    4. Las opciones generadas se almacenan en el estado y se muestran en la UI.
*   **Impacto:**
    - Esto garantiza que las opciones de historia sean relevantes para la edad, necesidades y preferencias lingüísticas del usuario final, mejorando la personalización y adecuación del contenido.