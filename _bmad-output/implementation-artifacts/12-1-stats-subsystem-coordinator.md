# Story 12.1: Stats Subsystem Coordinator

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a VibeSense developer,
I want a dedicated `StatsSubsystemCoordinator` class that encapsulates the instantiation and wiring of all stats subsystem components (`SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager`),
so that `extension.ts` `activate()` is simplified from 681 lines to a thin orchestration shell without breaking any existing stats behavior.

## Acceptance Criteria

**AC1 — `StatsSubsystemCoordinator` exists at `src/extension/stats/stats-subsystem-coordinator.ts`:**
Given the story is implemented,
When the file is inspected,
Then `StatsSubsystemCoordinator` is a class that owns: `SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager` — and nothing else.

**AC2 — All internal wiring moves out of `extension.ts`:**
Given `extension.ts` currently wires `xpManager.on('levelUp', ...)` → `achievementManager.checkAndUnlockForLevelUp()` and `achievementManager.on('achievementUnlocked', ...)` → haptic + burst + LED,
When the coordinator is introduced,
Then those event subscriptions live inside the coordinator, not in `extension.ts`.

**AC3 — `extension.ts` delegates session finalization through the coordinator:**
Given `extension.ts` currently has a `dispose` handler that calls `ratioTracker.finalizeSession()` → reads history → calls `xpManager.awardSessionXp()` → `achievementManager.checkAndUnlockForSession()` → `telemetryCollector.collectSession()`,
When the coordinator is introduced,
Then `extension.ts` calls a single `coordinator.finalizeSession(context.globalState, snapshotControllerType)` method — the coordinator handles the rest internally.
Note: `telemetryCollector.collectSession()` remains in `extension.ts` (telemetry isolation constraint — see Dev Notes).

**AC4 — `SessionHealthManager` started and disposed through the coordinator:**
Given `extension.ts` currently calls `sessionHealthManager.start()` and registers a `context.subscriptions` dispose entry,
When the coordinator is introduced,
Then the coordinator starts `SessionHealthManager` internally and exposes a `dispose()` method that `extension.ts` pushes to `context.subscriptions`.

**AC5 — `notifyConnected(connected: boolean)` proxied through coordinator:**
Given `extension.ts` calls `sessionHealthManager.notifyConnected(true/false)` at multiple call sites (initial connect, `lifecycleManager` connect/disconnect callbacks),
When the coordinator is introduced,
Then `extension.ts` calls `coordinator.notifyConnected(connected)` instead.

**AC6 — Achievement burst wiring proxied through coordinator:**
Given `extension.ts` currently handles the `achievementUnlocked` event to fire haptic + `achievementBurstPanelManager.show()` + rainbow LED,
When the coordinator is introduced,
Then the coordinator fires `achievementBurstPanelManager.show()` internally and emits an `achievementUnlocked` event that `extension.ts` subscribes to (for hardware feedback — haptic + LED — which requires the `currentDriver` reference that only `extension.ts` owns).

**AC7 — No behavior regression:**
Given 873 tests pass before this story,
When the story is implemented,
Then `npm test` passes with ≥873 tests and zero regressions.

**AC8 — New unit tests for `StatsSubsystemCoordinator`:**
Given the coordinator is a new class,
When tests are written,
Then `test/unit/extension/stats/stats-subsystem-coordinator.test.ts` covers: instantiation, `finalizeSession()`, `notifyConnected()`, `dispose()`, and `achievementUnlocked` event propagation.

## Tasks / Subtasks

- [x] Task 1: Create `src/extension/stats/stats-subsystem-coordinator.ts` (AC1, AC2, AC4, AC5, AC6)
  - [x] 1.1 Define constructor signature: `(context: vscode.ExtensionContext, slidePanelManager: SlidePanelManager)`
  - [x] 1.2 Instantiate `SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager` inside constructor
  - [x] 1.3 Wire internal events: `xpManager.on('levelUp', ...)` → `achievementManager.checkAndUnlockForLevelUp()` (moved from `extension.ts`)
  - [x] 1.4 Wire internal events: `achievementManager.on('achievementUnlocked', event)` → `achievementBurstPanelManager.show(...)` + re-emit `achievementUnlocked` on `this` (coordinator extends `EventEmitter`)
  - [x] 1.5 Expose `start()` method: calls `sessionHealthManager.start()`
  - [x] 1.6 Expose `dispose()` method: calls `sessionHealthManager.dispose()` + `achievementManager.removeAllListeners()` + `this.removeAllListeners()`
  - [x] 1.7 Expose `notifyConnected(connected: boolean)`: delegates to `sessionHealthManager.notifyConnected(connected)`
  - [x] 1.8 Expose `recordKeyboardAction()`: delegates to `ratioTracker.recordKeyboardAction()`
  - [x] 1.9 Expose `recordControllerAction()`: delegates to `ratioTracker.recordControllerAction()`
  - [x] 1.10 Expose `recordFeatureUsed(feature: string)`: delegates to `ratioTracker.recordFeatureUsed(feature)`
  - [x] 1.11 Expose `getDistinctFeatureCount()`: delegates to `ratioTracker.getDistinctFeatureCount()`
  - [x] 1.12 Expose `getDistinctFeatureNames()`: delegates to `ratioTracker.getDistinctFeatureNames()`
  - [x] 1.13 Expose `async finalizeSession(globalState: vscode.Memento, controllerType: ControllerType | null)`: encapsulates the full finalization chain (ratioTracker.finalizeSession → read history → xpManager.awardSessionXp → achievementManager.checkAndUnlockForSession); returns `{ sessionRecord: SessionRecord | undefined, distinctFeatureNames: string[] }` so `extension.ts` can still call `telemetryCollector.collectSession()`
  - [x] 1.14 Push `achievementBurstPanelManager` to `context.subscriptions` inside constructor

- [x] Task 2: Update `src/extension/extension.ts` (AC2, AC3, AC4, AC5, AC6, AC7)
  - [x] 2.1 Import `StatsSubsystemCoordinator` from `./stats/stats-subsystem-coordinator`
  - [x] 2.2 Replace individual instantiations of `SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager` with a single `statsCoordinator` instance
  - [x] 2.3 Replace all `ratioTracker.*` call sites with `statsCoordinator.*` equivalents
  - [x] 2.4 Replace `sessionHealthManager.notifyConnected(...)` call sites with `statsCoordinator.notifyConnected(...)`
  - [x] 2.5 Replace dispose subscription for `sessionHealthManager` + `achievementManager.removeAllListeners()` with `context.subscriptions.push({ dispose: () => statsCoordinator.dispose() })`
  - [x] 2.6 Replace the full dispose chain in the session finalize subscription with `statsCoordinator.finalizeSession(context.globalState, snapshotControllerType)` then call `telemetryCollector.collectSession()` with the returned session record
  - [x] 2.7 Subscribe to `statsCoordinator.on('achievementUnlocked', event)` for hardware feedback (haptic + rainbow LED — these require `currentDriver` ref that only `extension.ts` owns)
  - [x] 2.8 Call `statsCoordinator.start()` after instantiation (replaces `sessionHealthManager.start()`)
  - [x] 2.9 Remove now-unused imports: `SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager`, `SESSION_HISTORY_KEY`, `SessionHistorySchema`

- [x] Task 3: Create `test/unit/extension/stats/stats-subsystem-coordinator.test.ts` (AC8)
  - [x] 3.1 Test `finalizeSession()`: mock `globalState`, verify XP + achievement check are called in correct order
  - [x] 3.2 Test `notifyConnected()`: verify `sessionHealthManager.notifyConnected` is delegated
  - [x] 3.3 Test `achievementUnlocked` event: verify coordinator re-emits after burst panel show
  - [x] 3.4 Test `dispose()`: verify `sessionHealthManager.dispose()` called + all listeners removed
  - [x] 3.5 Test `recordKeyboardAction()`, `recordControllerAction()`, `recordFeatureUsed()` delegation

## Dev Notes

### What This Story Builds

This is a **refactor/extraction story** (process task AI-11 from Epic 9 retrospective). It creates `StatsSubsystemCoordinator` — a thin facade/coordinator that owns all stats subsystem components and their wiring — thereby removing ~60 lines of stats-related bootstrapping and event-wiring from `extension.ts`.

**No new user-facing behavior is added.** All existing tests must continue to pass. The only new tests are for the coordinator class itself.

### Critical Architecture Constraint — Telemetry Isolation

`telemetryCollector.collectSession()` **must remain in `extension.ts`** — it cannot move into `StatsSubsystemCoordinator`. The architecture enforces: "Only `src/extension/extension.ts` may import from `src/extension/telemetry/`" (enforced by ESLint `no-restricted-imports` rule). Violating this will cause a lint failure.

**Correct pattern:** `finalizeSession()` returns `{ sessionRecord, distinctFeatureNames }`. `extension.ts` then calls `telemetryCollector.collectSession(sessionRecord, { featuresActive: distinctFeatureNames, controllerType })`.

### Critical Architecture Constraint — Hardware Feedback Stays in `extension.ts`

The `achievementUnlocked` hardware feedback (DualSense haptic `triple_pulse` + rainbow LED cycle) **must remain in `extension.ts`** because it requires `currentDriver` — a reference that only `extension.ts` owns and that changes on connect/disconnect. The coordinator re-emits the event; `extension.ts` handles hardware.

### `StatsSubsystemCoordinator` — Skeleton

```typescript
// src/extension/stats/stats-subsystem-coordinator.ts
import * as vscode from 'vscode'
import { EventEmitter } from 'events'
import { SessionRatioTracker, SESSION_HISTORY_KEY } from './session-ratio-tracker'
import { XpManager } from './xp-manager'
import { AchievementManager } from './achievement-manager'
import { SessionHealthManager } from './session-health-manager'
import { AchievementBurstPanelManager } from '../panels/achievement-burst-panel'
import { SessionHistorySchema } from './session-record-schema'
import { logger } from '../logger'
import type { SlidePanelManager } from '../panels/slide-panel-manager'
import type { ControllerType, SessionRecord } from '../../shared/types'
import type { AchievementUnlockedEvent } from './achievement-manager'
import type { LevelUpEvent } from './xp-manager'

export interface FinalizeSessionResult {
  sessionRecord: SessionRecord | undefined
  distinctFeatureNames: string[]
}

export class StatsSubsystemCoordinator extends EventEmitter {
  private readonly ratioTracker: SessionRatioTracker
  private readonly xpManager: XpManager
  private readonly achievementManager: AchievementManager
  private readonly achievementBurstPanelManager: AchievementBurstPanelManager
  private readonly sessionHealthManager: SessionHealthManager

  constructor(
    context: vscode.ExtensionContext,
    slidePanelManager: SlidePanelManager,
  ) {
    super()
    this.ratioTracker = new SessionRatioTracker()
    this.xpManager = new XpManager(context.globalState)
    this.achievementManager = new AchievementManager(context.globalState)
    this.achievementBurstPanelManager = new AchievementBurstPanelManager(context)
    this.sessionHealthManager = new SessionHealthManager(slidePanelManager, this.ratioTracker, this.xpManager)

    // Push burst panel to context.subscriptions for dispose
    context.subscriptions.push(this.achievementBurstPanelManager)

    // Wire xpManager → achievementManager
    this.xpManager.on('levelUp', (event: LevelUpEvent) => {
      logger.info(`VibeSense: level up! ${event.previousLevel} → ${event.newLevel} (${event.totalXp} XP)`)
      this.achievementManager.checkAndUnlockForLevelUp(event.newLevel).catch((err: unknown) => {
        logger.error('StatsSubsystemCoordinator: checkAndUnlockForLevelUp failed', err)
      })
    })

    // Wire achievementManager → burst panel + re-emit for hardware feedback
    this.achievementManager.on('achievementUnlocked', (event: AchievementUnlockedEvent) => {
      try {
        this.achievementBurstPanelManager.show(event.id, event.label, event.tier, event.description)
        this.emit('achievementUnlocked', event)
      } catch (err) {
        logger.error('StatsSubsystemCoordinator: achievementUnlocked handler failed', err)
      }
    })
  }

  start(): void {
    this.sessionHealthManager.start()
  }

  dispose(): void {
    this.sessionHealthManager.dispose()
    this.achievementManager.removeAllListeners()
    this.removeAllListeners()
  }

  notifyConnected(connected: boolean): void {
    this.sessionHealthManager.notifyConnected(connected)
  }

  recordKeyboardAction(): void { this.ratioTracker.recordKeyboardAction() }
  recordControllerAction(): void { this.ratioTracker.recordControllerAction() }
  recordFeatureUsed(feature: string): void { this.ratioTracker.recordFeatureUsed(feature) }
  getDistinctFeatureCount(): number { return this.ratioTracker.getDistinctFeatureCount() }
  getDistinctFeatureNames(): string[] { return this.ratioTracker.getDistinctFeatureNames() }

  async finalizeSession(
    globalState: vscode.Memento,
    controllerType: ControllerType | null,
  ): Promise<FinalizeSessionResult> {
    const distinctFeatureNames = this.getDistinctFeatureNames()
    const distinctFeatureCount = this.getDistinctFeatureCount()
    const snapshotControllerType = controllerType
    await this.ratioTracker.finalizeSession(globalState)
    try {
      const raw = globalState.get<unknown>(SESSION_HISTORY_KEY)
      const parseResult = SessionHistorySchema.safeParse(raw ?? [])
      const history = parseResult.success ? parseResult.data : []
      const latest = history.length > 0 ? history[history.length - 1] : undefined
      if (latest !== undefined) {
        await this.xpManager.awardSessionXp(latest, distinctFeatureCount)
        await this.achievementManager.checkAndUnlockForSession(latest, this.xpManager.load())
        return { sessionRecord: latest, distinctFeatureNames }
      }
    } catch (err) {
      logger.error('StatsSubsystemCoordinator: finalizeSession failed', err)
    }
    return { sessionRecord: undefined, distinctFeatureNames }
  }
}
```

### `extension.ts` Changes — Diff Summary

**Remove these imports:**
```typescript
import { SessionRatioTracker, SESSION_HISTORY_KEY } from './stats/session-ratio-tracker'
import { SessionHistorySchema } from './stats/session-record-schema'
import { XpManager } from './stats/xp-manager'
import { SessionHealthManager } from './stats/session-health-manager'
import { AchievementManager } from './stats/achievement-manager'
import { AchievementBurstPanelManager } from './panels/achievement-burst-panel'
```

**Add this import:**
```typescript
import { StatsSubsystemCoordinator } from './stats/stats-subsystem-coordinator'
import type { AchievementUnlockedEvent } from './stats/achievement-manager'
```

**Replace instantiation block** (lines ~286–338 in current `extension.ts`):
```typescript
// Story 12.1: Stats subsystem coordinator — owns SessionRatioTracker, XpManager,
// AchievementManager, AchievementBurstPanelManager, SessionHealthManager
const statsCoordinator = new StatsSubsystemCoordinator(context, slidePanelManager)
statsCoordinator.start()
context.subscriptions.push({ dispose: () => statsCoordinator.dispose() })

// Hardware feedback for achievement unlocks — requires currentDriver ref (extension.ts only)
statsCoordinator.on('achievementUnlocked', (event: AchievementUnlockedEvent) => {
  try {
    if (currentDriver?.controllerType === 'dualsense') {
      currentDriver.setHaptic('triple_pulse')
    }
    if (currentDriver?.controllerType === 'dualsense') {
      const rainbowColors = ['#FF0000', '#FF8800', '#FFFF00', '#00FF00', '#00C8FF', '#7B5CFA']
      let step = 0
      const rainbowInterval = setInterval(() => {
        if (step < rainbowColors.length && currentDriver) {
          currentDriver.setLED(rainbowColors[step])
          step++
        } else {
          clearInterval(rainbowInterval)
          currentDriver?.setLED('#000000')
        }
      }, 200)
    }
  } catch (err) {
    logger.error('extension: achievementUnlocked hardware feedback failed', err)
  }
})
```

**Replace dispose subscription** (the complex stats finalize closure):
```typescript
context.subscriptions.push({
  dispose: () => {
    const snapshotControllerType = currentControllerType
    void statsCoordinator.finalizeSession(context.globalState, snapshotControllerType).then(async ({ sessionRecord, distinctFeatureNames }) => {
      if (sessionRecord !== undefined) {
        await telemetryCollector.collectSession(sessionRecord, {
          featuresActive: distinctFeatureNames,
          controllerType: snapshotControllerType,
        })
      }
    }).catch((err: unknown) => {
      logger.error('extension: stats finalization failed', err)
    })
  },
})
```

**Replace all `ratioTracker.*` call sites:**
- `ratioTracker.recordKeyboardAction()` → `statsCoordinator.recordKeyboardAction()`
- `ratioTracker.recordControllerAction()` (inside `InputRouter` — unchanged, `InputRouter` keeps its own reference to `ratioTracker` via the existing constructor arg)

> **IMPORTANT:** `InputRouter` is constructed with `ratioTracker` directly: `new InputRouter(initialBindings, ratioTracker)`. After this refactor, `ratioTracker` is private inside the coordinator. You must either:
> - Option A (recommended): expose `getRatioTracker()` accessor on coordinator and pass that to `InputRouter`
> - Option B: move `InputRouter` construction into the coordinator (increases scope — not recommended)
> - **Use Option A**: `inputRouter = new InputRouter(initialBindings, statsCoordinator.getRatioTracker())`

Add `getRatioTracker(): SessionRatioTracker` accessor to `StatsSubsystemCoordinator`.

**Replace `sessionHealthManager.notifyConnected(...)` call sites** (3 locations):
- Initial connect check
- `lifecycleManager` connect callback
- `lifecycleManager` disconnect callback

→ `statsCoordinator.notifyConnected(true/false)`

**Replace `featureCountAtDispose` / `featureNamesAtDispose` closures:**
These two closures in the dispose subscription:
```typescript
const featureCountAtDispose = () => ratioTracker.getDistinctFeatureCount()
const featureNamesAtDispose = () => ratioTracker.getDistinctFeatureNames()
```
Are removed. `finalizeSession()` captures these values internally before clearing state.

**Replace `RadialWheelController` construction — pass `statsCoordinator.getRatioTracker()`:**
```typescript
const radialWheelController = new RadialWheelController(
  radialWheelPanelManager, dispatchTracker, getR2Segments,
  statsCoordinator.getRatioTracker(),  // was: ratioTracker
  hudPanelManager
)
```

### Critical File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/extension/stats/stats-subsystem-coordinator.ts` | CREATE | New coordinator class |
| `src/extension/extension.ts` | MODIFY | Replace ~60 lines of stats wiring with coordinator |
| `test/unit/extension/stats/stats-subsystem-coordinator.test.ts` | CREATE | Unit tests |

### Project Structure Compliance

New file: `src/extension/stats/stats-subsystem-coordinator.ts` — correct location per architecture: "Stats dashboard → `src/extension/stats/`". Existing files in this folder: `session-ratio-tracker.ts`, `xp-manager.ts`, `achievement-manager.ts`, `session-health-manager.ts`, `achievement-definitions.ts`, `session-record-schema.ts`.

### Testing Patterns

Follow `test/unit/extension/stats/achievement-manager.test.ts` and `test/unit/extension/stats/session-health-manager.test.ts` for the mock patterns:

```typescript
// Mock globalState
function makeGlobalState(): vscode.Memento {
  const store = new Map<string, unknown>()
  return {
    get: <T>(key: string, defaultValue?: T): T => (store.get(key) ?? defaultValue) as T,
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    keys: () => [],
    setKeysForSync: () => {},
  } as unknown as vscode.Memento
}

// Mock ExtensionContext
const mockContext = {
  globalState: makeGlobalState(),
  subscriptions: [],
} as unknown as vscode.ExtensionContext
```

### Error Handling (NFR-R1)

All methods must wrap async in try/catch with `logger.error`, never rethrow. Pattern from `session-health-manager.ts`.

### Key Patterns from Codebase

- **EventEmitter extension:** `extends EventEmitter` — pattern from `XpManager`, `AchievementManager`
- **Dispose pattern:** `context.subscriptions.push({ dispose: () => ... })` — standard throughout `extension.ts`
- **Logger:** `logger.info` / `logger.error` from `../logger` — never `console.log`
- **Zod schema validation on globalState reads:** defensive parse with `.safeParse()` + fallback to defaults — all stats managers use this pattern

### Anti-Patterns to Avoid

- **Do NOT** import `TelemetryCollector` or anything from `src/extension/telemetry/` in the coordinator — architecture constraint, ESLint will fail
- **Do NOT** move `currentDriver` or hardware feedback logic into the coordinator — it needs the `currentDriver` ref that only `extension.ts` owns
- **Do NOT** add new messages to `src/shared/messages.ts` — this is a pure extension-host refactor
- **Do NOT** break the `InputRouter(bindings, ratioTracker)` constructor signature — expose `getRatioTracker()` on coordinator instead of changing `InputRouter`
- **Do NOT** call `achievementBurstPanelManager.show()` from `extension.ts` directly — this now belongs in the coordinator (AC6)

### References

- [Source: src/extension/extension.ts] — full wiring to be extracted (lines ~285–390)
- [Source: src/extension/stats/session-ratio-tracker.ts] — `SessionRatioTracker` interface
- [Source: src/extension/stats/xp-manager.ts] — `XpManager` + `LevelUpEvent`
- [Source: src/extension/stats/achievement-manager.ts] — `AchievementManager` + `AchievementUnlockedEvent`
- [Source: src/extension/stats/session-health-manager.ts] — `SessionHealthManager`
- [Source: _bmad-output/planning-artifacts/architecture.md#Telemetry isolation] — ESLint no-restricted-imports constraint
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] — `process-stats-subsystem-design: backlog  # AI-11`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded without blockers.

### Completion Notes List

- Created `StatsSubsystemCoordinator` extending `EventEmitter` that encapsulates all 5 stats subsystem components: `SessionRatioTracker`, `XpManager`, `AchievementManager`, `AchievementBurstPanelManager`, `SessionHealthManager`.
- Internal event wiring (xpManager levelUp → achievementManager, achievementManager achievementUnlocked → burst panel + re-emit) moved entirely out of `extension.ts` into the coordinator constructor.
- `finalizeSession()` returns `{ sessionRecord, distinctFeatureNames }` preserving telemetry isolation (telemetryCollector stays in extension.ts per ESLint constraint).
- `getRatioTracker()` accessor added (not in original subtasks but required per Dev Notes) to allow `InputRouter` and `RadialWheelController` to receive the internal `ratioTracker` reference.
- `extension.ts` reduced from 681 lines to 630 lines (~51 lines removed). All stats bootstrap + wiring replaced with 3 lines: instantiate coordinator, start, register dispose.
- 24 new unit tests added covering all AC8 scenarios. Vitest 4 class mock pattern used (`mockImplementation(class { constructor() { return instance } })`).
- All 1195 tests pass (was 1171 before this story's tests added). Zero regressions.
- ESLint: 0 errors (3 pre-existing warnings in unrelated files).

### File List

- `src/extension/stats/stats-subsystem-coordinator.ts` — CREATED
- `src/extension/extension.ts` — MODIFIED
- `test/unit/extension/stats/stats-subsystem-coordinator.test.ts` — CREATED
- `_bmad-output/implementation-artifacts/12-1-stats-subsystem-coordinator.md` — MODIFIED (story tracking)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (status tracking)

## Change Log

- 2026-04-02: Story implemented by claude-sonnet-4-6. Created `StatsSubsystemCoordinator` class, updated `extension.ts` to delegate all stats subsystem wiring through coordinator, added 24 unit tests. All 1195 tests pass, 0 ESLint errors.
