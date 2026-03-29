// src/webview/radial-wheel/index.tsx
// Radial Wheel webview entry point — placeholder
// Full implementation in Story 7.1

import React from 'react'
import { createRoot } from 'react-dom/client'

function RadialWheelPlaceholder(): React.ReactElement {
  return (
    <div style={{ padding: '1rem', fontFamily: 'var(--vscode-font-family)' }}>
      <p>VibeSense Radial Wheel — coming in Story 7.1</p>
    </div>
  )
}

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(<RadialWheelPlaceholder />)
}
