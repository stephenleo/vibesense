// src/extension/panels/game-high-score-store.ts
// Persists mini-game high scores in ExtensionContext.globalState (Story 8.4, FR33)
// Pattern: mirrors RadialWheelDispatchTracker — globalState.get with default 0, update with try/catch

import * as vscode from 'vscode'
import { logger } from '../logger'

const KEYS = {
  snake: 'vibesense.gameHighScore.snake',
  tetris: 'vibesense.gameHighScore.tetris',
} as const

export type GameType = 'snake' | 'tetris'

export class GameHighScoreStore {
  constructor(private readonly globalState: vscode.Memento) {}

  /** Returns stored high score for the given game. Returns 0 if never set. Never throws. */
  getHighScore(game: GameType): number {
    return this.globalState.get<number>(KEYS[game]) ?? 0
  }

  /**
   * Persists a new high score for the given game if score > current stored value.
   * Only writes if score exceeds current high score (idempotent on re-open).
   * Never throws (NFR-R1).
   */
  async updateHighScore(game: GameType, score: number): Promise<void> {
    try {
      const current = this.getHighScore(game)
      if (score > current) {
        await this.globalState.update(KEYS[game], score)
        logger.info(`GameHighScoreStore: new ${game} high score: ${score}`)
      }
    } catch (err) {
      logger.error('GameHighScoreStore: failed to persist high score', err)
    }
  }
}
