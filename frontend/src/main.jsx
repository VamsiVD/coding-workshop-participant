// Browser entry point (loaded by index.html): mounts the React app into <div id="root">.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// [CONCEPT: Root render] createRoot attaches React to the #root element in index.html; render draws App into it.
createRoot(document.getElementById('root')).render(
  // [CONCEPT: StrictMode] Development-only checks: React renders components and runs effects twice to expose side-effect bugs.
  <StrictMode>
    <App />
  </StrictMode>,
)
