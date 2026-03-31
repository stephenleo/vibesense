// src/webview/session/ErrorMenu.tsx
// Full-screen error recovery modal — Story 5.5 (AC 1, 2, 3)

import React from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ErrorMenuProps {
  visible: boolean
  hasLastCommand: boolean
  onAction: (action: 'retry' | 'clear' | 'new-session' | 'view-log') => void
  onDismiss: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ErrorMenu({
  visible,
  hasLastCommand,
  onAction,
  onDismiss,
}: ErrorMenuProps): React.ReactElement {
  const visibilityClass = visible ? 'error-menu--visible' : 'error-menu--hidden'

  return (
    <div
      className={`error-menu ${visibilityClass}`}
      role="dialog"
      aria-modal="true"
      aria-label="Agent error quick-action menu"
    >
      {/* Semi-transparent backdrop */}
      <div className="error-menu__backdrop" aria-hidden="true" />

      {/* Centered content panel */}
      <div className="error-menu__content">
        <p className="error-menu__title">Agent Error</p>

        <ul className="error-menu__action-list" role="menu">
          <li role="menuitem">
            <button
              className={`error-menu__action-btn${!hasLastCommand ? ' error-menu__action-btn--disabled' : ''}`}
              onClick={() => onAction('retry')}
              disabled={!hasLastCommand}
              aria-disabled={!hasLastCommand}
            >
              Retry last command
            </button>
          </li>
          <li role="menuitem">
            <button
              className="error-menu__action-btn"
              onClick={() => onAction('clear')}
            >
              Clear terminal output
            </button>
          </li>
          <li role="menuitem">
            <button
              className="error-menu__action-btn"
              onClick={() => onAction('new-session')}
            >
              Open new agent session
            </button>
          </li>
          <li role="menuitem">
            <button
              className="error-menu__action-btn"
              onClick={() => onAction('view-log')}
            >
              View error log
            </button>
          </li>
        </ul>

        <button
          className="error-menu__dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss error menu"
        >
          Dismiss (○)
        </button>
      </div>
    </div>
  )
}
