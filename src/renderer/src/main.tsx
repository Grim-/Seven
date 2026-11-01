import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Overlay } from './overlay/Overlay'

const mode = new URLSearchParams(window.location.search).get('mode') === 'overlay' ? 'overlay' : 'app'
document.documentElement.dataset.mode = mode

createRoot(document.getElementById('root')!).render(<StrictMode>{mode === 'overlay' ? <Overlay /> : <App />}</StrictMode>)
