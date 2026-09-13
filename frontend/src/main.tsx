import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { initAccentColor } from './lib/accentColor'
import { initCompat } from './lib/initCompat'
import App from './App.tsx'

initCompat()
initAccentColor()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
