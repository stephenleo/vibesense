// test/unit/input/radial-wheel-dispatch-tracker.test.ts
// Unit tests for RadialWheelDispatchTracker — Story 7.4

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockLogger } = vi.hoisted(() => {
  return {
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  // Memento is only used as a type; no runtime VSCode APIs needed here
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { RadialWheelDispatchTracker } from '../../../src/extension/input/radial-wheel-dispatch-tracker'

// ── Mock Memento ───────────────────────────────────────────────────────────────

function makeMockMemento() {
  const store = new Map<string, unknown>()
  return {
    get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return store.has(key) ? (store.get(key) as T) : defaultValue
    }),
    update: vi.fn(async (key: string, value: unknown): Promise<void> => {
      store.set(key, value)
    }),
    keys: vi.fn(() => Array.from(store.keys())),
    store,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RadialWheelDispatchTracker', () => {
  let memento: ReturnType<typeof makeMockMemento>
  let tracker: RadialWheelDispatchTracker

  beforeEach(() => {
    vi.resetAllMocks()
    memento = makeMockMemento()
    tracker = new RadialWheelDispatchTracker(memento as never)
  })

  // ── getCount() ────────────────────────────────────────────────────────────────

  describe('getCount()', () => {
    it('returns 0 when no stored value exists for a segment index', () => {
      expect(tracker.getCount(0)).toBe(0)
    })

    it('returns 0 for any valid index when store is empty', () => {
      for (let i = 0; i <= 7; i++) {
        expect(tracker.getCount(i)).toBe(0)
      }
    })

    it('returns the stored count when a value exists', async () => {
      await tracker.increment(3)
      await tracker.increment(3)
      expect(tracker.getCount(3)).toBe(2)
    })

    it('uses the correct key prefix: vibesense.r2DispatchCount.<index>', async () => {
      await tracker.increment(5)
      expect(memento.get).toHaveBeenCalledWith('vibesense.r2DispatchCount.5')
    })
  })

  // ── increment() ───────────────────────────────────────────────────────────────

  describe('increment()', () => {
    it('persists count via globalState.update()', async () => {
      await tracker.increment(0)
      expect(memento.update).toHaveBeenCalledWith('vibesense.r2DispatchCount.0', 1)
    })

    it('increments count from 0 to 1', async () => {
      await tracker.increment(0)
      expect(tracker.getCount(0)).toBe(1)
    })

    it('increments count correctly from 4 to 5', async () => {
      for (let i = 0; i < 4; i++) {
        await tracker.increment(2)
      }
      expect(tracker.getCount(2)).toBe(4)
      await tracker.increment(2)
      expect(tracker.getCount(2)).toBe(5)
    })

    it('tracks counts independently per segment index', async () => {
      await tracker.increment(0)
      await tracker.increment(0)
      await tracker.increment(1)
      expect(tracker.getCount(0)).toBe(2)
      expect(tracker.getCount(1)).toBe(1)
      expect(tracker.getCount(2)).toBe(0)
    })

    it('does not throw when globalState.update() rejects (NFR-R1)', async () => {
      memento.update.mockRejectedValue(new Error('storage error'))
      await expect(tracker.increment(0)).resolves.not.toThrow()
    })

    it('logs error when globalState.update() rejects', async () => {
      const err = new Error('storage error')
      memento.update.mockRejectedValue(err)
      await tracker.increment(0)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RadialWheelDispatchTracker: failed to increment count',
        err,
      )
    })
  })

  // ── computeLabelMode() ────────────────────────────────────────────────────────

  describe('computeLabelMode()', () => {
    it("returns 'full' when count is 0", () => {
      expect(tracker.computeLabelMode(0, false)).toBe('full')
    })

    it("returns 'full' when count is 4 (just below abbreviated threshold)", async () => {
      for (let i = 0; i < 4; i++) {
        await tracker.increment(0)
      }
      expect(tracker.computeLabelMode(0, false)).toBe('full')
    })

    it("returns 'abbreviated' when count is exactly 5", async () => {
      for (let i = 0; i < 5; i++) {
        await tracker.increment(1)
      }
      expect(tracker.computeLabelMode(1, false)).toBe('abbreviated')
    })

    it("returns 'abbreviated' when count is 14 (just below icon-only threshold)", async () => {
      for (let i = 0; i < 14; i++) {
        await tracker.increment(2)
      }
      expect(tracker.computeLabelMode(2, false)).toBe('abbreviated')
    })

    it("returns 'icon-only' when count is exactly 15", async () => {
      for (let i = 0; i < 15; i++) {
        await tracker.increment(3)
      }
      expect(tracker.computeLabelMode(3, false)).toBe('icon-only')
    })

    it("returns 'icon-only' when count is greater than 15", async () => {
      for (let i = 0; i < 20; i++) {
        await tracker.increment(4)
      }
      expect(tracker.computeLabelMode(4, false)).toBe('icon-only')
    })

    it("returns 'icon-only' when forceIconOnly = true regardless of count (AC4)", () => {
      // No increments — count is 0 — but forceIconOnly overrides
      expect(tracker.computeLabelMode(0, true)).toBe('icon-only')
    })

    it("returns 'icon-only' when forceIconOnly = true even at count 4 (full range)", async () => {
      for (let i = 0; i < 4; i++) {
        await tracker.increment(5)
      }
      expect(tracker.computeLabelMode(5, true)).toBe('icon-only')
    })

    it("returns 'icon-only' when forceIconOnly = true even at count 10 (abbreviated range)", async () => {
      for (let i = 0; i < 10; i++) {
        await tracker.increment(6)
      }
      expect(tracker.computeLabelMode(6, true)).toBe('icon-only')
    })
  })
})
