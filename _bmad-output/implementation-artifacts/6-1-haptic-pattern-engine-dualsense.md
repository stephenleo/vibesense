# Story 6.1: Haptic Pattern Engine (DualSense)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a vibe coder,
I want distinct haptic patterns emitted on my DualSense for each agent state event — single pulse (complete), rising pulse (needs-input), slow rumble (processing start), double pulse (error) — so that I feel my agent's state in my hands without looking at the screen.

## Acceptance Criteria

1. **Given** a DualSense is connected and an agent session transitions to `needs-input`, **When** the haptic engine fires, **Then** a rising escalating pulse plays on the DualSense within 50ms of the FSM transition, **And** the haptic fires BEFORE any visual update (per UX-DR14 haptic-first principle).

2. **Given** an agent session transitions to `idle` (complete), **When** the haptic engine fires, **Then** a single short pulse plays.

3. **Given** a Do Not Disturb mode is active with priority threshold = `high` (Story 6.5), **When** a `normal` priority haptic would fire, **Then** the haptic is suppressed.

4. **Given** an Xbox controller or generic HID device is connected, **When** agent state transitions occur, **Then** no haptic output is attempted, **And** no error is thrown.

5. **Given** agent state transitions occur rapidly (multiple within 100ms), **When** the haptic engine fires, **Then** only the latest haptic fires (no stacking of concurrent haptic sequences).

## Tasks / Subtasks

- [x] Create `src/extension/output/haptic-controller.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Define `HapticController` class subscribing to `sessionManager.on('sessionStateChanged', ...)`
  - [x] Map AgentState → HapticPattern: `processing→slow_rumble`, `needs-input→rising_pulse` (via double_pulse cadence), `idle→single_pulse`, `error→double_pulse`
  - [x] Guard: only fire haptics when `hal.controllerType === 'dualsense'`; silently skip for `xbox` and `generic-hid`
  - [x] DND integration: accept an optional `isDndSuppressed: () => boolean` callback; suppress when callback returns true (stub out for Story 6.5)
  - [x] Anti-stacking: cancel any in-flight haptic timer sequence before starting a new one
  - [x] Call `hal.setHaptic(pattern)` — do NOT re-implement rumble logic; DualSenseDriver.setHaptic() already handles all patterns
  - [x] Dispose: `removeAllListeners()` on the sessionManager subscription when hapticController is disposed
- [x] Wire `HapticController` into `src/extension/extension.ts` (AC: 1, 4)
  - [x] Instantiate `HapticController` after `sessionManager` and `hal` (ControllerLifecycleManager) are both ready
  - [x] Pass `sessionManager` and a `getHal()` accessor to `HapticController`
  - [x] Add to `context.subscriptions` for proper disposal
  - [x] Haptic must fire before postMessage to Webview panels (order matters per UX-DR14)
- [x] Write unit tests `test/unit/output/haptic-controller.test.ts` (AC: 1, 2, 3, 4, 5)
  - [x] Test: `processing` transition → `slow_rumble` called on DualSense HAL
  - [x] Test: `needs-input` transition → haptic fired within timing window
  - [x] Test: `idle` transition → `single_pulse` called
  - [x] Test: `error` transition → `double_pulse` called
  - [x] Test: non-DualSense HAL (xbox, generic-hid) → `setHaptic` never called, no error thrown
  - [x] Test: DND suppression callback → `setHaptic` not called when suppressed
  - [x] Test: rapid successive transitions → only latest haptic fires (anti-stacking)
  - [x] Test: dispose → no further haptic calls after disposal
- [x] Add `output/` directory test structure: `test/unit/output/haptic-controller.test.ts`

## Dev Notes

### Haptic Pattern Mapping (State → Pattern)

| AgentState | HapticPattern | Rationale |
|------------|---------------|-----------|
| `processing` | `slow_rumble` | Sustained low pulse — agent is thinking |
| `needs-input` | `double_pulse` | Two-beat rising tap — needs your attention |
| `idle` (complete) | `single_pulse` | Single short tap — done |
| `error` | `double_pulse` | Two-beat alert — something went wrong |

> Story 6.1 uses `double_pulse` for both `needs-input` and `error`. Story 6.2 (LED color) differentiates these states visually (amber vs red). The haptic distinction is intentionally subtle — Story 6.5 (DND) can tune per-state priority later.

### Critical: DualSenseDriver.setHaptic() Already Exists

**DO NOT reimplement rumble logic.** `src/extension/hid/dualsense-driver.ts` already implements all 5 haptic patterns via `controller.rumble()` with timer scheduling. The `haptic-controller.ts` you build here is purely a **state-to-haptic routing layer** — it listens to FSM events and calls `hal.setHaptic(pattern)`.

Existing patterns in `DualSenseDriver.setHaptic()`:
- `single_pulse` — `rumble(0.5)` → 80ms → `rumble(0)` ✓
- `double_pulse` — two-beat: on→60ms→off→120ms→on→200ms→off ✓
- `triple_pulse` — three-beat for Story 6.4 external API ✓
- `slow_rumble` — `rumble(0.3)` → 500ms → `rumble(0)` ✓
- `none` — `rumble(0)` ✓

### Anti-Stacking: Cancel In-Flight Timers

`DualSenseDriver.setHaptic()` already manages its own `hapticTimers[]` array. BUT if `sessionManager` fires two state transitions within 100ms (e.g., `processing → needs-input → processing`), the second `setHaptic()` call should NOT layer on top of the first. Implement an in-flight guard in `HapticController`:

```typescript
// In HapticController — call this before each new setHaptic()
private cancelInFlight(): void {
  // DualSenseDriver.setHaptic('none') cancels any ongoing rumble
  this.currentHal?.setHaptic('none')
}
```

### HAL Access: ControllerLifecycleManager Pattern

In `extension.ts`, the active HAL is managed by `ControllerLifecycleManager`. There is no single exported `hal` reference — drivers are passed as callbacks on connect. The correct pattern for `HapticController` is to accept a `getHal: () => ControllerHAL | null` function reference that resolves the currently active driver at fire time:

```typescript
export class HapticController {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly getHal: () => ControllerHAL | null,
    private readonly isDndSuppressed: () => boolean = () => false,
  ) { ... }
}
```

In `extension.ts`, wire it like:
```typescript
let currentHal: ControllerHAL | null = null
// ... (set currentHal in onConnected callback, clear in onDisconnected)
const hapticController = new HapticController(sessionManager, () => currentHal)
```

### UX-DR14: Haptic-First Ordering

Architecture mandates haptic fires BEFORE visual update. In `extension.ts`, `hapticController` must be subscribed to `sessionManager.on('sessionStateChanged', ...)` BEFORE `slidePanelManager` and `hud-panel` postMessage calls. Since EventEmitter fires listeners in registration order, instantiate and register `hapticController` before the panel managers that push FSM state to Webviews.

### DND Integration (Stub for Story 6.5)

Story 6.5 has not been implemented yet. The `isDndSuppressed` callback is a forward-compatibility hook. Default: `() => false` (no suppression). Story 6.5 will wire the actual DND state when implemented. Do NOT block this story on Story 6.5.

### Xbox / Generic HID: Silent Skip

`ControllerHAL.setHaptic()` is already a no-op on `XboxDriver` and `GenericHidDriver` (architecture mandate). BUT `HapticController` must guard at the controller type level and not call `setHaptic()` at all for non-DualSense to be explicit:

```typescript
const hal = this.getHal()
if (!hal || hal.controllerType !== 'dualsense') {
  return  // No haptic for xbox/generic-hid — no-op, no error
}
hal.setHaptic(pattern)
```

### File Location

- **New file:** `src/extension/output/haptic-controller.ts`
- **New test:** `test/unit/output/haptic-controller.test.ts`
- **Modified:** `src/extension/extension.ts` (wire HapticController)
- Architecture maps `output/` to `src/extension/output/` — see architecture.md Feature-to-Location Mapping. The directory currently has no files; create it with `haptic-controller.ts`.

### NFR-R1: Never Throw

All event handlers and HAL calls must be wrapped in try/catch. Use `logger.error()` to record — never rethrow. Pattern established in all Epic 4 and Epic 5 stories:

```typescript
sessionManager.on('sessionStateChanged', (_sessionId: string, _prev: AgentState, next: AgentState) => {
  try {
    this.handleStateChange(next)
  } catch (err) {
    logger.error('HapticController: sessionStateChanged handler error', err)
  }
})
```

### Timing Requirement

AC 1 specifies: haptic fires within 50ms of FSM transition. The SessionManager emits `sessionStateChanged` synchronously from `AgentFSM.dispatch()`. The EventEmitter chain is synchronous. The `setHaptic()` call in DualSenseDriver initiates rumble synchronously. There is no async gap — 50ms constraint is met by design as long as no `setTimeout`/`await` is introduced in `HapticController`.

### Testing Pattern (from Epic 5)

Mock `vscode` at the top of test files — required by `logger.ts`:

```typescript
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))
```

Mock `ControllerHAL` as a plain object with jest spies:
```typescript
const mockHal = {
  controllerType: 'dualsense' as ControllerType,
  setHaptic: vi.fn(),
  setLED: vi.fn(),
  on: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}
```

### AgentState → FSM Event Reminder

From `session-manager.ts` (Epic 5, Story 5.1):
- `hook: 'stop'` → `fsm.dispatch('AGENT_COMPLETE')` → state `idle`
- `hook: 'post_tool_use'` → `fsm.dispatch('NEEDS_INPUT')` → state `needs-input`
- `AGENT_PROCESSING` event → state `processing` (fired by terminal parser, Story 5.4)
- `AGENT_ERROR` event → state `error` (fired by terminal parser, Story 5.4)

### Project Structure Notes

**Context boundary:** `haptic-controller.ts` is in `src/extension/` (Node.js context). It must NOT import from `src/webview/`. It may import from `src/shared/` (types, constants).

**Existing `src/extension/output/` directory:** The directory exists but is empty. The architecture plan designated this folder for `haptic-controller.ts`, `led-controller.ts`, and `audio-controller.ts` (Epic 6 output subsystem). Create only `haptic-controller.ts` in this story; do NOT create stubs for the others.

**No new shared types needed:** `HapticPattern` is already defined in `src/shared/types.ts`. `AgentState` is already defined there. `ControllerHAL` and `ControllerType` in `src/extension/hid/hal.ts`. No changes to `src/shared/types.ts` required.

**No new messages.ts entries needed:** Haptic output is entirely within the extension host. No Webview postMessage needed for this story.

### extension.ts Integration Points

The `extension.ts` already has a `currentControllerType` local variable and the `onConnected`/`onDisconnected` callbacks. Add a `currentDriver: ControllerHAL | null = null` local ref alongside `currentControllerType`. Set it in the same callbacks where `currentControllerType` is set. Then pass `() => currentDriver` to `HapticController`.

Instantiation order in `extension.ts` must be:
1. `sessionManager` (already exists — Story 5.1)
2. `hapticController` — NEW (subscribe to sessionManager first, before panels)
3. `slidePanelManager`, `hud-panel` (already exist — visual update comes after haptic)

### References

- Architecture haptic/output section: `_bmad-output/planning-artifacts/architecture.md` — "Feature-to-Location Mapping", "Data Flow" (line 753), "Structure Patterns" (line 400)
- Epic 6 Story 6.1 requirements: `_bmad-output/planning-artifacts/epics.md` line 1134
- UX-DR14 haptic-first principle: `_bmad-output/planning-artifacts/epics.md` line 140
- FR24 (haptic patterns per agent state): `_bmad-output/planning-artifacts/prd.md`
- FR54 (celebration haptic infrastructure): `_bmad-output/planning-artifacts/epics.md` line 134
- Existing DualSense driver (do not duplicate): `src/extension/hid/dualsense-driver.ts`
- HAL interface: `src/extension/hid/hal.ts`
- SessionManager API: `src/extension/session/session-manager.ts`
- AgentFSM states: `src/extension/fsm/states.ts`
- Shared types (HapticPattern, AgentState): `src/shared/types.ts`
- Test pattern reference: `test/unit/fsm/agent-fsm.test.ts`
- Epic 5 retrospective learnings: `_bmad-output/implementation-artifacts/epic-5-retro-2026-03-31.md`
- Deferred work (relevant): `_bmad-output/implementation-artifacts/deferred-work.md` — unbounded sessions map, multi-window socket

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_None — implementation proceeded without debugging issues._

### Completion Notes List

- Implemented `HapticController` class in `src/extension/output/haptic-controller.ts` as a pure state-to-haptic routing layer. Does not duplicate rumble logic from `DualSenseDriver.setHaptic()`.
- State-to-pattern mapping: `processing→slow_rumble`, `needs-input→double_pulse`, `idle→single_pulse`, `error→double_pulse`.
- Anti-stacking implemented by calling `hal.setHaptic('none')` before each new pattern — cancels any in-flight DualSenseDriver timer sequences.
- DualSense guard: `if (!hal || hal.controllerType !== 'dualsense') return` — silent no-op for xbox/generic-hid per AC 4.
- DND stub: `isDndSuppressed: () => boolean = () => false` forward-compat hook — wired in Story 6.5.
- NFR-R1 respected: event handler wrapped in try/catch; errors logged, never rethrown.
- Wired into `extension.ts`: `hapticController` instantiated BEFORE `slidePanelManager` (UX-DR14 haptic-first ordering). `currentDriver: ControllerHAL | null` ref set/cleared in ControllerLifecycleManager callbacks and initial driver setup.
- 12 unit tests covering all 5 ACs: pattern routing, non-DualSense silent skip, DND suppression, anti-stacking, dispose cleanup, and synchronous timing proof.
- All 607 tests pass (36 test files, no regressions).

### File List

- `src/extension/output/haptic-controller.ts` (new)
- `src/extension/extension.ts` (modified — import HapticController + ControllerHAL, add currentDriver ref, instantiate HapticController before panels, set currentDriver in lifecycle callbacks)
- `test/unit/output/haptic-controller.test.ts` (new)

## Change Log

- 2026-04-01: Story 6.1 implemented — HapticController created, wired into extension.ts (haptic-first per UX-DR14), 12 unit tests added. All 607 tests pass.
