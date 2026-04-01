// src/extension/output/dnd-controller.ts
// Reads DND configuration from VSCode Settings and exposes isDndSuppressed() callback
// Used by HapticController, LedController, AudioController

import * as vscode from 'vscode'
import type { FeedbackPriority } from '../../shared/types'
import { logger } from '../logger'

const PRIORITY_ORDER: Record<FeedbackPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
}

/**
 * DndController reads Do Not Disturb configuration from VSCode Settings.
 * - `vibesense.dndEnabled` (boolean, default: false)
 * - `vibesense.dndThreshold` ('low' | 'normal' | 'high', default: 'normal')
 *
 * `isDndSuppressed(priority)` returns true when DND is on AND the event's
 * priority is below the configured threshold.
 *
 * High-priority events (error state) always pass through — never suppressed.
 *
 * Config is read live on every call (no caching) so settings changes
 * take effect immediately for subsequent events (AC3).
 *
 * Stateless — no listeners, no dispose needed.
 */
export class DndController {
  /**
   * Returns true if feedback at `priority` level should be suppressed.
   * Reads config live on each call — no caching — so settings changes
   * take effect immediately for subsequent events (AC3).
   */
  isDndSuppressed(priority: FeedbackPriority): boolean {
    try {
      const config = vscode.workspace.getConfiguration('vibesense')
      const enabled = config.get<boolean>('dndEnabled', false)
      if (!enabled) {
        return false
      }
      const threshold = config.get<FeedbackPriority>('dndThreshold', 'normal')
      // Suppress if priority < threshold (exclusive — events AT threshold pass through)
      const result = PRIORITY_ORDER[priority] < PRIORITY_ORDER[threshold]
      if (result) {
        logger.info(`DndController: suppressing ${priority} feedback (threshold=${threshold})`)
      }
      return result
    } catch (err) {
      logger.error('DndController: failed to read config — defaulting to not suppressed', err)
      return false // fail open — never suppress due to config error
    }
  }

  /**
   * Convenience: returns a callback bound to a specific priority.
   * Usage: `new HapticController(sm, getHal, dndController.forPriority('normal'))`
   */
  forPriority(priority: FeedbackPriority): () => boolean {
    return () => this.isDndSuppressed(priority)
  }
}
