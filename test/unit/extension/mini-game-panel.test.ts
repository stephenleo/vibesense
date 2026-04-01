// test/unit/extension/mini-game-panel.test.ts
// Unit tests for MiniGamePanelManager pauseGame() and resumeGame() — Story 8.2 (FR31, FR32, AC1–AC4)
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  let disposeListener: (() => void) | undefined
  const postedMessages: unknown[] = []

  return {
    postedMessages,
    setDisposeListener: (l: () => void) => {
      disposeListener = l
    },
    getDisposeListener: () => disposeListener,
    panelDispose: vi.fn(),
    postMessage: vi.fn((msg: unknown) => {
      postedMessages.push(msg)
      return Promise.resolve(true)
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
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(): vscode.ExtensionContext {
  return {
    extensionUri: 'mock-extension-uri' as unknown as vscode.Uri,
    subscriptions: [],
  } as unknown as vscode.ExtensionContext
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MiniGamePanelManager — pauseGame() / resumeGame() (Story 8.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.postedMessages.length = 0
  })

  // ── Test 1: pauseGame() no-op when panel not open (AC3) ──────────────────
  it('pauseGame() is a no-op when panel is not open — postMessage NOT called (AC3)', () => {
    const manager = new MiniGamePanelManager(makeContext())

    manager.pauseGame()

    expect(mockState.postMessage).not.toHaveBeenCalled()
  })

  // ── Test 2: pauseGame() sends GAME_PAUSE when panel open (AC1) ───────────
  it('pauseGame() sends GAME_PAUSE message to webview when panel is open (AC1)', () => {
    const manager = new MiniGamePanelManager(makeContext())

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
    const manager = new MiniGamePanelManager(makeContext())

    manager.resumeGame()

    expect(mockState.postMessage).not.toHaveBeenCalled()
  })

  // ── Test 4: resumeGame() sends GAME_RESUME when panel open (AC2) ─────────
  it('resumeGame() sends GAME_RESUME message to webview when panel is open (AC2)', () => {
    const manager = new MiniGamePanelManager(makeContext())

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
    const manager = new MiniGamePanelManager(makeContext())

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
    const manager = new MiniGamePanelManager(makeContext())

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
})
