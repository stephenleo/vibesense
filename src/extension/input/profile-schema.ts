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
    y: 'workbench.action.terminal.focus',
    lt: 'vibesense.openRadialWheel',
    lb: 'vibesense.switchSessionPrev',
    rb: 'vibesense.switchSessionNext',
    menu: 'vibesense.openSettings',
  },
  radialWheel: {
    segments: [
      'vibesense.approve',
      'vibesense.deny',
      'vibesense.switchSessionNext',
      'vibesense.switchSessionPrev',
      'workbench.action.terminal.focus',
      'workbench.action.terminal.scrollUp',
      'workbench.action.terminal.scrollDown',
      'vibesense.openSettings',
    ],
  },
}
