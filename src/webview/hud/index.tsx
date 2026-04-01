// src/webview/hud/index.tsx
// Webview bundle entry point for the VibeSense HUD Overlay (Story 7.3)

import React from 'react'
import { createRoot } from 'react-dom/client'
import { HUDOverlay } from './HUDOverlay'
import './hud.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<HUDOverlay />)
}
