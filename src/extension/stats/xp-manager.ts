// src/extension/stats/xp-manager.ts
// XP, level, and daily streak management for gamified controller usage stats (Story 9.3)
// FR53: XP, levels, streaks

import * as vscode from 'vscode'
import { EventEmitter } from 'events'
import { logger } from '../logger'
import { XpRecordSchema } from './session-record-schema'
import type { SessionRecord, XpRecord } from '../../shared/types'
import {
  XP_KEY,
  XP_CONTROLLER_ONLY,
  XP_HIGH_RATIO,
  XP_MULTI_FEATURE,
  XP_STREAK_PER_DAY,
  HIGH_RATIO_THRESHOLD,
  MULTI_FEATURE_MIN_COUNT,
  LEVEL_2_XP_THRESHOLD,
} from '../../shared/constants'

/** Default XpRecord for a brand-new user */
const DEFAULT_XP_RECORD: XpRecord = {
  totalXp: 0,
  level: 1,
  streakDays: 0,
  lastSessionDate: null,
}

/** Level-up event payload */
export interface LevelUpEvent {
  previousLevel: number
  newLevel: number
  totalXp: number
}

/**
 * Manages XP accumulation, level progression, and daily usage streaks (Story 9.3).
 *
 * Extends EventEmitter — emits 'levelUp' with a {@link LevelUpEvent} payload when the user
 * crosses a level threshold. Story 9.5 (AchievementBurst) subscribes to this event.
 *
 * All methods are try/catch wrapped — never throw (NFR-R1).
 */
export class XpManager extends EventEmitter {
  constructor(private readonly globalState: vscode.Memento) {
    super()
  }

  /**
   * Load the current XpRecord from globalState.
   * Returns defaults if absent or corrupted.
   * Never throws (NFR-R1).
   */
  load(): XpRecord {
    try {
      const raw = this.globalState.get<unknown>(XP_KEY)
      if (raw === undefined || raw === null) return { ...DEFAULT_XP_RECORD }
      const parseResult = XpRecordSchema.safeParse(raw)
      if (!parseResult.success) {
        logger.warn('XpManager: corrupted XP record in globalState — resetting to defaults')
        return { ...DEFAULT_XP_RECORD }
      }
      return parseResult.data as XpRecord
    } catch (err) {
      logger.error('XpManager: load() failed', err)
      return { ...DEFAULT_XP_RECORD }
    }
  }

  /**
   * Compute the level for a given total XP.
   *
   * Level 1: 0 – 499 XP
   * Level 2: 500 – 999 XP  (threshold = LEVEL_2_XP_THRESHOLD = 500)
   * Level 3: 1000 – 1999 XP (threshold = 1000)
   * Level 4: 2000 – 3999 XP (threshold = 2000)
   * ...each subsequent threshold doubles.
   */
  static computeLevelForXp(xp: number): number {
    if (xp < LEVEL_2_XP_THRESHOLD) return 1
    let level = 2
    let threshold = LEVEL_2_XP_THRESHOLD
    while (xp >= threshold * 2) {
      threshold *= 2
      level++
    }
    return level
  }

  /**
   * Compute the UTC date string (YYYY-MM-DD) for a given epoch ms timestamp.
   * Exported for testability.
   */
  static toUtcDateString(epochMs: number): string {
    return new Date(epochMs).toISOString().slice(0, 10)
  }

  /**
   * Compute the updated streak given the previous last session date and the current session date.
   *
   * Rules:
   * - If lastSessionDate is null (first ever session): streakDays = 1
   * - If lastSessionDate == today: no change (already counted today)
   * - If lastSessionDate == yesterday: increment streak
   * - Otherwise: reset to 1
   */
  static computeStreak(currentStreakDays: number, lastSessionDate: string | null, today: string): number {
    if (lastSessionDate === null) return 1
    if (lastSessionDate === today) return currentStreakDays // already counted today
    const yesterday = XpManager.toUtcDateString(new Date(today).getTime() - 24 * 60 * 60 * 1000)
    if (lastSessionDate === yesterday) return currentStreakDays + 1
    return 1 // streak broken
  }

  /**
   * Award XP for a completed session.
   *
   * XP bonuses (stackable):
   * - +100 if controllerOnly (AC1)
   * - +50 if ratio >= HIGH_RATIO_THRESHOLD (AC2)
   * - +25 if distinctFeatureCount >= MULTI_FEATURE_MIN_COUNT (AC3)
   * - + streakDays × XP_STREAK_PER_DAY (AC4)
   *
   * Emits 'levelUp' event if the user crosses a level threshold (AC5).
   * Persists updated XpRecord to globalState (AC6).
   * Never throws (NFR-R1).
   */
  async awardSessionXp(sessionRecord: SessionRecord, distinctFeatureCount: number): Promise<void> {
    try {
      const current = this.load()
      const today = XpManager.toUtcDateString(sessionRecord.endedAt)

      // Compute updated streak
      const newStreakDays = XpManager.computeStreak(current.streakDays, current.lastSessionDate, today)

      // Compute XP earned this session
      let earned = 0
      if (sessionRecord.controllerOnly) {
        earned += XP_CONTROLLER_ONLY
        logger.info('XpManager: +100 XP (controller-only session)')
      }
      if (sessionRecord.ratio >= HIGH_RATIO_THRESHOLD) {
        earned += XP_HIGH_RATIO
        logger.info(`XpManager: +50 XP (high ratio ${sessionRecord.ratio.toFixed(2)})`)
      }
      if (distinctFeatureCount >= MULTI_FEATURE_MIN_COUNT) {
        earned += XP_MULTI_FEATURE
        logger.info(`XpManager: +25 XP (multi-feature: ${distinctFeatureCount} features)`)
      }
      earned += newStreakDays * XP_STREAK_PER_DAY
      logger.info(`XpManager: +${newStreakDays * XP_STREAK_PER_DAY} XP (streak ${newStreakDays} days)`)

      const newTotalXp = current.totalXp + earned
      const previousLevel = current.level
      const newLevel = XpManager.computeLevelForXp(newTotalXp)

      const updated: XpRecord = {
        totalXp: newTotalXp,
        level: newLevel,
        streakDays: newStreakDays,
        lastSessionDate: today,
      }

      await this.globalState.update(XP_KEY, updated)
      logger.info(
        `XpManager: session finalized — earned ${earned} XP, total ${newTotalXp} XP, level ${newLevel}, streak ${newStreakDays} days`,
      )

      // Emit level-up event if level increased (AC5)
      if (newLevel > previousLevel) {
        const payload: LevelUpEvent = { previousLevel, newLevel, totalXp: newTotalXp }
        this.emit('levelUp', payload)
        logger.info(`XpManager: level up! ${previousLevel} → ${newLevel}`)
      }
    } catch (err) {
      logger.error('XpManager: awardSessionXp() failed', err)
    }
  }
}
