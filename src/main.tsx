import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { isStandalone, track } from './lib/analytics'
import './index.css'

registerSW({ immediate: true })
track('app_opened', { is_standalone: isStandalone() })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
