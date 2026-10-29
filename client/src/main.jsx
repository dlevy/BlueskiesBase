import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { reloadForStaleChunk } from './utils/staleChunkReload'

// Every route/admin page here is a separate lazy-loaded chunk, named with a
// content hash that changes on every deploy. A tab left open across a deploy
// still has the old hashes in memory, so navigating to a not-yet-visited
// chunk fetches a filename the new deployment no longer has - a 404 that
// surfaces as "error loading dynamically imported module" and trips the
// ErrorBoundary below. Vite fires this event when that happens; reloading
// once re-fetches the current index.html with the current hashes and fixes
// it transparently. Guarded (via staleChunkReload.js, shared with
// ErrorBoundary's matching fallback) so a *genuinely* broken chunk doesn't
// reload-loop, while still recovering again from a later deploy in a tab
// that's been left open for days.
window.addEventListener('vite:preloadError', reloadForStaleChunk)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PorscheDesignSystemProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PorscheDesignSystemProvider>
  </StrictMode>,
)
