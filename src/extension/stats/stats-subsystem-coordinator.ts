// src/extension/stats/stats-subsystem-coordinator.ts
// Coordinator that owns all stats subsystem components — extracted from extension.ts (Story 12.1)

import * as vscode from 'vscode'
import { EventEmitter } from 'events'
import { SessionRatioTracker, SESSION_HISTORY_KEY } from './session-ratio-tracker'
import { XpManager } from './xp-manager'
import { AchievementManager } from './achievement-manager'
import { SessionHealthManager } from './session-health-manager'
import { AchievementBurstPanelManager } from '../panels/achievement-burst-panel'
import { SessionHistorySchema } from './session-record-schema'
import { logger } from '../logger'
import type { SlidePanelManager } from '../panels/slide-panel-manager'
import type { ControllerType, SessionRecord } from '../../shared/types'
import type { AchievementUnlockedEvent } from './achievement-manager'
import type { LevelUpEvent } from './xp-manager'

export interface FinalizeSessionResult {
  sessionRecord: SessionRecord | undefined
  distinctFeatureNames: string[]
}

/**
 * Owns all stats subsystem components and their wiring (Story 12.1).
 *
 * Extends EventEmitter — re-emits 'achievementUnlocked' so extension.ts can subscribe
 * for hardware feedback (haptic + LED) which requires the currentDriver ref that only
 * extension.ts owns.
 *
 * Telemetry isolation: never imports from src/extension/telemetry/ (ESLint-enforced).
 * Hardware feedback isolation: never drives DualSense haptic/LED directly.
 */
export class StatsSubsystemCoordinator extends EventEmitter {
  private readonly ratioTracker: SessionRatioTracker
  private readonly xpManager: XpManager
  private readonly achievementManager: AchievementManager
  private readonly achievementBurstPanelManager: AchievementBurstPanelManager
  private readonly sessionHealthManager: SessionHealthManager

  constructor(
    context: vscode.ExtensionContext,
    slidePanelManager: SlidePanelManager,
  ) {
    super()
    this.ratioTracker = new SessionRatioTracker()
    this.xpManager = new XpManager(context.globalState)
    this.achievementManager = new AchievementManager(context.globalState)
    this.achievementBurstPanelManager = new AchievementBurstPanelManager(context)
    this.sessionHealthManager = new SessionHealthManager(slidePanelManager, this.ratioTracker, this.xpManager)

    // Push burst panel to context.subscriptions for dispose (AC4 pattern)
    context.subscriptions.push(this.achievementBurstPanelManager)

    // Wire xpManager → achievementManager (moved from extension.ts — AC2)
    this.xpManager.on('levelUp', (event: LevelUpEvent) => {
      logger.info(`VibeSense: level up! ${event.previousLevel} → ${event.newLevel} (${event.totalXp} XP)`)
      this.achievementManager.checkAndUnlockForLevelUp(event.newLevel).catch((err: unknown) => {
        logger.error('StatsSubsystemCoordinator: checkAndUnlockForLevelUp failed', err)
      })
    })

    // Wire achievementManager → burst panel + re-emit for hardware feedback (AC6)
    this.achievementManager.on('achievementUnlocked', (event: AchievementUnlockedEvent) => {
      try {
        this.achievementBurstPanelManager.show(event.id, event.label, event.tier, event.description)
        this.emit('achievementUnlocked', event)
      } catch (err) {
        logger.error('StatsSubsystemCoordinator: achievementUnlocked handler failed', err)
      }
    })
  }

  /** Start the SessionHealthManager polling loop (AC4). */
  start(): void {
    this.sessionHealthManager.start()
  }

  /** Dispose all managed resources (AC4). */
  dispose(): void {
    this.sessionHealthManager.dispose()
    this.achievementManager.removeAllListeners()
    this.removeAllListeners()
  }

  /** Proxy notifyConnected to SessionHealthManager (AC5). */
  notifyConnected(connected: boolean): void {
    this.sessionHealthManager.notifyConnected(connected)
  }

  /** Expose underlying SessionRatioTracker for InputRouter and RadialWheelController (Dev Notes). */
  getRatioTracker(): SessionRatioTracker {
    return this.ratioTracker
  }

  recordKeyboardAction(): void {
    this.ratioTracker.recordKeyboardAction()
  }

  recordControllerAction(): void {
    this.ratioTracker.recordControllerAction()
  }

  recordFeatureUsed(feature: string): void {
    this.ratioTracker.recordFeatureUsed(feature)
  }

  getDistinctFeatureCount(): number {
    return this.ratioTracker.getDistinctFeatureCount()
  }

  getDistinctFeatureNames(): string[] {
    return this.ratioTracker.getDistinctFeatureNames()
  }

  /**
   * Finalize the session: run ratio→XP→achievement chain.
   * Returns { sessionRecord, distinctFeatureNames } so extension.ts can pass them to
   * telemetryCollector.collectSession() without importing from telemetry/ (AC3).
   * Never throws (NFR-R1).
   */
  async finalizeSession(
    globalState: vscode.Memento,
    controllerType: ControllerType | null,
  ): Promise<FinalizeSessionResult> {
    // Capture feature names before ratioTracker state is cleared
    const distinctFeatureNames = this.getDistinctFeatureNames()
    const distinctFeatureCount = this.getDistinctFeatureCount()
    // controllerType param reserved for future coordinator-level telemetry hints
    void controllerType
    await this.ratioTracker.finalizeSession(globalState)
    try {
      const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
      const parseResult = SessionHistorySchema.safeParse(raw ?? [])
      const history = parseResult.success ? parseResult.data : []
      const latest = history.length > 0 ? history[history.length - 1] : undefined
      if (latest !== undefined) {
        await this.xpManager.awardSessionXp(latest, distinctFeatureCount)
        await this.achievementManager.checkAndUnlockForSession(latest, this.xpManager.load())
        return { sessionRecord: latest, distinctFeatureNames }
      }
    } catch (err) {
      logger.error('StatsSubsystemCoordinator: finalizeSession failed', err)
    }
    return { sessionRecord: undefined, distinctFeatureNames }
  }
}
