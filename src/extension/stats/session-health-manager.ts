// src/extension/stats/session-health-manager.ts
// Polls live session stats every second and pushes SESSION_HEALTH_UPDATE to the SlidePanel (Story 9.4)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { SlidePanelManager } from '../panels/slide-panel-manager'
import type { SessionRatioTracker } from './session-ratio-tracker'
import type { XpManager } from './xp-manager'
import {
  XP_CONTROLLER_ONLY,
  XP_HIGH_RATIO,
  XP_MULTI_FEATURE,
  XP_STREAK_PER_DAY,
  HIGH_RATIO_THRESHOLD,
  MULTI_FEATURE_MIN_COUNT,
} from '../../shared/constants'

const HEALTH_UPDATE_INTERVAL_MS = 1000

export class SessionHealthManager implements vscode.Disposable {
  private timer: ReturnType<typeof setInterval> | undefined
  private connected = false

  constructor(
    private readonly slidePanelManager: SlidePanelManager,
    private readonly ratioTracker: SessionRatioTracker,
    private readonly xpManager: XpManager,
  ) {}

  /** Start the 1s polling loop. */
  start(): void {
    this.timer = setInterval(() => {
      this.pushUpdate()
    }, HEALTH_UPDATE_INTERVAL_MS)
  }

  /**
   * Compute and push the current health update to the SlidePanel.
   * All errors are swallowed — never throws (NFR-R1).
   */
  pushUpdate(): void {
    try {
      const stats = this.ratioTracker.getCurrentStats()
      const durationMs = Date.now() - this.ratioTracker.getSessionStartTime()
      const featureCount = this.ratioTracker.getDistinctFeatureCount()

      // Read-only XP preview (same logic as XpManager.awardSessionXp but non-mutating)
      const xpRecord = this.xpManager.load()
      let sessionXp = 0
      if (stats.keyboardActions === 0 && (stats.controllerActions + stats.keyboardActions) > 0) {
        sessionXp += XP_CONTROLLER_ONLY  // +100 for controller-only session
      }
      if (stats.ratio >= HIGH_RATIO_THRESHOLD) {
        sessionXp += XP_HIGH_RATIO  // +50 for high ratio
      }
      if (featureCount >= MULTI_FEATURE_MIN_COUNT) {
        sessionXp += XP_MULTI_FEATURE  // +25 for multi-feature usage
      }
      sessionXp += xpRecord.streakDays * XP_STREAK_PER_DAY  // streak bonus

      this.slidePanelManager.notifyHealthUpdate(
        stats.ratio,
        durationMs,
        sessionXp,
        this.connected,
      )
    } catch (err) {
      logger.error('SessionHealthManager: pushUpdate() failed', err)
    }
  }

  /**
   * Update the connected state and immediately push an update.
   * Called when a controller connects or disconnects.
   */
  notifyConnected(connected: boolean): void {
    this.connected = connected
    this.pushUpdate()
  }

  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  dispose(): void {
    this.stop()
  }
}
