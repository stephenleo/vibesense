// test/unit/extension/stats/session-health-manager.test.ts
// Unit tests for SessionHealthManager — Story 9.4

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
import { SessionHealthManager } from '../../../../src/extension/stats/session-health-manager'
import { logger } from '../../../../src/extension/logger'
import {
  XP_CONTROLLER_ONLY,
  XP_HIGH_RATIO,
  XP_MULTI_FEATURE,
  XP_STREAK_PER_DAY,
} from '../../../../src/shared/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockRatioTracker(overrides?: {
  controllerActions?: number
  keyboardActions?: number
  ratio?: number
  featureCount?: number
  startedAt?: number
}) {
  const startedAt = overrides?.startedAt ?? Date.now() - 5000
  return {
    getCurrentStats: vi.fn(() => ({
      controllerActions: overrides?.controllerActions ?? 5,
      keyboardActions: overrides?.keyboardActions ?? 0,
      ratio: overrides?.ratio ?? 1.0,
    })),
    getSessionStartTime: vi.fn(() => startedAt),
    getDistinctFeatureCount: vi.fn(() => overrides?.featureCount ?? 0),
  }
}

function makeMockXpManager(streakDays = 0) {
  return {
    load: vi.fn(() => ({
      totalXp: 100,
      level: 1,
      streakDays,
      lastSessionDate: null as string | null,
    })),
  }
}

function makeMockSlidePanelManager() {
  return {
    notifyHealthUpdate: vi.fn(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionHealthManager — pushUpdate()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls notifyHealthUpdate with correct ratio', () => {
    const ratioTracker = makeMockRatioTracker({ ratio: 0.75, controllerActions: 3, keyboardActions: 1 })
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledWith(
      0.75,
      expect.any(Number),
      expect.any(Number),
      false,
    )
  })

  it('computes durationMs from session start time', () => {
    const startedAt = Date.now() - 12000  // 12s ago
    const ratioTracker = makeMockRatioTracker({ startedAt })
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, durationMs] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(durationMs).toBeGreaterThanOrEqual(12000)
    expect(durationMs).toBeLessThan(13000)
  })

  it('computes sessionXp +100 for controller-only session (no keyboard actions)', () => {
    const ratioTracker = makeMockRatioTracker({ controllerActions: 5, keyboardActions: 0, ratio: 1.0 })
    const xpManager = makeMockXpManager(0)
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, , sessionXp] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(sessionXp).toBeGreaterThanOrEqual(XP_CONTROLLER_ONLY)
  })

  it('computes sessionXp +50 for ratio >= 0.8', () => {
    const ratioTracker = makeMockRatioTracker({ controllerActions: 8, keyboardActions: 2, ratio: 0.8 })
    const xpManager = makeMockXpManager(0)
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, , sessionXp] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    // keyboard > 0 so no XP_CONTROLLER_ONLY, but ratio >= 0.8 gives XP_HIGH_RATIO
    expect(sessionXp).toBeGreaterThanOrEqual(XP_HIGH_RATIO)
  })

  it('computes sessionXp +25 for 3+ distinct features used', () => {
    const ratioTracker = makeMockRatioTracker({
      controllerActions: 0,
      keyboardActions: 3,
      ratio: 0.0,
      featureCount: 3,
    })
    const xpManager = makeMockXpManager(0)
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, , sessionXp] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(sessionXp).toBeGreaterThanOrEqual(XP_MULTI_FEATURE)
  })

  it('includes streak bonus in sessionXp computation', () => {
    const ratioTracker = makeMockRatioTracker({ controllerActions: 0, keyboardActions: 1, ratio: 0.0, featureCount: 0 })
    const xpManager = makeMockXpManager(5)  // 5-day streak
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, , sessionXp] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(sessionXp).toBe(5 * XP_STREAK_PER_DAY)
  })

  it('passes connected=false initially', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    const [, , , connected] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(connected).toBe(false)
  })
})

describe('SessionHealthManager — notifyConnected()', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls pushUpdate() immediately when notifyConnected(true)', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.notifyConnected(true)

    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledTimes(1)
    const [, , , connected] = slidePanelManager.notifyHealthUpdate.mock.calls[0] as [number, number, number, boolean]
    expect(connected).toBe(true)
  })

  it('sets connected=false after notifyConnected(false)', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.notifyConnected(true)
    manager.notifyConnected(false)

    // Second call should have connected=false
    const [, , , connected] = slidePanelManager.notifyHealthUpdate.mock.calls[1] as [number, number, number, boolean]
    expect(connected).toBe(false)
  })
})

describe('SessionHealthManager — start() / dispose() interval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls pushUpdate after 1000ms interval fires', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.start()

    expect(slidePanelManager.notifyHealthUpdate).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledTimes(2)

    manager.dispose()
  })

  it('stops interval after dispose()', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.start()
    vi.advanceTimersByTime(1000)
    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledTimes(1)

    manager.dispose()
    vi.advanceTimersByTime(3000)
    // Should still be 1 — no more calls after dispose
    expect(slidePanelManager.notifyHealthUpdate).toHaveBeenCalledTimes(1)
  })

  it('dispose() is idempotent (safe to call multiple times)', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.start()
    manager.dispose()
    expect(() => manager.dispose()).not.toThrow()
  })
})

describe('SessionHealthManager — error resilience (NFR-R1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not throw when notifyHealthUpdate throws', () => {
    const ratioTracker = makeMockRatioTracker()
    const xpManager = makeMockXpManager()
    const slidePanelManager = {
      notifyHealthUpdate: vi.fn(() => { throw new Error('panel error') }),
    }

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    expect(() => manager.pushUpdate()).not.toThrow()
  })

  it('logs error when pushUpdate throws internally (NFR-R1)', () => {
    const ratioTracker = {
      getCurrentStats: vi.fn(() => { throw new Error('stats error') }),
      getSessionStartTime: vi.fn(() => Date.now()),
      getDistinctFeatureCount: vi.fn(() => 0),
    }
    const xpManager = makeMockXpManager()
    const slidePanelManager = makeMockSlidePanelManager()

    const manager = new SessionHealthManager(
      slidePanelManager as never,
      ratioTracker as never,
      xpManager as never,
    )
    manager.pushUpdate()

    expect(logger.error).toHaveBeenCalledWith(
      'SessionHealthManager: pushUpdate() failed',
      expect.any(Error),
    )
  })
})
