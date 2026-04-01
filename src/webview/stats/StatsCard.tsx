// src/webview/stats/StatsCard.tsx
// Stats tile component for the VibeSense Stats Dashboard (Story 9.2)
// Displays a single labeled metric with optional milestone-glow (UX-DR10)
// AC3: keyboard-navigable (NFR-A1)

import React from 'react'

interface StatsCardProps {
  label: string
  value: string
  description: string
  /** When true, applies milestone-glow styling (new personal best / high streak) */
  highlight: boolean
}

export function StatsCard({ label, value, description, highlight }: StatsCardProps): React.ReactElement {
  return (
    <div
      className={`stats-card${highlight ? ' stats-card--highlight' : ''}`}
      tabIndex={0}
      role="region"
      aria-label={`${label}: ${value}. ${description}`}
    >
      <div className="stats-card__label" aria-hidden="true">{label}</div>
      <div className="stats-card__value" aria-hidden="true">{value}</div>
      <div className="stats-card__description">{description}</div>
    </div>
  )
}
