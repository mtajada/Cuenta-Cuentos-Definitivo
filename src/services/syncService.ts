import { useUserStore } from "../store/user/userStore";
// REMOVED: No necesitas importar characterStore, storiesStore, audioStore aquí
// import { useCharacterStore } from "../store/character/characterStore";
// import { useStoriesStore } from "../store/stories/storiesStore";
// import { useAudioStore } from "../store/stories/audio/audioStore";
// import { getCurrentUser } from "../supabaseAuth"; // Ya no se usa aquí directamente
import { supabase } from "../supabaseClient"; // Importa el cliente supabase si no lo tienes ya

declare global {
    interface Window {
        _syncListenersInitialized?: boolean;
    }
}

/**
 * Servicio para INICIAR la sincronización de datos del usuario con Supabase
 * delegando la carga real al userStore.
 */
export const syncUserData = async (): Promise<boolean> => {
    console.log("Intentando iniciar sincronización de datos...");
    try {
        // 1. Verificar conexión (ligero y útil)
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            console.log("Offline. Sincronización pospuesta.");
            return false;
        }

        // 2. Verificar si hay una sesión activa usando el cliente Supabase
        // Esto es más directo que llamar a getCurrentUser de supabaseAuth
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error("Error al obtener la sesión:", sessionError.message);
            // Considerar si llamar a checkAuth aquí para limpiar el estado local si falla
            // await useUserStore.getState().checkAuth();
            return false;
        }

        if (!session || !session.user) {
            console.log("No hay sesión de usuario activa, no se inicia sincronización.");
            // Si no hay sesión, checkAuth se encargará de poner el estado de usuario a null
            // No necesitamos hacer nada más aquí, la UI reaccionará al estado nulo del userStore
            // Opcionalmente, puedes llamar a checkAuth para asegurar limpieza:
            // await useUserStore.getState().checkAuth();
            return false;
        }

        const userId = session.user.id;
        console.log(`Sesión activa detectada para usuario ${userId}. Iniciando proceso checkAuth/sync.`);

        // 3. Disparar el proceso de carga centralizado en userStore
        // checkAuth() AHORA es responsable de:
        //    a) Confirmar la sesión (ya lo hicimos, pero checkAuth lo reconfirma)
        //    b) Llamar a getUserProfile para obtener datos de perfil (incluyendo Stripe/límites)
        //    c) Actualizar userStore.user y userStore.profileSettings
        //    d) Llamar a syncAllUserData(userId) DENTRO de userStore
        //    e) syncAllUserData llamará a los load...FromSupabase de los otros stores.
        const checkAuthSuccessful = await useUserStore.getState().checkAuth();

        if (checkAuthSuccessful) {
            console.log("Proceso checkAuth completado exitosamente. La carga de datos debería estar en curso o finalizada por userStore.");
            return true;
        } else {
            // checkAuth devuelve false si no hay usuario o si hubo un error interno en checkAuth.
            console.warn("checkAuth() devolvió false. La sincronización podría no haberse completado.");
            return false;
        }

    } catch (error) {
        // Captura errores generales que podrían ocurrir en este flujo
        console.error("Error inesperado en syncUserData:", error);
        return false;
    }
};

/**
 * Escuchar cambios en la conectividad para sincronizar
 * cuando el usuario vuelve a estar online.
 */
export const initSyncListeners = () => {
    // Solo ejecutar en el cliente
    if (typeof window !== "undefined" && !window._syncListenersInitialized) {
        console.log("Inicializando listeners de conectividad...");
        // Sincronizar cuando vuelve la conexión
        window.addEventListener("online", () => {
            console.log("Evento 'online' detectado, intentando sincronizar datos...");
            syncUserData(); // Llama a la función refactorizada
        });
        // Sincronizar cuando cambia el estado de visibilidad (útil si la pestaña estuvo inactiva)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log("Pestaña visible, intentando sincronizar datos...");
                syncUserData();
            }
        });
        // Añadir un flag para evitar duplicar listeners si esta función se llama más de una vez
        window._syncListenersInitialized = true;
    } else if (typeof window !== "undefined") {
        console.log("Listeners de conectividad ya inicializados.");
    }
};

/**
 * Inicializar el servicio de sincronización.
 * Esta función debe llamarse UNA SOLA VEZ al inicio de la aplicación.
 */
export const initSyncService = () => {
    // Iniciar listeners de conexión y visibilidad
    initSyncListeners();

    console.log("Servicio de sincronización inicializado.");

    // Intentar sincronización inicial inmediatamente si hay conexión
    // syncUserData ya verifica la conexión internamente.
    console.log("Intentando sincronización inicial...");
    syncUserData();

};
