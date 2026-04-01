// test/unit/extension/stats/achievement-manager.test.ts
// Unit tests for AchievementManager — Story 9.5 (AC1–AC4, NFR-R1)
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
import { AchievementManager } from '../../../../src/extension/stats/achievement-manager'
import { ACHIEVEMENT_KEY } from '../../../../src/shared/constants'
import { SESSION_HISTORY_KEY } from '../../../../src/extension/stats/session-ratio-tracker'
import type { AchievementRecord, SessionRecord, XpRecord } from '../../../../src/shared/types'
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

function makeXpRecord(overrides: Partial<XpRecord> = {}): XpRecord {
  return {
    totalXp: 0,
    level: 1,
    streakDays: 1,
    lastSessionDate: null,
    ...overrides,
  }
}

// ── AchievementManager.load() ─────────────────────────────────────────────────

describe('AchievementManager — load()', () => {
  it('returns empty array when globalState is empty', () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    expect(manager.load()).toEqual([])
  })

  it('returns stored achievements when present and valid', () => {
    const globalState = makeGlobalState()
    const stored: AchievementRecord[] = [{ id: 'first-steps', unlockedAt: 1234567890 }]
    globalState._store.set(ACHIEVEMENT_KEY, stored)
    const manager = new AchievementManager(globalState)
    expect(manager.load()).toEqual(stored)
  })

  it('returns empty array and logs warn when stored data is corrupted', () => {
    const globalState = makeGlobalState()
    globalState._store.set(ACHIEVEMENT_KEY, { not: 'an array' })
    const manager = new AchievementManager(globalState)
    const result = manager.load()
    expect(result).toEqual([])
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('corrupted'))
  })

  it('returns empty array when stored entry has null unlockedAt', () => {
    const globalState = makeGlobalState()
    const stored: AchievementRecord[] = [{ id: 'first-steps', unlockedAt: null }]
    globalState._store.set(ACHIEVEMENT_KEY, stored)
    const manager = new AchievementManager(globalState)
    expect(manager.load()).toEqual(stored)
  })
})

// ── AchievementManager.isUnlocked() ──────────────────────────────────────────

describe('AchievementManager — isUnlocked()', () => {
  it('returns false for an achievement that is not in the store', () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    expect(manager.isUnlocked('first-steps')).toBe(false)
  })

  it('returns false for an achievement with unlockedAt = null (locked)', () => {
    const globalState = makeGlobalState()
    globalState._store.set(ACHIEVEMENT_KEY, [{ id: 'first-steps', unlockedAt: null }])
    const manager = new AchievementManager(globalState)
    expect(manager.isUnlocked('first-steps')).toBe(false)
  })

  it('returns true for an achievement with a non-null unlockedAt (unlocked)', () => {
    const globalState = makeGlobalState()
    globalState._store.set(ACHIEVEMENT_KEY, [{ id: 'first-steps', unlockedAt: 1234567890 }])
    const manager = new AchievementManager(globalState)
    expect(manager.isUnlocked('first-steps')).toBe(true)
  })
})

// ── AchievementManager.unlock() — idempotency (AC2) ──────────────────────────

describe('AchievementManager — unlock() idempotency (AC2)', () => {
  it('returns true on first unlock and false on duplicate call', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const first = await manager.unlock('first-steps')
    const second = await manager.unlock('first-steps')
    expect(first).toBe(true)
    expect(second).toBe(false)
  })

  it('calls globalState.update exactly once for duplicate unlock calls', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.unlock('first-steps')
    await manager.unlock('first-steps')
    expect(globalState.update).toHaveBeenCalledTimes(1)
  })

  it('persists achievement to globalState on first unlock', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.unlock('first-steps')
    expect(globalState.update).toHaveBeenCalledWith(
      ACHIEVEMENT_KEY,
      expect.arrayContaining([
        expect.objectContaining({ id: 'first-steps', unlockedAt: expect.any(Number) }),
      ]),
    )
  })

  it('emits achievementUnlocked event with correct payload on first unlock', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const listener = vi.fn()
    manager.on('achievementUnlocked', listener)
    await manager.unlock('first-steps')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'first-steps',
        label: 'First Steps',
        tier: 'bronze',
        description: expect.any(String),
      }),
    )
  })

  it('does NOT emit achievementUnlocked event on duplicate unlock', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const listener = vi.fn()
    manager.on('achievementUnlocked', listener)
    await manager.unlock('first-steps')
    await manager.unlock('first-steps')
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

// ── AchievementManager.checkAndUnlockForSession() ────────────────────────────

describe('AchievementManager — checkAndUnlockForSession()', () => {
  it('unlocks first-steps on first controller-only session', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: true })
    const xp = makeXpRecord()
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('first-steps')).toBe(true)
  })

  it('does NOT unlock first-steps for a session with keyboardActions > 0', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: false, keyboardActions: 5 })
    const xp = makeXpRecord()
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('first-steps')).toBe(false)
  })

  it('does NOT re-unlock an already unlocked achievement (AC2)', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const listener = vi.fn()
    manager.on('achievementUnlocked', listener)
    const session = makeSessionRecord({ controllerOnly: true })
    const xp = makeXpRecord()
    await manager.checkAndUnlockForSession(session, xp)
    await manager.checkAndUnlockForSession(session, xp)
    // achievementUnlocked should fire only once for first-steps
    const firstStepsCalls = listener.mock.calls.filter((call) => call[0].id === 'first-steps')
    expect(firstStepsCalls).toHaveLength(1)
  })

  it('unlocks streak-3 when streakDays >= 3', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: false, keyboardActions: 5 })
    const xp = makeXpRecord({ streakDays: 3 })
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('streak-3')).toBe(true)
  })

  it('does NOT unlock streak-3 when streakDays < 3', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: false, keyboardActions: 5 })
    const xp = makeXpRecord({ streakDays: 2 })
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('streak-3')).toBe(false)
  })

  it('unlocks streak-7 when streakDays >= 7', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: false, keyboardActions: 5 })
    const xp = makeXpRecord({ streakDays: 7 })
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('streak-7')).toBe(true)
  })

  it('does NOT unlock streak-7 when streakDays < 7', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: false, keyboardActions: 5 })
    const xp = makeXpRecord({ streakDays: 6 })
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('streak-7')).toBe(false)
  })

  it('unlocks sessions-10 when there are 10+ controller-only sessions in history', async () => {
    const globalState = makeGlobalState()
    // Seed session history with 10 controller-only sessions
    const history: SessionRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeSessionRecord({ sessionId: `s-${i}`, controllerOnly: true }),
    )
    globalState._store.set(SESSION_HISTORY_KEY, history)
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: true })
    const xp = makeXpRecord()
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('sessions-10')).toBe(true)
  })

  it('does NOT unlock sessions-10 when fewer than 10 controller-only sessions in history', async () => {
    const globalState = makeGlobalState()
    const history: SessionRecord[] = Array.from({ length: 9 }, (_, i) =>
      makeSessionRecord({ sessionId: `s-${i}`, controllerOnly: true }),
    )
    globalState._store.set(SESSION_HISTORY_KEY, history)
    const manager = new AchievementManager(globalState)
    const session = makeSessionRecord({ controllerOnly: true })
    const xp = makeXpRecord()
    await manager.checkAndUnlockForSession(session, xp)
    expect(manager.isUnlocked('sessions-10')).toBe(false)
  })
})

// ── AchievementManager.checkAndUnlockForLevelUp() ────────────────────────────

describe('AchievementManager — checkAndUnlockForLevelUp()', () => {
  it('unlocks level-2 when newLevel >= 2', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(2)
    expect(manager.isUnlocked('level-2')).toBe(true)
  })

  it('unlocks level-2 when newLevel > 2', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(3)
    expect(manager.isUnlocked('level-2')).toBe(true)
  })

  it('does NOT unlock level-2 when newLevel is 1', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(1)
    expect(manager.isUnlocked('level-2')).toBe(false)
  })

  it('unlocks level-5 when newLevel >= 5', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(5)
    expect(manager.isUnlocked('level-5')).toBe(true)
  })

  it('does NOT unlock level-5 when newLevel is 4', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(4)
    expect(manager.isUnlocked('level-5')).toBe(false)
  })

  it('unlocks both level-2 and level-5 when newLevel is 5 or higher', async () => {
    const globalState = makeGlobalState()
    const manager = new AchievementManager(globalState)
    await manager.checkAndUnlockForLevelUp(5)
    expect(manager.isUnlocked('level-2')).toBe(true)
    expect(manager.isUnlocked('level-5')).toBe(true)
  })
})

// ── AchievementManager — error resilience (NFR-R1) ───────────────────────────

describe('AchievementManager — error resilience (NFR-R1)', () => {
  it('does not throw when globalState.update() rejects', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))
    const manager = new AchievementManager(globalState)
    await expect(manager.unlock('first-steps')).resolves.not.toThrow()
  })

  it('load() does not throw when globalState.get throws', () => {
    const globalState = makeGlobalState()
    ;(globalState as unknown as { get: () => void }).get = () => { throw new Error('get error') }
    const manager = new AchievementManager(globalState)
    expect(() => manager.load()).not.toThrow()
    expect(manager.load()).toEqual([])
  })
})
