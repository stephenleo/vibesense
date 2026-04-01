// src/webview/radial-wheel/WheelSegment.tsx
// SVG arc segment for the radial wheel (Story 7.1)

import React from 'react'

interface WheelSegmentProps {
  index: number
  label: string
  promptText?: string  // full prompt text for ARIA label (prompt-dispatch segments)
  isActive: boolean    // true = highlighted/selected
  isPreview: boolean   // true = showing full prompt text preview
  centerX: number
  centerY: number
  radius: number
}

/**
 * Renders a single donut arc segment for the radial wheel.
 *
 * Geometry:
 * - 8 segments, each 45° wide
 * - Segment 0 starts at top (270° / -90° in standard math angle)
 * - Angles increase clockwise
 * - Donut shape: outer radius = radius, inner radius = radius * 0.35
 *
 * Active state: scale(1.05) + drop-shadow glow via CSS class
 */
export function WheelSegment({
  index,
  label,
  promptText,
  isActive,
  isPreview,
  centerX,
  centerY,
  radius,
}: WheelSegmentProps): React.ReactElement {
  const innerRadius = radius * 0.35
  const segmentAngle = Math.PI / 4 // 45° in radians
  const gap = 0.03 // small gap between segments in radians

  // Start angle for this segment: segment 0 = top = -π/2
  const startAngle = index * segmentAngle - Math.PI / 2 + gap / 2
  const endAngle = (index + 1) * segmentAngle - Math.PI / 2 - gap / 2

  // Compute arc path points
  const outerStartX = centerX + radius * Math.cos(startAngle)
  const outerStartY = centerY + radius * Math.sin(startAngle)
  const outerEndX = centerX + radius * Math.cos(endAngle)
  const outerEndY = centerY + radius * Math.sin(endAngle)
  const innerStartX = centerX + innerRadius * Math.cos(endAngle)
  const innerStartY = centerY + innerRadius * Math.sin(endAngle)
  const innerEndX = centerX + innerRadius * Math.cos(startAngle)
  const innerEndY = centerY + innerRadius * Math.sin(startAngle)

  // SVG arc path: M outer-start, arc to outer-end, L inner-end, arc back to inner-start, Z
  const pathD = [
    `M ${outerStartX} ${outerStartY}`,
    `A ${radius} ${radius} 0 0 1 ${outerEndX} ${outerEndY}`,
    `L ${innerStartX} ${innerStartY}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerEndX} ${innerEndY}`,
    'Z',
  ].join(' ')

  // Label position: midpoint angle, between inner and outer radius
  const midAngle = (startAngle + endAngle) / 2
  const labelRadius = (radius + innerRadius) / 2
  const labelX = centerX + labelRadius * Math.cos(midAngle)
  const labelY = centerY + labelRadius * Math.sin(midAngle)

  const segmentClass = [
    'wheel-segment',
    isActive ? 'wheel-segment--active' : '',
    isPreview ? 'wheel-segment--preview' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // The transform origin must be the center of the SVG for scale to work correctly
  const transformOrigin = `${centerX}px ${centerY}px`

  return (
    <g
      className={segmentClass}
      role="menuitem"
      aria-label={promptText ?? label}
      aria-selected={isActive}
      style={isActive ? { transformOrigin } : undefined}
    >
      <path d={pathD} className="wheel-segment__path" />
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="middle"
        className="wheel-segment__label"
      >
        {label}
      </text>
    </g>
  )
}
