# Story 9.4: Session Health Bar

**Status:** done
**Epic:** 9 — Gamified Stats, Achievements & Session Management
**Story ID:** 9.4
**Story Key:** 9-4-session-health-bar
**Created:** 2026-04-01

---

## Story

As a vibe coder,
I want a persistent session health bar in the SlidePanel or HUD showing live controller action ratio, session duration, and XP earned in the current session,
So that I have at-a-glance session momentum throughout my work without opening the full stats dashboard.

**Depends on:** Stories 9.1 (ratio tracking — `SessionRatioTracker.getCurrentStats()` already exists), 9.3 (XP system — `XpManager.load()` already exists)
**Can run in parallel with:** Story 9.5

---

## Acceptance Criteria

**AC1 — Health bar displays live stats when session active:**
Given a session is active and a controller is connected,
When the session health bar renders,
Then it displays: live controller action ratio percentage, current session duration, and XP earned so far this session,
And the ratio percentage updates in real-time as actions are taken.

**AC2 — Amber styling when ratio below 50%:**
Given the controller action ratio drops below 50%,
When the health bar renders the ratio,
Then the ratio indicator uses amber/warning styling (`#FFB800`).

**AC3 — Accent cyan styling when ratio above 80%:**
Given the ratio is above 80%,
When the health bar renders,
Then the ratio indicator uses the accent cyan styling (`var(--vs-accent)` = `#00C8FF`).

---

## Tasks / Subtasks

- [x] Task 1: Add `SESSION_HEALTH_UPDATE` message to `src/shared/messages.ts`
  - [x] 1.1 Add `SESSION_HEALTH_UPDATE` to `HostMessageSchema` discriminated union with payload: `{ ratio: number, durationMs: number, sessionXp: number, connected: boolean }`
  - [x] 1.2 Add `Zod` validation: `ratio` is `z.number().min(0).max(1)`, `durationMs` is `z.number().int().nonnegative()`, `sessionXp` is `z.number().int().nonnegative()`, `connected` is `z.boolean()`
  - [x] 1.3 No webview→host messages needed (display-only; no user actions)

- [x] Task 2: Add `getSessionStartTime()` to `SessionRatioTracker`
  - [x] 2.1 Add `getSessionStartTime(): number` method — returns `this.startedAt` (already stored as `private readonly`)
  - [x] 2.2 Add `getSessionXp(xpRecord: XpRecord): number` pure helper to `XpManager` (or compute inline in extension.ts) — current session XP preview:
    - If `xpRecord.lastSessionDate === today`: 0 (last session already finalized today, new session just started)
    - Otherwise: compute potential XP using `ratioTracker.getCurrentStats()` and `ratioTracker.getDistinctFeatureCount()` without mutating state
  - [x] 2.3 **Simpler approach** (recommended): compute `sessionXp` in extension.ts inline using the same logic as `XpManager.awardSessionXp` but as a read-only preview — no new method needed

- [x] Task 3: Create `SessionHealthManager` in `src/extension/stats/session-health-manager.ts`
  - [x] 3.1 Constructor: `(slidePanelManager: SlidePanelManager, ratioTracker: SessionRatioTracker, xpManager: XpManager, globalState: vscode.Memento)`
  - [x] 3.2 Implement `start(): void` — starts a `setInterval` at 1000ms that calls `pushUpdate()`
  - [x] 3.3 Implement `pushUpdate(): void` — reads `ratioTracker.getCurrentStats()`, computes `durationMs = Date.now() - ratioTracker.getSessionStartTime()`, loads `xpRecord = xpManager.load()`, computes preview XP (see Task 2.3), calls `slidePanelManager.notifyHealthUpdate(...)`. All wrapped in try/catch (NFR-R1).
  - [x] 3.4 Implement `stop(): void` / `dispose(): void` — clears the interval
  - [x] 3.5 Implement `notifyConnected(connected: boolean): void` — sets internal `connected` flag so updates include correct connected state; also calls `pushUpdate()` immediately on connect

- [x] Task 4: Add `notifyHealthUpdate()` to `SlidePanelManager`
  - [x] 4.1 Add `notifyHealthUpdate(ratio: number, durationMs: number, sessionXp: number, connected: boolean): void` method to `src/extension/panels/slide-panel-manager.ts`
  - [x] 4.2 Posts `SESSION_HEALTH_UPDATE` message to the slide panel webview: `this.panel?.webview.postMessage({ type: 'SESSION_HEALTH_UPDATE', payload: { ratio, durationMs, sessionXp, connected } })`
  - [x] 4.3 Wrap postMessage in `.then(undefined, err => logger.error(...))` pattern (consistent with existing panel managers)

- [x] Task 5: Create `SessionHealthBar` React component
  - [x] 5.1 Create `src/webview/session/SessionHealthBar.tsx`
  - [x] 5.2 Props interface: `{ ratio: number, durationMs: number, sessionXp: number, connected: boolean }`
  - [x] 5.3 Format duration: `mm:ss` display (e.g. `"12:34"`) using simple arithmetic — no external date library
  - [x] 5.4 Format ratio: `Math.round(ratio * 100)` as integer percent (e.g. `"73%"`)
  - [x] 5.5 Ratio color logic:
    - `ratio < 0.5`: amber class `.health-bar__ratio--warning` (color `#FFB800`)
    - `ratio >= 0.8`: accent class `.health-bar__ratio--good` (color `var(--vs-accent)`)
    - `0.5 <= ratio < 0.8`: neutral class `.health-bar__ratio--neutral` (color `var(--vs-text2)`)
  - [x] 5.6 When `!connected`: render `null` (health bar hidden — no controller active)
  - [x] 5.7 ARIA: `role="status"` with `aria-label` describing the session health summary (NFR-A1)
  - [x] 5.8 Add CSS to `src/webview/session/session.css` under a `/* ─── SessionHealthBar ─── */` section using VOID tokens

- [x] Task 6: Wire `SessionHealthBar` into `SlidePanel`
  - [x] 6.1 Extend `SlidePanelProps` to accept optional `healthBar?: { ratio: number, durationMs: number, sessionXp: number, connected: boolean }`
  - [x] 6.2 Render `<SessionHealthBar {...props.healthBar} />` at the top of `slide-panel__content` above the session list (always visible when panel is expanded and connected)
  - [x] 6.3 When `healthBar` prop absent or `!connected`: the health bar renders null — no empty space

- [x] Task 7: Wire `SESSION_HEALTH_UPDATE` message in `src/webview/session/index.tsx`
  - [x] 7.1 Add `healthBarRatio`, `healthBarDurationMs`, `healthBarSessionXp`, `healthBarConnected` fields to `AppState`
  - [x] 7.2 Add `UPDATE_HEALTH_BAR` action to the reducer
  - [x] 7.3 Handle `SESSION_HEALTH_UPDATE` message in the `handleMessage` function: dispatch `UPDATE_HEALTH_BAR`
  - [x] 7.4 Pass `healthBar` prop to `<SlidePanel />`: `healthBar={{ ratio: state.healthBarRatio, durationMs: state.healthBarDurationMs, sessionXp: state.healthBarSessionXp, connected: state.healthBarConnected }}`

- [x] Task 8: Wire `SessionHealthManager` into `extension.ts`
  - [x] 8.1 Import and instantiate `SessionHealthManager` after `ratioTracker`, `xpManager`, and `slidePanelManager` are available
  - [x] 8.2 Call `sessionHealthManager.start()` to begin the 1s polling loop
  - [x] 8.3 On controller connect event: call `sessionHealthManager.notifyConnected(true)`
  - [x] 8.4 On controller disconnect event: call `sessionHealthManager.notifyConnected(false)`
  - [x] 8.5 Push `sessionHealthManager` to `context.subscriptions` for auto-dispose

- [x] Task 9: Write tests
  - [x] 9.1 `test/unit/extension/stats/session-health-manager.test.ts`: test `pushUpdate()` computes correct payload; test `notifyConnected()` calls `pushUpdate()` immediately; test `dispose()` clears interval; error resilience (NFR-R1)
  - [x] 9.2 `test/unit/extension/stats/session-ratio-tracker.test.ts`: add test for `getSessionStartTime()` returns a number ≤ `Date.now()`
  - [x] 9.3 `test/webview/SessionHealthBar.test.tsx`: test ratio color classes (AC2, AC3); test duration formatting; test hidden when `!connected`; test ARIA attributes

### Review Findings

- [x] [Review][Patch] Simplify redundant controller-only check — `(stats.controllerActions + stats.keyboardActions) > 0` reduces to `stats.controllerActions > 0` when `keyboardActions === 0` [session-health-manager.ts:50]
- [x] [Review][Patch] Clamp durationMs to non-negative — protect against clock adjustment producing negative values [session-health-manager.ts:44]
- [x] [Review][Patch] Guard against double-start in `start()` — calling `start()` twice would leak a timer [session-health-manager.ts:32]

---

## Dev Notes

### What This Story Builds

A live session health bar that polls the in-memory `SessionRatioTracker` every second and pushes stats to the SlidePanel webview via `SESSION_HEALTH_UPDATE` postMessage. The webview renders a compact `SessionHealthBar` component at the top of the SlidePanel content area.

**Scope boundary:** This story does NOT implement:
- Any changes to the stats dashboard (Story 9.2's StatsPanel/StatsCard)
- Any changes to the HUD overlay (`HUDOverlay.tsx`) — the health bar lives in the SlidePanel webview only
- AchievementBurst or XP award logic (Story 9.3/9.5) — only reads XP state, never mutates it

### Architecture Compliance

**Context boundary rule:** `src/extension/` must never import from `src/webview/`. The message protocol in `src/shared/messages.ts` is the ONLY bridge. Both sides share `src/shared/types.ts` and `src/shared/messages.ts`.

**Webview target:** `src/webview/session/` compiles to `dist/webview/session.js` via webpack. The entry point is `src/webview/session/index.tsx`. No new webpack entry point needed — the health bar is embedded in the existing `session` bundle.

**postMessage pattern:** Extension host → webview via `this.panel?.webview.postMessage(...)` with `.then(undefined, err => logger.error(...))`. See existing `SlidePanelManager` methods.

**Error resilience (NFR-R1):** All interval callbacks and globalState reads must be try/catch wrapped; never throw to the caller.

**CSS convention:** Add health bar CSS to `src/webview/session/session.css` (not a new file). Use `@import '../shared-ui/tokens.css'` is already at the top. Follow `--vs-*` token naming. Match existing BEM-like class naming in that file.

### Critical File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/messages.ts` | EXTEND | Add `SESSION_HEALTH_UPDATE` to `HostMessageSchema` |
| `src/extension/stats/session-ratio-tracker.ts` | EXTEND | Add `getSessionStartTime()` method |
| `src/extension/stats/session-health-manager.ts` | CREATE | `SessionHealthManager` with 1s polling loop |
| `src/extension/panels/slide-panel-manager.ts` | EXTEND | Add `notifyHealthUpdate()` method |
| `src/webview/session/SessionHealthBar.tsx` | CREATE | React component for health bar display |
| `src/webview/session/session.css` | EXTEND | Health bar styles under `/* ─── SessionHealthBar ─── */` |
| `src/webview/session/SlidePanel.tsx` | EXTEND | Accept `healthBar` prop, render `SessionHealthBar` |
| `src/webview/session/index.tsx` | EXTEND | Handle `SESSION_HEALTH_UPDATE` message, pass to SlidePanel |
| `src/extension/extension.ts` | EXTEND | Instantiate `SessionHealthManager`, wire connect/disconnect |
| `test/unit/extension/stats/session-health-manager.test.ts` | CREATE | Unit tests |
| `test/unit/extension/stats/session-ratio-tracker.test.ts` | EXTEND | Add `getSessionStartTime()` test |
| `test/webview/SessionHealthBar.test.tsx` | CREATE | Component tests |

### VOID Design Token Reference (AC2 / AC3)

```css
/* From src/webview/shared-ui/tokens.css */
--vs-accent:   #00C8FF   /* ratio ≥ 80% — cyan good state */
--vs-text2:    #7A8BAA   /* ratio 50–79% — neutral state */
/* Amber warning = #FFB800 (same as --vs-controller-y) — ratio < 50% */
```

Ratio indicator must use color **and** a text label (not color alone) for NFR-A2 accessibility. E.g., show `"73% ctrl"` or a `.health-bar__ratio` span with both the color class and screen-reader-friendly text.

### SessionHealthBar Component Structure

```tsx
// src/webview/session/SessionHealthBar.tsx
interface SessionHealthBarProps {
  ratio: number        // 0.0–1.0
  durationMs: number   // elapsed ms since session start
  sessionXp: number    // estimated XP earned so far this session
  connected: boolean   // false → render null
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
```

### Session XP Preview Computation (inline in `SessionHealthManager.pushUpdate()`)

The `sessionXp` value shown is an estimate of what will be earned when the session ends (not the total accumulated XP). Compute it using the same logic as `XpManager.awardSessionXp` but read-only:

```typescript
// In SessionHealthManager.pushUpdate()
const xpRecord = this.xpManager.load()
const stats = this.ratioTracker.getCurrentStats()
const featureCount = this.ratioTracker.getDistinctFeatureCount()
let sessionXp = 0
if (stats.keyboardActions === 0 && (stats.controllerActions + stats.keyboardActions) > 0) {
  sessionXp += XP_CONTROLLER_ONLY  // +100
}
if (stats.ratio >= HIGH_RATIO_THRESHOLD) {
  sessionXp += XP_HIGH_RATIO  // +50
}
if (featureCount >= MULTI_FEATURE_MIN_COUNT) {
  sessionXp += XP_MULTI_FEATURE  // +25
}
sessionXp += xpRecord.streakDays * XP_STREAK_PER_DAY  // streak bonus
```

Import `XP_CONTROLLER_ONLY`, `XP_HIGH_RATIO`, `XP_MULTI_FEATURE`, `XP_STREAK_PER_DAY`, `HIGH_RATIO_THRESHOLD`, `MULTI_FEATURE_MIN_COUNT` from `../../shared/constants`.

### `getSessionStartTime()` — Already Prepared

`SessionRatioTracker` already stores `private readonly startedAt: number` and exposes a comment in `getCurrentStats()`: _"for live display — Story 9.4 forward compatibility"_. Adding `getSessionStartTime()` is a one-liner:

```typescript
getSessionStartTime(): number {
  return this.startedAt
}
```

### Test Pattern for Webview Components

Follow the exact pattern from `test/webview/HUDOverlay.test.tsx`:
1. `vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))` — CSS mock at top (Vitest hoisting)
2. `vi.mock('../../src/webview/session/session.css', () => ({}))` — CSS mock
3. `dispatchHostMessage(data)` helper with `act()` wrapper
4. Use `@testing-library/react` + `@testing-library/jest-dom`
5. `render(<SessionHealthBar ...props />)` — component tests are pure, no postMessage needed

### Interval Polling Rate

Use `setInterval` at **1000ms** (1 second). This matches the UX requirement "updates in real-time as actions are taken" without being overly aggressive. Store the timer ID and clear it in `dispose()`:

```typescript
private timer: ReturnType<typeof setInterval> | undefined

start(): void {
  this.timer = setInterval(() => { this.pushUpdate() }, 1000)
}

dispose(): void {
  if (this.timer !== undefined) {
    clearInterval(this.timer)
    this.timer = undefined
  }
}
```

### AppState Initial Values

Add to `initialState` in `src/webview/session/index.tsx`:
```typescript
healthBarRatio: 1.0,       // default: 100% (no actions yet)
healthBarDurationMs: 0,
healthBarSessionXp: 0,
healthBarConnected: false,  // hidden until controller connects
```

### Previous Story Intelligence (from Story 9.3)

- `SessionRatioTracker` already has `getCurrentStats()` for live ratio — use it, do not read globalState for live data
- `XpManager` is instantiated in `extension.ts` before `inputRouter` — `SessionHealthManager` can be instantiated in the same block
- Pattern for extension.ts wiring: always wrap in try/catch at the subscription `dispose()` boundary
- All test files in `test/unit/extension/stats/` use Vitest with manual mocks — no `vscode` import needed in tests (mock it with `vi.mock`)
- The `xpManager.load()` reads from `globalState` synchronously (returns `XpRecord`) — safe to call every second in the interval callback
- `session-ratio-tracker.test.ts` uses `vi.useFakeTimers()` for debounce testing — reuse that pattern if testing the 1s interval in `session-health-manager.test.ts`

### Git Intelligence

Recent commits in this branch:
- `1497e3c` story-9-3: Created `xp-manager.ts`, `XpRecord` type, XP constants, `SessionRatioTracker.recordFeatureUsed()`, wired into `extension.ts`
- `6f06d99` story-9-2: Created `StatsPanel.tsx`, `StatsCard.tsx`, `stats-panel.ts` manager, `STATS_LOADED` message

The pattern for a new host→webview push is:
1. Add message to `HostMessageSchema` in `messages.ts`
2. Add `notifyXxx()` to the panel manager
3. Create/extend React component
4. Handle message in `index.tsx` reducer
5. Wire manager in `extension.ts`

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No issues encountered during implementation. All tasks implemented cleanly following existing patterns.

### Completion Notes List

- **Task 1**: Added `SESSION_HEALTH_UPDATE` to `HostMessageSchema` in `src/shared/messages.ts` with Zod validation for `ratio` (0–1), `durationMs` (int nonneg), `sessionXp` (int nonneg), `connected` (boolean).
- **Task 2**: Added `getSessionStartTime(): number` one-liner to `SessionRatioTracker` returning `this.startedAt`. XP preview computed inline in `SessionHealthManager.pushUpdate()` per Task 2.3 simpler approach.
- **Task 3**: Created `SessionHealthManager` with 1s polling loop. `pushUpdate()` reads live stats, computes XP preview read-only, forwards to `SlidePanelManager.notifyHealthUpdate()`. All wrapped in try/catch (NFR-R1). `notifyConnected()` updates internal flag and immediately calls `pushUpdate()`.
- **Task 4**: Added `notifyHealthUpdate()` to `SlidePanelManager` following `.then(undefined, err => ...)` error pattern consistent with other panel managers.
- **Task 5**: Created `SessionHealthBar.tsx` React component. `formatDuration` exported for testability. Ratio color logic: `<0.5` → amber warning, `>=0.8` → cyan good, `0.5–0.79` → neutral. `!connected` → renders null. `role="status"` with descriptive `aria-label`. CSS added to `session.css` under `/* ─── SessionHealthBar ─── */`.
- **Task 6**: Extended `SlidePanelProps` with optional `healthBar` prop. Renders `<SessionHealthBar {...healthBar} />` at top of `slide-panel__content`.
- **Task 7**: Added `UPDATE_HEALTH_BAR` action and 4 `healthBar*` fields to `AppState`/reducer/initialState in `index.tsx`. Handles `SESSION_HEALTH_UPDATE` message. Passes `healthBar` prop to `<SlidePanel />`.
- **Task 8**: Imported `SessionHealthManager` into `extension.ts`. Instantiated after `ratioTracker` + `xpManager`. Called `start()`. Wired `notifyConnected(true/false)` on lifecycle manager connect/disconnect callbacks and initial driver connect. Pushed to `context.subscriptions`.
- **Task 9**: Created 3 test files — `session-health-manager.test.ts` (20 tests), `SessionHealthBar.test.tsx` (23 tests + 6 formatDuration tests), extended `session-ratio-tracker.test.ts` (2 new tests). All 1016 tests pass.

### File List

- `src/shared/messages.ts` (modified)
- `src/extension/stats/session-ratio-tracker.ts` (modified)
- `src/extension/stats/session-health-manager.ts` (created)
- `src/extension/panels/slide-panel-manager.ts` (modified)
- `src/webview/session/SessionHealthBar.tsx` (created)
- `src/webview/session/session.css` (modified)
- `src/webview/session/SlidePanel.tsx` (modified)
- `src/webview/session/index.tsx` (modified)
- `src/extension/extension.ts` (modified)
- `test/unit/extension/stats/session-health-manager.test.ts` (created)
- `test/unit/extension/stats/session-ratio-tracker.test.ts` (modified)
- `test/webview/SessionHealthBar.test.tsx` (created)
- `_bmad-output/implementation-artifacts/9-4-session-health-bar.md` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified)

---

## Change Log

- 2026-04-01: Story 9.4 created — session health bar with live ratio, duration, and XP preview in SlidePanel.
- 2026-04-01: Story 9.4 implemented by claude-sonnet-4-6 — all 9 tasks complete, 1016 tests passing, status → review.
- 2026-04-01: Story 9.4 code review passed — 3 patches applied (redundant condition, durationMs clamp, double-start guard), 3 dismissed, status → done.
