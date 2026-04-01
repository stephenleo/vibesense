// test/unit/extension/stats-panel.test.ts
// Unit tests for StatsPanelManager — Story 9.2 (FR42, FR43, AC1, AC2)
// All VSCode APIs mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock state (vi.hoisted ensures availability before vi.mock hoisting) ──────
const mockState = vi.hoisted(() => {
  const postMessage = vi.fn().mockResolvedValue(true)
  const webview = {
    postMessage,
    asWebviewUri: vi.fn((uri: unknown) => uri),
    get html() { return '' },
    set html(_val: string) { /* no-op */ },
  }
  const panel = {
    webview,
    reveal: vi.fn(),
    dispose: vi.fn(),
    onDidDispose: vi.fn(),
    get active() { return true },
  }
  return {
    panel,
    webview,
    postMessage,
    createWebviewPanel: vi.fn(() => panel),
    joinPath: vi.fn((_base: unknown, ...parts: string[]) => parts.join('/')),
    loggerError: vi.fn(),
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn(),
  }
})

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  window: {
    createWebviewPanel: (...args: unknown[]) => mockState.createWebviewPanel(...args),
  },
  Uri: {
    joinPath: (...args: unknown[]) => mockState.joinPath(...args),
  },
  ViewColumn: { One: 1, Two: 2 },
}))

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockState.loggerInfo(...args),
    warn: (...args: unknown[]) => mockState.loggerWarn(...args),
    error: (...args: unknown[]) => mockState.loggerError(...args),
    debug: vi.fn(),
  },
}))

// ── Mock session-record-schema (so we don't pull in zod's full bundle) ───────
vi.mock('../../../src/extension/stats/session-record-schema', () => ({
  SessionHistorySchema: {
    safeParse: (raw: unknown) => ({
      success: Array.isArray(raw),
      data: Array.isArray(raw) ? raw : [],
    }),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { StatsPanelManager } from '../../../src/extension/panels/stats-panel'
import type { SessionRecord } from '../../../src/shared/types'
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(sessions?: SessionRecord[]): vscode.Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  if (sessions) {
    store.set('vibesense.sessionHistory', sessions)
  }
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento & { _store: Map<string, unknown> }
}

function makeContext(globalState: vscode.Memento): vscode.ExtensionContext {
  return {
    extensionUri: { fsPath: '/test/ext' },
    globalState,
    subscriptions: [],
  } as unknown as vscode.ExtensionContext
}

/** Build a SessionRecord for a given UTC date string, e.g. '2026-04-01' */
function makeSession(dateStr: string, ratio = 0.9, controllerOnly = true): SessionRecord {
  const startedAt = new Date(dateStr + 'T12:00:00Z').getTime()
  return {
    sessionId: `session-${dateStr}`,
    startedAt,
    endedAt: startedAt + 3600_000,
    controllerActions: Math.round(ratio * 100),
    keyboardActions: Math.round((1 - ratio) * 100),
    ratio,
    controllerOnly,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StatsPanelManager — open()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset onDidDispose to a no-op by default
    mockState.panel.onDidDispose.mockImplementation((_cb: unknown) => {})
  })

  it('creates a WebviewPanel on first open()', () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    manager.open()

    expect(mockState.createWebviewPanel).toHaveBeenCalledOnce()
    expect(mockState.createWebviewPanel).toHaveBeenCalledWith(
      'vibesense.statsPanel',
      expect.stringContaining('Stats'),
      expect.objectContaining({ viewColumn: 1 }),
      expect.objectContaining({ enableScripts: true, retainContextWhenHidden: true }),
    )
  })

  it('posts STATS_LOADED after opening', () => {
    const sessions = [makeSession('2026-04-01')]
    const globalState = makeGlobalState(sessions)
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    manager.open()

    expect(mockState.postMessage).toHaveBeenCalledOnce()
    const call = mockState.postMessage.mock.calls[0][0] as { type: string; payload: unknown }
    expect(call.type).toBe('STATS_LOADED')
  })

  it('STATS_LOADED payload contains sessions and streak', () => {
    const sessions = [makeSession('2026-04-01')]
    const globalState = makeGlobalState(sessions)
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    manager.open()

    const call = mockState.postMessage.mock.calls[0][0] as {
      type: string
      payload: { sessions: SessionRecord[]; streak: number }
    }
    expect(call.payload.sessions).toHaveLength(1)
    expect(typeof call.payload.streak).toBe('number')
  })

  it('sends empty sessions array when no history in globalState', () => {
    const globalState = makeGlobalState() // no sessions
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    manager.open()

    const call = mockState.postMessage.mock.calls[0][0] as {
      type: string
      payload: { sessions: SessionRecord[]; streak: number }
    }
    expect(call.payload.sessions).toHaveLength(0)
    expect(call.payload.streak).toBe(0)
  })

  it('does NOT create a second panel on repeated open() calls', () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    manager.open()
    manager.open()

    expect(mockState.createWebviewPanel).toHaveBeenCalledOnce()
  })

  it('swallows errors without throwing (NFR-R1)', () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    // Force createWebviewPanel to throw
    mockState.createWebviewPanel.mockImplementationOnce(() => { throw new Error('VSCode API error') })
    const manager = new StatsPanelManager(context, globalState)

    expect(() => manager.open()).not.toThrow()
    expect(mockState.loggerError).toHaveBeenCalled()
  })
})

describe('StatsPanelManager — computeStreak()', () => {
  const manager = new StatsPanelManager(
    makeContext(makeGlobalState()),
    makeGlobalState(),
  )

  it('returns 0 for empty sessions', () => {
    expect(manager.computeStreak([])).toBe(0)
  })

  it('returns 0 when most recent session is not today', () => {
    // Use a date well in the past so it definitely isn't "today"
    const past = [makeSession('2020-01-01')]
    expect(manager.computeStreak(past)).toBe(0)
  })

  it('returns 1 when only today has a session', () => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    expect(manager.computeStreak([makeSession(todayStr)])).toBe(1)
  })

  it('returns 2 when today and yesterday both have sessions', () => {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 86_400_000)
    const todayStr = today.toISOString().slice(0, 10)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    expect(manager.computeStreak([makeSession(todayStr), makeSession(yesterdayStr)])).toBe(2)
  })

  it('returns 0 when yesterday has sessions but today does not', () => {
    const yesterday = new Date(Date.now() - 86_400_000)
    const yesterdayStr = yesterday.toISOString().slice(0, 10)
    expect(manager.computeStreak([makeSession(yesterdayStr)])).toBe(0)
  })

  it('counts only consecutive days from today; breaks on gap', () => {
    const today = new Date()
    const yesterday = new Date(today.getTime() - 86_400_000)
    const twoDaysAgo = new Date(today.getTime() - 2 * 86_400_000)
    // Skip day 3 days ago — so streak = 3 (today, yesterday, two days ago)
    const threeDaysAgo = new Date(today.getTime() - 3 * 86_400_000)
    const fourDaysAgo = new Date(today.getTime() - 4 * 86_400_000)

    const sessions = [
      makeSession(today.toISOString().slice(0, 10)),
      makeSession(yesterday.toISOString().slice(0, 10)),
      makeSession(twoDaysAgo.toISOString().slice(0, 10)),
      // gap here (3 days ago missing)
      makeSession(fourDaysAgo.toISOString().slice(0, 10)),
    ]
    void threeDaysAgo
    expect(manager.computeStreak(sessions)).toBe(3)
  })

  it('returns correct streak with multiple sessions on same day', () => {
    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    // Two sessions on same day — should still count as 1 day
    const s1 = makeSession(todayStr)
    const s2 = { ...makeSession(todayStr), sessionId: 'dupe', startedAt: s1.startedAt + 1000 }
    expect(manager.computeStreak([s1, s2])).toBe(1)
  })
})

describe('StatsPanelManager — dispose()', () => {
  it('disposes the panel when open', () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    vi.clearAllMocks()
    mockState.panel.onDidDispose.mockImplementation((_cb: unknown) => {})

    manager.open()
    manager.dispose()

    expect(mockState.panel.dispose).toHaveBeenCalledOnce()
  })

  it('does not throw when disposed before opening', () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    const manager = new StatsPanelManager(context, globalState)

    expect(() => manager.dispose()).not.toThrow()
  })
})
