import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Analytics } from '@vercel/analytics/react'
import { initMonitoring } from './utils/monitoring.js'
import './pwa.js'
import { captureInviteFromUrl } from './utils/invite.js'

initMonitoring()
// ?friend=CODE invite links: remember the invite before sign-in can redirect away.
captureInviteFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
)
