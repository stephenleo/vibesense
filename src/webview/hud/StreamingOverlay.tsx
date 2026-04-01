// src/webview/hud/StreamingOverlay.tsx
// CINEMA-style streaming overlay for Story 10.1
// Renders as a fixed bottom band inside the HUD panel webview

import React from 'react'
import type { ControllerType, Session } from '../../shared/types'
import { ButtonMap } from './ButtonMap'

interface StreamingOverlayProps {
  sessions: Session[]
  bindings: Record<string, string>
  controllerType: ControllerType | null
  mode: 'guided' | 'full'
}

function agentStateToClass(state: Session['agentState']): string {
  switch (state) {
    case 'processing':   return 'streaming-session-dot--processing'
    case 'needs-input':  return 'streaming-session-dot--needs-input'
    case 'error':        return 'streaming-session-dot--error'
    case 'idle':
    default:             return 'streaming-session-dot--idle'
  }
}

export function StreamingOverlay({ sessions, bindings, controllerType, mode }: StreamingOverlayProps): React.ReactElement {
  return (
    <div className="streaming-overlay" role="region" aria-label="VibeSense Streaming Overlay">
      {/* Left: session state indicators */}
      <div className="streaming-section">
        {sessions.map((s) => (
          <span
            key={s.sessionId}
            className={`streaming-session-dot ${agentStateToClass(s.agentState)}`}
            aria-label={`Session ${s.label ?? s.sessionId}: ${s.agentState}`}
          />
        ))}
      </div>
      {/* Center: CINEMA brand badge */}
      <div className="streaming-section" style={{ flex: 1, justifyContent: 'center' }}>
        <span className="streaming-badge">CINEMA</span>
      </div>
      {/* Right: button-map-visible */}
      <div className="streaming-section">
        <ButtonMap bindings={bindings} controllerType={controllerType} mode={mode} />
      </div>
    </div>
  )
}
