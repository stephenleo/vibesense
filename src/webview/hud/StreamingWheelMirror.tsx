// src/webview/hud/StreamingWheelMirror.tsx
// Compact SVG wheel mirror for streaming overlay (Story 10.3)
// DO NOT import from src/webview/radial-wheel/ — separate webpack bundle

import React, { useEffect, useState } from 'react'
import type { WheelSegmentDef } from '../../shared/types'

// SVG geometry constants — scaled to 200×200 viewBox (half the 400×400 radial-wheel)
const SVG_SIZE = 200
const CENTER = SVG_SIZE / 2
const WHEEL_RADIUS = 85        // scaled from 170 (radial-wheel) → 85
const INNER_RADIUS = WHEEL_RADIUS * 0.35  // same ratio as WheelSegment

function buildArcPath(
  index: number,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): string {
  const segAngle = Math.PI / 4
  const gap = 0.03
  const startAngle = index * segAngle - Math.PI / 2 + gap / 2
  const endAngle = (index + 1) * segAngle - Math.PI / 2 - gap / 2
  const osx = cx + outerR * Math.cos(startAngle)
  const osy = cy + outerR * Math.sin(startAngle)
  const oex = cx + outerR * Math.cos(endAngle)
  const oey = cy + outerR * Math.sin(endAngle)
  const isx = cx + innerR * Math.cos(endAngle)
  const isy = cy + innerR * Math.sin(endAngle)
  const iex = cx + innerR * Math.cos(startAngle)
  const iey = cy + innerR * Math.sin(startAngle)
  return `M ${osx} ${osy} A ${outerR} ${outerR} 0 0 1 ${oex} ${oey} L ${isx} ${isy} A ${innerR} ${innerR} 0 0 0 ${iex} ${iey} Z`
}

interface StreamingWheelMirrorProps {
  activeWheel: 'l2' | 'r2'
  l2Segments: WheelSegmentDef[]
  r2Segments: WheelSegmentDef[]
  selectedIndex: number
  isClosing: boolean
  dispatched: boolean
}

export function StreamingWheelMirror({
  activeWheel,
  l2Segments,
  r2Segments,
  selectedIndex,
  isClosing,
  dispatched,
}: StreamingWheelMirrorProps): React.ReactElement {
  const [isReducedMotion, setIsReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setIsReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const segments = activeWheel === 'l2' ? l2Segments : r2Segments
  const label = activeWheel === 'l2' ? 'L2' : 'R2'
  const ariaLabel = `Radial wheel: ${activeWheel === 'l2' ? 'L2 Smart' : 'R2 Personal'} wheel`

  let containerClass = 'streaming-wheel-mirror'
  if (!isReducedMotion && isClosing) {
    containerClass += dispatched
      ? ' streaming-wheel-mirror--dispatching'
      : ' streaming-wheel-mirror--cancelling'
  }

  return (
    <div className={containerClass} role="img" aria-label={ariaLabel}>
      <svg
        className="streaming-wheel-mirror__svg"
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {Array.from({ length: 8 }, (_, i) => {
          const isActive = i === selectedIndex
          const seg = segments[i]
          const fill = isActive
            ? 'var(--vs-accent, #00C8FF)'
            : 'rgba(255,255,255,0.12)'
          const filter = isActive
            ? 'drop-shadow(0 0 4px var(--vs-glow, #00C8FF))'
            : undefined
          const path = buildArcPath(i, CENTER, CENTER, WHEEL_RADIUS, INNER_RADIUS)
          return (
            <path
              key={i}
              d={path}
              fill={fill}
              style={{ filter }}
              aria-label={seg?.label ?? `Segment ${i}`}
            />
          )
        })}
      </svg>
      <span className="streaming-badge streaming-wheel-mirror__label">{label}</span>
    </div>
  )
}
