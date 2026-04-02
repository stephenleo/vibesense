# Story 12.2: Session Finalization Integration Test

Status: review

## Story

As the VibeSense engineering team,
I want a full-stack integration test that exercises the complete 4-step session finalization chain,
So that any regression in the chain (`finalizeSession → awardSessionXp → checkAndUnlockForSession → telemetryCollector.collectSession()`) is caught before it reaches production.

**Depends on:** Epic 11 complete (telemetry is the final step added to the chain)
**Can run in parallel with:** Stories 12.1, 12.3, 12.4

## Acceptance Criteria

**AC1 — Full 4-step chain executes in order:**
Given a simulated controller session completes,
When the session finalization chain runs end-to-end in a test environment,
Then all 4 steps execute in order: XP is awarded, achievements are checked, and the telemetry payload is queued,
And the test verifies that a failure in step 3 or 4 does NOT prevent step 1 or 2 from completing (independent `.catch()` boundary).

**AC2 — CI regression detection:**
Given the integration test suite runs in CI,
When any change to `extension.ts`, `SessionManager`, `XPManager`, `AchievementManager`, or `TelemetryCollector` breaks the finalization chain,
Then the integration test fails with a clear assertion message identifying which step regressed.

**AC3 — Telemetry no-op when opted out:**
Given the session finalization chain runs with telemetry opted out,
When the integration test exercises this path,
Then steps 1–3 complete normally and step 4 (`collectSession`) is a no-op without error.

## Tasks / Subtasks

- [x] **Task 1: Create Vitest integration test file** (AC1, AC2, AC3)
  - [x] 1.1 Create `test/unit/extension/stats/session-finalization-chain.test.ts`
  - [x] 1.2 Mock `vscode` (standard pattern: `vi.mock('vscode', () => ({}))`
  - [x] 1.3 Mock `logger` (standard pattern from existing test files)
  - [x] 1.4 Implement `makeGlobalState()` helper (copy from `xp-manager.test.ts` — do NOT import across test files)
  - [x] 1.5 Implement `makeSessionRecord()` helper
  - [x] 1.6 Implement `makeConfig(optedIn: boolean)` helper (from `telemetry.test.ts` pattern)

- [x] **Task 2: Write AC1 tests — chain executes all 4 steps** (AC1)
  - [x] 2.1 Test: `finalizeSession` persists a `SessionRecord` to `SESSION_HISTORY_KEY` in globalState
  - [x] 2.2 Test: `awardSessionXp` writes an updated `XpRecord` to `XP_KEY` after `finalizeSession` completes
  - [x] 2.3 Test: `checkAndUnlockForSession` unlocks `first-steps` achievement after XP is awarded (controller-only session)
  - [x] 2.4 Test: `collectSession` queues a telemetry payload to `TELEMETRY_QUEUE_KEY` when opted in (all 4 steps complete)
  - [x] 2.5 Test: chain runs end-to-end with a single shared `globalState` so each step reads state written by previous steps

- [x] **Task 3: Write AC1 error isolation tests** (AC1 — independent `.catch()` boundary)
  - [x] 3.1 Test: when `awardSessionXp` throws (force rejection), `checkAndUnlockForSession` still runs — step 3 must not be skipped
  - [x] 3.2 Test: when `checkAndUnlockForSession` throws, `collectSession` still runs — step 4 must not be skipped
  - [x] 3.3 Test: when `awardSessionXp` throws, the error is caught and does NOT propagate to caller (NFR-R1: never throw)
  - [x] 3.4 IMPORTANT: Verified against actual `extension.ts` code — the current chain uses a single `try/catch` block wrapping all 4 await calls. Steps 3 and 4 rely on NFR-R1 (each class method has its own internal try/catch). Tests verify that each method never throws to caller — this is the correct isolation boundary. Chain continuity is tested by breaking storage at each step and verifying downstream steps still execute.

- [x] **Task 4: Write AC2 tests — regression detection messages** (AC2)
  - [x] 4.1 Test: assertion messages clearly identify which step failed (use descriptive `expect().toBe()` messages)

- [x] **Task 5: Write AC3 tests — telemetry no-op when opted out** (AC3)
  - [x] 5.1 Test: with `telemetry.enabled = false` in config, steps 1–3 complete normally (XP awarded, achievement checked)
  - [x] 5.2 Test: with `telemetry.enabled = false`, `TELEMETRY_QUEUE_KEY` remains empty in globalState after chain completes
  - [x] 5.3 Test: no errors thrown when opted out (NFR-R1 — silent no-op)

## Dev Notes

### Critical Architecture Constraint: Current Chain Has a Single try/catch

**MUST READ before implementing Task 3.** The actual `extension.ts` dispose handler at lines 365–388 uses this structure:

```typescript
void ratioTracker.finalizeSession(context.globalState).then(async () => {
  try {
    const raw = context.globalState.get<unknown>(SESSION_HISTORY_KEY)
    // ... parse history ...
    if (latest !== undefined) {
      await xpManager.awardSessionXp(latest, distinctFeatureCount)          // step 2
      await achievementManager.checkAndUnlockForSession(latest, xpManager.load())  // step 3
      await telemetryCollector.collectSession(latest, { ... })               // step 4
    }
  } catch (err) {
    logger.error('extension: XP award on session finalize failed', err)
  }
}).catch((err: unknown) => {
  logger.error('extension: session finalization failed', err)
})
```

**Key finding:** Steps 2, 3, and 4 are inside a single `try/catch`. If step 2 throws, steps 3 and 4 are skipped. Each class method (awardSessionXp, checkAndUnlockForSession, collectSession) has its own internal try/catch (NFR-R1), so in practice they **should not throw**. The AC1 acceptance criterion says "failure in step 3 or 4 does NOT prevent step 1 or 2" — this holds because the internal methods catch their own errors. The test in Task 3 should verify the internal no-throw guarantee, not the external chain structure.

**Write tests that verify the internal NFR-R1 guarantees**: force the class internals to fail (e.g., mock `globalState.update` to reject), then assert the chain does not short-circuit.

### Test File Location and Framework

- **Location:** `test/unit/extension/stats/session-finalization-chain.test.ts`
- **Framework:** Vitest (NOT mocha/jest) — `import { vi, describe, it, expect, beforeEach } from 'vitest'`
- **Why Vitest not `@vscode/test-electron`:** This test exercises pure business logic (SessionRatioTracker, XpManager, AchievementManager, TelemetryCollector) with a mocked `globalState`. No live VSCode instance is needed. Integration test in the "integration of business logic" sense, not the "requires VSCode process" sense.
- **Vitest config:** `vitest.config.ts` already includes `test/unit/**/*.test.ts` under the `unit` project — no config changes needed.

### Exact Import Paths (Copy These Directly)

```typescript
import { SessionRatioTracker, SESSION_HISTORY_KEY } from '../../../../src/extension/stats/session-ratio-tracker'
import { XpManager } from '../../../../src/extension/stats/xp-manager'
import { AchievementManager } from '../../../../src/extension/stats/achievement-manager'
import { TelemetryCollector } from '../../../../src/extension/telemetry/telemetry'
import { SESSION_HISTORY_KEY } from '../../../../src/extension/stats/session-ratio-tracker'
import { XP_KEY, ACHIEVEMENT_KEY, TELEMETRY_QUEUE_KEY } from '../../../../src/shared/constants'
import type { SessionRecord, XpRecord } from '../../../../src/shared/types'
import type * as vscode from 'vscode'
```

**ESLint isolation rule:** `TelemetryCollector` may only be imported by `src/extension/extension.ts` from within `src/`. Test files under `test/` are NOT covered by the `no-restricted-imports` ESLint rule that restricts telemetry imports (the rule applies to `src/extension/**` files, not `test/**`). Importing `TelemetryCollector` directly in a test file is safe and correct.

### Standard Helper Functions (Copy from existing tests — do NOT import across test files)

```typescript
// Verbatim pattern from test/unit/extension/stats/xp-manager.test.ts
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

// Verbatim pattern from test/unit/extension/telemetry/telemetry.test.ts
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
```

### How the 4-Step Chain Works End-to-End

The test must replicate what `extension.ts` does in the dispose handler:

```typescript
// Step 1: finalizeSession writes SessionRecord to globalState[SESSION_HISTORY_KEY]
const ratioTracker = new SessionRatioTracker()
// (optionally record some controller actions here)
await ratioTracker.finalizeSession(globalState)

// Step 2: Read the latest session from history (as extension.ts does)
const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
const history = SessionHistorySchema.parse(raw)   // or safeParse
const latest = history[history.length - 1]

// Step 3: Award XP
const xpManager = new XpManager(globalState)
await xpManager.awardSessionXp(latest, 0)  // distinctFeatureCount = 0 for basic test

// Step 4: Check achievements
const achievementManager = new AchievementManager(globalState)
await achievementManager.checkAndUnlockForSession(latest, xpManager.load())

// Step 5: Collect telemetry (requires opted-in config)
const telemetryCollector = new TelemetryCollector(globalState, () => makeConfig(true))
await telemetryCollector.collectSession(latest, { featuresActive: [], controllerType: null })
```

Import `SessionHistorySchema` from `../../../../src/extension/stats/session-record-schema` for parsing.

### Assertions to Verify Each Step

```typescript
// After step 1 (finalizeSession):
const history = globalState._store.get(SESSION_HISTORY_KEY) as SessionRecord[]
expect(history).toHaveLength(1)
expect(history[0].controllerOnly).toBe(true)

// After step 2 (awardSessionXp):
const xpRecord = globalState._store.get(XP_KEY) as XpRecord
expect(xpRecord.totalXp).toBeGreaterThan(0)

// After step 3 (checkAndUnlockForSession):
const achievements = globalState._store.get(ACHIEVEMENT_KEY) as Array<{ id: string; unlockedAt: number | null }>
const firstSteps = achievements.find(a => a.id === 'first-steps')
expect(firstSteps?.unlockedAt).not.toBeNull()

// After step 4 (collectSession — opted in):
const queue = globalState._store.get(TELEMETRY_QUEUE_KEY) as unknown[]
expect(queue).toHaveLength(1)

// After step 4 (collectSession — opted out):
const queueOptedOut = globalState._store.get(TELEMETRY_QUEUE_KEY)
expect(queueOptedOut).toBeUndefined()  // or empty — never written
```

### NFR-R1 Error Isolation Test Pattern

Each method catches its own errors internally. To test isolation, mock `globalState.update` to reject for ONE step, then verify subsequent steps still run:

```typescript
it('awardSessionXp internal failure does not prevent checkAndUnlockForSession', async () => {
  const globalState = makeGlobalState()
  const ratioTracker = new SessionRatioTracker()
  await ratioTracker.finalizeSession(globalState)
  const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
  const history = SessionHistorySchema.parse(raw)
  const latest = history[history.length - 1]

  // Force awardSessionXp's internal globalState.update to fail
  const updateMock = vi.fn().mockRejectedValue(new Error('storage failure'))
  const brokenState = { ...globalState, update: updateMock }
  const xpManager = new XpManager(brokenState as unknown as vscode.Memento)
  
  // awardSessionXp should NOT throw despite internal failure (NFR-R1)
  await expect(xpManager.awardSessionXp(latest, 0)).resolves.toBeUndefined()
  
  // achievementManager can still use the original (non-broken) globalState
  const achievementManager = new AchievementManager(globalState)
  await achievementManager.checkAndUnlockForSession(latest, { totalXp: 0, level: 1, streakDays: 0, lastSessionDate: null })
  
  // Achievement still unlocked despite XP step failing
  const achievements = globalState._store.get(ACHIEVEMENT_KEY) as Array<{ id: string; unlockedAt: number | null }>
  expect(achievements?.find(a => a.id === 'first-steps')?.unlockedAt).not.toBeNull()
})
```

### Key Files — Do NOT Modify (Read Only for Context)

- `src/extension/extension.ts` — the actual finalization chain at lines 354–389; this is what we are testing
- `src/extension/stats/session-ratio-tracker.ts` — `SessionRatioTracker.finalizeSession()`
- `src/extension/stats/xp-manager.ts` — `XpManager.awardSessionXp()`
- `src/extension/stats/achievement-manager.ts` — `AchievementManager.checkAndUnlockForSession()`
- `src/extension/telemetry/telemetry.ts` — `TelemetryCollector.collectSession()`
- `src/extension/stats/session-record-schema.ts` — `SessionHistorySchema` for parsing

### File to Create

- `test/unit/extension/stats/session-finalization-chain.test.ts` — new integration test (Vitest)

### Files to Modify

- `_bmad-output/implementation-artifacts/sprint-status.yaml` — update `12-2-session-finalization-integration-test` to `done` (after PR merged)
- This story file — populate Dev Agent Record upon completion

### ESLint Rules to Know

- `no-restricted-imports` in `.eslintrc.json` lines 68–86 blocks `**/telemetry/**` imports for files in `src/extension/**` EXCEPT `extension.ts` and `telemetry/**` itself. Test files under `test/` are NOT affected — importing `TelemetryCollector` in a test file is allowed.
- `@typescript-eslint/naming-convention` — use camelCase for variables; no raw `console.log` (use logger mock instead).
- Run `npm run lint` to verify before committing.

### Run Tests

```bash
npm test              # runs all Vitest unit tests (picks up new test file automatically)
npm run test:coverage # with coverage report
```

### Previous Story Learnings (from Epic 11)

From Story 11.3 dev notes:
- Each test file declares its own `makeGlobalState()` helper — do not import from other test files. Copy-paste by convention.
- `vi.mock('vscode', () => ({}))` is the correct vscode mock pattern — place before all other imports.
- `vi.mock('../../../../src/extension/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))` is the logger mock pattern.
- All mocks must be declared before any imports of files that use them.
- `beforeEach(() => { vi.clearAllMocks() })` is used to reset mocks between tests.
- NFR-R1 is the core reliability contract: every async method wraps in try/catch; methods NEVER throw to caller.

From Story 11.1 completion notes:
- `TelemetryCollector.isOptedIn()` reads live config via `getConfig()` getter — the test must pass a config that returns `true` for `'telemetry.enabled'` to exercise the collection path.
- `collectSession` is a no-op if not opted in — no globalState writes occur.

From Epic 11 retrospective (AI-24):
- The chain is: `finalizeSession → awardSessionXp → checkAndUnlockForSession → collectSession`. This order matters.
- Test must verify telemetry is not called when opted out.
- Test must verify all steps run even if intermediate steps throw internally.

### References

- [Source: epics.md#Story-12.2] — Story requirements, acceptance criteria
- [Source: src/extension/extension.ts lines 354–389] — Actual session finalization chain implementation
- [Source: src/extension/stats/session-ratio-tracker.ts] — SessionRatioTracker.finalizeSession()
- [Source: src/extension/stats/xp-manager.ts lines 128–178] — XpManager.awardSessionXp()
- [Source: src/extension/stats/achievement-manager.ts lines 120–156] — AchievementManager.checkAndUnlockForSession()
- [Source: src/extension/telemetry/telemetry.ts lines 74–107] — TelemetryCollector.collectSession()
- [Source: src/extension/stats/session-record-schema.ts] — SessionHistorySchema for parsing
- [Source: src/shared/constants.ts] — SESSION_HISTORY_KEY (in session-ratio-tracker.ts), XP_KEY, ACHIEVEMENT_KEY, TELEMETRY_QUEUE_KEY
- [Source: test/unit/extension/stats/xp-manager.test.ts lines 30–42] — makeGlobalState() helper pattern
- [Source: test/unit/extension/telemetry/telemetry.test.ts lines 29–52] — makeConfig() helper pattern
- [Source: vitest.config.ts] — test/unit/**/*.test.ts included in `unit` project (no config changes needed)
- [Source: _bmad-output/implementation-artifacts/epic-11-retro-2026-04-02.md#AI-24] — Origin and requirements of this story
- [Source: architecture.md lines 187, 421–424] — Vitest for unit tests; test/ directory structure

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation straightforward with full context from Dev Notes.

### Completion Notes List

- Created `test/unit/extension/stats/session-finalization-chain.test.ts` with 18 Vitest integration tests covering all 3 acceptance criteria.
- Verified the architecture constraint documented in Dev Notes: the `extension.ts` chain uses a single `try/catch` wrapping steps 2–4. Isolation is guaranteed by NFR-R1 (each class method has its own internal try/catch and never throws to caller). Tests exercise this by mocking `globalState.update` to reject for individual steps and asserting downstream steps still execute.
- Task 3.4 finding: the "independent `.catch()` boundary" in AC1 refers to NFR-R1 internal boundaries, not separate `catch` blocks in `extension.ts`. This is working as designed — tests verify the internal no-throw guarantee.
- All 18 new tests pass; full regression suite (1189 tests) green; lint clean (0 errors, 3 pre-existing warnings in source files).
- Sprint status updated: Epic 11 marked done, Epic 12 entries added, story 12-2 updated to review.

### File List

- `test/unit/extension/stats/session-finalization-chain.test.ts` (created)
- `_bmad-output/implementation-artifacts/12-2-session-finalization-integration-test.md` (updated — tasks, dev agent record, status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (updated — Epic 11 done, Epic 12 entries, story 12-2 review)

### Change Log

- 2026-04-02: Implemented Story 12.2 — created session-finalization-chain.test.ts with 18 integration tests covering AC1 (full 4-step chain), AC2 (regression detection messages), AC3 (telemetry no-op when opted out), and NFR-R1 error isolation guarantees.
