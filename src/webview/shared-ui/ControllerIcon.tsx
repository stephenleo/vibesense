// src/webview/shared-ui/ControllerIcon.tsx
// Hardware-adaptive button glyph component for VibeSense UI panels
import React from 'react'
import type { ButtonId, ControllerType } from '../../shared/types'

export interface ControllerIconProps {
  button: ButtonId
  controllerType: ControllerType
  size?: number
}

// DualSense face button glyph map
const PS_GLYPHS: Partial<Record<ButtonId, string>> = {
  cross: '✕',
  circle: '○',
  square: '□',
  triangle: '△',
}

// Xbox face button glyph map
const XBOX_GLYPHS: Partial<Record<ButtonId, string>> = {
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
}

// DualSense color token map (face buttons only — others use --vs-controller-generic)
const PS_COLORS: Partial<Record<ButtonId, string>> = {
  cross: 'var(--vs-controller-cross)',
  circle: 'var(--vs-controller-circle)',
  square: 'var(--vs-controller-square)',
  triangle: 'var(--vs-controller-triangle)',
}

// Xbox color token map
const XBOX_COLORS: Partial<Record<ButtonId, string>> = {
  a: 'var(--vs-controller-a)',
  b: 'var(--vs-controller-b)',
  x: 'var(--vs-controller-x)',
  y: 'var(--vs-controller-y)',
}

// Human-readable fallback label for non-face buttons
const BUTTON_LABELS: Partial<Record<ButtonId, string>> = {
  // DualSense shoulder/trigger/other
  l1: 'L1',
  r1: 'R1',
  l2: 'L2',
  r2: 'R2',
  l3: 'L3',
  r3: 'R3',
  options: 'Options',
  touchpad: 'Touch',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  // Xbox shoulder/trigger/other
  lb: 'LB',
  rb: 'RB',
  lt: 'LT',
  rt: 'RT',
  ls: 'LS',
  rs: 'RS',
  menu: 'Menu',
  view: 'View',
}

export function ControllerIcon({ button, controllerType, size = 20 }: ControllerIconProps): React.ReactElement {
  let glyph: string
  let color: string
  let ariaLabel: string

  if (controllerType === 'dualsense') {
    glyph = PS_GLYPHS[button] ?? BUTTON_LABELS[button] ?? button
    color = PS_COLORS[button] ?? 'var(--vs-controller-generic)'
    ariaLabel = `DualSense ${button}`
  } else if (controllerType === 'xbox') {
    glyph = XBOX_GLYPHS[button] ?? BUTTON_LABELS[button] ?? button
    color = XBOX_COLORS[button] ?? 'var(--vs-controller-generic)'
    ariaLabel = `Xbox ${button}`
  } else {
    // generic-hid — text label only
    glyph = BUTTON_LABELS[button] ?? button
    color = 'var(--vs-controller-generic)'
    ariaLabel = `Controller ${button}`
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-label={ariaLabel}
      role="img"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <title>{ariaLabel}</title>
      <text
        x="10"
        y="10"
        dominantBaseline="central"
        textAnchor="middle"
        fontSize={14}
        fill={color}
        fontFamily="var(--vs-font-family, sans-serif)"
        fontWeight="bold"
      >
        {glyph}
      </text>
    </svg>
  )
}
