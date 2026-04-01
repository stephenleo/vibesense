// test/unit/extension/stats/session-ratio-tracker.test.ts
// Unit tests for SessionRatioTracker — Story 9.1 (AC1–AC6)
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../../src/extension/logger', () => ({
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
import { SessionRatioTracker, SESSION_HISTORY_KEY } from '../../../../src/extension/stats/session-ratio-tracker'
import type * as vscode from 'vscode'
import type { SessionRecord } from '../../../../src/shared/types'
import { logger } from '../../../../src/extension/logger'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(): vscode.Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento & { _store: Map<string, unknown> }
}

function getStoredHistory(globalState: vscode.Memento & { _store: Map<string, unknown> }): SessionRecord[] {
  return (globalState._store.get(SESSION_HISTORY_KEY) as SessionRecord[]) ?? []
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionRatioTracker — recordControllerAction() (AC1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('increments controllerActions counter synchronously', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordControllerAction()
    tracker.recordControllerAction()

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(1)
    expect(history[0].controllerActions).toBe(3)
  })

  it('starts at zero controller actions', async () => {
    const tracker = new SessionRatioTracker()

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].controllerActions).toBe(0)
  })
})

describe('SessionRatioTracker — recordKeyboardAction() (AC2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('increments keyboardActions after debounce fires', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600) // past 500ms debounce

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].keyboardActions).toBe(1)
  })

  it('counts rapid typing as a single keyboard action (debounce)', async () => {
    const tracker = new SessionRatioTracker()
    // Simulate rapid typing — multiple calls within debounce window
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(100)
    tracker.recordKeyboardAction() // ignored — pending flag set
    vi.advanceTimersByTime(100)
    tracker.recordKeyboardAction() // ignored — pending flag set
    vi.advanceTimersByTime(600) // let debounce fire

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].keyboardActions).toBe(1)
  })

  it('allows a second keyboard action after debounce completes', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600) // first debounce fires

    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600) // second debounce fires

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].keyboardActions).toBe(2)
  })

  it('flushes pending keyboard increment on finalizeSession even if debounce has not fired', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordKeyboardAction()
    // do NOT advance timer — debounce still pending

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].keyboardActions).toBe(1)
  })
})

describe('SessionRatioTracker — finalizeSession() ratio computation (AC3, AC4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('computes correct ratio: 3 controller / 4 total = 0.75', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordControllerAction()
    tracker.recordControllerAction()
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600)

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].ratio).toBeCloseTo(0.75)
    expect(history[0].controllerActions).toBe(3)
    expect(history[0].keyboardActions).toBe(1)
    expect(history[0].controllerOnly).toBe(false)
  })

  it('sets controllerOnly = true when keyboardActions is 0 (AC4)', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordControllerAction()

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].controllerOnly).toBe(true)
  })

  it('sets controllerOnly = false when keyboardActions > 0 (AC4)', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600)

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].controllerOnly).toBe(false)
  })

  it('persists record with correct sessionId, startedAt, endedAt fields (AC4)', async () => {
    const before = Date.now()
    const tracker = new SessionRatioTracker()
    const after = Date.now()

    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    const record = history[0]
    expect(record.sessionId).toMatch(/^session-\d+$/)
    expect(record.startedAt).toBeGreaterThanOrEqual(before)
    expect(record.startedAt).toBeLessThanOrEqual(after + 5)
    expect(record.endedAt).toBeGreaterThanOrEqual(record.startedAt)
  })

  it('stores to vibesense.sessionHistory key (AC3)', async () => {
    const tracker = new SessionRatioTracker()
    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    expect(globalState.update).toHaveBeenCalledWith(
      'vibesense.sessionHistory',
      expect.any(Array),
    )
  })
})

describe('SessionRatioTracker — finalizeSession() with 0 total actions (AC4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets ratio = 1.0 when both controller and keyboard actions are 0 (AC4)', async () => {
    const tracker = new SessionRatioTracker()
    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].ratio).toBe(1.0)
  })

  it('sets controllerOnly = true when zero keyboard actions and zero controller actions (AC4)', async () => {
    const tracker = new SessionRatioTracker()
    const globalState = makeGlobalState()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history[0].controllerOnly).toBe(true)
  })
})

describe('SessionRatioTracker — finalizeSession() sliding window eviction (AC5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('evicts oldest records when > 100 sessions stored (AC5)', async () => {
    const globalState = makeGlobalState()

    // Pre-populate with 100 records
    const existingHistory: SessionRecord[] = Array.from({ length: 100 }, (_, i) => ({
      sessionId: `session-${i}`,
      startedAt: i * 1000,
      endedAt: i * 1000 + 500,
      controllerActions: 1,
      keyboardActions: 0,
      ratio: 1.0,
      controllerOnly: true,
    }))
    globalState._store.set(SESSION_HISTORY_KEY, existingHistory)

    const tracker = new SessionRatioTracker()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(100)
    // Oldest should be evicted — first entry should NOT be session-0
    expect(history[0].sessionId).toBe('session-1')
    // New record should be the last
    expect(history[99].sessionId).toMatch(/^session-\d{13,}$/) // timestamp-based
  })

  it('keeps all records when <= 100 sessions (AC5)', async () => {
    const globalState = makeGlobalState()

    // Pre-populate with 99 records
    const existingHistory: SessionRecord[] = Array.from({ length: 99 }, (_, i) => ({
      sessionId: `session-${i}`,
      startedAt: i * 1000,
      endedAt: i * 1000 + 500,
      controllerActions: 1,
      keyboardActions: 0,
      ratio: 1.0,
      controllerOnly: true,
    }))
    globalState._store.set(SESSION_HISTORY_KEY, existingHistory)

    const tracker = new SessionRatioTracker()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(100)
    expect(history[0].sessionId).toBe('session-0') // oldest preserved
  })
})

describe('SessionRatioTracker — finalizeSession() idempotence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is a no-op on second call (finalizeSession called twice)', async () => {
    const tracker = new SessionRatioTracker()
    const globalState = makeGlobalState()

    await tracker.finalizeSession(globalState)
    await tracker.finalizeSession(globalState) // second call — should be no-op

    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(1) // only one record stored
    expect(globalState.update).toHaveBeenCalledTimes(1)
  })
})

describe('SessionRatioTracker — reset() (AC6)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('resets controller action counter to 0', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordControllerAction()
    tracker.reset()

    const globalState = makeGlobalState()
    // Verify counters via getCurrentStats()
    const stats = tracker.getCurrentStats()
    expect(stats.controllerActions).toBe(0)
  })

  it('resets keyboard action counter to 0', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600)
    tracker.reset()

    const stats = tracker.getCurrentStats()
    expect(stats.keyboardActions).toBe(0)
  })

  it('cancels pending keyboard debounce timer on reset()', async () => {
    const tracker = new SessionRatioTracker()
    tracker.recordKeyboardAction() // sets pending, starts timer
    tracker.reset() // should cancel timer and clear pending

    vi.advanceTimersByTime(600) // timer would have fired — but was cancelled

    // After reset, counters should be zero
    const stats = tracker.getCurrentStats()
    expect(stats.keyboardActions).toBe(0)
  })

  it('resets finalized flag so tracker can be reused for a new session', async () => {
    const tracker = new SessionRatioTracker()
    const globalState = makeGlobalState()
    tracker.recordControllerAction()
    await tracker.finalizeSession(globalState)

    // After finalize, reset should allow a second finalization
    tracker.reset()
    tracker.recordControllerAction()
    tracker.recordControllerAction()
    await tracker.finalizeSession(globalState)

    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(2)
    expect(history[1].controllerActions).toBe(2)
  })

  it('clean slate on activate: starts at zero (AC6)', () => {
    // AC6: New SessionRatioTracker instance starts at zero
    const tracker = new SessionRatioTracker()
    const stats = tracker.getCurrentStats()
    expect(stats.controllerActions).toBe(0)
    expect(stats.keyboardActions).toBe(0)
    expect(stats.ratio).toBe(1.0)
  })
})

describe('SessionRatioTracker — getCurrentStats() (forward compatibility for Story 9.4)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns live stats without finalizing session', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()
    tracker.recordControllerAction()

    const stats = tracker.getCurrentStats()
    expect(stats.controllerActions).toBe(2)
    expect(stats.keyboardActions).toBe(0)
    expect(stats.ratio).toBe(1.0)
  })

  it('computes ratio from live in-memory counters', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordControllerAction()

    // recordKeyboardAction increments only after debounce fires
    tracker.recordKeyboardAction()
    vi.advanceTimersByTime(600)

    const stats = tracker.getCurrentStats()
    expect(stats.controllerActions).toBe(1)
    expect(stats.keyboardActions).toBe(1)
    expect(stats.ratio).toBeCloseTo(0.5)
  })
})

describe('SessionRatioTracker — error resilience (NFR-R1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not throw when globalState.update() rejects', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))

    const tracker = new SessionRatioTracker()
    await expect(tracker.finalizeSession(globalState)).resolves.toBeUndefined()
  })

  it('logs error when globalState.update() rejects (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))

    const tracker = new SessionRatioTracker()
    await tracker.finalizeSession(globalState)

    expect(logger.error).toHaveBeenCalledWith(
      'SessionRatioTracker: failed to persist session record',
      expect.any(Error),
    )
  })

  it('handles corrupted globalState data gracefully (defensive parse)', async () => {
    const globalState = makeGlobalState()
    // Store invalid data (not an array of SessionRecord)
    globalState._store.set(SESSION_HISTORY_KEY, { invalid: 'data' })

    const tracker = new SessionRatioTracker()
    await expect(tracker.finalizeSession(globalState)).resolves.toBeUndefined()

    // Should have persisted a 1-element history (corrupted data treated as empty)
    const history = getStoredHistory(globalState)
    expect(history).toHaveLength(1)
  })
})

// ── SessionRatioTracker — feature tracking (Story 9.3 — AC3) ─────────────────

describe('SessionRatioTracker — recordFeatureUsed() and getDistinctFeatureCount() (Story 9.3 — AC3)', () => {
  it('starts with 0 distinct features', () => {
    const tracker = new SessionRatioTracker()
    expect(tracker.getDistinctFeatureCount()).toBe(0)
  })

  it('counts a single feature usage', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordFeatureUsed('radialWheel')
    expect(tracker.getDistinctFeatureCount()).toBe(1)
  })

  it('deduplicates repeated calls with the same feature name', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordFeatureUsed('radialWheel')
    tracker.recordFeatureUsed('radialWheel')
    tracker.recordFeatureUsed('radialWheel')
    expect(tracker.getDistinctFeatureCount()).toBe(1)
  })

  it('counts multiple distinct features correctly', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordFeatureUsed('radialWheel')
    tracker.recordFeatureUsed('sessionSwitch')
    tracker.recordFeatureUsed('miniGame')
    expect(tracker.getDistinctFeatureCount()).toBe(3)
  })

  it('handles all known feature categories without error', () => {
    const tracker = new SessionRatioTracker()
    const features = ['radialWheel', 'sessionSwitch', 'miniGame', 'voicePtt', 'quickPanel', 'hud', 'quicksave']
    for (const feature of features) {
      tracker.recordFeatureUsed(feature)
    }
    expect(tracker.getDistinctFeatureCount()).toBe(7)
  })

  it('resets feature count on reset()', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordFeatureUsed('radialWheel')
    tracker.recordFeatureUsed('miniGame')
    expect(tracker.getDistinctFeatureCount()).toBe(2)
    tracker.reset()
    expect(tracker.getDistinctFeatureCount()).toBe(0)
  })

  it('allows feature tracking after reset (clean slate)', () => {
    const tracker = new SessionRatioTracker()
    tracker.recordFeatureUsed('radialWheel')
    tracker.reset()
    tracker.recordFeatureUsed('sessionSwitch')
    expect(tracker.getDistinctFeatureCount()).toBe(1)
  })
})

// ── SessionRatioTracker — getSessionStartTime() (Story 9.4) ───────────────────

describe('SessionRatioTracker — getSessionStartTime() (Story 9.4)', () => {
  it('returns a number less than or equal to Date.now()', () => {
    const before = Date.now()
    const tracker = new SessionRatioTracker()
    const startTime = tracker.getSessionStartTime()
    expect(typeof startTime).toBe('number')
    expect(startTime).toBeGreaterThanOrEqual(before)
    expect(startTime).toBeLessThanOrEqual(Date.now())
  })

  it('returns the same value on repeated calls (immutable start time)', () => {
    const tracker = new SessionRatioTracker()
    const first = tracker.getSessionStartTime()
    const second = tracker.getSessionStartTime()
    expect(first).toBe(second)
  })
})
