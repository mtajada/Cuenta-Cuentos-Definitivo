import React from 'react';
import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext';
import { useUserStore } from './store/user/userStore'
import { initSyncService } from './services/syncService'

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
  <React.StrictMode>
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  </React.StrictMode>
);
