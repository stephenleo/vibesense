// test/unit/extension/game-high-score-store.test.ts
// Unit tests for GameHighScoreStore — Story 8.4 (FR33, AC1, AC2, AC6)
// All VSCode APIs mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { GameHighScoreStore } from '../../../src/extension/panels/game-high-score-store'
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(): vscode.Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T => (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento & { _store: Map<string, unknown> }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GameHighScoreStore — getHighScore() (AC1, Story 8.4)', () => {
  it('returns 0 for snake when globalState has no value', () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    expect(store.getHighScore('snake')).toBe(0)
  })

  it('returns 0 for tetris when globalState has no value', () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    expect(store.getHighScore('tetris')).toBe(0)
  })

  it('returns stored value for snake when key is set', () => {
    const globalState = makeGlobalState()
    globalState._store.set('vibesense.gameHighScore.snake', 450)
    const store = new GameHighScoreStore(globalState)
    expect(store.getHighScore('snake')).toBe(450)
  })

  it('returns stored value for tetris when key is set', () => {
    const globalState = makeGlobalState()
    globalState._store.set('vibesense.gameHighScore.tetris', 1200)
    const store = new GameHighScoreStore(globalState)
    expect(store.getHighScore('tetris')).toBe(1200)
  })
})

describe('GameHighScoreStore — updateHighScore() (AC1, AC2, AC6, Story 8.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists snake high score when new score exceeds stored value', async () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('snake', 300)
    expect(globalState.update).toHaveBeenCalledWith('vibesense.gameHighScore.snake', 300)
  })

  it('persists tetris high score when new score exceeds stored value', async () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('tetris', 800)
    expect(globalState.update).toHaveBeenCalledWith('vibesense.gameHighScore.tetris', 800)
  })

  it('does NOT overwrite snake high score when new score is lower', async () => {
    const globalState = makeGlobalState()
    globalState._store.set('vibesense.gameHighScore.snake', 500)
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('snake', 300)
    expect(globalState.update).not.toHaveBeenCalled()
  })

  it('does NOT overwrite tetris high score when new score is equal', async () => {
    const globalState = makeGlobalState()
    globalState._store.set('vibesense.gameHighScore.tetris', 400)
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('tetris', 400)
    expect(globalState.update).not.toHaveBeenCalled()
  })

  it('getHighScore reflects the updated value after updateHighScore', async () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('snake', 750)
    expect(store.getHighScore('snake')).toBe(750)
  })

  it('snake and tetris high scores are stored independently', async () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    await store.updateHighScore('snake', 200)
    await store.updateHighScore('tetris', 600)
    expect(store.getHighScore('snake')).toBe(200)
    expect(store.getHighScore('tetris')).toBe(600)
  })

  it('swallows errors from globalState.update without throwing (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('disk full'))
    const store = new GameHighScoreStore(globalState)
    await expect(store.updateHighScore('snake', 100)).resolves.toBeUndefined()
  })
})
