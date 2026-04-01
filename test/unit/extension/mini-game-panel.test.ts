// test/unit/extension/mini-game-panel.test.ts
// Unit tests for MiniGamePanelManager pauseGame() and resumeGame() — Story 8.2 (FR31, FR32, AC1–AC4)
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  let disposeListener: (() => void) | undefined
  let msgListener: ((raw: unknown) => void) | undefined
  const postedMessages: unknown[] = []

  return {
    postedMessages,
    setDisposeListener: (l: () => void) => {
      disposeListener = l
    },
    getDisposeListener: () => disposeListener,
    setMsgListener: (l: (raw: unknown) => void) => {
      msgListener = l
    },
    getMsgListener: () => msgListener,
    panelDispose: vi.fn(),
    postMessage: vi.fn((msg: unknown) => {
      postedMessages.push(msg)
      return Promise.resolve(true)
    }),
    onDidReceiveMessage: vi.fn((listener: (raw: unknown) => void) => {
      msgListener = listener
      return { dispose: vi.fn() }
    }),
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn(),
    loggerError: vi.fn(),
    loggerDebug: vi.fn(),
  }
})

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => {
  return {
    window: {
      createWebviewPanel: vi.fn(() => {
        const panel = {
          webview: {
            html: '',
            postMessage: mockState.postMessage,
            asWebviewUri: vi.fn((uri: unknown) => uri),
            onDidReceiveMessage: mockState.onDidReceiveMessage,
          },
          onDidDispose: vi.fn((listener: () => void) => {
            mockState.setDisposeListener(listener)
            return { dispose: vi.fn() }
          }),
          dispose: mockState.panelDispose,
          reveal: vi.fn(),
        }
        return panel
      }),
    },
    Uri: {
      joinPath: vi.fn((..._args: unknown[]) => 'mock-uri'),
    },
    ViewColumn: {
      Two: 2,
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn().mockReturnValue(5),
      })),
    },
  }
})

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockState.loggerInfo(...args),
    warn: (...args: unknown[]) => mockState.loggerWarn(...args),
    error: (...args: unknown[]) => mockState.loggerError(...args),
    debug: (...args: unknown[]) => mockState.loggerDebug(...args),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { MiniGamePanelManager } from '../../../src/extension/panels/mini-game-panel'
import { GameHighScoreStore } from '../../../src/extension/panels/game-high-score-store'
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(): vscode.ExtensionContext {
  return {
    extensionUri: 'mock-extension-uri' as unknown as vscode.Uri,
    subscriptions: [],
  } as unknown as vscode.ExtensionContext
}

function makeGlobalState(initialValues: Record<string, unknown> = {}): vscode.Memento {
  const store = new Map<string, unknown>(Object.entries(initialValues))
  return {
    get: <T>(key: string, defaultValue?: T): T => (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento
}

function makeHighScoreStore(initialValues: Record<string, unknown> = {}): GameHighScoreStore {
  const globalState = makeGlobalState(initialValues)
  return new GameHighScoreStore(globalState)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MiniGamePanelManager — pauseGame() / resumeGame() (Story 8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.postedMessages.length = 0
  })

  // ── Test 1: pauseGame() no-op when panel not open (AC3) ──────────────────
  it('pauseGame() is a no-op when panel is not open — postMessage NOT called (AC3)', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.pauseGame()

    expect(mockState.postMessage).not.toHaveBeenCalled()
  })

  // ── Test 2: pauseGame() sends GAME_PAUSE when panel open (AC1) ───────────
  it('pauseGame() sends GAME_PAUSE message to webview when panel is open (AC1)', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.open()
    mockState.postedMessages.length = 0 // clear GAME_START from open()

    manager.pauseGame()

    const pauseMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_PAUSE',
    )
    expect(pauseMsg).toBeDefined()
    expect(pauseMsg).toEqual({ type: 'GAME_PAUSE', payload: {} })
  })

  // ── Test 3: resumeGame() no-op when panel not open ───────────────────────
  it('resumeGame() is a no-op when panel is not open — postMessage NOT called', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.resumeGame()

    expect(mockState.postMessage).not.toHaveBeenCalled()
  })

  // ── Test 4: resumeGame() sends GAME_RESUME when panel open (AC2) ─────────
  it('resumeGame() sends GAME_RESUME message to webview when panel is open (AC2)', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.open()
    mockState.postedMessages.length = 0 // clear GAME_START from open()

    manager.resumeGame()

    const resumeMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_RESUME',
    )
    expect(resumeMsg).toBeDefined()
    expect(resumeMsg).toEqual({ type: 'GAME_RESUME', payload: {} })
  })

  // ── Test 5: cancelCountdown() + pauseGame() after countdown start (AC4) ──
  it('cancelCountdown() clears timer AND pauseGame() sends GAME_PAUSE after countdown started (AC4)', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.open()
    mockState.postedMessages.length = 0 // clear GAME_START

    // Start a countdown then immediately cancel it and pause
    manager.startCountdown()
    manager.cancelCountdown()
    manager.pauseGame()

    const pauseMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_PAUSE',
    )
    expect(pauseMsg).toBeDefined()
    expect(pauseMsg).toEqual({ type: 'GAME_PAUSE', payload: {} })
    // logger.info should have been called for countdown cancelled and game paused
    expect(mockState.loggerInfo).toHaveBeenCalledWith('MiniGamePanelManager: countdown cancelled')
    expect(mockState.loggerInfo).toHaveBeenCalledWith('MiniGamePanelManager: game paused')
  })

  // ── Test 6: Panel disposed mid-game: pauseGame() is no-op (AC3) ──────────
  it('pauseGame() is a no-op after panel is disposed externally — no throw, no postMessage', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.open()
    mockState.postedMessages.length = 0 // clear GAME_START

    // Simulate external panel disposal (user closes the panel tab)
    const disposeListener = mockState.getDisposeListener()
    disposeListener?.()

    // Panel ref is now undefined — pauseGame() must be a no-op
    expect(() => {
      manager.pauseGame()
    }).not.toThrow()

    const pauseMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_PAUSE',
    )
    expect(pauseMsg).toBeUndefined()
  })

  // ── Test 7: Panel disposed mid-game: resumeGame() is no-op ────────────────
  it('resumeGame() is a no-op after panel is disposed externally — no throw, no postMessage', () => {
    const manager = new MiniGamePanelManager(makeContext(), makeHighScoreStore())

    manager.open()
    mockState.postedMessages.length = 0 // clear GAME_START

    // Simulate external panel disposal (user closes the panel tab)
    const disposeListener = mockState.getDisposeListener()
    disposeListener?.()

    // Panel ref is now undefined — resumeGame() must be a no-op
    expect(() => {
      manager.resumeGame()
    }).not.toThrow()

    const resumeMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_RESUME',
    )
    expect(resumeMsg).toBeUndefined()
  })
})

describe('MiniGamePanelManager — high score persistence (Story 8.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.postedMessages.length = 0
  })

  // ── Test 8: open() sends GAME_HIGH_SCORE after GAME_START (AC5) ─────────
  it('open() sends GAME_HIGH_SCORE message with stored scores after GAME_START (AC5)', () => {
    const store = makeHighScoreStore({
      'vibesense.gameHighScore.snake': 450,
      'vibesense.gameHighScore.tetris': 1200,
    })
    const manager = new MiniGamePanelManager(makeContext(), store)

    manager.open()

    const highScoreMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_HIGH_SCORE',
    )
    expect(highScoreMsg).toBeDefined()
    expect(highScoreMsg).toEqual({
      type: 'GAME_HIGH_SCORE',
      payload: { snake: 450, tetris: 1200 },
    })
  })

  // ── Test 9: open() sends GAME_HIGH_SCORE with zeros when globalState empty ─
  it('open() sends GAME_HIGH_SCORE with { snake: 0, tetris: 0 } when no scores stored (AC1)', () => {
    const store = makeHighScoreStore()
    const manager = new MiniGamePanelManager(makeContext(), store)

    manager.open()

    const highScoreMsg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'GAME_HIGH_SCORE',
    )
    expect(highScoreMsg).toBeDefined()
    expect(highScoreMsg).toEqual({
      type: 'GAME_HIGH_SCORE',
      payload: { snake: 0, tetris: 0 },
    })
  })

  // ── Test 10: GAME_SCORE_UPDATE from webview triggers store.updateHighScore ─
  it('GAME_SCORE_UPDATE webview message triggers high score persistence (AC6)', async () => {
    const globalState = makeGlobalState()
    const store = new GameHighScoreStore(globalState)
    const manager = new MiniGamePanelManager(makeContext(), store)

    manager.open()

    // Simulate webview sending a GAME_SCORE_UPDATE message
    const msgListener = mockState.getMsgListener()
    expect(msgListener).toBeDefined()
    msgListener?.({ type: 'GAME_SCORE_UPDATE', payload: { game: 'snake', score: 500 } })

    // Allow async persistence to run
    await Promise.resolve()

    expect(globalState.update).toHaveBeenCalledWith('vibesense.gameHighScore.snake', 500)
  })

  // ── Test 11: GAME_SCORE_UPDATE with unknown type is silently ignored ──────
  it('unknown webview message type is silently ignored without throwing (NFR-R1)', () => {
    const store = makeHighScoreStore()
    const manager = new MiniGamePanelManager(makeContext(), store)

    manager.open()

    const msgListener = mockState.getMsgListener()
    expect(() => {
      msgListener?.({ type: 'UNKNOWN_TYPE', payload: {} })
    }).not.toThrow()
  })

  // ── Test 12: GAME_HIGH_SCORE message is sent before pause messages (AC5) ──
  it('open() posts GAME_START, GAME_SET_MODE, and GAME_HIGH_SCORE in sequence', () => {
    const store = makeHighScoreStore()
    const manager = new MiniGamePanelManager(makeContext(), store)

    manager.open()

    const types = mockState.postedMessages.map((m) => (m as { type: string }).type)
    expect(types).toContain('GAME_START')
    expect(types).toContain('GAME_SET_MODE')
    expect(types).toContain('GAME_HIGH_SCORE')
    // GAME_HIGH_SCORE must come after GAME_START
    const startIdx = types.indexOf('GAME_START')
    const highScoreIdx = types.indexOf('GAME_HIGH_SCORE')
    expect(highScoreIdx).toBeGreaterThan(startIdx)
  })
})
