// src/extension/input/profile-schema.ts
// Authoritative Zod schema for .vscode/vibesense.json — no VSCode imports, fully unit-testable

import { z } from 'zod'

export const VibeProfileSchema = z.object({
  profile: z.string().optional(),
  bindings: z.record(z.string(), z.string().min(1)).optional(),
  radialWheel: z
    .object({
      segments: z.array(z.string()),
    })
    .optional(),
})

export type VibeProfile = z.infer<typeof VibeProfileSchema>

export const CLAUDE_CODE_DEFAULT_PROFILE: VibeProfile = {
  profile: 'claude-code-default',
  bindings: {
    cross: 'vibesense.approve',
    circle: 'vibesense.deny',
    square: 'vibesense.openTerminal', // Story 3.1: DualSense □ = new terminal
    l2: 'vibesense.openRadialWheel',
    l1: 'vibesense.switchSessionPrev',
    r1: 'vibesense.switchSessionNext',
    options: 'vibesense.openSettings',
    triangle: 'workbench.action.terminal.focus',
    up: 'workbench.action.terminal.scrollUp',
    down: 'workbench.action.terminal.scrollDown',
    left: 'workbench.action.navigateBack',
    right: 'workbench.action.navigateForward',
    a: 'vibesense.approve',
    b: 'vibesense.deny',
    x: 'vibesense.openTerminal', // Story 3.1: Xbox X = new terminal
    y: 'workbench.action.terminal.focus',
    lt: 'vibesense.openRadialWheel',
    lb: 'vibesense.switchSessionPrev',
    rb: 'vibesense.switchSessionNext',
    menu: 'vibesense.openSettings',
  },
  // Note: radialWheel.segments is intentionally absent — R2 Personal Wheel uses
  // R2_PERSONAL_WHEEL_SEGMENTS defaults until the user adds their own prompt strings.
  // (Story 7.4: segments must be human-readable prompt text, not command IDs)
}
