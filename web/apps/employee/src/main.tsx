import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouter, AuthProvider } from '@ep/shared'
import { App } from './App'
import { api } from './lib/api'
import { biometric } from './lib/biometric'
import './styles.css'

// A remembered session with Face ID enabled must be unlocked before it is restored.
const shouldLock = () => biometric.isEnrolled()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter>
      <AuthProvider api={api} shouldLock={shouldLock}>
        <App />
      </AuthProvider>
    </AppRouter>
  </StrictMode>,
)
