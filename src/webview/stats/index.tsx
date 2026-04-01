// src/webview/stats/index.tsx
// Webview bundle entry point for the VibeSense Stats Dashboard (Story 9.2)

import React from 'react'
import { createRoot } from 'react-dom/client'
import { StatsPanel } from './StatsPanel'
import './stats.css'

const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<StatsPanel />)
}
