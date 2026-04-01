// src/webview/radial-wheel/index.tsx
// Radial Wheel webview entry point (Story 7.1)

import '../shared-ui/tokens.css'
import './radial-wheel.css'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { RadialWheelApp } from './RadialWheel'

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<RadialWheelApp />)
}
