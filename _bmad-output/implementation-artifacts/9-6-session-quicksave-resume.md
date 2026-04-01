# Story 9.6: Session Quicksave & Resume

**Status:** done
**Epic:** 9 — Gamified Stats, Achievements & Session Management
**Story ID:** 9.6
**Story Key:** 9-6-session-quicksave-resume
**Created:** 2026-04-01

---

## Story

As a multi-agent power developer,
I want to quicksave my current session state (open terminals, active agent sessions, radial wheel segment configuration) via a controller input and restore it on the next VSCode launch,
So that I never have to rebuild my working context from scratch after closing VSCode.

---

## Acceptance Criteria

**AC1 — Quicksave persists open terminal names, agent session IDs, and R2 Personal wheel segments:**
Given multiple terminal sessions and a configured radial wheel are active,
When the user triggers quicksave via the designated controller input (`vibesense.quicksave` command, e.g. `touchpad` / `view` button),
Then the current session state is saved to `ExtensionContext.globalState` including: open terminal names (from `vscode.window.terminals`), agent session IDs (from `SessionManager.getSessions()` keys), and R2 Personal wheel segment configuration (from `loadR2PersonalSegments()`).

**AC2 — Resume prompt appears on VSCode launch when a quicksave exists:**
Given a quicksave state exists in `ExtensionContext.globalState`,
When VSCode launches and VibeSense activates,
Then a non-blocking notification appears: "Resume previous session? [Yes] [Dismiss]",
And the notification does NOT block activation — it is shown with `void vscode.window.showInformationMessage(...)` (fire-and-forget).

**AC3 — Selecting "Yes" restores terminals and radial wheel config:**
Given a quicksave exists and the user selects "Yes" on the resume prompt,
When the restore runs,
Then each saved terminal name is re-created via `vscode.window.createTerminal({ name })`,
And the saved R2 Personal wheel segment configuration is written to `.vscode/vibesense.json` (the `radialWheel.segments` array),
And the radial wheel controller reloads its segments (the `getR2Segments()` closure re-reads the file automatically).

**AC4 — Selecting "Dismiss" clears the quicksave:**
Given a quicksave exists and the user selects "Dismiss",
When the dismiss action fires,
Then the `globalState` entry is cleared (`globalState.update(QUICKSAVE_KEY, undefined)`),
And the resume prompt does not appear again on the next launch.

**AC5 — Quicksave command is bound in the input router:**
Given the user has assigned `vibesense.quicksave` to a controller button (e.g. `touchpad`),
When the button is pressed,
Then the `vibesense.quicksave` VSCode command fires and quicksave executes.

---

## Tasks / Subtasks

- [x] Task 1: Add `QuickSaveState` type and `QUICKSAVE_KEY` to `src/shared/types.ts` and `src/shared/constants.ts`
  - [x] 1.1 Add `QuickSaveState` interface to `src/shared/types.ts`: `{ terminalNames: string[], sessionIds: string[], r2Segments: string[] }`
  - [x] 1.2 Add `QUICKSAVE_KEY = 'vibesense.quicksaveState'` constant to `src/shared/constants.ts`

- [x] Task 2: Create `src/extension/session/quicksave-manager.ts`
  - [x] 2.1 Implement `QuickSaveManager` class (constructor: `globalState: vscode.Memento, sessionManager: SessionManager, workspaceRoot: string`)
  - [x] 2.2 Implement `save()`: reads `vscode.window.terminals`, `sessionManager.getSessions()`, `loadR2PersonalSegments()` → writes to `globalState` with key `QUICKSAVE_KEY`
  - [x] 2.3 Implement `load(): QuickSaveState | null`: reads from `globalState`; returns `null` if absent
  - [x] 2.4 Implement `clear()`: calls `globalState.update(QUICKSAVE_KEY, undefined)` — wrapped in try/catch (NFR-R1)
  - [x] 2.5 All methods wrap async in try/catch with `logger.error` — never throw (NFR-R1)

- [x] Task 3: Register `vibesense.quicksave` command in `src/extension/commands/register.ts`
  - [x] 3.1 Add `quickSaveManager?: QuickSaveManager` parameter to `registerCommands()` signature
  - [x] 3.2 Register `vibesense.quicksave` command: call `quickSaveManager?.save()` + show status bar confirmation via `logger.info`
  - [x] 3.3 Update all `registerCommands()` call sites in `extension.ts`

- [x] Task 4: Show resume prompt on activation in `src/extension/extension.ts`
  - [x] 4.1 Instantiate `QuickSaveManager` after `sessionManager` and `workspaceRoot` are ready
  - [x] 4.2 After activation completes, fire-and-forget: `void quickSaveManager.load()` → if state exists, show `vscode.window.showInformationMessage('Resume previous session?', 'Yes', 'Dismiss')`
  - [x] 4.3 On `'Yes'`: call `quickSaveManager.restore()` (Task 5); on `'Dismiss'`: call `quickSaveManager.clear()`

- [x] Task 5: Implement `restore()` in `QuickSaveManager`
  - [x] 5.1 For each `terminalName` in `state.terminalNames`: `vscode.window.createTerminal({ name: terminalName })`
  - [x] 5.2 Write `state.r2Segments` to `.vscode/vibesense.json` via `updateVibeProfileSegments(workspaceRoot, state.r2Segments)` helper (reads existing profile, updates `radialWheel.segments`, writes back atomically)
  - [x] 5.3 The `getR2Segments()` closure in `extension.ts` re-reads `.vscode/vibesense.json` on next call — no explicit reload needed
  - [x] 5.4 After restore, clear the quicksave state (`this.clear()`) so it doesn't re-prompt next time

- [x] Task 6: Add `vibesense.quicksave` to `package.json` command contributions
  - [x] 6.1 Add command entry: `{ "command": "vibesense.quicksave", "title": "VibeSense: Quick Save Session" }`

- [x] Task 7: Write tests
  - [x] 7.1 Unit test `QuickSaveManager`: `save()` persists correct shape; `load()` returns `null` when absent; `clear()` removes the key; errors are swallowed (NFR-R1)
  - [x] 7.2 Unit test `register.ts` / `extension.ts`: `vibesense.quicksave` command registration verified
  - [x] 7.3 Integration note: terminal re-creation is a VSCode API call — test via mock

### Review Findings

- [x] [Review][Patch] Dead try/catch around fire-and-forget async call in quicksave command [src/extension/commands/register.ts:341] — fixed: removed unreachable catch block, added clarifying comment
- [x] [Review][Patch] Double-logging on updateVibeProfileSegments error [src/extension/session/quicksave-manager.ts:113] — fixed: removed redundant logger.error in private method since restore() already logs
- [x] [Review][Patch] Redundant "triggered" log in quicksave command handler [src/extension/commands/register.ts:344] — fixed: removed, save() already logs completion
- [x] [Review][Defer] No schema validation on QuickSaveState loaded from globalState [src/extension/session/quicksave-manager.ts:59] — deferred, pre-existing pattern across all globalState consumers (GameHighScoreStore, ModeManager, etc.)

---

## Dev Notes

### What This Story Builds

Story 9.6 adds one new capability: **session state quicksave and resume**. When triggered, it snapshots terminal names, agent session IDs, and the R2 Personal wheel prompt configuration into `ExtensionContext.globalState`. On next VSCode launch, VibeSense checks for this snapshot and offers a non-blocking "Resume previous session?" prompt. Selecting "Yes" re-creates the terminals and restores wheel prompts.

**Scope boundary:** This story does NOT implement:
- Any gamification UI (stats, XP, achievements) — those belong in Stories 9.1–9.5
- New Webview panels — quicksave is entirely extension host-side (no postMessage needed)
- Actual agent session state recovery (Claude Code sessions restart fresh — only terminal names and wheel config are restored)
- Any radial wheel segment editing UI — segments are saved/restored via `.vscode/vibesense.json`

### Architecture Compliance

**Storage API:** Use `ExtensionContext.globalState` for the quicksave snapshot — consistent with `ModeManager` (`vibesense.bindingMode`), `GameHighScoreStore` (`vibesense.gameHighScore.*`), `RadialWheelDispatchTracker` (`vibesense.wheelDispatch.*`), and onboarding completion (`vibesense.onboardingComplete`). Key: `vibesense.quicksaveState`.

**Error handling (NFR-R1):** All `globalState.update()` and file-write calls must be wrapped in try/catch with `logger.error` — never rethrow. Same pattern as `GameHighScoreStore.updateHighScore()` and `RadialWheelDispatchTracker.increment()`.

**No new messages needed:** Quicksave is entirely extension host-side. No `HostMessage` / `WebviewMessage` additions to `src/shared/messages.ts` are required.

**File location:** `src/extension/session/quicksave-manager.ts` — per architecture feature mapping: "Session management + quicksave → `src/extension/session/session-manager.ts`" (same folder, new file).

**No async in hot path:** `save()` and `restore()` are triggered by command dispatch (not the 16ms input pipeline), so async `globalState.update()` is fine here.

**Logging:** Use `logger.info`/`logger.error` from `../logger` — never `console.log`.

**`vscode.window.showInformationMessage` pattern:** Non-blocking fire-and-forget, exactly like the "Controller not found" prompt in `extension.ts` (lines 417–422). Use `void ...then(...)` pattern.

### Critical File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/types.ts` | EXTEND | Add `QuickSaveState` interface |
| `src/shared/constants.ts` | EXTEND | Add `QUICKSAVE_KEY` constant |
| `src/extension/session/quicksave-manager.ts` | CREATE | `QuickSaveManager` class |
| `src/extension/commands/register.ts` | EXTEND | Add `vibesense.quicksave` command registration |
| `src/extension/extension.ts` | EXTEND | Instantiate `QuickSaveManager`; show resume prompt on activation |
| `package.json` | EXTEND | Add `vibesense.quicksave` to `contributes.commands` |
| `test/unit/extension/quicksave-manager.test.ts` | CREATE | Unit tests for `QuickSaveManager` |

### `QuickSaveState` Type

Add to `src/shared/types.ts`:

```typescript
/** Persisted quicksave snapshot for session restore (Story 9.6) */
export interface QuickSaveState {
  /** Names of open VSCode terminals at save time */
  terminalNames: string[]
  /** Claude Code session IDs from SessionManager.getSessions() keys */
  sessionIds: string[]
  /** R2 Personal wheel prompt texts (one per slot, up to 8) */
  r2Segments: string[]
}
```

Add to `src/shared/constants.ts`:

```typescript
/** globalState key for session quicksave snapshot (Story 9.6) */
export const QUICKSAVE_KEY = 'vibesense.quicksaveState'
```

### `QuickSaveManager` — Full Implementation Guide

```typescript
// src/extension/session/quicksave-manager.ts
// Persists session quicksave snapshot in ExtensionContext.globalState (Story 9.6)

import * as vscode from 'vscode'
import type { QuickSaveState } from '../../shared/types'
import { QUICKSAVE_KEY } from '../../shared/constants'
import type { SessionManager } from './session-manager'
import { loadR2PersonalSegments } from '../input/radial-wheel-segments'
import { logger } from '../logger'
import * as fs from 'fs'
import * as path from 'path'

export class QuickSaveManager {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly sessionManager: SessionManager,
    private readonly workspaceRoot: string,
  ) {}

  /**
   * Snapshot current session state and persist to globalState.
   * Never throws (NFR-R1).
   */
  async save(): Promise<void> {
    try {
      const terminalNames = vscode.window.terminals.map(t => t.name)
      const sessionIds = Array.from(this.sessionManager.getSessions().keys())
      // loadR2PersonalSegments reads .vscode/vibesense.json — extract promptTexts
      const r2Defs = loadR2PersonalSegments(this.workspaceRoot, /* dispatchTracker */ null as never, false)
      const r2Segments = r2Defs.map(s => s.promptText ?? s.label)
      const state: QuickSaveState = { terminalNames, sessionIds, r2Segments }
      await this.globalState.update(QUICKSAVE_KEY, state)
      logger.info(`QuickSaveManager: saved ${terminalNames.length} terminals, ${sessionIds.length} sessions`)
    } catch (err) {
      logger.error('QuickSaveManager: save() failed', err)
    }
  }

  /**
   * Load persisted quicksave state.
   * Returns null if no snapshot exists or on error (NFR-R1).
   */
  load(): QuickSaveState | null {
    try {
      return this.globalState.get<QuickSaveState>(QUICKSAVE_KEY) ?? null
    } catch (err) {
      logger.error('QuickSaveManager: load() failed', err)
      return null
    }
  }

  /**
   * Restore terminals and radial wheel config from saved state.
   * Never throws (NFR-R1). Clears the snapshot after restore.
   */
  async restore(state: QuickSaveState): Promise<void> {
    try {
      // Re-create terminals by name
      for (const name of state.terminalNames) {
        vscode.window.createTerminal({ name })
      }
      // Write R2 segments back to .vscode/vibesense.json
      if (state.r2Segments.length > 0) {
        await this.updateVibeProfileSegments(state.r2Segments)
      }
      logger.info(`QuickSaveManager: restored ${state.terminalNames.length} terminals`)
    } catch (err) {
      logger.error('QuickSaveManager: restore() failed', err)
    } finally {
      await this.clear()
    }
  }

  /**
   * Clear the persisted quicksave snapshot.
   * Never throws (NFR-R1).
   */
  async clear(): Promise<void> {
    try {
      await this.globalState.update(QUICKSAVE_KEY, undefined)
      logger.info('QuickSaveManager: cleared quicksave state')
    } catch (err) {
      logger.error('QuickSaveManager: clear() failed', err)
    }
  }

  /** Write R2 segments array to .vscode/vibesense.json radialWheel.segments field. */
  private async updateVibeProfileSegments(segments: string[]): Promise<void> {
    const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
    try {
      let json: Record<string, unknown> = {}
      if (fs.existsSync(profilePath)) {
        json = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as Record<string, unknown>
      }
      const radialWheel = (json['radialWheel'] as Record<string, unknown> | undefined) ?? {}
      json['radialWheel'] = { ...radialWheel, segments }
      fs.writeFileSync(profilePath, JSON.stringify(json, null, 2), 'utf-8')
    } catch (err) {
      logger.error('QuickSaveManager: updateVibeProfileSegments failed', err)
      throw err  // re-throw so restore() catch block logs it
    }
  }
}
```

**Important:** `loadR2PersonalSegments` requires a `RadialWheelDispatchTracker` instance. For the save snapshot, you only need `promptText` values — pass the actual `dispatchTracker` instance from `extension.ts`, or refactor `save()` to read `.vscode/vibesense.json` directly (simpler: just read `radialWheel.segments` array from the profile, no need to invoke `loadR2PersonalSegments`). **Recommended:** read `.vscode/vibesense.json` directly in `save()` to avoid `dispatchTracker` dependency in `QuickSaveManager`.

Revised `save()` reading profile directly:

```typescript
async save(): Promise<void> {
  try {
    const terminalNames = vscode.window.terminals.map(t => t.name)
    const sessionIds = Array.from(this.sessionManager.getSessions().keys())
    // Read R2 segment prompts directly from profile file
    let r2Segments: string[] = []
    const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
    try {
      const raw = fs.readFileSync(profilePath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const rw = parsed['radialWheel'] as Record<string, unknown> | undefined
      if (Array.isArray(rw?.['segments'])) {
        r2Segments = rw['segments'] as string[]
      }
    } catch { /* ENOENT or parse error — default to empty */ }
    const state: QuickSaveState = { terminalNames, sessionIds, r2Segments }
    await this.globalState.update(QUICKSAVE_KEY, state)
    logger.info(`QuickSaveManager: saved ${terminalNames.length} terminals, ${sessionIds.length} sessions`)
  } catch (err) {
    logger.error('QuickSaveManager: save() failed', err)
  }
}
```

### `extension.ts` Changes

**Import:**

```typescript
import { QuickSaveManager } from './session/quicksave-manager'
```

**After `sessionManager` and `workspaceRoot` are initialized** (after line ~224 in current `extension.ts`):

```typescript
// Story 9.6: Session quicksave/resume
const quickSaveManager = new QuickSaveManager(context.globalState, sessionManager, workspaceRoot)
```

**Pass to `registerCommands()`** — update the call signature to include `quickSaveManager`:

```typescript
registerCommands(context, slidePanelManager, modeManager, onboardingPanelManager, sessionManager, lastCommandTracker, hudPanelManager, miniGamePanelManager, quickSaveManager)
```

**Resume prompt** — add after the existing onboarding check (around line ~413):

```typescript
// Story 9.6: Show resume prompt if quicksave state exists
const savedState = quickSaveManager.load()
if (savedState !== null) {
  void vscode.window
    .showInformationMessage('Resume previous session?', 'Yes', 'Dismiss')
    .then(async (selection) => {
      if (selection === 'Yes') {
        await quickSaveManager.restore(savedState)
      } else {
        // Dismissed (or closed) — clear the snapshot
        await quickSaveManager.clear()
      }
    })
}
```

### `register.ts` Changes

Add `quickSaveManager?: QuickSaveManager` as the last parameter:

```typescript
export function registerCommands(
  context: vscode.ExtensionContext,
  slidePanelManager: SlidePanelManager,
  modeManager: ModeManager,
  onboardingPanelManager: OnboardingPanelManager,
  sessionManager?: SessionManager,
  lastCommandTracker?: LastCommandTracker,
  hudPanelManager?: HudPanelManager,
  miniGamePanelManager?: MiniGamePanelManager,
  quickSaveManager?: QuickSaveManager,  // Story 9.6
): void {
```

Register the command (inside the `context.subscriptions.push(...)` call):

```typescript
// Story 9.6: Session quicksave (FR58)
vscode.commands.registerCommand('vibesense.quicksave', () => {
  try {
    void quickSaveManager?.save()
  } catch (err) {
    logger.error('vibesense.quicksave: failed', err)
    // NFR-R1: never propagate
  }
}),
```

Import at top of `register.ts`:

```typescript
import type { QuickSaveManager } from '../session/quicksave-manager'
```

### `package.json` Addition

Add to `contributes.commands` array:

```json
{
  "command": "vibesense.quicksave",
  "title": "VibeSense: Quick Save Session"
}
```

### Testing Pattern

Follow the `GameHighScoreStore` pattern from `test/unit/extension/game-high-score-store.test.ts`.

**Mock `globalState`:**

```typescript
function makeGlobalState(): vscode.Memento {
  const store = new Map<string, unknown>()
  return {
    get: <T>(key: string, defaultValue?: T): T => (store.get(key) ?? defaultValue) as T,
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    keys: () => [],
    setKeysForSync: () => {},
  } as unknown as vscode.Memento
}
```

**Mock `SessionManager`:**

```typescript
const mockSessionManager = {
  getSessions: () => new Map([['session-1', {}], ['session-2', {}]]),
} as unknown as SessionManager
```

**Mock `vscode.window.terminals`** — in `vi.hoisted` or `vi.mock`:

```typescript
vi.mock('vscode', () => ({
  window: {
    terminals: [{ name: 'VibeSense' }, { name: 'Claude Code' }],
    createTerminal: vi.fn(),
  },
  // ...
}))
```

**Test cases:**

1. `save()` persists correct shape with `terminalNames`, `sessionIds`, `r2Segments`
2. `load()` returns `null` when key absent
3. `load()` returns persisted state when key present
4. `clear()` sets key to `undefined`
5. `restore()` calls `vscode.window.createTerminal` for each name; clears state after
6. All methods swallow errors (NFR-R1) — mock `globalState.update` to throw and verify no re-throw

### Key Patterns from Previous Stories

- **globalState key convention:** `vibesense.{featureName}` — use `vibesense.quicksaveState`
- **try/catch + `logger.error` + no re-throw:** Required on ALL async extension host operations (NFR-R1). See `game-high-score-store.ts` for exact pattern.
- **`void ...then(...)` for fire-and-forget notifications:** See `extension.ts` line ~417 for the "Controller not found" prompt — exact same pattern for the resume prompt.
- **Optional manager parameters in `registerCommands`:** All managers after `modeManager` are optional — add `quickSaveManager` as last optional param.
- **`.vscode/vibesense.json` schema:** `radialWheel.segments` is a `string[]` (prompt texts). See `VibeProfileSchema` in `src/extension/input/radial-wheel-segments.ts` for the exact Zod schema — match this when writing back.
- **File write pattern:** Use synchronous `fs.readFileSync` / `fs.writeFileSync` — consistent with `SettingsBridge` and `ensureWorkspaceProfile` patterns in the codebase. Wrap in try/catch.

### Anti-Patterns to Avoid

- **Do NOT** add messages to `src/shared/messages.ts` — quicksave is entirely extension host side, no Webview involved
- **Do NOT** call `loadR2PersonalSegments()` in `QuickSaveManager` — it requires `dispatchTracker` and computes label fading, which is not what we need for saving raw prompt texts. Read `.vscode/vibesense.json` directly.
- **Do NOT** attempt to restore agent session FSM state — `SessionManager.sessions` map is runtime-only. Only terminal names and wheel prompts are meaningful to restore.
- **Do NOT** show the resume prompt more than once — calling `clear()` after any user action (Yes or Dismiss) ensures it won't re-appear.
- **Do NOT** block extension activation — the `showInformationMessage` call must be `void ...then(...)` (fire-and-forget).
- **Do NOT** use `console.log` — use `logger.info`/`logger.error` only.

### Vitest Config

No changes needed. Tests go in `test/unit/extension/quicksave-manager.test.ts` — the existing `vitest.config.ts` handles this path. Follow `test/unit/extension/game-high-score-store.test.ts` as the structural template (vi.hoisted mock state, vi.mock vscode, helper functions).

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed `quicksave-manager.test.ts`: used `vi.hoisted()` for `mockCreateTerminal` and `mockTerminals` to avoid "Cannot access before initialization" error from Vitest hoisting of `vi.mock` factory
- Fixed `register.test.ts`: updated subscription count assertion from 20 → 21 to account for new `vibesense.quicksave` command

### Completion Notes List

- AC1: `QuickSaveState` interface in `src/shared/types.ts`; `QUICKSAVE_KEY` in `src/shared/constants.ts`; `QuickSaveManager.save()` persists `terminalNames`, `sessionIds`, and `r2Segments` (read directly from `.vscode/vibesense.json`) to `globalState`
- AC2: Resume prompt shown fire-and-forget via `void vscode.window.showInformationMessage(...)` in `extension.ts` — does not block activation
- AC3: `restore()` calls `vscode.window.createTerminal({ name })` for each saved terminal; writes `r2Segments` back to `.vscode/vibesense.json`; clears quicksave after restore
- AC4: `clear()` calls `globalState.update(QUICKSAVE_KEY, undefined)`; called on Dismiss or notification close
- AC5: `vibesense.quicksave` registered in `register.ts` and `package.json`
- NFR-R1: all methods wrapped in try/catch with `logger.error`, never rethrow
- 873 tests pass (16 new tests in `quicksave-manager.test.ts`)

### File List

| File | Action |
|------|--------|
| `src/shared/types.ts` | Modify — add `QuickSaveState` interface |
| `src/shared/constants.ts` | Modify — add `QUICKSAVE_KEY` |
| `src/extension/session/quicksave-manager.ts` | Create — `QuickSaveManager` class |
| `src/extension/commands/register.ts` | Modify — add `quickSaveManager` param + `vibesense.quicksave` command |
| `src/extension/extension.ts` | Modify — instantiate `QuickSaveManager`, show resume prompt, pass to `registerCommands` |
| `package.json` | Modify — add `vibesense.quicksave` to `contributes.commands` |
| `test/unit/extension/quicksave-manager.test.ts` | Create — unit tests |
| `test/unit/extension/commands/register.test.ts` | Modify — update subscription count assertion to 21 |
| `_bmad-output/implementation-artifacts/9-6-session-quicksave-resume.md` | Modify — story file updated |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modify — status updated to `review` |

## Change Log

| Date | Change |
|------|--------|
| 2026-04-01 | Story 9.6 implemented — QuickSaveManager, vibesense.quicksave command, resume prompt on activation, 16 unit tests; all 873 tests pass |
