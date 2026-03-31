// src/webview/session/SessionSwitcher.tsx
// Brief 800ms overlay confirming L1/R1 session switch — Story 3.3
// NFR-A2: shows session name text + counter number (never color alone)

import React from 'react'

interface SessionSwitcherProps {
  sessionIndex: number
  sessionName: string
  totalSessions: number
  visible: boolean
}

/**
 * SessionSwitcher — brief overlay that confirms an L1/R1 session switch.
 * Renders as a centered fixed overlay above SlidePanel (z-index: 2000).
 * Visibility is controlled by the `visible` prop; parent manages the 800ms timer.
 * Component is never unmounted to allow CSS fade-out transition.
 */
export function SessionSwitcher({
  sessionIndex,
  sessionName,
  totalSessions,
  visible,
}: SessionSwitcherProps): React.ReactElement {
  const visibilityClass = visible ? 'session-switcher--visible' : 'session-switcher--hidden'

  return (
    <div
      className={`session-switcher ${visibilityClass}`}
      role="status"
      aria-live="polite"
      aria-hidden={!visible}
    >
      <div className="session-switcher__name">{sessionName}</div>
      <div className="session-switcher__counter">
        {sessionIndex + 1} / {totalSessions}
      </div>
    </div>
  )
}
