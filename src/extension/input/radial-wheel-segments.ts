// src/extension/input/radial-wheel-segments.ts
// L2 Smart Wheel default segment definitions (Story 7.1)
// 8 evenly-spaced segments, segment 0 at top, clockwise

import type { WheelSegmentDef } from '../../shared/types'

/**
 * Default L2 Smart Wheel segments.
 * Index 0 = top, increasing clockwise.
 * Segments 4–6 dispatch prompts via vibesense.dispatchPrompt.
 */
export const L2_SMART_WHEEL_SEGMENTS: WheelSegmentDef[] = [
  {
    index: 0,
    label: 'Voice PTT',
    commandId: 'vibesense.voicePtt',
  },
  {
    index: 1,
    label: 'Approve',
    commandId: 'vibesense.approve',
  },
  {
    index: 2,
    label: 'New Terminal',
    commandId: 'vibesense.openTerminal',
  },
  {
    index: 3,
    label: 'Launch Agent',
    commandId: 'vibesense.launchClaudeCode',
  },
  {
    index: 4,
    label: 'Explain This',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Explain the selected code',
  },
  {
    index: 5,
    label: 'Fix This',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Fix the issue in the selected code',
  },
  {
    index: 6,
    label: 'Add Tests',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Add unit tests for the selected code',
  },
  {
    index: 7,
    label: 'Deny',
    commandId: 'vibesense.deny',
  },
]
