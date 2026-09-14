import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PhoneScanScene } from './scenes/PhoneScanScene.tsx'

// QRから開く「スマホで よみとる」専用ページ。ゲーム本体とは別の軽量ルート。
const scanSession = new URLSearchParams(window.location.search).get('session')
const isPhoneScanRoute = window.location.pathname === '/scan' && scanSession

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPhoneScanRoute ? <PhoneScanScene code={scanSession} /> : <App />}
  </StrictMode>,
)
