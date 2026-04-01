// src/webview/stats/RatioTrendChart.tsx
// Bar chart of controller action ratio over the last N sessions (Story 9.2)
// SVG-based; no external chart library dependency
// AC1: ratio trend over last 30 sessions; AC3: keyboard-navigable with ARIA

import React from 'react'
import type { SessionData } from './StatsPanel'

interface RatioTrendChartProps {
  sessions: SessionData[]
}

/** Determine bar color based on ratio value using VOID design tokens */
function getBarColor(ratio: number): string {
  if (ratio >= 0.8) return 'var(--vs-accent)'        // cyan: excellent
  if (ratio >= 0.5) return 'var(--vs-accent2)'       // purple: moderate
  return 'var(--vs-text2)'                            // muted: low ratio
}

export function RatioTrendChart({ sessions }: RatioTrendChartProps): React.ReactElement {
  if (sessions.length === 0) {
    return (
      <div className="chart-empty" role="img" aria-label="No session data available">
        No sessions to display
      </div>
    )
  }

  const CHART_WIDTH = 600
  const CHART_HEIGHT = 120
  const BAR_GAP = 2
  const LABEL_HEIGHT = 16
  const LABEL_LEFT_MARGIN = 30 // space for Y-axis labels so they don't overlap bars
  const PLOT_HEIGHT = CHART_HEIGHT - LABEL_HEIGHT
  const PLOT_WIDTH = CHART_WIDTH - LABEL_LEFT_MARGIN

  const barWidth = Math.max(4, Math.floor((PLOT_WIDTH - BAR_GAP * sessions.length) / sessions.length))

  // Summary for aria-label
  const avgRatio = sessions.reduce((sum, s) => sum + s.ratio, 0) / sessions.length
  const ariaLabel = `Controller ratio trend chart over ${sessions.length} sessions. Average ratio: ${Math.round(avgRatio * 100)}%.`

  return (
    <div className="chart-container" tabIndex={0} role="img" aria-label={ariaLabel}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="ratio-chart"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Reference line at 80% (highlight threshold) */}
        <line
          x1={LABEL_LEFT_MARGIN}
          y1={PLOT_HEIGHT * (1 - 0.8)}
          x2={CHART_WIDTH}
          y2={PLOT_HEIGHT * (1 - 0.8)}
          stroke="var(--vs-accent)"
          strokeOpacity="0.25"
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        {/* Reference line at 50% */}
        <line
          x1={LABEL_LEFT_MARGIN}
          y1={PLOT_HEIGHT * (1 - 0.5)}
          x2={CHART_WIDTH}
          y2={PLOT_HEIGHT * (1 - 0.5)}
          stroke="var(--vs-text2)"
          strokeOpacity="0.15"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* Bars */}
        {sessions.map((session, i) => {
          const barHeight = Math.max(2, Math.round(session.ratio * PLOT_HEIGHT))
          const x = LABEL_LEFT_MARGIN + i * (barWidth + BAR_GAP)
          const y = PLOT_HEIGHT - barHeight
          return (
            <rect
              key={session.sessionId}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={getBarColor(session.ratio)}
              rx={2}
            />
          )
        })}

        {/* Y-axis labels */}
        <text x={2} y={PLOT_HEIGHT * (1 - 0.8) - 2} fill="var(--vs-text2)" fontSize="9" fontFamily="var(--vs-font-family)">80%</text>
        <text x={2} y={PLOT_HEIGHT * (1 - 0.5) - 2} fill="var(--vs-text2)" fontSize="9" fontFamily="var(--vs-font-family)">50%</text>
      </svg>

      {/* Legend */}
      <div className="chart-legend" aria-hidden="true">
        <span className="legend-item legend-item--accent">≥ 80%</span>
        <span className="legend-item legend-item--accent2">≥ 50%</span>
        <span className="legend-item legend-item--muted">&lt; 50%</span>
      </div>
    </div>
  )
}
