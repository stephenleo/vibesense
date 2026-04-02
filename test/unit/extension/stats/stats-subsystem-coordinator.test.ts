// test/unit/extension/stats/stats-subsystem-coordinator.test.ts
// Unit tests for StatsSubsystemCoordinator — Story 12.1 (AC1–AC8)

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

// ── Hoisted mock state (available before module code runs) ────────────────────
const mocks = vi.hoisted(() => {
  let capturedLevelUpListener: ((event: { previousLevel: number; newLevel: number; totalXp: number }) => void) | undefined
  let capturedAchievementUnlockedListener: ((event: { id: string; label: string; tier: string; description: string }) => void) | undefined

  const ratioTracker = {
    recordKeyboardAction: vi.fn(),
    recordControllerAction: vi.fn(),
    recordFeatureUsed: vi.fn(),
    getDistinctFeatureCount: vi.fn(() => 0),
    getDistinctFeatureNames: vi.fn(() => [] as string[]),
    finalizeSession: vi.fn(async () => {}),
    getCurrentStats: vi.fn(() => ({ controllerActions: 0, keyboardActions: 0, ratio: 1.0 })),
    getSessionStartTime: vi.fn(() => Date.now()),
  }

  const xpManager = {
    load: vi.fn(() => ({ totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null as string | null })),
    awardSessionXp: vi.fn(async () => {}),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'levelUp') {
        capturedLevelUpListener = listener as typeof capturedLevelUpListener
      }
      return xpManager
    }),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    getCapturedLevelUpListener: () => capturedLevelUpListener,
    resetListeners: () => { capturedLevelUpListener = undefined },
  }

  const achievementManager = {
    load: vi.fn(() => [] as unknown[]),
    checkAndUnlockForLevelUp: vi.fn(async () => {}),
    checkAndUnlockForSession: vi.fn(async () => {}),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (event === 'achievementUnlocked') {
        capturedAchievementUnlockedListener = listener as typeof capturedAchievementUnlockedListener
      }
      return achievementManager
    }),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    getCapturedUnlockedListener: () => capturedAchievementUnlockedListener,
    resetListeners: () => { capturedAchievementUnlockedListener = undefined },
  }

  const sessionHealthManager = {
    start: vi.fn(),
    dispose: vi.fn(),
    notifyConnected: vi.fn(),
  }

  const burstPanelManager = {
    show: vi.fn(),
    dispose: vi.fn(),
  }

  return {
    ratioTracker,
    xpManager,
    achievementManager,
    sessionHealthManager,
    burstPanelManager,
    SessionHistorySchemaSafeParse: vi.fn((raw: unknown) => ({ success: true, data: Array.isArray(raw) ? raw : [] })),
  }
})

// ── Module mocks — use class keyword per vitest 4 class support ──────────────
vi.mock('../../../../src/extension/stats/session-ratio-tracker', () => ({
  SessionRatioTracker: vi.fn().mockImplementation(class { constructor() { return mocks.ratioTracker } }),
  SESSION_HISTORY_KEY: 'vibesense.sessionHistory',
}))

vi.mock('../../../../src/extension/stats/xp-manager', () => ({
  XpManager: vi.fn().mockImplementation(class { constructor() { return mocks.xpManager } }),
}))

vi.mock('../../../../src/extension/stats/achievement-manager', () => ({
  AchievementManager: vi.fn().mockImplementation(class { constructor() { return mocks.achievementManager } }),
}))

vi.mock('../../../../src/extension/stats/session-health-manager', () => ({
  SessionHealthManager: vi.fn().mockImplementation(class { constructor() { return mocks.sessionHealthManager } }),
}))

vi.mock('../../../../src/extension/panels/achievement-burst-panel', () => ({
  AchievementBurstPanelManager: vi.fn().mockImplementation(class { constructor() { return mocks.burstPanelManager } }),
}))

vi.mock('../../../../src/extension/stats/session-record-schema', () => ({
  SessionHistorySchema: {
    safeParse: (raw: unknown) => mocks.SessionHistorySchemaSafeParse(raw),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { StatsSubsystemCoordinator } from '../../../../src/extension/stats/stats-subsystem-coordinator'
import type * as vscode from 'vscode'
import { SESSION_HISTORY_KEY, SessionRatioTracker } from '../../../../src/extension/stats/session-ratio-tracker'
import { XpManager } from '../../../../src/extension/stats/xp-manager'
import { AchievementManager } from '../../../../src/extension/stats/achievement-manager'
import { SessionHealthManager } from '../../../../src/extension/stats/session-health-manager'
import { AchievementBurstPanelManager } from '../../../../src/extension/panels/achievement-burst-panel'
import type { SessionRecord } from '../../../../src/shared/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(initialData: Record<string, unknown> = {}): vscode.Memento {
  const store = new Map<string, unknown>(Object.entries(initialData))
  return {
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento
}

function makeContext(globalState?: vscode.Memento): vscode.ExtensionContext {
  return {
    globalState: globalState ?? makeGlobalState(),
    subscriptions: [],
  } as unknown as vscode.ExtensionContext
}

const slidePanelManager = {} as never

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

function makeCoordinator(globalState?: vscode.Memento): StatsSubsystemCoordinator {
  const context = makeContext(globalState)
  return new StatsSubsystemCoordinator(context, slidePanelManager)
}

// ── Reset before each test ────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  // Restore constructor mock implementations after clearAllMocks resets them
  // vitest 4: must use class keyword per class support
  const rt = mocks.ratioTracker; vi.mocked(SessionRatioTracker).mockImplementation(class { constructor() { return rt } } as never)
  const xp = mocks.xpManager; vi.mocked(XpManager).mockImplementation(class { constructor() { return xp } } as never)
  const am = mocks.achievementManager; vi.mocked(AchievementManager).mockImplementation(class { constructor() { return am } } as never)
  const shm = mocks.sessionHealthManager; vi.mocked(SessionHealthManager).mockImplementation(class { constructor() { return shm } } as never)
  const bpm = mocks.burstPanelManager; vi.mocked(AchievementBurstPanelManager).mockImplementation(class { constructor() { return bpm } } as never)
  // Restore safe-parse default after clearAllMocks resets it
  mocks.SessionHistorySchemaSafeParse.mockImplementation(
    (raw: unknown) => ({ success: true, data: Array.isArray(raw) ? raw : [] })
  )
  // Restore .on() behaviour so listener capture still works after clearAllMocks
  mocks.xpManager.on.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
    return mocks.xpManager
  })
  mocks.achievementManager.on.mockImplementation((event: string, listener: (...args: unknown[]) => void) => {
    return mocks.achievementManager
  })
  mocks.ratioTracker.getDistinctFeatureCount.mockReturnValue(0)
  mocks.ratioTracker.getDistinctFeatureNames.mockReturnValue([])
  mocks.ratioTracker.finalizeSession.mockResolvedValue(undefined)
  mocks.xpManager.awardSessionXp.mockResolvedValue(undefined)
  mocks.xpManager.load.mockReturnValue({ totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null })
  mocks.achievementManager.checkAndUnlockForSession.mockResolvedValue(undefined)
  mocks.achievementManager.checkAndUnlockForLevelUp.mockResolvedValue(undefined)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StatsSubsystemCoordinator — instantiation (AC1)', () => {
  it('creates coordinator without throwing', () => {
    expect(() => makeCoordinator()).not.toThrow()
  })

  it('pushes achievementBurstPanelManager to context.subscriptions (subtask 1.14)', () => {
    const context = makeContext()
    new StatsSubsystemCoordinator(context, slidePanelManager)
    expect((context.subscriptions as unknown[]).length).toBeGreaterThan(0)
  })

  it('wires levelUp listener on xpManager (subtask 1.3)', () => {
    makeCoordinator()
    expect(mocks.xpManager.on).toHaveBeenCalledWith('levelUp', expect.any(Function))
  })

  it('wires achievementUnlocked listener on achievementManager (subtask 1.4)', () => {
    makeCoordinator()
    expect(mocks.achievementManager.on).toHaveBeenCalledWith('achievementUnlocked', expect.any(Function))
  })
})

describe('StatsSubsystemCoordinator — start() (AC4)', () => {
  it('calls sessionHealthManager.start()', () => {
    const coordinator = makeCoordinator()
    coordinator.start()
    expect(mocks.sessionHealthManager.start).toHaveBeenCalledTimes(1)
  })
})

describe('StatsSubsystemCoordinator — dispose() (AC4, subtask 3.4)', () => {
  it('calls sessionHealthManager.dispose()', () => {
    const coordinator = makeCoordinator()
    coordinator.dispose()
    expect(mocks.sessionHealthManager.dispose).toHaveBeenCalledTimes(1)
  })

  it('calls achievementManager.removeAllListeners()', () => {
    const coordinator = makeCoordinator()
    coordinator.dispose()
    expect(mocks.achievementManager.removeAllListeners).toHaveBeenCalled()
  })

  it('removes all listeners from coordinator itself', () => {
    const coordinator = makeCoordinator()
    coordinator.on('achievementUnlocked', vi.fn())
    coordinator.dispose()
    expect(coordinator.listenerCount('achievementUnlocked')).toBe(0)
  })
})

describe('StatsSubsystemCoordinator — notifyConnected() (AC5, subtask 3.2)', () => {
  it('delegates notifyConnected(true) to sessionHealthManager', () => {
    const coordinator = makeCoordinator()
    coordinator.notifyConnected(true)
    expect(mocks.sessionHealthManager.notifyConnected).toHaveBeenCalledWith(true)
  })

  it('delegates notifyConnected(false) to sessionHealthManager', () => {
    const coordinator = makeCoordinator()
    coordinator.notifyConnected(false)
    expect(mocks.sessionHealthManager.notifyConnected).toHaveBeenCalledWith(false)
  })
})

describe('StatsSubsystemCoordinator — achievementUnlocked event (AC6, subtask 3.3)', () => {
  it('shows burst panel when achievementManager emits achievementUnlocked', () => {
    makeCoordinator()
    // Retrieve the listener that was passed to achievementManager.on
    const onCalls = mocks.achievementManager.on.mock.calls
    const unlockedCall = onCalls.find(c => c[0] === 'achievementUnlocked')
    const listener = unlockedCall?.[1] as ((event: { id: string; label: string; tier: string; description: string }) => void) | undefined

    const event = { id: 'first-steps', label: 'First Steps', tier: 'bronze', description: 'Complete your first session' }
    listener?.(event)

    expect(mocks.burstPanelManager.show).toHaveBeenCalledWith(
      'first-steps', 'First Steps', 'bronze', 'Complete your first session',
    )
  })

  it('re-emits achievementUnlocked on coordinator for hardware feedback', () => {
    const coordinator = makeCoordinator()
    const hardwareSpy = vi.fn()
    coordinator.on('achievementUnlocked', hardwareSpy)

    const onCalls = mocks.achievementManager.on.mock.calls
    const unlockedCall = onCalls.find(c => c[0] === 'achievementUnlocked')
    const listener = unlockedCall?.[1] as ((event: { id: string; label: string; tier: string; description: string }) => void) | undefined

    const event = { id: 'first-steps', label: 'First Steps', tier: 'bronze', description: 'Desc' }
    listener?.(event)

    expect(hardwareSpy).toHaveBeenCalledWith(event)
  })

  it('calls checkAndUnlockForLevelUp when xpManager emits levelUp (AC2)', async () => {
    makeCoordinator()
    const onCalls = mocks.xpManager.on.mock.calls
    const levelUpCall = onCalls.find(c => c[0] === 'levelUp')
    const listener = levelUpCall?.[1] as ((event: { previousLevel: number; newLevel: number; totalXp: number }) => void) | undefined

    listener?.({ previousLevel: 1, newLevel: 2, totalXp: 500 })
    await Promise.resolve()

    expect(mocks.achievementManager.checkAndUnlockForLevelUp).toHaveBeenCalledWith(2)
  })
})

describe('StatsSubsystemCoordinator — finalizeSession() (AC3, subtask 3.1)', () => {
  it('calls ratioTracker.finalizeSession with globalState', async () => {
    const globalState = makeGlobalState()
    const coordinator = makeCoordinator(globalState)
    await coordinator.finalizeSession(globalState, null)
    expect(mocks.ratioTracker.finalizeSession).toHaveBeenCalledWith(globalState)
  })

  it('awards XP and checks achievements when session record found', async () => {
    const sessionRecord = makeSessionRecord()
    const globalState = makeGlobalState({ [SESSION_HISTORY_KEY]: [sessionRecord] })
    mocks.SessionHistorySchemaSafeParse.mockReturnValueOnce({ success: true, data: [sessionRecord] })
    mocks.ratioTracker.getDistinctFeatureCount.mockReturnValue(3)

    const coordinator = makeCoordinator(globalState)
    await coordinator.finalizeSession(globalState, null)

    expect(mocks.xpManager.awardSessionXp).toHaveBeenCalledWith(sessionRecord, 3)
    expect(mocks.achievementManager.checkAndUnlockForSession).toHaveBeenCalled()
  })

  it('returns sessionRecord and distinctFeatureNames when session found', async () => {
    const sessionRecord = makeSessionRecord()
    const globalState = makeGlobalState({ [SESSION_HISTORY_KEY]: [sessionRecord] })
    mocks.SessionHistorySchemaSafeParse.mockReturnValueOnce({ success: true, data: [sessionRecord] })
    mocks.ratioTracker.getDistinctFeatureNames.mockReturnValue(['haptic', 'radial-wheel'])

    const coordinator = makeCoordinator(globalState)
    const result = await coordinator.finalizeSession(globalState, null)

    expect(result.sessionRecord).toEqual(sessionRecord)
    expect(result.distinctFeatureNames).toEqual(['haptic', 'radial-wheel'])
  })

  it('returns undefined sessionRecord when no session history exists', async () => {
    const globalState = makeGlobalState({ [SESSION_HISTORY_KEY]: [] })
    mocks.SessionHistorySchemaSafeParse.mockReturnValueOnce({ success: true, data: [] })

    const coordinator = makeCoordinator(globalState)
    const result = await coordinator.finalizeSession(globalState, null)

    expect(result.sessionRecord).toBeUndefined()
    expect(mocks.xpManager.awardSessionXp).not.toHaveBeenCalled()
  })

  it('awards XP before checking session achievements (correct order)', async () => {
    const callOrder: string[] = []
    mocks.xpManager.awardSessionXp.mockImplementation(async () => { callOrder.push('awardXp') })
    mocks.achievementManager.checkAndUnlockForSession.mockImplementation(async () => { callOrder.push('checkAchievements') })

    const sessionRecord = makeSessionRecord()
    const globalState = makeGlobalState({ [SESSION_HISTORY_KEY]: [sessionRecord] })
    mocks.SessionHistorySchemaSafeParse.mockReturnValueOnce({ success: true, data: [sessionRecord] })

    const coordinator = makeCoordinator(globalState)
    await coordinator.finalizeSession(globalState, null)

    expect(callOrder).toEqual(['awardXp', 'checkAchievements'])
  })
})

describe('StatsSubsystemCoordinator — delegation methods (subtask 3.5)', () => {
  it('recordKeyboardAction() delegates to ratioTracker', () => {
    const coordinator = makeCoordinator()
    coordinator.recordKeyboardAction()
    expect(mocks.ratioTracker.recordKeyboardAction).toHaveBeenCalledTimes(1)
  })

  it('recordControllerAction() delegates to ratioTracker', () => {
    const coordinator = makeCoordinator()
    coordinator.recordControllerAction()
    expect(mocks.ratioTracker.recordControllerAction).toHaveBeenCalledTimes(1)
  })

  it('recordFeatureUsed() delegates to ratioTracker', () => {
    const coordinator = makeCoordinator()
    coordinator.recordFeatureUsed('haptic')
    expect(mocks.ratioTracker.recordFeatureUsed).toHaveBeenCalledWith('haptic')
  })

  it('getDistinctFeatureCount() delegates to ratioTracker', () => {
    mocks.ratioTracker.getDistinctFeatureCount.mockReturnValue(5)
    const coordinator = makeCoordinator()
    expect(coordinator.getDistinctFeatureCount()).toBe(5)
  })

  it('getDistinctFeatureNames() delegates to ratioTracker', () => {
    mocks.ratioTracker.getDistinctFeatureNames.mockReturnValue(['haptic', 'radial-wheel'])
    const coordinator = makeCoordinator()
    expect(coordinator.getDistinctFeatureNames()).toEqual(['haptic', 'radial-wheel'])
  })

  it('getRatioTracker() returns the internal ratioTracker instance', () => {
    const coordinator = makeCoordinator()
    expect(coordinator.getRatioTracker()).toBe(mocks.ratioTracker)
  })
})
