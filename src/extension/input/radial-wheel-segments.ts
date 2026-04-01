// src/extension/input/radial-wheel-segments.ts
// L2 Smart Wheel and R2 Personal Wheel default segment definitions (Story 7.1, 7.2)
// 8 evenly-spaced segments, segment 0 at top, clockwise
// Story 7.4: loadR2PersonalSegments — loads custom prompts from .vscode/vibesense.json

import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from '../logger'
import { VibeProfileSchema } from './profile-schema'
import type { WheelSegmentDef, LabelMode } from '../../shared/types'
import type { RadialWheelDispatchTracker } from './radial-wheel-dispatch-tracker'

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

/**
 * Default R2 Personal Wheel segments (Story 7.2).
 * Placeholder prompts — full customization is Story 7.4.
 * Index 0 = top, increasing clockwise.
 */
export const R2_PERSONAL_WHEEL_SEGMENTS: WheelSegmentDef[] = [
  {
    index: 0,
    label: 'Refactor',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Refactor the selected code for clarity and efficiency',
  },
  {
    index: 1,
    label: 'Summarize',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Summarize what this code does in plain English',
  },
  {
    index: 2,
    label: 'Document',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Add JSDoc comments to the selected code',
  },
  {
    index: 3,
    label: 'Optimize',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Optimize the selected code for performance',
  },
  {
    index: 4,
    label: 'Review',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Review the selected code for bugs and issues',
  },
  {
    index: 5,
    label: 'Simplify',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Simplify the selected code',
  },
  {
    index: 6,
    label: 'Convert',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Convert the selected code to TypeScript with strict types',
  },
  {
    index: 7,
    label: 'Git Commit',
    commandId: 'vibesense.dispatchPrompt',
    promptText: 'Write a concise conventional commit message for my changes',
  },
]

// ─── Story 7.4: Dynamic segment loader with label fading ─────────────────────

/**
 * Loads R2 Personal Wheel segments from .vscode/vibesense.json.
 * Falls back to R2_PERSONAL_WHEEL_SEGMENTS defaults on any error (NFR-R1).
 * Applies label fading via dispatchTracker + forceIconOnly setting.
 */
export function loadR2PersonalSegments(
  workspaceRoot: string,
  dispatchTracker: RadialWheelDispatchTracker,
  forceIconOnly: boolean,
): WheelSegmentDef[] {
  const profilePath = path.join(workspaceRoot, '.vscode', 'vibesense.json')
  let customPrompts: string[] = []

  try {
    const raw = fs.readFileSync(profilePath, 'utf-8')
    const json: unknown = JSON.parse(raw)
    const result = VibeProfileSchema.safeParse(json)
    if (result.success && result.data.radialWheel?.segments) {
      customPrompts = result.data.radialWheel.segments
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('loadR2PersonalSegments: error reading vibesense.json — using defaults', err)
    }
  }

  return R2_PERSONAL_WHEEL_SEGMENTS.map((defaultSeg, i) => {
    const promptText = customPrompts[i] ?? defaultSeg.promptText ?? defaultSeg.label
    const labelMode = dispatchTracker.computeLabelMode(i, forceIconOnly)
    const label = computeDisplayLabel(promptText, labelMode, i)
    return {
      ...defaultSeg,
      label,
      promptText,   // always full for ARIA + preview
      labelMode,
    }
  })
}

/** Derives display label from full prompt text + fading mode. */
function computeDisplayLabel(promptText: string, mode: LabelMode, index: number): string {
  if (mode === 'icon-only') return `${index + 1}`  // "1"–"8" digit as icon
  if (mode === 'abbreviated') {
    // First word of prompt text, max 8 chars
    const firstWord = promptText.split(' ')[0] ?? promptText
    return firstWord.slice(0, 8)
  }
  return promptText  // full text (up to WheelSegment component to truncate via CSS)
}
