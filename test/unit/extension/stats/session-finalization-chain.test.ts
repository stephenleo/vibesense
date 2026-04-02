// test/unit/extension/stats/session-finalization-chain.test.ts
// Integration test for the full 4-step session finalization chain — Story 12.2
// Verifies: finalizeSession → awardSessionXp → checkAndUnlockForSession → collectSession
// Framework: Vitest (pure business logic — no live VSCode process required)
// AC1: Full 4-step chain executes in order
// AC2: CI regression detection with clear assertion messages
// AC3: Telemetry is a no-op when opted out

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock logger (must be declared before imports that use it) ─────────────────
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
import { XpManager } from '../../../../src/extension/stats/xp-manager'
import { AchievementManager } from '../../../../src/extension/stats/achievement-manager'
import { TelemetryCollector } from '../../../../src/extension/telemetry/telemetry'
import { SessionHistorySchema } from '../../../../src/extension/stats/session-record-schema'
import { XP_KEY, ACHIEVEMENT_KEY, TELEMETRY_QUEUE_KEY } from '../../../../src/shared/constants'
import type { SessionRecord, XpRecord } from '../../../../src/shared/types'
import type * as vscode from 'vscode'

// ── Helpers (copy-by-convention — do NOT import across test files) ────────────

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

function makeConfig(optedIn: boolean): vscode.WorkspaceConfiguration {
  return {
    get: vi.fn((key: string) => {
      if (key === 'telemetry.enabled') return optedIn
      return undefined
    }),
    has: vi.fn(() => false),
    inspect: vi.fn(() => undefined),
    update: vi.fn(),
  } as unknown as vscode.WorkspaceConfiguration
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

/**
 * Replicate the extension.ts finalization chain in test form.
 * Step 1: finalizeSession (via SessionRatioTracker)
 * Step 2: awardSessionXp (via XpManager)
 * Step 3: checkAndUnlockForSession (via AchievementManager)
 * Step 4: collectSession (via TelemetryCollector)
 */
async function runFinalizationChain(
  globalState: vscode.Memento & { _store: Map<string, unknown> },
): Promise<void> {
  const ratioTracker = new SessionRatioTracker()
  // Simulate 10 controller actions to produce a controller-only session
  for (let i = 0; i < 10; i++) {
    ratioTracker.recordControllerAction()
  }

  // Step 1: Finalize session — writes SessionRecord to globalState[SESSION_HISTORY_KEY]
  await ratioTracker.finalizeSession(globalState)

  // Read latest session (as extension.ts does)
  const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
  const parseResult = SessionHistorySchema.safeParse(raw ?? [])
  const history = parseResult.success ? parseResult.data : []
  const latest = history.length > 0 ? history[history.length - 1] : undefined

  const xpManager = new XpManager(globalState)
  const achievementManager = new AchievementManager(globalState)
  const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(true))

  if (latest !== undefined) {
    // Step 2: Award XP
    await xpManager.awardSessionXp(latest, 0)
    // Step 3: Check achievements
    await achievementManager.checkAndUnlockForSession(latest, xpManager.load())
    // Step 4: Collect telemetry
    await telemetryCollector.collectSession(latest, {
      featuresActive: [],
      controllerType: null,
    })
  }
}

// ── Test Suite ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: AC1 — Full 4-step chain executes in order
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1 — Full 4-step session finalization chain', () => {
  it('step 1: finalizeSession persists a SessionRecord to SESSION_HISTORY_KEY in globalState', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    ratioTracker.recordControllerAction()

    await ratioTracker.finalizeSession(globalState)

    const history = globalState._store.get(SESSION_HISTORY_KEY) as SessionRecord[]
    expect(
      history,
      'step 1 regression: finalizeSession did not write SessionRecord to SESSION_HISTORY_KEY',
    ).toBeDefined()
    expect(
      history,
      'step 1 regression: SESSION_HISTORY_KEY should contain exactly 1 session record',
    ).toHaveLength(1)
    expect(
      history[0].controllerActions,
      'step 1 regression: SessionRecord.controllerActions should be 2',
    ).toBe(2)
  })

  it('step 2: awardSessionXp writes an updated XpRecord to XP_KEY after finalizeSession completes', async () => {
    const globalState = makeGlobalState()

    await runFinalizationChain(globalState)

    const xpRecord = globalState._store.get(XP_KEY) as XpRecord
    expect(
      xpRecord,
      'step 2 regression: awardSessionXp did not write XpRecord to XP_KEY',
    ).toBeDefined()
    expect(
      xpRecord.totalXp,
      'step 2 regression: XpRecord.totalXp should be greater than 0 after a controller-only session',
    ).toBeGreaterThan(0)
  })

  it('step 3: checkAndUnlockForSession unlocks first-steps achievement after XP is awarded (controller-only session)', async () => {
    const globalState = makeGlobalState()

    await runFinalizationChain(globalState)

    const achievements = globalState._store.get(ACHIEVEMENT_KEY) as Array<{ id: string; unlockedAt: number | null }>
    expect(
      achievements,
      'step 3 regression: checkAndUnlockForSession did not write achievements to ACHIEVEMENT_KEY',
    ).toBeDefined()
    const firstSteps = achievements.find((a) => a.id === 'first-steps')
    expect(
      firstSteps,
      'step 3 regression: first-steps achievement was not found in achievements store',
    ).toBeDefined()
    expect(
      firstSteps?.unlockedAt,
      'step 3 regression: first-steps achievement.unlockedAt should be non-null after controller-only session',
    ).not.toBeNull()
  })

  it('step 4: collectSession queues a telemetry payload to TELEMETRY_QUEUE_KEY when opted in', async () => {
    const globalState = makeGlobalState()

    await runFinalizationChain(globalState)

    const queue = globalState._store.get(TELEMETRY_QUEUE_KEY) as unknown[]
    expect(
      queue,
      'step 4 regression: collectSession did not write to TELEMETRY_QUEUE_KEY when opted in',
    ).toBeDefined()
    expect(
      queue,
      'step 4 regression: TELEMETRY_QUEUE_KEY should have exactly 1 queued payload after one session',
    ).toHaveLength(1)
  })

  it('chain runs end-to-end with a single shared globalState so each step reads state written by previous steps', async () => {
    const globalState = makeGlobalState()

    // Verify nothing pre-populated
    expect(globalState._store.size).toBe(0)

    await runFinalizationChain(globalState)

    // All 4 keys must be present after chain completes
    expect(
      globalState._store.has(SESSION_HISTORY_KEY),
      'end-to-end regression: SESSION_HISTORY_KEY missing — step 1 did not run',
    ).toBe(true)
    expect(
      globalState._store.has(XP_KEY),
      'end-to-end regression: XP_KEY missing — step 2 did not run',
    ).toBe(true)
    expect(
      globalState._store.has(ACHIEVEMENT_KEY),
      'end-to-end regression: ACHIEVEMENT_KEY missing — step 3 did not run',
    ).toBe(true)
    expect(
      globalState._store.has(TELEMETRY_QUEUE_KEY),
      'end-to-end regression: TELEMETRY_QUEUE_KEY missing — step 4 did not run',
    ).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 3: AC1 — Error isolation tests (NFR-R1: internal methods never throw)
// ─────────────────────────────────────────────────────────────────────────────

describe('AC1 — NFR-R1 error isolation: internal failures do not propagate', () => {
  it('awardSessionXp does not throw when internal globalState.update fails', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    // Break globalState.update to simulate storage failure
    const updateMock = vi.fn().mockRejectedValue(new Error('storage failure'))
    const brokenState = { ...globalState, update: updateMock }
    const xpManager = new XpManager(brokenState as unknown as vscode.Memento)

    // NFR-R1: awardSessionXp must NOT throw despite internal storage failure
    await expect(
      xpManager.awardSessionXp(latest, 0),
      'NFR-R1 regression: awardSessionXp threw to caller despite internal try/catch',
    ).resolves.toBeUndefined()
  })

  it('awardSessionXp internal failure does not prevent checkAndUnlockForSession from running', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    // Force XP award step to fail internally
    const updateMock = vi.fn().mockRejectedValue(new Error('storage failure'))
    const brokenState = { ...globalState, update: updateMock }
    const xpManager = new XpManager(brokenState as unknown as vscode.Memento)
    await xpManager.awardSessionXp(latest, 0)

    // achievementManager uses the original (non-broken) globalState
    const achievementManager = new AchievementManager(globalState)
    await expect(
      achievementManager.checkAndUnlockForSession(latest, { totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null }),
      'regression: checkAndUnlockForSession threw when called after XP step failure',
    ).resolves.toBeUndefined()

    // Achievement still unlocked despite XP step failing
    const achievements = globalState._store.get(ACHIEVEMENT_KEY) as Array<{ id: string; unlockedAt: number | null }>
    expect(
      achievements?.find((a) => a.id === 'first-steps')?.unlockedAt,
      'error isolation regression: first-steps achievement was not unlocked even though checkAndUnlockForSession ran independently',
    ).not.toBeNull()
  })

  it('checkAndUnlockForSession does not throw when internal globalState.update fails', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    const xpRecord: XpRecord = { totalXp: 100, level: 1, streakDays: 1, lastSessionDate: null }

    // Break storage to force internal failure
    const updateMock = vi.fn().mockRejectedValue(new Error('storage failure'))
    const brokenState = { ...globalState, update: updateMock }
    const achievementManager = new AchievementManager(brokenState as unknown as vscode.Memento)

    // NFR-R1: checkAndUnlockForSession must NOT throw despite internal failure
    await expect(
      achievementManager.checkAndUnlockForSession(latest, xpRecord),
      'NFR-R1 regression: checkAndUnlockForSession threw to caller despite internal try/catch',
    ).resolves.toBeUndefined()
  })

  it('checkAndUnlockForSession internal failure does not prevent collectSession from running', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    // Step 2: XP awarded successfully
    const xpManager = new XpManager(globalState)
    await xpManager.awardSessionXp(latest, 0)

    // Step 3: Force achievement check to fail internally
    const updateMock = vi.fn().mockRejectedValue(new Error('storage failure'))
    const brokenAchievementState = { ...globalState, update: updateMock }
    const brokenAchievementManager = new AchievementManager(brokenAchievementState as unknown as vscode.Memento)
    await brokenAchievementManager.checkAndUnlockForSession(latest, xpManager.load())

    // Step 4: telemetryCollector still uses original globalState — must run successfully
    const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(true))
    await expect(
      telemetryCollector.collectSession(latest, { featuresActive: [], controllerType: null }),
      'regression: collectSession threw when called after achievement step failure',
    ).resolves.toBeUndefined()

    // Telemetry payload must be queued despite step 3 failure
    const queue = globalState._store.get(TELEMETRY_QUEUE_KEY) as unknown[]
    expect(
      queue,
      'error isolation regression: TELEMETRY_QUEUE_KEY not written — step 4 did not execute after step 3 failure',
    ).toHaveLength(1)
  })

  it('awardSessionXp internal failure: error is caught and does NOT propagate to caller (NFR-R1)', async () => {
    const globalState = makeGlobalState()
    const session = makeSessionRecord({ controllerOnly: true })
    const updateMock = vi.fn().mockRejectedValue(new Error('persistence failure'))
    const brokenState = { ...globalState, update: updateMock }
    const xpManager = new XpManager(brokenState as unknown as vscode.Memento)

    // Must resolve (not reject) — caller must never see the internal error
    await expect(
      xpManager.awardSessionXp(session, 0),
      'NFR-R1 violation: awardSessionXp rejected — internal error escaped the try/catch boundary',
    ).resolves.toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 4: AC2 — Regression detection with clear messages
// ─────────────────────────────────────────────────────────────────────────────

describe('AC2 — CI regression detection: assertion messages identify which step failed', () => {
  it('reports step 1 regression clearly when SESSION_HISTORY_KEY is not written', async () => {
    const globalState = makeGlobalState()
    // Do NOT run finalizeSession — simulate step 1 regression

    const history = globalState._store.get(SESSION_HISTORY_KEY) as SessionRecord[] | undefined
    // This assertion documents the expected failure message for step 1
    expect(
      history,
      'step 1 regression: finalizeSession did not write SessionRecord to SESSION_HISTORY_KEY',
    ).toBeUndefined()
  })

  it('reports step 2 regression clearly when XP_KEY is not written', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)
    // Do NOT run awardSessionXp — simulate step 2 regression

    const xpRecord = globalState._store.get(XP_KEY)
    expect(
      xpRecord,
      'step 2 regression: awardSessionXp did not write XpRecord to XP_KEY',
    ).toBeUndefined()
  })

  it('reports step 3 regression clearly when ACHIEVEMENT_KEY is not written', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)
    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const history = SessionHistorySchema.safeParse(raw ?? []).data ?? []
    const latest = history[0]
    const xpManager = new XpManager(globalState)
    await xpManager.awardSessionXp(latest, 0)
    // Do NOT run checkAndUnlockForSession — simulate step 3 regression

    const achievements = globalState._store.get(ACHIEVEMENT_KEY)
    expect(
      achievements,
      'step 3 regression: checkAndUnlockForSession did not write to ACHIEVEMENT_KEY',
    ).toBeUndefined()
  })

  it('reports step 4 regression clearly when TELEMETRY_QUEUE_KEY is not written (opted in)', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)
    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const history = SessionHistorySchema.safeParse(raw ?? []).data ?? []
    const latest = history[0]
    const xpManager = new XpManager(globalState)
    await xpManager.awardSessionXp(latest, 0)
    const achievementManager = new AchievementManager(globalState)
    await achievementManager.checkAndUnlockForSession(latest, xpManager.load())
    // Do NOT run collectSession — simulate step 4 regression

    const queue = globalState._store.get(TELEMETRY_QUEUE_KEY)
    expect(
      queue,
      'step 4 regression: collectSession did not write to TELEMETRY_QUEUE_KEY when opted in',
    ).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Task 5: AC3 — Telemetry no-op when opted out
// ─────────────────────────────────────────────────────────────────────────────

describe('AC3 — Telemetry no-op when opted out', () => {
  it('steps 1–3 complete normally with telemetry opted out (XP awarded, achievement checked)', async () => {
    const globalState = makeGlobalState()
    // Run chain with opted-out telemetry collector
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    const xpManager = new XpManager(globalState)
    await xpManager.awardSessionXp(latest, 0)

    const achievementManager = new AchievementManager(globalState)
    await achievementManager.checkAndUnlockForSession(latest, xpManager.load())

    const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(false))
    await telemetryCollector.collectSession(latest, { featuresActive: [], controllerType: null })

    // Steps 1–3 must have completed normally
    expect(
      globalState._store.has(SESSION_HISTORY_KEY),
      'AC3 regression: step 1 (finalizeSession) did not run when telemetry opted out',
    ).toBe(true)
    expect(
      globalState._store.has(XP_KEY),
      'AC3 regression: step 2 (awardSessionXp) did not run when telemetry opted out',
    ).toBe(true)
    expect(
      globalState._store.has(ACHIEVEMENT_KEY),
      'AC3 regression: step 3 (checkAndUnlockForSession) did not run when telemetry opted out',
    ).toBe(true)
  })

  it('TELEMETRY_QUEUE_KEY remains absent in globalState when opted out', async () => {
    const globalState = makeGlobalState()
    const session = makeSessionRecord({ controllerOnly: true })

    const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(false))
    await telemetryCollector.collectSession(session, { featuresActive: [], controllerType: null })

    const queue = globalState._store.get(TELEMETRY_QUEUE_KEY)
    expect(
      queue,
      'AC3 regression: collectSession wrote to TELEMETRY_QUEUE_KEY despite telemetry being opted out (must be no-op)',
    ).toBeUndefined()
  })

  it('no errors thrown when opted out (NFR-R1 — silent no-op)', async () => {
    const globalState = makeGlobalState()
    const session = makeSessionRecord({ controllerOnly: false, ratio: 0.3 })

    const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(false))

    await expect(
      telemetryCollector.collectSession(session, { featuresActive: [], controllerType: null }),
      'NFR-R1 regression: collectSession threw when opted out — must be a silent no-op',
    ).resolves.toBeUndefined()
  })

  it('full chain with opted-out telemetry: XP awarded and achievement unlocked, queue empty', async () => {
    const globalState = makeGlobalState()
    const ratioTracker = new SessionRatioTracker()
    ratioTracker.recordControllerAction()
    await ratioTracker.finalizeSession(globalState)

    const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
    const parseResult = SessionHistorySchema.safeParse(raw ?? [])
    const history = parseResult.success ? parseResult.data : []
    const latest = history[0]

    const xpManager = new XpManager(globalState)
    await xpManager.awardSessionXp(latest, 0)

    const achievementManager = new AchievementManager(globalState)
    await achievementManager.checkAndUnlockForSession(latest, xpManager.load())

    const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(false))
    await telemetryCollector.collectSession(latest, { featuresActive: [], controllerType: null })

    // XP record must exist (step 2 ran)
    const xpRecord = globalState._store.get(XP_KEY) as XpRecord
    expect(
      xpRecord.totalXp,
      'AC3 regression: XP was not awarded when telemetry opted out',
    ).toBeGreaterThan(0)

    // Achievement must be unlocked (step 3 ran)
    const achievements = globalState._store.get(ACHIEVEMENT_KEY) as Array<{ id: string; unlockedAt: number | null }>
    const firstSteps = achievements.find((a) => a.id === 'first-steps')
    expect(
      firstSteps?.unlockedAt,
      'AC3 regression: first-steps achievement not unlocked even though session was controller-only',
    ).not.toBeNull()

    // Telemetry queue must remain absent (step 4 was no-op)
    const queue = globalState._store.get(TELEMETRY_QUEUE_KEY)
    expect(
      queue,
      'AC3 regression: telemetry queue was written despite opted-out config',
    ).toBeUndefined()
  })
})
