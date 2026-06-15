import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PorscheDesignSystemProvider theme="dark">
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PorscheDesignSystemProvider>
  </StrictMode>,
)
