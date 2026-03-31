// src/extension/input/default-bindings.ts
// Bundled default binding profiles — pure types and constants, no vscode imports

import type { ButtonId } from '../../shared/types'

/** Maps ButtonId to a VSCode command ID string */
export type BindingMap = Partial<Record<ButtonId, string>>

/** Default bindings for Claude Code vibe-coding workflow */
export const CLAUDE_CODE_DEFAULT_BINDINGS: BindingMap = {
  // DualSense primary actions
  cross: 'vibesense.approve',
  circle: 'vibesense.deny',
  l2: 'vibesense.openRadialWheel',
  l1: 'vibesense.switchSessionPrev',
  r1: 'vibesense.switchSessionNext',
  options: 'vibesense.openSettings',
  triangle: 'workbench.action.terminal.focus',
  up: 'workbench.action.terminal.scrollUp',
  down: 'workbench.action.terminal.scrollDown',
  left: 'workbench.action.navigateBack',
  right: 'workbench.action.navigateForward',
  // Xbox equivalents
  a: 'vibesense.approve',
  b: 'vibesense.deny',
  lt: 'vibesense.openRadialWheel',
  lb: 'vibesense.switchSessionPrev',
  rb: 'vibesense.switchSessionNext',
  menu: 'vibesense.openSettings',
}

/** Default bindings for Copilot vibe-coding workflow */
export const COPILOT_DEFAULT_BINDINGS: BindingMap = {
  ...CLAUDE_CODE_DEFAULT_BINDINGS,
  // Copilot-specific overrides can be added here
}
