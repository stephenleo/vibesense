// src/webview/session/SlidePanel.tsx
// Right-edge overlay panel for session status

import React, { useEffect, useRef } from 'react'
import type { Session } from '../../shared/types'
import { SessionCard } from './SessionCard'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SlidePanelProps {
  sessions: Session[]
  isExpanded: boolean
  onToggle: () => void
  editorWidth?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SlidePanel({
  sessions,
  isExpanded,
  onToggle,
  editorWidth,
}: SlidePanelProps): React.ReactElement {
  // Auto-retract when editor width < 800px (UX-DR17)
  const autoRetracted = typeof editorWidth === 'number' && editorWidth < 800
  const expanded = isExpanded && !autoRetracted

  // Focus management: focus first interactive element when panel expands (UX-DR18)
  const handleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (expanded && handleRef.current) {
      handleRef.current.focus()
    }
  }, [expanded])

  const panelWidth = expanded ? '200px' : '12px'

  return (
    <div
      className={`slide-panel${expanded ? ' slide-panel--expanded' : ''}`}
      // eslint-disable-next-line @typescript-eslint/naming-convention
      style={{ '--vs-panel-width': panelWidth } as React.CSSProperties}
      data-testid="slide-panel"
    >
      {/* Drag handle — always visible 12px strip */}
      <button
        ref={handleRef}
        className="slide-panel__handle"
        onClick={onToggle}
        aria-label={expanded ? 'Retract session panel' : 'Expand session panel'}
        aria-expanded={expanded}
        type="button"
      />

      {/* Panel content — only rendered when expanded */}
      {expanded && (
        <div className="slide-panel__content">
          {sessions.length === 0 ? (
            <p className="slide-panel__empty-hint">Hold L1+R1 to open a terminal</p>
          ) : (
            <ul className="slide-panel__session-list" aria-label="Open sessions">
              {sessions.map((session) => (
                <li key={session.sessionId}>
                  <SessionCard session={session} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
