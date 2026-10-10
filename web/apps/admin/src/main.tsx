import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRouter, AuthProvider } from '@ep/shared'
import { App } from './App'
import { api } from './lib/api'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRouter>
      <AuthProvider api={api} deviceName="HR Portal">
        <App />
      </AuthProvider>
    </AppRouter>
  </StrictMode>,
)
