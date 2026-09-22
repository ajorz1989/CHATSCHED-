import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { initErrorTracking } from './lib/errorTracking'
import { initAnalytics } from './lib/analytics'
import { registerSW } from 'virtual:pwa-register'

initErrorTracking();
initAnalytics();

// Make PWA updates take control immediately so a stale service worker cannot
// keep an older application bundle alive after a deployment.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
