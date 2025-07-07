import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App.tsx'
import './index.css'
import { useUserStore } from './store/user/userStore'
import { initSyncService } from './services/syncService'
import { queryClient } from './lib/queryClient'

// Importar tests de fase 1 en desarrollo
if (import.meta.env.DEV) {
  import('./test/testFase1').then(({ runPhase1Tests }) => {
    console.log('🧪 Tests de Fase 1 disponibles. Ejecuta testPhase1() en la consola.');
    // Auto-ejecutar tests en desarrollo
    setTimeout(runPhase1Tests, 1000);
  });
}

// Component to handle authentication check on app load
const AppWithAuth = () => {
  const { checkAuth } = useUserStore()

  useEffect(() => {
    // Check authentication status when app loads
    const initAuth = async () => {
      await checkAuth()
      // Inicializar el servicio de sincronización después de verificar autenticación
      initSyncService()
    }
    
    initAuth()
  }, [checkAuth])

  return <App />
}

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AppWithAuth />
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
)
