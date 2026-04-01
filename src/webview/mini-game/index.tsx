// src/webview/mini-game/index.tsx
// Entry point for VibeSense Mini-Game webview bundle (Story 8.1)
import React from 'react'
import { createRoot } from 'react-dom/client'
import { GameCanvas } from './GameCanvas'
import './mini-game.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<GameCanvas />)
}
