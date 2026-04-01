// src/webview/hud/StreamingOverlay.tsx
// CINEMA-style streaming overlay for Story 10.1
// Story 10.3: Extended to support wheel-visible state with StreamingWheelMirror
// Renders as a fixed bottom band inside the HUD panel webview

import React from 'react'
import type { ControllerType, Session, WheelSegmentDef } from '../../shared/types'
import { ButtonMap } from './ButtonMap'
import { StreamingWheelMirror } from './StreamingWheelMirror'

interface StreamingOverlayProps {
  sessions: Session[]
  bindings: Record<string, string>
  controllerType: ControllerType | null
  mode: 'guided' | 'full'
  pressedButtons?: Map<string, number>  // Story 10.2: active button-press state (Map<buttonId, pressCounter>)
  // Story 10.3: Wheel-visible state props
  wheelOpen: boolean
  wheelActiveWheel: 'l2' | 'r2'
  wheelL2Segments: WheelSegmentDef[]
  wheelR2Segments: WheelSegmentDef[]
  wheelSelectedIndex: number
  wheelIsClosing: boolean
  wheelDispatched: boolean
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

export function StreamingOverlay({
  sessions,
  bindings,
  controllerType,
  mode,
  pressedButtons,
  wheelOpen,
  wheelActiveWheel,
  wheelL2Segments,
  wheelR2Segments,
  wheelSelectedIndex,
  wheelIsClosing,
  wheelDispatched,
}: StreamingOverlayProps): React.ReactElement {
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
      {/* Center: CINEMA badge or wheel mirror when wheel-visible */}
      <div className="streaming-section" style={{ flex: 1, justifyContent: 'center' }}>
        {wheelOpen ? (
          <StreamingWheelMirror
            activeWheel={wheelActiveWheel}
            l2Segments={wheelL2Segments}
            r2Segments={wheelR2Segments}
            selectedIndex={wheelSelectedIndex}
            isClosing={wheelIsClosing}
            dispatched={wheelDispatched}
          />
        ) : (
          <span className="streaming-badge">CINEMA</span>
        )}
      </div>
      {/* Right: button-map-visible */}
      <div className="streaming-section">
        <ButtonMap bindings={bindings} controllerType={controllerType} mode={mode} pressedButtons={pressedButtons} />
      </div>
    </div>
  )
}
