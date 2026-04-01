// src/extension/stats/achievement-manager.ts
// Achievement unlock logic and persistence for the gamification system (Story 9.5)
// Extension-host-only — do NOT import from webview code.

import * as vscode from 'vscode'
import { EventEmitter } from 'events'
import { logger } from '../logger'
import { AchievementsStoreSchema } from './session-record-schema'
import { ACHIEVEMENT_DEFINITIONS } from './achievement-definitions'
import { ACHIEVEMENT_KEY } from '../../shared/constants'
import { SessionHistorySchema } from './session-record-schema'
import { SESSION_HISTORY_KEY } from './session-ratio-tracker'
import type { AchievementRecord, SessionRecord, XpRecord } from '../../shared/types'

/** Payload emitted with the 'achievementUnlocked' event */
export interface AchievementUnlockedEvent {
  id: string
  label: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
  description: string
}

/**
 * Manages achievement unlock logic, persistence, and event emission (Story 9.5).
 *
 * Extends EventEmitter — emits 'achievementUnlocked' with an {@link AchievementUnlockedEvent}
 * payload when a new achievement is unlocked. extension.ts subscribes to fire AchievementBurst.
 *
 * All methods are try/catch wrapped — never throw (NFR-R1).
 */
export class AchievementManager extends EventEmitter {
  constructor(private readonly globalState: vscode.Memento) {
    super()
  }

  /**
   * Load the current achievements store from globalState.
   * Returns empty array if absent or corrupted.
   * Never throws (NFR-R1).
   */
  load(): AchievementRecord[] {
    try {
      const raw = this.globalState.get<unknown>(ACHIEVEMENT_KEY)
      if (raw === undefined || raw === null) return []
      const parseResult = AchievementsStoreSchema.safeParse(raw)
      if (!parseResult.success) {
        logger.warn('AchievementManager: corrupted achievements store in globalState — returning empty')
        return []
      }
      return parseResult.data as AchievementRecord[]
    } catch (err) {
      logger.error('AchievementManager: load() failed', err)
      return []
    }
  }

  /**
   * Returns true if the achievement with the given id has been unlocked.
   * An achievement is unlocked when its `unlockedAt` is not null.
   */
  isUnlocked(id: string): boolean {
    const store = this.load()
    const record = store.find((r) => r.id === id)
    return record !== undefined && record.unlockedAt !== null
  }

  /**
   * Unlock an achievement by id.
   * Returns true if newly unlocked, false if already unlocked (idempotent — AC2).
   * Persists updated store to globalState.
   * Emits 'achievementUnlocked' event if newly unlocked.
   * Never throws (NFR-R1).
   */
  async unlock(id: string): Promise<boolean> {
    try {
      if (this.isUnlocked(id)) {
        return false  // already unlocked — idempotent (AC2)
      }

      const definition = ACHIEVEMENT_DEFINITIONS.find((def) => def.id === id)
      if (!definition) {
        logger.warn(`AchievementManager: unknown achievement id "${id}"`)
        return false
      }

      const store = this.load()
      const existingIndex = store.findIndex((r) => r.id === id)
      const now = Date.now()

      if (existingIndex >= 0) {
        store[existingIndex] = { id, unlockedAt: now }
      } else {
        store.push({ id, unlockedAt: now })
      }

      await this.globalState.update(ACHIEVEMENT_KEY, store)
      logger.info(`AchievementManager: unlocked achievement "${id}" (${definition.tier})`)

      const payload: AchievementUnlockedEvent = {
        id: definition.id,
        label: definition.label,
        tier: definition.tier,
        description: definition.description,
      }
      this.emit('achievementUnlocked', payload)

      return true
    } catch (err) {
      logger.error('AchievementManager: unlock() failed', err)
      return false
    }
  }

  /**
   * Evaluate and unlock session-triggered achievements.
   * Called after a session is finalized (extension.ts dispose handler).
   * Never throws (NFR-R1).
   */
  async checkAndUnlockForSession(sessionRecord: SessionRecord, xpRecord: XpRecord): Promise<void> {
    try {
      // 'first-steps': first controller-only session
      if (sessionRecord.controllerOnly) {
        await this.unlock('first-steps')
      }

      // 'sessions-10': total controller-only sessions reaches 10
      // Load history to count (defensive parse, same pattern as extension.ts)
      try {
        const raw = this.globalState.get<unknown>(SESSION_HISTORY_KEY)
        const parseResult = SessionHistorySchema.safeParse(raw ?? [])
        const history = parseResult.success ? parseResult.data : []
        const controllerOnlyCount = history.filter((s) => s.controllerOnly).length
        if (controllerOnlyCount >= 10) {
          await this.unlock('sessions-10')
        }
      } catch (err) {
        logger.error('AchievementManager: sessions-10 check failed', err)
      }

      // Streak-based achievements
      if (xpRecord.streakDays >= 3) {
        await this.unlock('streak-3')
      }
      if (xpRecord.streakDays >= 7) {
        await this.unlock('streak-7')
      }
    } catch (err) {
      logger.error('AchievementManager: checkAndUnlockForSession() failed', err)
    }
  }

  /**
   * Evaluate and unlock level-based achievements.
   * Called when XpManager emits 'levelUp'.
   * Never throws (NFR-R1).
   */
  async checkAndUnlockForLevelUp(newLevel: number): Promise<void> {
    try {
      if (newLevel >= 2) {
        await this.unlock('level-2')
      }
      if (newLevel >= 5) {
        await this.unlock('level-5')
      }
    } catch (err) {
      logger.error('AchievementManager: checkAndUnlockForLevelUp() failed', err)
    }
  }
}
