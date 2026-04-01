// src/webview/session/SessionHealthBar.tsx
// Live session health bar component — displays ratio, duration, and session XP preview (Story 9.4)

import React from 'react'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SessionHealthBarProps {
  ratio: number       // 0.0–1.0 controller action ratio
  durationMs: number  // elapsed ms since session start
  sessionXp: number   // estimated XP to be earned when session ends
  connected: boolean  // false → render null (no controller active)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function getRatioClass(ratio: number): string {
  if (ratio < 0.5) return 'health-bar__ratio--warning'
  if (ratio >= 0.8) return 'health-bar__ratio--good'
  return 'health-bar__ratio--neutral'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SessionHealthBar({
  ratio,
  durationMs,
  sessionXp,
  connected,
}: SessionHealthBarProps): React.ReactElement | null {
  if (!connected) return null

  const ratioPercent = Math.round(ratio * 100)
  const ratioClass = getRatioClass(ratio)
  const duration = formatDuration(durationMs)
  const ariaLabel = `Session health: ${ratioPercent}% controller ratio, duration ${duration}, ${sessionXp} XP earned`

  return (
    <div
      className="health-bar"
      role="status"
      aria-label={ariaLabel}
      data-testid="session-health-bar"
    >
      <span className={`health-bar__ratio ${ratioClass}`} aria-hidden="true">
        {ratioPercent}% ctrl
      </span>
      <span className="health-bar__duration" aria-hidden="true">
        {duration}
      </span>
      <span className="health-bar__xp" aria-hidden="true">
        +{sessionXp} XP
      </span>
    </div>
  )
}
