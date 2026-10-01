import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

async function start() {
  if (import.meta.env.DEV && !window.ogl) window.ogl = (await import('./dev-mock')).mockApi
  const root = document.getElementById('root')
  if (!root) throw new Error('Missing root')
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void start()
