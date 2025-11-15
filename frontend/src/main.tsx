import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from 'aws-amplify'
import amplifyConfig from './amplify-config'
import { initializePWA } from './utils/pwa'
import './index.css'
import App from './App.tsx'

// Configure Amplify
Amplify.configure(amplifyConfig)

// Initialize PWA functionality
initializePWA()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
