// test/unit/extension/quicksave-manager.test.ts
// Unit tests for QuickSaveManager — Story 9.6 (AC1–AC5, NFR-R1)
// All VSCode APIs and fs mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks (must be before any imports that use them) ──────────────────

const { mockCreateTerminal, mockTerminals } = vi.hoisted(() => {
  const mockCreateTerminal = vi.fn()
  const mockTerminals: { name: string }[] = []
  return { mockCreateTerminal, mockTerminals }
})

vi.mock('vscode', () => ({
  window: {
    get terminals() {
      return mockTerminals
    },
    createTerminal: mockCreateTerminal,
  },
}))

const mockFsExistsSync = vi.fn()
const mockFsReadFileSync = vi.fn()
const mockFsWriteFileSync = vi.fn()

vi.mock('fs', () => ({
  existsSync: (...args: unknown[]) => mockFsExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockFsReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockFsWriteFileSync(...args),
}))

vi.mock('../../../src/extension/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────

import { QuickSaveManager } from '../../../src/extension/session/quicksave-manager'
import { QUICKSAVE_KEY } from '../../../src/shared/constants'
import type { QuickSaveState } from '../../../src/shared/types'
import type * as vscode from 'vscode'
import type { SessionManager } from '../../../src/extension/session/session-manager'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(): vscode.Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      if (value === undefined) {
        store.delete(key)
      } else {
        store.set(key, value)
      }
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento & { _store: Map<string, unknown> }
}

function makeSessionManager(sessionIds: string[] = []): SessionManager {
  return {
    getSessions: () => new Map(sessionIds.map((id) => [id, {}])),
  } as unknown as SessionManager
}

const WORKSPACE_ROOT = '/workspace'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('QuickSaveManager — save() (AC1, Story 9.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTerminals.length = 0
    mockFsExistsSync.mockReturnValue(false)
    mockFsReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })
  })

  it('persists terminal names to globalState', async () => {
    mockTerminals.push({ name: 'VibeSense' }, { name: 'Claude Code' })
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.save()

    const saved = globalState._store.get(QUICKSAVE_KEY) as QuickSaveState
    expect(saved.terminalNames).toEqual(['VibeSense', 'Claude Code'])
  })

  it('persists session IDs from SessionManager.getSessions()', async () => {
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(
      globalState,
      makeSessionManager(['session-1', 'session-2']),
      WORKSPACE_ROOT,
    )

    await manager.save()

    const saved = globalState._store.get(QUICKSAVE_KEY) as QuickSaveState
    expect(saved.sessionIds).toEqual(['session-1', 'session-2'])
  })

  it('persists r2Segments from .vscode/vibesense.json when file exists', async () => {
    mockFsReadFileSync.mockReturnValue(
      JSON.stringify({ radialWheel: { segments: ['fix bug', 'write tests', 'review PR'] } }),
    )
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.save()

    const saved = globalState._store.get(QUICKSAVE_KEY) as QuickSaveState
    expect(saved.r2Segments).toEqual(['fix bug', 'write tests', 'review PR'])
  })

  it('persists empty r2Segments when vibesense.json is missing (AC1 — default)', async () => {
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.save()

    const saved = globalState._store.get(QUICKSAVE_KEY) as QuickSaveState
    expect(saved.r2Segments).toEqual([])
  })

  it('persists empty r2Segments when radialWheel.segments key is absent', async () => {
    mockFsReadFileSync.mockReturnValue(JSON.stringify({ radialWheel: {} }))
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.save()

    const saved = globalState._store.get(QUICKSAVE_KEY) as QuickSaveState
    expect(saved.r2Segments).toEqual([])
  })

  it('swallows errors from globalState.update without throwing (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('storage failure'),
    )
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)
    await expect(manager.save()).resolves.toBeUndefined()
  })
})

describe('QuickSaveManager — load() (AC1, Story 9.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when no quicksave state exists in globalState', () => {
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)
    expect(manager.load()).toBeNull()
  })

  it('returns the persisted QuickSaveState when the key is set', () => {
    const globalState = makeGlobalState()
    const state: QuickSaveState = {
      terminalNames: ['VibeSense'],
      sessionIds: ['abc-123'],
      r2Segments: ['fix bug'],
    }
    globalState._store.set(QUICKSAVE_KEY, state)
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)
    expect(manager.load()).toEqual(state)
  })

  it('returns null and does not throw when globalState.get throws (NFR-R1)', () => {
    const globalState = makeGlobalState()
    vi.spyOn(globalState, 'get').mockImplementation(() => {
      throw new Error('storage failure')
    })
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)
    expect(() => manager.load()).not.toThrow()
    expect(manager.load()).toBeNull()
  })
})

describe('QuickSaveManager — clear() (AC4, Story 9.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('removes the quicksave key from globalState', async () => {
    const globalState = makeGlobalState()
    const state: QuickSaveState = { terminalNames: ['term'], sessionIds: [], r2Segments: [] }
    globalState._store.set(QUICKSAVE_KEY, state)
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.clear()

    expect(globalState.update).toHaveBeenCalledWith(QUICKSAVE_KEY, undefined)
    expect(globalState._store.has(QUICKSAVE_KEY)).toBe(false)
  })

  it('swallows errors from globalState.update without throwing (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('storage failure'),
    )
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)
    await expect(manager.clear()).resolves.toBeUndefined()
  })
})

describe('QuickSaveManager — restore() (AC3, Story 9.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTerminals.length = 0
    mockFsExistsSync.mockReturnValue(false)
    mockFsReadFileSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })
  })

  it('calls createTerminal for each terminal name in saved state (AC3)', async () => {
    const state: QuickSaveState = {
      terminalNames: ['VibeSense', 'Claude Code'],
      sessionIds: [],
      r2Segments: [],
    }
    const globalState = makeGlobalState()
    globalState._store.set(QUICKSAVE_KEY, state)
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.restore(state)

    expect(mockCreateTerminal).toHaveBeenCalledTimes(2)
    expect(mockCreateTerminal).toHaveBeenCalledWith({ name: 'VibeSense' })
    expect(mockCreateTerminal).toHaveBeenCalledWith({ name: 'Claude Code' })
  })

  it('writes r2Segments to .vscode/vibesense.json when segments are present (AC3)', async () => {
    mockFsExistsSync.mockReturnValue(true)
    mockFsReadFileSync.mockReturnValue(
      JSON.stringify({ radialWheel: { segments: ['old segment'] }, other: 'value' }),
    )

    const state: QuickSaveState = {
      terminalNames: [],
      sessionIds: [],
      r2Segments: ['fix bug', 'write tests'],
    }
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.restore(state)

    expect(mockFsWriteFileSync).toHaveBeenCalledOnce()
    const writtenContent = mockFsWriteFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent) as Record<string, unknown>
    const rw = parsed['radialWheel'] as Record<string, unknown>
    expect(rw['segments']).toEqual(['fix bug', 'write tests'])
    // Verify other fields preserved
    expect(parsed['other']).toBe('value')
  })

  it('does NOT write vibesense.json when r2Segments is empty', async () => {
    const state: QuickSaveState = {
      terminalNames: ['term'],
      sessionIds: [],
      r2Segments: [],
    }
    const globalState = makeGlobalState()
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.restore(state)

    expect(mockFsWriteFileSync).not.toHaveBeenCalled()
  })

  it('clears quicksave state after successful restore (AC3)', async () => {
    const state: QuickSaveState = {
      terminalNames: ['VibeSense'],
      sessionIds: [],
      r2Segments: [],
    }
    const globalState = makeGlobalState()
    globalState._store.set(QUICKSAVE_KEY, state)
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await manager.restore(state)

    expect(globalState.update).toHaveBeenCalledWith(QUICKSAVE_KEY, undefined)
    expect(globalState._store.has(QUICKSAVE_KEY)).toBe(false)
  })

  it('still clears quicksave state even when restore throws (NFR-R1, finally block)', async () => {
    mockFsExistsSync.mockReturnValue(true)
    mockFsReadFileSync.mockReturnValue('invalid json {{{')

    const state: QuickSaveState = {
      terminalNames: [],
      sessionIds: [],
      r2Segments: ['segment'],
    }
    const globalState = makeGlobalState()
    globalState._store.set(QUICKSAVE_KEY, state)
    const manager = new QuickSaveManager(globalState, makeSessionManager(), WORKSPACE_ROOT)

    await expect(manager.restore(state)).resolves.toBeUndefined()
    // clear() should still have been called via finally
    expect(globalState.update).toHaveBeenCalledWith(QUICKSAVE_KEY, undefined)
  })
})
