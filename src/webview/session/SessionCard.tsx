// src/webview/session/SessionCard.tsx
// Per-session status card for the SlidePanel

import React from 'react'
import type { Session } from '../../shared/types'

// ─── AgentState → display mapping ────────────────────────────────────────────

const STATE_LABELS: Record<string, string> = {
  processing: 'Processing',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'needs-input': 'Needs input',
  idle: 'Idle',
  error: 'Error',
}

const STATE_DOT_CLASS: Record<string, string> = {
  processing: 'dot--processing',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'needs-input': 'dot--needs-input',
  idle: 'dot--idle',
  error: 'dot--error',
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionCardProps {
  session: Session
  isActive?: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionCard({ session, isActive = false }: SessionCardProps): React.ReactElement {
  const stateLabel = STATE_LABELS[session.agentState] ?? session.agentState
  const dotClass = STATE_DOT_CLASS[session.agentState] ?? 'dot--idle'
  const displayLabel = session.label ?? session.sessionId

  return (
    <div
      className={`session-card${isActive ? ' session-card--active' : ''}`}
      data-testid="session-card"
    >
      {/* Status indicator: color + text label together (NFR-A2) */}
      <div
        className={`session-card__dot ${dotClass}`}
        title={stateLabel}
        aria-hidden="true"
      />
      <div
        className="session-card__content"
        aria-live="polite"
        role="status"
      >
        <span className="session-card__label">{displayLabel}</span>
        <span className="session-card__state">{stateLabel}</span>
      </div>
    </div>
  )
}
