// src/webview/session/QuickPanel.tsx
// Full-screen modal session picker for the quick panel (Story 3.5 / FR14)

import React from 'react'
import type { Session } from '../../shared/types'
import { SessionCard } from './SessionCard'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface QuickPanelProps {
  sessions: Session[]
  selectedIndex: number
  visible: boolean
  onSelect: (index: number) => void
  onDismiss: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function QuickPanel({
  sessions,
  selectedIndex,
  visible,
  onSelect,
  onDismiss,
}: QuickPanelProps): React.ReactElement {
  const visibilityClass = visible ? 'quick-panel--visible' : 'quick-panel--hidden'

  return (
    <div
      className={`quick-panel ${visibilityClass}`}
      role="dialog"
      aria-modal="true"
      aria-label="Quick session panel"
    >
      {/* Semi-transparent backdrop */}
      <div className="quick-panel__backdrop" aria-hidden="true" />

      {/* Floating content panel */}
      <div className="quick-panel__content">
        <p className="quick-panel__title">Select Session</p>

        {sessions.length === 0 ? (
          <p className="quick-panel__empty">
            No terminal sessions open. Hold L1+R1 to open a terminal.
          </p>
        ) : (
          <ul
            className="quick-panel__session-list"
            role="listbox"
            aria-label="Terminal sessions"
          >
            {sessions.map((session, index) => (
              <li
                key={session.sessionId}
                className={`quick-panel__item${index === selectedIndex ? ' quick-panel__item--selected' : ''}`}
                role="option"
                aria-selected={index === selectedIndex}
              >
                <SessionCard
                  session={session}
                  isActive={index === selectedIndex}
                />
                <button
                  className="quick-panel__select-btn"
                  onClick={() => onSelect(index)}
                  aria-label={`Select session ${session.label ?? session.sessionId}`}
                >
                  Select
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          className="quick-panel__dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss panel"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
