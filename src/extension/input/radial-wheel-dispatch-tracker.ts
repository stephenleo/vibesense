// src/extension/input/radial-wheel-dispatch-tracker.ts
// Tracks per-segment dispatch counts in ExtensionContext.globalState (Story 7.4)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { LabelMode } from '../../shared/types'

/**
 * Tracks how many times each R2 Personal Wheel segment has been dispatched.
 * Counts are persisted in ExtensionContext.globalState (cross-session, per-device).
 * Key pattern: vibesense.r2DispatchCount.${segmentIndex}
 *
 * Used to compute the label fading progression:
 *   0–4 dispatches  → 'full'
 *   5–14 dispatches → 'abbreviated'
 *   15+ dispatches  → 'icon-only'
 */
/* eslint-disable @typescript-eslint/naming-convention */
const KEY_PREFIX = 'vibesense.r2DispatchCount.'
/* eslint-enable @typescript-eslint/naming-convention */

export class RadialWheelDispatchTracker {
  constructor(private readonly globalState: vscode.Memento) {}

  /** Returns the dispatch count for a segment index (0–7). Never throws. */
  getCount(segmentIndex: number): number {
    return this.globalState.get<number>(`${KEY_PREFIX}${segmentIndex}`) ?? 0
  }

  /** Increments the dispatch count for a segment. Never throws (NFR-R1). */
  async increment(segmentIndex: number): Promise<void> {
    try {
      const current = this.getCount(segmentIndex)
      await this.globalState.update(`${KEY_PREFIX}${segmentIndex}`, current + 1)
    } catch (err) {
      logger.error('RadialWheelDispatchTracker: failed to increment count', err)
    }
  }

  /** Computes LabelMode based on dispatch count and forceIconOnly setting. */
  computeLabelMode(segmentIndex: number, forceIconOnly: boolean): LabelMode {
    if (forceIconOnly) return 'icon-only'
    const count = this.getCount(segmentIndex)
    if (count >= 15) return 'icon-only'
    if (count >= 5) return 'abbreviated'
    return 'full'
  }
}
