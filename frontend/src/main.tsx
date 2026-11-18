import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './features/auth/AuthProvider'
import { BrowserRouter } from 'react-router-dom'
import './hooks/usePWAInstall'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
 <StrictMode>
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
</StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('SW registration failed:', err))
  })
}