// src/extension/stats/session-ratio-tracker.ts
// Tracks controller vs keyboard action ratio per session, persists to globalState (Story 9.1)

import * as vscode from 'vscode'
import { logger } from '../logger'
import { SessionHistorySchema } from './session-record-schema'
import type { SessionRecord } from '../../shared/types'

export const SESSION_HISTORY_KEY = 'vibesense.sessionHistory'
const MAX_SESSION_HISTORY = 100
const KEYBOARD_DEBOUNCE_MS = 500

export class SessionRatioTracker {
  private controllerActions = 0
  private keyboardActions = 0
  private readonly sessionId: string
  private readonly startedAt: number
  private finalized = false       // guard: finalize only once
  private keyboardDebounceTimer: ReturnType<typeof setTimeout> | undefined
  private pendingKeyboardIncrement = false
  /** Distinct VibeSense features used this session (Story 9.3 — AC3 multi-feature XP bonus) */
  private featuresUsed = new Set<string>()

  constructor() {
    this.startedAt = Date.now()
    this.sessionId = `session-${this.startedAt}`
  }

  /** Hot path — synchronous. Called from InputRouter on every dispatched button press. */
  recordControllerAction(): void {
    this.controllerActions++
  }

  /**
   * Record that a distinct VibeSense feature was used this session (Story 9.3 — AC3).
   * Deduplicates by feature name — calling multiple times with the same feature is a no-op.
   * Hot path — synchronous.
   */
  recordFeatureUsed(feature: string): void {
    this.featuresUsed.add(feature)
  }

  /** Returns the number of distinct VibeSense features used this session (Story 9.3 — AC3). */
  getDistinctFeatureCount(): number {
    return this.featuresUsed.size
  }

  /** Debounced keyboard action. Called from onDidChangeTextDocument handler. */
  recordKeyboardAction(): void {
    if (this.pendingKeyboardIncrement) return
    this.pendingKeyboardIncrement = true
    if (this.keyboardDebounceTimer !== undefined) {
      clearTimeout(this.keyboardDebounceTimer)
    }
    this.keyboardDebounceTimer = setTimeout(() => {
      this.keyboardActions++
      this.pendingKeyboardIncrement = false
      this.keyboardDebounceTimer = undefined
    }, KEYBOARD_DEBOUNCE_MS)
  }

  /** Finalize session, persist record to globalState. Idempotent (no-op if already finalized). */
  async finalizeSession(globalState: vscode.Memento): Promise<void> {
    if (this.finalized) return
    this.finalized = true
    if (this.keyboardDebounceTimer !== undefined) {
      clearTimeout(this.keyboardDebounceTimer)
      // Flush pending increment immediately
      if (this.pendingKeyboardIncrement) {
        this.keyboardActions++
        this.pendingKeyboardIncrement = false
      }
      this.keyboardDebounceTimer = undefined
    }
    const totalActions = this.controllerActions + this.keyboardActions
    const record: SessionRecord = {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      endedAt: Date.now(),
      controllerActions: this.controllerActions,
      keyboardActions: this.keyboardActions,
      ratio: totalActions === 0 ? 1.0 : this.controllerActions / totalActions,
      controllerOnly: this.keyboardActions === 0,
    }
    try {
      const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
      // Defensively parse existing history to handle corrupted data
      const parseResult = SessionHistorySchema.safeParse(raw ?? [])
      const existing: SessionRecord[] = parseResult.success ? parseResult.data : []
      const updated = [...existing, record]
      // Keep only the last MAX_SESSION_HISTORY entries (sliding window)
      const trimmed = updated.length > MAX_SESSION_HISTORY
        ? updated.slice(updated.length - MAX_SESSION_HISTORY)
        : updated
      await globalState.update(SESSION_HISTORY_KEY, trimmed)
      logger.info(
        `SessionRatioTracker: session "${record.sessionId}" finalized — ratio: ${record.ratio.toFixed(2)}, controllerOnly: ${record.controllerOnly}`,
      )
    } catch (err) {
      logger.error('SessionRatioTracker: failed to persist session record', err)
    }
  }

  /** Get current in-memory stats (for live display — Story 9.4 forward compatibility). */
  getCurrentStats(): { controllerActions: number; keyboardActions: number; ratio: number } {
    const total = this.controllerActions + this.keyboardActions
    return {
      controllerActions: this.controllerActions,
      keyboardActions: this.keyboardActions,
      ratio: total === 0 ? 1.0 : this.controllerActions / total,
    }
  }

  /** Reset in-memory counters. Preferred pattern: create a new instance for each session. */
  reset(): void {
    this.controllerActions = 0
    this.keyboardActions = 0
    this.finalized = false
    if (this.keyboardDebounceTimer !== undefined) {
      clearTimeout(this.keyboardDebounceTimer)
      this.keyboardDebounceTimer = undefined
    }
    this.pendingKeyboardIncrement = false
    this.featuresUsed.clear()
  }
}
