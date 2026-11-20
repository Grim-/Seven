import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

document.documentElement.dataset.mode = 'app'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
