import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Almacenamiento global del ID de usuario autenticado
let currentAuthUserId: string | null = null;
// Lista de stores que necesitan ser refrescados cuando cambia el usuario
type RefreshFn = () => void;
type StoreSetter<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
type StoreGetter<T> = () => T;
type StoreLogic<T> = (set: StoreSetter<T>, get: StoreGetter<T>) => Partial<T>;

const storesRegistry: Record<string, RefreshFn> = {};

/**
 * Establece el ID del usuario autenticado actualmente
 * Esta función debe ser llamada desde el componente de autenticación
 */
export const setCurrentAuthUser = (userId: string | null) => {
  console.log(`Cambiando usuario autenticado de [${currentAuthUserId}] a [${userId}]`);
  
  if (userId !== currentAuthUserId) {
    // Si cambia el usuario, limpiar stores anteriores
    if (userId) {
      cleanPreviousUserStores(userId);
      // Notificar a todos los stores registrados para que se actualicen
      refreshAllStores();
    }
    currentAuthUserId = userId;
  }
};

/**
 * Limpia los stores que no pertenecen al usuario actual
 */
export const cleanPreviousUserStores = (currentUserId: string) => {
  console.log(`Limpiando stores previos para usuario: ${currentUserId}`);
  
  let cleaned = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('story-app-')) {
      // Si no es una clave del usuario actual y no es la clave global de usuario
      if (!key.includes(`-${currentUserId}-`) && !key.includes('story-app-user')) {
        console.log(`Eliminando store: ${key}`);
        localStorage.removeItem(key);
        i--; // Ajustar el índice
        cleaned++;
      }
    }
  }
  console.log(`Se limpiaron ${cleaned} stores anteriores`);
  
  // Identificar las claves que coinciden con el store de personajes
  const characterKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes('-characters')) {
      characterKeys.push(key);
      try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        console.log(`[DEBUG] Clave ${key}, tiene ${value?.state?.savedCharacters?.length || 0} personajes`);
      } catch (error) {
        console.error(`[DEBUG] Error al analizar clave ${key}:`, error);
      }
    }
  }
  
  console.log(`[DEBUG] Claves de personajes encontradas: ${characterKeys.join(', ')}`);
};

/**
 * Refresca todos los stores registrados para que carguen datos frescos
 */
export const refreshAllStores = () => {
  console.log(`Refrescando ${Object.keys(storesRegistry).length} stores registrados`);
  
  Object.keys(storesRegistry).forEach(storeName => {
    const refreshFn = storesRegistry[storeName];
    if (typeof refreshFn === 'function') {
      console.log(`Refrescando store: ${storeName}`);
      try {
        refreshFn();
      } catch (error) {
        console.error(`Error refrescando store ${storeName}:`, error);
      }
    }
  });
};

/**
 * Registra una función para refrescar un store cuando cambia el usuario
 */
export const registerStoreRefresh = (storeName: string, refreshFn: RefreshFn) => {
  storesRegistry[storeName] = refreshFn;
  console.log(`Store ${storeName} registrado para refresco automático`);
};

/**
 * Crea un store persistente con Zustand que incluye el ID del usuario en el nombre
 * para garantizar que cada usuario tenga sus propios datos
 */
export const createPersistentStore = <T>(
  initialState: Partial<T>,
  storeLogic: StoreLogic<T>,
  storeName: string
) => {
  const fullStoreName = getStoreNameWithUserId(storeName);
  
  // Crear el store
  const useStore = create<T>()(
    persist(
      (set, get) => ({
        ...initialState,
        ...storeLogic(set, get)
      }) as T,
      {
        name: fullStoreName,
      }
    )
  );
  
  return useStore;
};

/**
 * Genera un nombre de store único para cada usuario basado en su ID
 */
const getStoreNameWithUserId = (baseName: string): string => {
  // Si hay un usuario autenticado, usar su ID
  const userId = currentAuthUserId || 'anonymous';
  
  // El store para el usuario tiene que incluir su ID
  const storeName = `story-app-${userId}-${baseName}`;
  console.log(`Creando/accediendo store: ${storeName}`);
  return storeName;
}; 
