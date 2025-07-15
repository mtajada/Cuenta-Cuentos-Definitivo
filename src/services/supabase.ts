// Importa los tipos necesarios
import {
    Challenge,
    ChallengeQuestion,
    ProfileSettings,
    Story,
    StoryChapter,
    StoryCharacter,
} from "../types";

// --- Importa la instancia ÚNICA del cliente Supabase ---
import { supabase } from "../supabaseClient"; // Ajusta esta ruta si es necesario

// --- Listener de Auth (Opcional, solo para logging) ---
// Ya no inicializamos el cliente aquí, solo usamos el importado.
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('Evento Auth en supabase.ts:', event, '- Usuario:', session?.user?.id);
    } else if (event === 'SIGNED_OUT') {
        console.log('Evento Auth en supabase.ts: SIGNED_OUT');
    }
});

// --- Funciones de Perfil ---

export const syncUserProfile = async (
    userId: string,
    // Renombramos el parámetro para claridad y ajustamos tipo
    dataToSync: Partial<ProfileSettings> & { [key: string]: any },
): Promise<{ success: boolean; error?: any }> => {
    try {
        console.log(`[syncUserProfile_DEBUG] Attempting to sync for user ${userId} with data:`, dataToSync);

        // Preparamos los datos para upsert, asegurando que 'id' y 'updated_at' están presentes
        const upsertData = {
            id: userId,             // ID es necesario para upsert
            ...dataToSync,         // Usamos directamente los datos mapeados (ej. child_age, special_need)
            updated_at: new Date(), // Siempre actualizamos la fecha
        };

        // Opcional: Asegurarse de que special_need sea null si es undefined, aunque upsert debería manejarlo
        // Corregido: Usar notación de corchetes para evitar error de linting con snake_case
        if (upsertData['special_need'] === undefined) {
            upsertData['special_need'] = null;
        }

        const { error } = await supabase
            .from("profiles")
            .upsert(upsertData); // <<< Pasamos el objeto correcto a upsert

        if (error) {
            console.error("Error sincronizando perfil (posible RLS):", error);
            throw error; // Re-lanzar para el catch general
        }
        console.log(`[syncUserProfile_DEBUG] Profile synced successfully for user ${userId}`);
        return { success: true };
    } catch (error) {
        console.error("Fallo general en syncUserProfile:", error);
        // Asegurarse de devolver un objeto Error estándar
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { success: false, error: new Error(errorMessage) }; 
    }
};

export const getUserProfile = async (userId: string): Promise<{ success: boolean, profile?: ProfileSettings, error?: any }> => {
    try {
        console.log(`Solicitando perfil para usuario: ${userId}`);
        const { data, error } = await supabase
            .from("profiles")
            .select("*") // Selecciona todas las columnas
            .eq("id", userId)
            .single();

        if (error && error.code === 'PGRST116') {
            console.log(`No se encontró perfil para usuario ${userId}`);
            return { success: false };
        } else if (error) {
            console.error(`Error al obtener perfil para ${userId} (posible RLS):`, error);
            throw error;
        }

        console.log(`Datos de perfil recibidos para ${userId}:`, data);

        if (data) {
            // Mapea todos los campos recuperados
            const profile: ProfileSettings = {
                language: data.language,
                childAge: data.child_age,
                specialNeed: data.special_need,
                stripe_customer_id: data.stripe_customer_id,
                subscription_status: data.subscription_status,
                subscription_id: data.subscription_id,
                plan_id: data.plan_id,
                current_period_end: data.current_period_end,
                voice_credits: data.voice_credits,
                monthly_stories_generated: data.monthly_stories_generated,
                monthly_voice_generations_used: data.monthly_voice_generations_used,
                has_completed_setup: data.has_completed_setup,
            };
            return { success: true, profile: profile };
        }

        console.log(`No se encontró perfil (inesperado) para usuario ${userId}`);
        return { success: false };

    } catch (error) {
        console.error(`Fallo general en getUserProfile para ${userId}:`, error);
        return { success: false, error };
    }
};

// --- Funciones de Personajes ---

export const syncCharacter = async (
    userId: string,
    character: StoryCharacter,
): Promise<{ success: boolean; error?: any }> => {
    try {
        console.log(`[DEBUG] Sincronizando personaje "${character.name}" (ID: ${character.id}) para usuario ${userId}`);
        const { data: existingChar, error: queryError } = await supabase
            .from("characters")
            .select("id, user_id")
            .eq("id", character.id)
            .maybeSingle();

        if (queryError) {
            console.error(`[DEBUG] Error al verificar existencia del personaje:`, queryError);
            throw queryError;
        }

        const characterData = {
            id: character.id,
            user_id: userId,
            name: character.name,
            hobbies: character.hobbies,
            description: character.description,
            profession: character.profession,
            character_type: character.characterType,
            personality: character.personality,
            updated_at: new Date(),
        };

        let result;
        if (existingChar) {
            console.log(`[DEBUG] Personaje ${character.id} existe. Actualizando.`);
            if (existingChar.user_id !== userId) {
                console.error(`[DEBUG] ¡Error de seguridad! Intento de modificar personaje ${character.id} de otro usuario.`);
                return { success: false, error: new Error('No tienes permiso para modificar este personaje') };
            }
            result = await supabase
                .from("characters")
                .update(characterData)
                .eq("id", character.id);
        } else {
            console.log(`[DEBUG] Creando nuevo personaje con ID: ${character.id}`);
            result = await supabase
                .from("characters")
                .insert(characterData);
        }

        const { error } = result;
        if (error) {
            console.error(`[DEBUG] Error en operación upsert de personaje (posible RLS):`, error);
            throw error;
        }

        console.log(`[DEBUG] Personaje "${character.name}" guardado exitosamente.`);
        return { success: true };
    } catch (error) {
        console.error("[DEBUG] Fallo general en syncCharacter:", error);
        return { success: false, error };
    }
};

export const getUserCharacters = async (userId: string): Promise<{ success: boolean; characters?: StoryCharacter[]; error?: any }> => {
    // --- CORREGIDO: Eliminada la consulta ineficiente ---
    try {
        console.log(`[DEBUG] Consultando personajes para usuario ${userId}`);
        const { data, error } = await supabase
            .from("characters")
            .select("*") // Consulta correcta y única
            .eq("user_id", userId);

        if (error) {
            console.error(`[DEBUG] Error en consulta de personajes (posible RLS):`, error);
            throw error;
        }

        console.log(`[DEBUG] Personajes encontrados: ${data?.length || 0}`);
        const characters: StoryCharacter[] = data ? data.map((char) => ({
            id: char.id,
            name: char.name,
            hobbies: char.hobbies || [],
            description: char.description || '',
            profession: char.profession || '',
            characterType: char.character_type || '',
            personality: char.personality || '',
        })) : [];

        return { success: true, characters: characters };
    } catch (error) {
        console.error("Fallo general en getUserCharacters:", error);
        return { success: false, error };
    }
};

export const deleteCharacter = async (characterId: string): Promise<{ success: boolean; error?: any }> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return { success: false, error: new Error('No autenticado') };
        }
        const userId = user.id;

        const { data: characterData, error: queryError } = await supabase
            .from("characters")
            .select("user_id")
            .eq("id", characterId)
            .maybeSingle();

        if (queryError) {
            console.error("Error verificando propiedad:", queryError);
            return { success: false, error: queryError };
        }
        if (!characterData) {
            console.warn(`Personaje ${characterId} no encontrado para eliminar.`);
            return { success: false, error: new Error('Personaje no encontrado') };
        }
        if (characterData.user_id !== userId) {
            console.error(`Seguridad: Usuario ${userId} intentó eliminar personaje ${characterId} de ${characterData.user_id}`);
            return { success: false, error: new Error('Permiso denegado') };
        }

        const { error } = await supabase
            .from("characters")
            .delete()
            .eq("id", characterId);

        if (error) {
            console.error("Error eliminando personaje (RLS?):", error);
            throw error;
        }
        return { success: true };
    } catch (error) {
        console.error("Fallo general en deleteCharacter:", error);
        return { success: false, error };
    }
};

// --- Funciones de Historias ---

export const syncStory = async (userId: string, story: Story): Promise<{ success: boolean; error?: any }> => {
    try {
        console.log(`Sincronizando historia ${story.id} para usuario ${userId}`);
        const storyData = {
            id: story.id,
            user_id: userId,
            title: story.title,
            content: story.content,
            audio_url: story.audioUrl,
            moral: story.options.moral,
            genre: story.options.genre,
            duration: story.options.duration,
            character_id: story.options.characters[0]?.id, // Primary character (first selected)
            additional_details: story.additional_details,
            updated_at: new Date(),
        };
        const { error } = await supabase.from("stories").upsert(storyData);
        if (error) {
            console.error(`Error al sincronizar historia ${story.id} (RLS?):`, error);
            throw error;
        }
        console.log(`Historia ${story.id} sincronizada.`);
        return { success: true };
    } catch (error) {
        console.error("Fallo general en syncStory:", error);
        return { success: false, error };
    }
};

export const getUserStories = async (userId: string): Promise<{ success: boolean; stories?: Story[]; error?: any }> => {
    try {
        console.log(`Buscando historias para usuario ${userId}`);
        const { data, error } = await supabase
            .from("stories")
            .select(`*, characters (*)`)
            .eq("user_id", userId)
            .order('created_at', { ascending: false }); // Ordenar por más reciente

        if (error) {
            console.error("Error obteniendo historias (RLS?):", error);
            throw error;
        }

        const stories: Story[] = data ? data.map((story) => {
            const characterData = story.characters;
            console.log(`[getUserStories_DEBUG] DB raw title for story ${story.id}: "${story.title}"`); // <-- ADD THIS

            return {
                id: story.id,
                title: story.title || "Historia sin título",
                content: story.content,
                audioUrl: story.audio_url,
                options: {
                    moral: story.moral,
                    genre: story.genre,
                    duration: story.duration,
                    character: {
                        id: characterData?.id || 'deleted_character',
                        name: characterData?.name || 'Personaje Eliminado',
                        hobbies: characterData?.hobbies || [],
                        description: characterData?.description || '',
                        profession: characterData?.profession || '',
                        characterType: characterData?.character_type || '',
                        personality: characterData?.personality || '',
                    } as StoryCharacter,
                },
                createdAt: story.created_at,
                additional_details: story.additional_details, // <-- Incluir aquí
            };
        }) : [];

        console.log(`Encontradas ${stories.length} historias`);
        return { success: true, stories: stories };
    } catch (error) {
        console.error("Fallo general en getUserStories:", error);
        return { success: false, error };
    }
};

/**
 * Obtiene el número de capítulos existentes para una historia específica.
 */
export const getChapterCountForStory = async (storyId: string): Promise<{ count: number; error: Error | null }> => {
    try {
        const { count, error } = await supabase
            .from('story_chapters')
            .select('*', { count: 'exact', head: true }) // Solo necesitamos el conteo
            .eq('story_id', storyId);

        if (error) {
            console.error('Error al contar capítulos:', error);
            return { count: 0, error };
        }

        return { count: count ?? 0, error: null }; // Devuelve 0 si count es null

    } catch (error: any) {
        console.error('Error inesperado al contar capítulos:', error);
        return { count: 0, error };
    }
};

// --- Funciones para Capítulos ---

export const syncChapter = async (chapter: StoryChapter, storyId: string): Promise<{ success: boolean; error?: any }> => {
    console.log("🚀 ~ syncChapter ~ chapter:", chapter)
    try {
        const { error } = await supabase
            .from("story_chapters")
            .upsert({
                id: chapter.id,
                story_id: storyId,
                chapter_number: chapter.chapterNumber,
                title: chapter.title,
                content: chapter.content,
                generation_method: chapter.generationMethod,
                custom_input: chapter.customInput,
                updated_at: new Date(),
            });
        if (error) {
            console.error("Error sincronizando capítulo (RLS/FK?):", error);
            throw error;
        }
        return { success: true };
    } catch (error) {
        console.error("Fallo general en syncChapter:", error);
        return { success: false, error };
    }
};

export const getStoryChapters = async (storyId: string): Promise<{ success: boolean; chapters?: StoryChapter[]; error?: any }> => {
    try {
        const { data, error } = await supabase
            .from("story_chapters")
            .select("*")
            .eq("story_id", storyId)
            .order('chapter_number', { ascending: true });

        if (error) {
            console.error("Error obteniendo capítulos (RLS/FK?):", error);
            throw error;
        }
        const chapters: StoryChapter[] = data ? data.map((chapter) => ({
            id: chapter.id,
            chapterNumber: chapter.chapter_number,
            title: chapter.title,
            content: chapter.content,
            createdAt: chapter.created_at,
            generationMethod: chapter.generation_method,
            customInput: chapter.custom_input,
        })) : [];
        return { success: true, chapters: chapters };
    } catch (error) {
        console.error("Fallo general en getStoryChapters:", error);
        return { success: false, error };
    }
};

// --- Funciones para Desafíos ---

export const syncChallenge = async (challenge: Challenge): Promise<{ success: boolean; error?: any }> => {
    try {
        const { data, error: challengeError } = await supabase
            .from("challenges")
            .upsert({
                id: challenge.id,
                story_id: challenge.storyId,
                created_at: challenge.createdAt,
            })
            .select("id")
            .single();

        if (challengeError) {
            console.error("Error en upsert de desafío (RLS/FK?):", challengeError);
            throw challengeError;
        }
        if (!data?.id) throw new Error("No se pudo obtener ID del desafío.");
        const challengeId = data.id;

        // Batch upsert preguntas (más eficiente si hay muchas)
        const questionUpserts = challenge.questions.map(question => ({
            id: question.id,
            challenge_id: challengeId,
            question: question.question,
            options: question.options,
            correct_option_index: question.correctOptionIndex,
            explanation: question.explanation,
            category: question.category,
            target_language: question.targetLanguage,
        }));

        if (questionUpserts.length > 0) {
            const { error: questionsError } = await supabase
                .from("challenge_questions")
                .upsert(questionUpserts);
            if (questionsError) {
                console.error(`Error en upsert masivo de preguntas (RLS/FK?):`, questionsError);
                throw questionsError;
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Fallo general en syncChallenge:", error);
        return { success: false, error };
    }
};


export const getStoryChallenges = async (storyId: string): Promise<{ success: boolean; challenges?: Challenge[]; error?: any }> => {
    try {
        const { data: challengesData, error: challengesError } = await supabase
            .from("challenges")
            .select("*, challenge_questions(*)") // Join con preguntas
            .eq("story_id", storyId);

        if (challengesError) {
            console.error("Error obteniendo desafíos (RLS?):", challengesError);
            throw challengesError;
        }

        const challenges: Challenge[] = challengesData ? challengesData.map(challengeRecord => ({
            id: challengeRecord.id,
            storyId: challengeRecord.story_id,
            createdAt: challengeRecord.created_at,
            questions: (challengeRecord.challenge_questions || []).map((q: any) => ({ // Tipar 'q' si es posible
                id: q.id,
                question: q.question,
                options: q.options,
                correctOptionIndex: q.correct_option_index,
                explanation: q.explanation,
                category: q.category,
                targetLanguage: q.target_language,
            })),
        })) : [];

        return { success: true, challenges };
    } catch (error) {
        console.error("Fallo general en getStoryChallenges:", error);
        return { success: false, error };
    }
};

// --- Funciones para Archivos de Audio ---

export const syncAudioFile = async (
    userId: string,
    storyId: string,
    chapterId: string | number,
    voiceId: string,
    audioUrl: string,
): Promise<{ success: boolean; error?: any }> => {
    try {
        const { error } = await supabase
            .from("audio_files")
            .upsert({
                user_id: userId,
                story_id: storyId,
                chapter_id: chapterId,
                voice_id: voiceId,
                url: audioUrl,
            });
        if (error) {
            console.error("Error sincronizando archivo de audio (RLS/FK?):", error);
            throw error;
        }
        return { success: true };
    } catch (error) {
        console.error("Fallo general en syncAudioFile:", error);
        return { success: false, error };
    }
};

export const getUserAudios = async (userId: string): Promise<{ success: boolean; audios?: any[]; error?: any }> => { // Ajustar tipo 'audios' si tienes uno específico
    try {
        const { data, error } = await supabase
            .from("audio_files")
            .select("*")
            .eq("user_id", userId);

        if (error) {
            console.error("Error obteniendo archivos de audio (RLS?):", error);
            throw error;
        }
        const audios = data || [];
        return { success: true, audios: audios };
    } catch (error) {
        console.error("Fallo general en getUserAudios:", error);
        return { success: false, error };
    }
};

// --- Funciones para Preferencias de Voz ---

export const setCurrentVoice = async (userId: string, voiceId: string): Promise<{ success: boolean; error?: any }> => {
    try {
        // Paso 1: Resetear la voz actual
        await supabase
            .from("user_voices")
            .update({ is_current: false })
            .eq("user_id", userId)
            .eq("is_current", true);

        // Paso 2: Establecer la nueva voz actual
        const { error } = await supabase
            .from("user_voices")
            .upsert({
                user_id: userId,
                voice_id: voiceId,
                is_current: true,
                updated_at: new Date(),
            });
        if (error) {
            console.error("Error en upsert de voz actual (RLS?):", error);
            throw error;
        }
        return { success: true };
    } catch (error) {
        console.error("Fallo general en setCurrentVoice:", error);
        return { success: false, error };
    }
};

export const getCurrentVoice = async (userId: string): Promise<{ success: boolean; voiceId?: string | null; error?: any }> => {
    try {
        const { data, error } = await supabase
            .from("user_voices")
            .select("voice_id")
            .eq("user_id", userId)
            .eq("is_current", true)
            .maybeSingle();

        if (error) {
            console.error("Error obteniendo voz actual (RLS?):", error);
            throw error;
        }
        return { success: true, voiceId: data?.voice_id || null };
    } catch (error) {
        console.error("Fallo general en getCurrentVoice:", error);
        return { success: false, error };
    }
};


// --- Servicio de Cola de Sincronización ---
// (Se mantiene la versión mejorada con re-encolado)
interface SyncQueueItem {
    table: string;
    operation: "insert" | "update" | "delete";
    data: any;
    timestamp: number;
}

class SyncQueueService {
    private static instance: SyncQueueService;
    private queue: SyncQueueItem[] = [];
    private isProcessing = false;
    private readonly STORAGE_KEY = "sync_queue";

    private constructor() {
        this.loadQueue();
        if (typeof window !== "undefined" && !window.hasOwnProperty('_syncQueueListenerAdded')) {
            window.addEventListener("online", () => this.processQueue());
            (window as any)._syncQueueListenerAdded = true;
        }
    }

    static getInstance(): SyncQueueService {
        if (!SyncQueueService.instance) {
            SyncQueueService.instance = new SyncQueueService();
        }
        return SyncQueueService.instance;
    }

    private loadQueue() {
        if (typeof localStorage === 'undefined') return;
        try {
            const savedQueue = localStorage.getItem(this.STORAGE_KEY);
            if (savedQueue) {
                this.queue = JSON.parse(savedQueue);
                console.log(`Cola de sincronización cargada con ${this.queue.length} elementos.`);
            }
        } catch (error) {
            console.error("Error cargando cola de sincronización:", error);
            this.queue = [];
        }
    }

    private saveQueue() {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
        } catch (error) {
            console.error("Error guardando cola de sincronización:", error);
        }
    }

    addToQueue(table: string, operation: "insert" | "update" | "delete", data: any,) {
        console.log(`Añadiendo a cola: ${operation} en ${table}`, data);
        this.queue.push({ table, operation, data, timestamp: Date.now() });
        this.saveQueue();
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) {
            if (this.isProcessing) console.log("Cola ya en proceso.");
            return;
        }
        console.log(`Procesando cola: ${this.queue.length} elementos.`);
        this.isProcessing = true;
        const itemsToProcess = [...this.queue];
        this.queue = [];
        this.saveQueue();
        const failedItems: SyncQueueItem[] = [];

        try {
            for (const item of itemsToProcess) {
                let success = false;
                console.log(`Procesando: ${item.operation} en ${item.table}`); // No loguear item.data por defecto (puede ser grande)
                try {
                    let operationError = null;
                    switch (item.operation) {
                        case "insert":
                        case "update":
                            const { error } = await supabase.from(item.table).upsert(item.data);
                            operationError = error;
                            break;
                        case "delete":
                            if (!item.data?.id) {
                                console.error("Datos para DELETE sin ID:", item);
                                operationError = new Error("Datos para DELETE sin ID");
                                break;
                            }
                            const { error: deleteError } = await supabase.from(item.table).delete().eq("id", item.data.id);
                            operationError = deleteError;
                            break;
                    }
                    if (operationError) {
                        console.error(`Error procesando item [${item.operation} ${item.table}]:`, operationError);
                    } else {
                        console.log(`Item procesado: ${item.operation} ${item.table}`);
                        success = true;
                    }
                } catch (processingError) {
                    console.error(`Error inesperado procesando item:`, processingError);
                }
                if (!success) failedItems.push(item);
            }
        } finally {
            if (failedItems.length > 0) {
                console.warn(`Re-encolando ${failedItems.length} elementos fallidos.`);
                this.queue = [...failedItems, ...this.queue];
                this.saveQueue();
            }
            console.log(`Procesamiento de cola finalizado. Pendientes: ${this.queue.length}`);
            this.isProcessing = false;
        }
    }
    getQueueLength(): number { return this.queue.length; }
}

export const syncQueue = SyncQueueService.getInstance();