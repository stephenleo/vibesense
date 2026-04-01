// test/unit/extension/stats/xp-manager.test.ts
// Unit tests for XpManager — Story 9.3 (AC1–AC6, NFR-R1)
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

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
import { XpManager } from '../../../../src/extension/stats/xp-manager'
import { XP_KEY } from '../../../../src/shared/constants'
import type { XpRecord, SessionRecord } from '../../../../src/shared/types'
import type * as vscode from 'vscode'
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

function getStoredXpRecord(globalState: vscode.Memento & { _store: Map<string, unknown> }): XpRecord | undefined {
  return globalState._store.get(XP_KEY) as XpRecord | undefined
}

function makeSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  const now = Date.now()
  return {
    sessionId: `session-${now}`,
    startedAt: now - 60_000,
    endedAt: now,
    controllerActions: 10,
    keyboardActions: 0,
    ratio: 1.0,
    controllerOnly: true,
    ...overrides,
  }
}

// ── XpManager.computeLevelForXp() (pure function) ────────────────────────────

describe('XpManager.computeLevelForXp()', () => {
  it('returns level 1 for 0 XP', () => {
    expect(XpManager.computeLevelForXp(0)).toBe(1)
  })

  it('returns level 1 for 499 XP', () => {
    expect(XpManager.computeLevelForXp(499)).toBe(1)
  })

  it('returns level 2 for exactly 500 XP', () => {
    expect(XpManager.computeLevelForXp(500)).toBe(2)
  })

  it('returns level 2 for 999 XP', () => {
    expect(XpManager.computeLevelForXp(999)).toBe(2)
  })

  it('returns level 3 for exactly 1000 XP', () => {
    expect(XpManager.computeLevelForXp(1000)).toBe(3)
  })

  it('returns level 3 for 1999 XP', () => {
    expect(XpManager.computeLevelForXp(1999)).toBe(3)
  })

  it('returns level 4 for exactly 2000 XP', () => {
    expect(XpManager.computeLevelForXp(2000)).toBe(4)
  })

  it('returns level 4 for 3999 XP', () => {
    expect(XpManager.computeLevelForXp(3999)).toBe(4)
  })

  it('returns level 5 for exactly 4000 XP', () => {
    expect(XpManager.computeLevelForXp(4000)).toBe(5)
  })

  it('handles very large XP values without infinite loop', () => {
    const level = XpManager.computeLevelForXp(1_000_000)
    expect(level).toBeGreaterThan(1)
  })
})

// ── XpManager.computeStreak() (pure function) ─────────────────────────────────

describe('XpManager.computeStreak()', () => {
  it('returns 1 for first ever session (lastSessionDate = null)', () => {
    expect(XpManager.computeStreak(0, null, '2026-04-01')).toBe(1)
  })

  it('does not change streak when lastSessionDate == today (already counted)', () => {
    expect(XpManager.computeStreak(5, '2026-04-01', '2026-04-01')).toBe(5)
  })

  it('increments streak when lastSessionDate was yesterday', () => {
    expect(XpManager.computeStreak(3, '2026-03-31', '2026-04-01')).toBe(4)
  })

  it('resets streak to 1 when lastSessionDate was two days ago', () => {
    expect(XpManager.computeStreak(10, '2026-03-30', '2026-04-01')).toBe(1)
  })

  it('resets streak to 1 when lastSessionDate was much older', () => {
    expect(XpManager.computeStreak(50, '2026-01-01', '2026-04-01')).toBe(1)
  })

  it('handles month boundary correctly (yesterday was last day of previous month)', () => {
    // March 31 → April 1 boundary
    expect(XpManager.computeStreak(2, '2026-03-31', '2026-04-01')).toBe(3)
  })

  it('handles year boundary correctly', () => {
    // Dec 31 → Jan 1 boundary
    expect(XpManager.computeStreak(7, '2025-12-31', '2026-01-01')).toBe(8)
  })
})

// ── XpManager.load() ─────────────────────────────────────────────────────────

describe('XpManager — load()', () => {
  it('returns default XpRecord when globalState is empty', () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = manager.load()
    expect(record).toEqual({ totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null })
  })

  it('returns stored XpRecord when it exists and is valid', () => {
    const globalState = makeGlobalState()
    const stored: XpRecord = { totalXp: 750, level: 2, streakDays: 5, lastSessionDate: '2026-04-01' }
    globalState._store.set(XP_KEY, stored)
    const manager = new XpManager(globalState)
    expect(manager.load()).toEqual(stored)
  })

  it('returns defaults and logs warn when stored data is corrupted', () => {
    const globalState = makeGlobalState()
    globalState._store.set(XP_KEY, { invalid: 'garbage' })
    const manager = new XpManager(globalState)
    const record = manager.load()
    expect(record).toEqual({ totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null })
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('corrupted'))
  })
})

// ── XpManager.awardSessionXp() — AC1 (controller-only +100 XP) ───────────────

describe('XpManager — awardSessionXp() AC1: controller-only +100 XP', () => {
  it('adds 100 XP for a controller-only session', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    // Use distinctFeatureCount = 0 to isolate AC1
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    // 100 (controller-only) + 50 (high ratio) + 1 * 10 (streak day 1) = 160
    // But for isolation, let's check at least 100 is included in total
    expect(stored?.totalXp).toBeGreaterThanOrEqual(100)
  })

  it('does not add controller-only bonus when keyboardActions > 0', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    // controllerOnly = false; low ratio to avoid high-ratio bonus
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    // Only streak bonus: 1 * 10 = 10
    expect(stored?.totalXp).toBe(10)
  })
})

// ── XpManager.awardSessionXp() — AC2 (high ratio +50 XP) ────────────────────

describe('XpManager — awardSessionXp() AC2: high ratio ≥80% earns +50 XP', () => {
  it('adds 50 XP when ratio is exactly 0.80', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.80, keyboardActions: 1 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    // 50 (high ratio) + 1 * 10 (streak day 1) = 60
    expect(stored?.totalXp).toBe(60)
  })

  it('adds 50 XP when ratio is above 0.80', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.95, keyboardActions: 1 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.totalXp).toBe(60)
  })

  it('does not add high-ratio bonus when ratio is 0.79', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.79, keyboardActions: 2 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    // Only streak bonus: 1 * 10 = 10
    expect(stored?.totalXp).toBe(10)
  })

  it('controller-only session also earns high-ratio bonus (both bonuses stack)', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    // 100 (controller-only) + 50 (high ratio) + 1 * 10 (streak) = 160
    expect(stored?.totalXp).toBe(160)
  })
})

// ── XpManager.awardSessionXp() — AC3 (multi-feature +25 XP) ─────────────────

describe('XpManager — awardSessionXp() AC3: 3+ distinct features earns +25 XP', () => {
  it('adds 25 XP when distinctFeatureCount is exactly 3', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 3)
    const stored = getStoredXpRecord(globalState)
    // 25 (multi-feature) + 1 * 10 (streak) = 35
    expect(stored?.totalXp).toBe(35)
  })

  it('adds 25 XP when distinctFeatureCount > 3', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 7)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.totalXp).toBe(35)
  })

  it('does not add multi-feature bonus when distinctFeatureCount is 2', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 2)
    const stored = getStoredXpRecord(globalState)
    // Only streak bonus: 1 * 10 = 10
    expect(stored?.totalXp).toBe(10)
  })
})

// ── XpManager.awardSessionXp() — AC4 (streak bonus) ─────────────────────────

describe('XpManager — awardSessionXp() AC4: streak bonus = streakDays × 10 XP', () => {
  it('earns 10 XP streak bonus on first ever session (streakDays = 1)', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.totalXp).toBe(10) // 1 day × 10
    expect(stored?.streakDays).toBe(1)
  })

  it('earns larger streak bonus on continued consecutive days', async () => {
    const globalState = makeGlobalState()
    // Set up existing XP record with a yesterday date to trigger streak increment
    const yesterday = XpManager.toUtcDateString(Date.now() - 24 * 60 * 60 * 1000)
    globalState._store.set(XP_KEY, {
      totalXp: 0,
      level: 1,
      streakDays: 3,
      lastSessionDate: yesterday,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.streakDays).toBe(4)
    expect(stored?.totalXp).toBe(40) // 4 days × 10
  })

  it('resets streak to 1 after a missed day', async () => {
    const globalState = makeGlobalState()
    // Two days ago — streak should reset
    const twoDaysAgo = XpManager.toUtcDateString(Date.now() - 2 * 24 * 60 * 60 * 1000)
    globalState._store.set(XP_KEY, {
      totalXp: 100,
      level: 1,
      streakDays: 10,
      lastSessionDate: twoDaysAgo,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.streakDays).toBe(1) // reset
    expect(stored?.totalXp).toBe(110) // 100 + (1 day × 10)
  })

  it('does not double-count streak when same day session fires twice', async () => {
    const globalState = makeGlobalState()
    const today = XpManager.toUtcDateString(Date.now())
    globalState._store.set(XP_KEY, {
      totalXp: 50,
      level: 1,
      streakDays: 5,
      lastSessionDate: today,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.streakDays).toBe(5) // unchanged — already counted today
    expect(stored?.totalXp).toBe(100) // 50 + (5 days × 10)
  })
})

// ── XpManager.awardSessionXp() — AC5 (level-up event) ───────────────────────

describe('XpManager — awardSessionXp() AC5: level-up event emission', () => {
  it('emits levelUp event when XP crosses level 2 threshold (500 XP)', async () => {
    const globalState = makeGlobalState()
    // Start at 490 XP — one controller-only session = +100 XP → crosses 500 threshold
    globalState._store.set(XP_KEY, {
      totalXp: 490,
      level: 1,
      streakDays: 0,
      lastSessionDate: null,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const levelUpListener = vi.fn()
    manager.on('levelUp', levelUpListener)

    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    await manager.awardSessionXp(record, 0)

    expect(levelUpListener).toHaveBeenCalledTimes(1)
    expect(levelUpListener).toHaveBeenCalledWith(
      expect.objectContaining({ previousLevel: 1, newLevel: 2 }),
    )
  })

  it('does NOT emit levelUp when XP stays within the same level', async () => {
    const globalState = makeGlobalState()
    // Start at 100 XP — won't reach 500 with just streak bonus
    globalState._store.set(XP_KEY, {
      totalXp: 100,
      level: 1,
      streakDays: 0,
      lastSessionDate: null,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const levelUpListener = vi.fn()
    manager.on('levelUp', levelUpListener)

    const record = makeSessionRecord({ controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)

    expect(levelUpListener).not.toHaveBeenCalled()
  })

  it('emits levelUp with correct totalXp in the event payload', async () => {
    const globalState = makeGlobalState()
    globalState._store.set(XP_KEY, {
      totalXp: 980,
      level: 2,
      streakDays: 0,
      lastSessionDate: null,
    } as XpRecord)

    const manager = new XpManager(globalState)
    const levelUpListener = vi.fn()
    manager.on('levelUp', levelUpListener)

    // Controller-only (100 XP) + high ratio (50 XP) + streak (10 XP) = 160 XP → 1140 total → level 3
    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    await manager.awardSessionXp(record, 0)

    expect(levelUpListener).toHaveBeenCalledWith(
      expect.objectContaining({ previousLevel: 2, newLevel: 3, totalXp: 1140 }),
    )
  })
})

// ── XpManager.awardSessionXp() — AC6 (persistence) ──────────────────────────

describe('XpManager — awardSessionXp() AC6: XpRecord persisted in globalState', () => {
  it('persists updated XpRecord to globalState with key vibesense.xpRecord', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    await manager.awardSessionXp(record, 3)
    expect(globalState.update).toHaveBeenCalledWith(XP_KEY, expect.any(Object))
  })

  it('persisted record has correct shape (AC6)', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const record = makeSessionRecord({ controllerOnly: true, ratio: 1.0 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored).toMatchObject({
      totalXp: expect.any(Number),
      level: expect.any(Number),
      streakDays: expect.any(Number),
      lastSessionDate: expect.any(String),
    })
  })

  it('lastSessionDate is set to the session endedAt date (UTC)', async () => {
    const globalState = makeGlobalState()
    const manager = new XpManager(globalState)
    const endedAt = new Date('2026-04-01T15:30:00Z').getTime()
    const record = makeSessionRecord({ endedAt, controllerOnly: false, ratio: 0.5, keyboardActions: 5 })
    await manager.awardSessionXp(record, 0)
    const stored = getStoredXpRecord(globalState)
    expect(stored?.lastSessionDate).toBe('2026-04-01')
  })
})

// ── XpManager — error resilience (NFR-R1) ─────────────────────────────────────

describe('XpManager — error resilience (NFR-R1)', () => {
  it('does not throw when globalState.update() rejects', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))
    const manager = new XpManager(globalState)
    const record = makeSessionRecord()
    await expect(manager.awardSessionXp(record, 0)).resolves.toBeUndefined()
  })

  it('logs error when globalState.update() rejects (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))
    const manager = new XpManager(globalState)
    const record = makeSessionRecord()
    await manager.awardSessionXp(record, 0)
    expect(logger.error).toHaveBeenCalledWith(
      'XpManager: awardSessionXp() failed',
      expect.any(Error),
    )
  })

  it('load() does not throw when globalState.get throws', () => {
    const globalState = makeGlobalState()
    ;(globalState as unknown as { get: () => void }).get = () => { throw new Error('get error') }
    const manager = new XpManager(globalState)
    expect(() => manager.load()).not.toThrow()
    const result = manager.load()
    expect(result).toEqual({ totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null })
  })
})
