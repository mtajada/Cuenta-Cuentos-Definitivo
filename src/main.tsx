import { createRoot } from 'react-dom/client'
import { useEffect } from 'react'
import App from './App.tsx'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext'
import { initSyncService } from './services/syncService'

// Component to handle authentication check on app load
const AppWithAuth = () => {
  const { loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      initSyncService()
    }
  }, [loading])

  return <App />
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <AppWithAuth />
  </AuthProvider>
)
