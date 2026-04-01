// src/extension/input/default-bindings.ts
// Bundled default binding profiles — pure types and constants, no vscode imports

import type { ButtonId } from '../../shared/types'

/** Maps ButtonId to a VSCode command ID string */
export type BindingMap = Partial<Record<ButtonId, string>>

/** Active binding mode — Guided exposes only core buttons; Full exposes all configured bindings */
export type BindingMode = 'guided' | 'full'

/**
 * Strict set of ButtonIds allowed in Guided mode.
 * Analog axes (left_y / right_y) are NOT in this set — they are handled
 * by AnalogScrollController independently and always pass through.
 */
export const GUIDED_MODE_BUTTON_IDS: ReadonlySet<ButtonId> = new Set([
  // DualSense core buttons
  'cross',
  'circle',
  'l1',
  'r1',
  // Xbox equivalents
  'a',
  'b',
  'lb',
  'rb',
])

/** Default bindings for Claude Code vibe-coding workflow */
export const CLAUDE_CODE_DEFAULT_BINDINGS: BindingMap = {
  // DualSense primary actions
  cross: 'vibesense.approve',
  circle: 'vibesense.deny',
  square: 'vibesense.openTerminal', // Story 3.1: DualSense □ = new terminal (MVP; L1+R1 chord deferred)
  // l2 intentionally omitted — Story 7.1: RadialWheelController owns L2 hold/release directly
  r2: 'vibesense.openQuickPanel',
  l1: 'vibesense.switchSessionPrev',
  r1: 'vibesense.switchSessionNext',
  options: 'vibesense.openSettings',
  touchpad: 'vibesense.voicePtt', // Story 3.6: DualSense touchpad = voice PTT
  triangle: 'workbench.action.terminal.focus',
  up: 'workbench.action.terminal.scrollUp',
  down: 'workbench.action.terminal.scrollDown',
  left: 'workbench.action.navigateBack',
  right: 'workbench.action.navigateForward',
  // Xbox equivalents
  a: 'vibesense.approve',
  b: 'vibesense.deny',
  x: 'vibesense.openTerminal', // Story 3.1: Xbox X = new terminal (parity with DualSense □)
  y: 'workbench.action.terminal.focus',
  // lt intentionally omitted — Story 7.1: RadialWheelController owns LT hold/release directly
  rt: 'vibesense.openQuickPanel',
  lb: 'vibesense.switchSessionPrev',
  rb: 'vibesense.switchSessionNext',
  menu: 'vibesense.openSettings',
  view: 'vibesense.voicePtt', // Story 3.6: Xbox View button = voice PTT
}

// Story 5.5: vibesense.openErrorMenu is intentionally NOT bound here.
// The error menu opens automatically when an agent session transitions to error state (AC 1).
// A manual binding can be added in a future story if a dedicated button becomes available
// (currently unbound: l3, r3).

/** Default bindings for Copilot vibe-coding workflow */
export const COPILOT_DEFAULT_BINDINGS: BindingMap = {
  ...CLAUDE_CODE_DEFAULT_BINDINGS,
  // Copilot-specific overrides can be added here
}
