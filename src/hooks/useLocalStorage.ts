import { useState, useEffect, useCallback } from 'react';

type SetValue<T> = T | ((val: T) => T);

// Hook para manejar localStorage con TypeScript y React
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: SetValue<T>) => void, () => void] {
  // State para almacenar el valor
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error leyendo localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Función para actualizar el valor
  const setValue = useCallback((value: SetValue<T>) => {
    try {
      // Permitir funciones como parámetro para mantener compatibilidad con useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      setStoredValue(valueToStore);
      
      // Guardar en localStorage
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        
        // Dispatchar evento personalizado para sincronizar entre tabs
        window.dispatchEvent(
          new CustomEvent('localStorage-change', {
            detail: { key, value: valueToStore }
          })
        );
      }
    } catch (error) {
      console.warn(`Error guardando en localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  // Función para eliminar el valor
  const removeValue = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
        window.dispatchEvent(
          new CustomEvent('localStorage-change', {
            detail: { key, value: null }
          })
        );
      }
    } catch (error) {
      console.warn(`Error eliminando localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listener para cambios desde otras tabs
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: CustomEvent) => {
      if (e.detail.key === key) {
        setStoredValue(e.detail.value ?? initialValue);
      }
    };

    // Listener para cambios nativos de localStorage (otras tabs)
    const handleNativeStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : initialValue;
          setStoredValue(newValue);
        } catch (error) {
          console.warn(`Error parseando valor de localStorage para key "${key}":`, error);
          setStoredValue(initialValue);
        }
      }
    };

    window.addEventListener('localStorage-change', handleStorageChange as EventListener);
    window.addEventListener('storage', handleNativeStorageChange);

    return () => {
      window.removeEventListener('localStorage-change', handleStorageChange as EventListener);
      window.removeEventListener('storage', handleNativeStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

// Hook especializado para cache de datos temporales
export function useSessionCache<T>(key: string, initialValue: T) {
  return useLocalStorage(`session_${key}`, initialValue);
}

// Hook para datos persistentes entre sesiones
export function usePersistentData<T>(key: string, initialValue: T) {
  return useLocalStorage(`persistent_${key}`, initialValue);
}