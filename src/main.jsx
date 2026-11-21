import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { Analytics } from '@vercel/analytics/react'
import { initMonitoring } from './utils/monitoring.js'
import './pwa.js'
import { captureInviteFromUrl } from './utils/invite.js'
import { captureTutorJoinFromUrl } from './utils/tutorJoin.js'
import { installDomGuard } from './utils/domGuard.js'

initMonitoring()
// Browser "Translate page" mustn't be able to crash a screen (Sentry: NotFoundError).
installDomGuard()
// ?friend=CODE invite links: remember the invite before sign-in can redirect away.
captureInviteFromUrl()
// /join/<code> tutor links: remember the tutor before sign-in can redirect away.
captureTutorJoinFromUrl()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Analytics />
    </ErrorBoundary>
  </StrictMode>,
)
