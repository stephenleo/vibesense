# Story 7.2: Dual Layered Wheel System (R2 Personal Wheel)

**Status:** review
**Epic:** 7 — Prompt Radial Wheel & HUD Overlay
**Story ID:** 7.2
**Story Key:** 7-2-dual-layered-wheel-system-r2-personal-wheel
**Created:** 2026-04-01

---

## User Story

As a vibe coder,
I want both the L2 Smart wheel and R2 Personal wheel visible simultaneously when either trigger is held, with the active wheel centered and the inactive wheel receded at ~85% scale + 50% opacity, and pressing the opposite trigger swapping foreground/background,
So that I can switch between system prompts and personal prompts with one trigger press.

---

## Acceptance Criteria (BDD)

**AC1 — R2 hold opens both wheels with R2 centered:**
Given R2 is held (without L2),
When both wheels render,
Then the R2 Personal wheel is centered (full size, full opacity),
And the L2 Smart wheel is offset 80px to the left at ~85% scale, ~50% opacity, 1px blur.

**AC2 — Trigger swap moves active wheel to center:**
Given L2 is held and then R2 is also pressed,
When the trigger swap fires,
Then the R2 wheel slides forward to center and L2 steps back in ~50ms ease-out,
And right stick navigation now controls the R2 wheel.

**AC3 — Releasing receded trigger does nothing:**
Given the non-active (receded) trigger is released,
When only the release event fires,
Then no action occurs (only releasing the active centered trigger dispatches).

---

## Requirements

**FR38** (full dual-wheel — both L2 and R2)
**UX-DR1** — dual layered wheel system with receded inactive wheel

---

## Developer Context

### What Story 7.1 Built (Foundation to Extend)

Story 7.1 created the full radial wheel infrastructure. Story 7.2 extends it — **do NOT rewrite what exists.**

**Files Story 7.1 created (extend, not replace):**
- `src/extension/input/radial-wheel-controller.ts` — handles L2 hold/release + right stick. **Extend** to also handle R2 and trigger swap logic.
- `src/extension/input/radial-wheel-segments.ts` — L2 Smart Wheel defaults. **Add** R2 Personal Wheel defaults alongside.
- `src/extension/panels/radial-wheel-panel.ts` — `RadialWheelPanelManager`. Already has `open(activeWheel, l2Segments, r2Segments)` signature. Extend to support the visual dual-wheel layout.
- `src/webview/radial-wheel/RadialWheel.tsx` — top-level wheel component. **Extend** to render both wheels simultaneously with depth/offset.
- `src/webview/radial-wheel/WheelSegment.tsx` — SVG arc segment. **No changes needed** (it renders a segment; dual-layout is handled in `RadialWheel.tsx`).
- `src/webview/radial-wheel/radial-wheel.css` — overlay styles. **Extend** with dual-wheel layout, inactive wheel styles, and swap transition.
- `src/shared/messages.ts` — already has `WHEEL_OPEN`, `WHEEL_STICK_UPDATE`, `WHEEL_CLOSE`. **No new messages needed** for Story 7.2.
- `src/shared/types.ts` — already has `WheelSegmentDef`. **No changes needed.**
- `src/shared/constants.ts` — has `computeWheelSegmentIndex()`. **No changes needed.**

**Critical from Story 7.1:** `RadialWheelPanelManager.open()` already sends both `l2Segments` and `r2Segments` to the Webview via `WHEEL_OPEN`. The data path exists. Story 7.2 makes the UI use it properly.

---

### What Story 7.2 Builds

1. **Extension host — `RadialWheelController` dual-trigger logic:** Add R2 hold/release detection and trigger swap (when opposite trigger pressed while one is held). Update `open()` calls to pass the correct `activeWheel` and the R2 segments.
2. **Extension host — `radial-wheel-segments.ts`:** Add `R2_PERSONAL_WHEEL_SEGMENTS` constant (8 default placeholder segments).
3. **Webview — `RadialWheel.tsx`:** Render BOTH wheels simultaneously using correct layout (active centered, inactive offset). Handle the `activeWheel` prop correctly to apply depth cues.
4. **Webview — `radial-wheel.css`:** Add styles for inactive wheel (translate, scale, opacity, blur) and the swap transition (`~50ms ease-out`).
5. **Tests:** Extend `test/webview/RadialWheel.test.tsx` and `test/unit/input/radial-wheel-controller.test.ts`.

---

### R2 Personal Wheel — Default Segments

Story 7.2 must provide 8 default R2 Personal segments (placeholder prompts — full customization is Story 7.4). Create in `src/extension/input/radial-wheel-segments.ts` alongside the existing L2 constant:

```typescript
export const R2_PERSONAL_WHEEL_SEGMENTS: WheelSegmentDef[] = [
  { index: 0, label: 'Refactor',    commandId: 'vibesense.dispatchPrompt', promptText: 'Refactor the selected code for clarity and efficiency' },
  { index: 1, label: 'Summarize',   commandId: 'vibesense.dispatchPrompt', promptText: 'Summarize what this code does in plain English' },
  { index: 2, label: 'Document',    commandId: 'vibesense.dispatchPrompt', promptText: 'Add JSDoc comments to the selected code' },
  { index: 3, label: 'Optimize',    commandId: 'vibesense.dispatchPrompt', promptText: 'Optimize the selected code for performance' },
  { index: 4, label: 'Review',      commandId: 'vibesense.dispatchPrompt', promptText: 'Review the selected code for bugs and issues' },
  { index: 5, label: 'Simplify',    commandId: 'vibesense.dispatchPrompt', promptText: 'Simplify the selected code' },
  { index: 6, label: 'Convert',     commandId: 'vibesense.dispatchPrompt', promptText: 'Convert the selected code to TypeScript with strict types' },
  { index: 7, label: 'Git Commit',  commandId: 'vibesense.dispatchPrompt', promptText: 'Write a concise conventional commit message for my changes' },
]
```

---

### RadialWheelController — Dual-Trigger Logic

**Current state:** `RadialWheelController` only handles L2/LT. Story 7.2 adds R2/RT and trigger swap.

**New state tracking:**
```typescript
private l2Held = false   // already exists
private r2Held = false   // ADD
private activeWheel: 'l2' | 'r2' = 'l2'  // ADD — which trigger opened the wheel
```

**Trigger event handling logic:**

```typescript
handleEvent(event: ControllerEvent): void {
  try {
    if (event.kind === 'button') {
      if (event.button === 'l2' || event.button === 'lt') {
        event.pressed ? this.onL2Press() : this.onL2Release()
      } else if (event.button === 'r2' || event.button === 'rt') {
        event.pressed ? this.onR2Press() : this.onR2Release()
      }
    } else if (event.kind === 'axis') {
      // right stick: only update when wheel is open (l2Held || r2Held)
      if (event.axis === 'right_x') { this.stickX = event.value; this.onStickUpdate() }
      else if (event.axis === 'right_y') { this.stickY = event.value; this.onStickUpdate() }
    }
  } catch (err) {
    logger.error('RadialWheelController: handleEvent error', err)
  }
}
```

**onL2Press():**
- If wheel is already open (r2Held): perform trigger swap — `activeWheel = 'l2'`, call `panelManager.swap('l2')` (or re-open with swapped active)
- If wheel is NOT open: open normally with `activeWheel = 'l2'`, `l2Held = true`, reset stick/selection

**onR2Press():**
- If wheel is already open (l2Held): perform trigger swap — `activeWheel = 'r2'`, call `panelManager.swap('r2')`
- If wheel is NOT open: open with `activeWheel = 'r2'`, `r2Held = true`, reset stick/selection

**onL2Release():**
- If `l2Held` is false: ignore (receded trigger release — AC3)
- If `activeWheel === 'l2'` AND `l2Held`: dispatch selected segment and close — same dispatch logic as Story 7.1
- If `activeWheel === 'r2'` AND `l2Held`: this is releasing the receded L2 — no action (AC3). Set `l2Held = false`.

**onR2Release():**
- Mirror of onL2Release() for R2.
- If `r2Held` AND `activeWheel === 'r2'`: dispatch from R2_PERSONAL_WHEEL_SEGMENTS and close.
- If `r2Held` AND `activeWheel === 'l2'`: receded R2 released — no action (AC3). Set `r2Held = false`.

**Dispatch from R2 segments:**
```typescript
private dispatchFromR2(): void {
  if (this.selectedIndex >= 0) {
    const seg = R2_PERSONAL_WHEEL_SEGMENTS[this.selectedIndex]
    if (seg) {
      this.panelManager.close(false)
      try {
        void vscode.commands.executeCommand('vibesense.dispatchPrompt', seg.promptText ?? seg.label)
        logger.info(`RadialWheelController: R2 dispatched segment ${this.selectedIndex}`)
      } catch (err) {
        logger.error('RadialWheelController: R2 dispatch error', err)
      }
    } else {
      this.panelManager.close(true)
    }
  } else {
    this.panelManager.close(true)
  }
}
```

**onStickUpdate():** Guard changed from `if (!this.l2Held)` to `if (!this.l2Held && !this.r2Held)`:
```typescript
private onStickUpdate(): void {
  if (!this.l2Held && !this.r2Held) return
  const newIndex = computeWheelSegmentIndex(this.stickX, this.stickY)
  if (newIndex !== this.selectedIndex) {
    this.selectedIndex = newIndex
  }
  this.panelManager.updateStick(this.stickX, this.stickY)
}
```

**Open calls:**
- L2 opens: `this.panelManager.open('l2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)`
- R2 opens: `this.panelManager.open('r2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)`

**Trigger swap — `panelManager.swap(newActive)`:**
Add a `swap(activeWheel: 'l2' | 'r2')` method to `RadialWheelPanelManager`. It posts a new `WHEEL_SWAP` message (add to `messages.ts`) OR simply re-sends `WHEEL_OPEN` with the new `activeWheel` (simpler, reuses existing message). **Recommended: re-send `WHEEL_OPEN`** with updated `activeWheel` — the Webview already handles this message and will re-render with the correct active wheel:

```typescript
// In RadialWheelPanelManager
swap(newActiveWheel: 'l2' | 'r2'): void {
  this.panel?.webview.postMessage({
    type: 'WHEEL_OPEN',
    payload: { activeWheel: newActiveWheel, l2Segments: L2_SMART_WHEEL_SEGMENTS, r2Segments: R2_PERSONAL_WHEEL_SEGMENTS },
  })
  logger.debug(`RadialWheelPanelManager: swapped active wheel to ${newActiveWheel}`)
}
```

Wait — `RadialWheelPanelManager` should not depend on segment data directly. Pass segments to `swap()` from the controller:

```typescript
// In RadialWheelPanelManager
swap(newActiveWheel: 'l2' | 'r2', l2Segments: WheelSegmentDef[], r2Segments: WheelSegmentDef[]): void {
  this.panel?.webview.postMessage({
    type: 'WHEEL_OPEN',
    payload: { activeWheel: newActiveWheel, l2Segments, r2Segments },
  })
  logger.debug(`RadialWheelPanelManager: swapped to ${newActiveWheel}`)
}
```

This means **no new message types needed** — `WHEEL_OPEN` with updated `activeWheel` triggers a swap in the Webview. The Webview already handles `WHEEL_OPEN` and transitions to the new state.

---

### Webview — RadialWheel.tsx Changes

**Current state:** `RadialWheel.tsx` renders only `activeSegments` (L2 or R2 depending on `activeWheel`). The inactive wheel is not rendered.

**Story 7.2 change:** Render BOTH wheels simultaneously. The inactive wheel is rendered but receives CSS classes for the receded visual state.

**New rendering logic:**

```tsx
// Replace the single-wheel render with dual-wheel render

// Determine active and inactive segments
const isL2Active = activeWheel === 'l2'
const activeL2Segments = l2Segments
const activeR2Segments = r2Segments

// Determine offset direction
// L2 wheel: offset right when inactive (+80px), centered when active
// R2 wheel: offset left when inactive (-80px), centered when active
const l2WheelClass = [
  'radial-wheel__wheel',
  'radial-wheel__wheel--l2',
  isL2Active ? 'radial-wheel__wheel--active' : 'radial-wheel__wheel--inactive',
].join(' ')

const r2WheelClass = [
  'radial-wheel__wheel',
  'radial-wheel__wheel--r2',
  !isL2Active ? 'radial-wheel__wheel--active' : 'radial-wheel__wheel--inactive',
].join(' ')

// Preview text: show for active wheel's selected segment
const activeSegments = isL2Active ? l2Segments : r2Segments
const previewSegment = previewIndex >= 0 ? activeSegments.find((s) => s.index === previewIndex) : undefined

return (
  <div className={containerClass}>
    <div className="radial-wheel__stage">
      {/* L2 Smart Wheel */}
      <div className={l2WheelClass}>
        <svg className="radial-wheel__svg" viewBox="0 0 400 400" role="menu" aria-label="L2 Smart wheel">
          {activeL2Segments.map((seg) => (
            <WheelSegment
              key={seg.index}
              index={seg.index}
              label={seg.label}
              promptText={seg.promptText}
              isActive={isL2Active && seg.index === selectedIndex}
              isPreview={isL2Active && seg.index === previewIndex}
              centerX={200}
              centerY={200}
              radius={170}
            />
          ))}
        </svg>
      </div>

      {/* R2 Personal Wheel */}
      <div className={r2WheelClass}>
        <svg className="radial-wheel__svg" viewBox="0 0 400 400" role="menu" aria-label="R2 Personal wheel">
          {activeR2Segments.map((seg) => (
            <WheelSegment
              key={seg.index}
              index={seg.index}
              label={seg.label}
              promptText={seg.promptText}
              isActive={!isL2Active && seg.index === selectedIndex}
              isPreview={!isL2Active && seg.index === previewIndex}
              centerX={200}
              centerY={200}
              radius={170}
            />
          ))}
        </svg>
      </div>
    </div>

    {previewSegment && (
      <div className="radial-wheel__preview" aria-live="polite">
        {previewSegment.promptText ?? previewSegment.label}
      </div>
    )}
  </div>
)
```

**Swap transition:** When `WHEEL_OPEN` is received with a different `activeWheel` while the wheel is already open (state = `'open'`), the Webview should detect this is a swap (not a fresh open). The swap gets the `~50ms ease-out` transition; a fresh open gets `transition: none`. Distinguish in state:

```typescript
// New state: track whether this is a swap vs fresh open
const [isSwapping, setIsSwapping] = useState(false)

// In WHEEL_OPEN handler:
if (msg.type === 'WHEEL_OPEN') {
  if (wheelState === 'open' && msg.payload.activeWheel !== activeWheel) {
    // This is a trigger swap, not a fresh open
    setIsSwapping(true)
    // After 50ms, clear swapping state
    setTimeout(() => setIsSwapping(false), 50)
  } else {
    setIsSwapping(false)
  }
  setActiveWheel(msg.payload.activeWheel)
  setL2Segments(msg.payload.l2Segments)
  setR2Segments(msg.payload.r2Segments)
  setSelectedIndex(-1)
  setPreviewIndex(-1)
  setWheelState('open')
  // (clear timers as before)
}
```

Pass `isSwapping` to the container or wheel divs to control transition CSS class.

---

### Webview — radial-wheel.css Additions

Add to `radial-wheel.css` (do NOT replace existing styles):

```css
/* ── Dual-wheel stage ───────────────────────────────────────────────────────── */

.radial-wheel__stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 320px;
  height: 320px;
}

/* ── Individual wheel wrappers ──────────────────────────────────────────────── */

.radial-wheel__wheel {
  position: absolute;
  top: 0;
  left: 0;
  width: 320px;
  height: 320px;
}

/* Active wheel: centered, full size, full opacity */
.radial-wheel__wheel--active {
  transform: translateX(0) scale(1);
  opacity: 1;
  filter: none;
  z-index: 2;
}

/* Inactive wheel: offset + dimmed (UX spec: ~85% scale, ~50% opacity, 1px blur, 80px offset) */
.radial-wheel__wheel--l2.radial-wheel__wheel--inactive {
  /* L2 inactive: L2 wheel offset LEFT (80px to the left, behind) */
  transform: translateX(-80px) scale(0.85);
  opacity: 0.5;
  filter: blur(1px);
  z-index: 1;
}

.radial-wheel__wheel--r2.radial-wheel__wheel--inactive {
  /* R2 inactive: R2 wheel offset RIGHT (80px to the right, behind) */
  transform: translateX(80px) scale(0.85);
  opacity: 0.5;
  filter: blur(1px);
  z-index: 1;
}

/* Swap transition: ~50ms ease-out (applied only during swap, not on fresh open) */
.radial-wheel--swapping .radial-wheel__wheel {
  transition: transform 50ms ease-out, opacity 50ms ease-out, filter 50ms ease-out;
}

/* R2 wheel uses purple glow (--vs-glow2) for active segments */
.radial-wheel__wheel--r2 .wheel-segment--active .wheel-segment__path {
  filter: drop-shadow(0 0 12px var(--vs-glow2));
  stroke: var(--vs-accent2);
}

/* Depth shadow under active wheel (UX spec) */
.radial-wheel__wheel--active .radial-wheel__svg {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.6));
}
```

**Important note on offset direction:** Per UX spec:
- When L2 is active (L2 wheel centered), the R2 wheel is offset to the **right** (80px right) — it is the "receded" wheel in R2's natural position.
- When R2 is active (R2 wheel centered), the L2 wheel is offset to the **left** (80px left) — it is the "receded" wheel in L2's natural position.
- The acceptance criteria in the epics confirm: "L2 Smart wheel is offset 80px to the left at ~85% scale" (when R2 is active).

This means the CSS for the **inactive L2** wheel shifts it left, and the **inactive R2** wheel shifts right. The above CSS is correct.

---

### Key Files

| File | Action | Purpose |
|------|--------|---------|
| `src/extension/input/radial-wheel-controller.ts` | **EXTEND** | Add R2/RT handling, trigger swap logic, dual-trigger state tracking |
| `src/extension/input/radial-wheel-segments.ts` | **EXTEND** | Add `R2_PERSONAL_WHEEL_SEGMENTS` constant |
| `src/extension/panels/radial-wheel-panel.ts` | **EXTEND** | Add `swap()` method |
| `src/webview/radial-wheel/RadialWheel.tsx` | **EXTEND** | Render both wheels simultaneously with depth layout, swap detection |
| `src/webview/radial-wheel/radial-wheel.css` | **EXTEND** | Add `.radial-wheel__stage`, `.radial-wheel__wheel`, inactive/active/swap styles |
| `test/webview/RadialWheel.test.tsx` | **EXTEND** | Add tests for dual-wheel render, R2 wheel, swap behavior |
| `test/unit/input/radial-wheel-controller.test.ts` | **EXTEND** | Add tests for R2 press, trigger swap, AC3 (receded trigger release) |

**No new files need to be created.** Everything extends existing Story 7.1 files.

---

## Architecture Constraints (MUST Follow)

1. **Context boundary:** `src/extension/` (Node.js + vscode API), `src/webview/` (browser + React), `src/shared/` (pure types). Never import across boundaries.

2. **No new cross-boundary message types needed for Story 7.2.** `WHEEL_OPEN` with updated `activeWheel` handles the swap. Do not add a `WHEEL_SWAP` message type — re-use `WHEEL_OPEN`.

3. **Webview state is derived.** Extension host is source of truth. The Webview only renders what `HostMessage` events tell it.

4. **No CSS-in-JS.** All new styles go in `radial-wheel.css`. Offset/transform values are in CSS (not inline style), except for computed SVG geometry.

5. **`transition: none` on fresh wheel open still applies.** Only trigger swaps get the 50ms transition. Distinguish with the `.radial-wheel--swapping` class (added/removed by React state → className).

6. **R2 wheel visual identity:** Use `--vs-accent2` (purple `#7B5CFA`) and `--vs-glow2` (`rgba(123,92,250,0.35)`) for R2 wheel segment highlights and glow. The L2 wheel uses `--vs-accent` (cyan) and `--vs-glow`.

7. **Use `logger` singleton.** Never `console.log` in extension host code.

8. **Test files under `test/`.** Unit tests in `test/unit/`, Webview tests in `test/webview/`.

9. **No new npm dependencies.** Everything needed is already installed.

10. **726 tests currently pass.** New tests must not break any existing tests. Run `npm run test` before marking done.

11. **Import `R2_PERSONAL_WHEEL_SEGMENTS` from `radial-wheel-segments.ts`** — same pattern as `L2_SMART_WHEEL_SEGMENTS`.

---

## Testing Requirements

### `test/webview/RadialWheel.test.tsx` — New Test Cases (add to existing)

```typescript
// Add to existing describe block or create a new describe('Story 7.2 - Dual Wheel')
```

**New test cases to add:**

1. **Both wheels render when wheel is open (R2 active):**
   Post `{ type: 'WHEEL_OPEN', payload: { activeWheel: 'r2', l2Segments: mockL2, r2Segments: mockR2 } }`
   → Both `aria-label="L2 Smart wheel"` and `aria-label="R2 Personal wheel"` SVGs present in DOM.

2. **R2 active: R2 wheel has active class, L2 wheel has inactive class:**
   Post `WHEEL_OPEN` with `activeWheel: 'r2'`
   → R2 wrapper has `.radial-wheel__wheel--active` class
   → L2 wrapper has `.radial-wheel__wheel--inactive` class.

3. **L2 active: L2 wheel has active class, R2 wheel has inactive class:**
   Post `WHEEL_OPEN` with `activeWheel: 'l2'`
   → L2 wrapper has `.radial-wheel__wheel--active` class
   → R2 wrapper has `.radial-wheel__wheel--inactive` class.

4. **Right stick navigation controls active wheel only (R2 active):**
   Post `WHEEL_OPEN` with `activeWheel: 'r2'`, then stick update `x: 0, y: -1.0`
   → Segment 0 of R2 wheel has `wheel-segment--active` class
   → Segment 0 of L2 wheel does NOT have `wheel-segment--active` class.

5. **Trigger swap: WHEEL_OPEN with new activeWheel while open triggers swap class:**
   Post `WHEEL_OPEN` with `activeWheel: 'l2'` (open), then post `WHEEL_OPEN` with `activeWheel: 'r2'`
   → Container gets `.radial-wheel--swapping` class
   → After 50ms (advance timers), `.radial-wheel--swapping` removed.

6. **Swap resets stick selection:**
   Open with `activeWheel: 'l2'`, update stick to select segment 2, then swap to `r2`
   → No segment in R2 wheel has active class (selection reset).

7. **Preview text shows for active wheel's segment only:**
   Open with `activeWheel: 'r2'`, update stick to segment 0, advance 200ms
   → Preview text shows R2 segment 0's promptText, not L2 segment 0's.

8. **Both wheels collapse on WHEEL_CLOSE:**
   Open both wheels, post `WHEEL_CLOSE`
   → Both wheel containers have closing animation class, then removed from DOM after 120ms.

### `test/unit/input/radial-wheel-controller.test.ts` — New Test Cases (add to existing)

**New test cases to add:**

1. **R2 press opens panel with R2 as active wheel:**
   `handleEvent({ kind: 'button', button: 'r2', pressed: true })`
   → `panelManager.open` called with `activeWheel: 'r2'`

2. **RT press opens panel (Xbox):**
   `handleEvent({ kind: 'button', button: 'rt', pressed: true })`
   → `panelManager.open` called with `activeWheel: 'r2'`

3. **R2 release with segment selected dispatches from R2 segments:**
   Press R2, stick to segment 3, release R2
   → `panelManager.close(false)` called
   → `vibesense.dispatchPrompt` called with `R2_PERSONAL_WHEEL_SEGMENTS[3].promptText`

4. **Trigger swap — L2 held, R2 pressed → active wheel swaps to R2:**
   Press L2, then press R2
   → `panelManager.swap('r2', ...)` called (or `panelManager.open` with `activeWheel: 'r2'`)

5. **Trigger swap — R2 held, L2 pressed → active wheel swaps to L2:**
   Press R2, then press L2
   → swap to L2 called on panelManager

6. **AC3 — Releasing receded trigger (L2 active, R2 receded) — no dispatch:**
   Press L2 (active), press R2 (now receded), release R2
   → `panelManager.close` NOT called; no dispatch

7. **AC3 — Releasing receded trigger (R2 active, L2 receded) — no dispatch:**
   Press R2 (active), press L2 (swap makes R2 active — wait, press L2 after R2 makes L2 active), then release R2 (now receded)
   → Specifically: press R2, then press L2 (swap to L2 active), then release R2 (now receded)
   → `panelManager.close` NOT called; `r2Held = false`

8. **Right stick ignored when both triggers released:**
   No L2 or R2 held; send axis event
   → `panelManager.updateStick` NOT called

9. **Right stick works when R2 held:**
   Press R2, send `right_x` axis event
   → `panelManager.updateStick` called

10. **Dispose clears state correctly (no timer leaks introduced in 7.2):**
    `dispose()` called after R2 held
    → no errors

---

## Previous Story Intelligence

### From Story 7.1 (direct predecessor):

- **`RadialWheelController` pattern:** Single `handleEvent()` entry point, try/catch wrapping, uses `logger.error()`. R2 extends this exactly.
- **`computeWheelSegmentIndex()` from `src/shared/constants.ts`:** Already imported in controller. Shared between extension host and Webview. Do NOT inline or duplicate it.
- **Panel reuse on close:** `RadialWheelPanelManager` does NOT dispose the panel on close — it sends `WHEEL_CLOSE` to the Webview. This is intentional for <25ms snap-open. The `swap()` method follows the same "just post a message" pattern.
- **`vscode` import at top of controller:** Story 7.1 fixed the workaround anti-pattern. R2 dispatch uses `void vscode.commands.executeCommand(...)` directly (same as L2 dispatch in the existing controller).
- **714→726 tests after 7.1+7.3:** Current suite has 726 tests. Story 7.2 must not break any.
- **CSS class naming:** `kebab-case` throughout (e.g., `radial-wheel__wheel--active`, `radial-wheel__wheel--l2`).
- **Mock CSS in test setup:** Test files mock CSS imports with `vi.mock('...css', () => ({}))` at top. Existing `RadialWheel.test.tsx` already has this — new test cases added to same file inherit the mocks.
- **`parseHostMessage()` in Webview:** Already imported in `RadialWheel.tsx`. The Webview uses this to parse `WHEEL_OPEN` messages. The swap re-uses `WHEEL_OPEN` — the existing handler in `RadialWheel.tsx` already updates `activeWheel` from any `WHEEL_OPEN` message. The swap detection logic (checking if wheel is already open with different active wheel) is the only addition.

### From Story 7.3 (HUD Overlay — ran in parallel):

- Story 7.3 added HUD messages to `src/shared/messages.ts`. These are already in the current codebase (`HUD_TOGGLE`, `HUD_BINDINGS_UPDATED`, `HUD_MODE_CHANGED`). Story 7.2 makes NO changes to the HUD message area.
- Story 7.3 wired `HudPanelManager` in `extension.ts`. Story 7.2 makes NO changes to the HUD panel wiring.

---

## Git Intelligence

Recent commits (from `git log --oneline -8`):
- `04f96c0` — story-7-3-hud-overlay-floating-button-map merged
- `6d0cb63` — story-7-1-radial-wheel-core-l2-smart-wheel merged
- `a56178d` — Story 6.5 Do Not Disturb merged

Both 7.1 and 7.3 are merged. This branch starts from a clean base with 726 passing tests.

**Merge conflict risk for Story 7.2:**
- `src/extension/input/radial-wheel-controller.ts` — 7.2 is the only story touching this in Epic 7 now. No conflict risk.
- `src/webview/radial-wheel/RadialWheel.tsx` — same, 7.2 only.
- `src/shared/messages.ts` — 7.2 makes NO changes to messages.ts. Zero conflict risk.
- `src/extension/extension.ts` — 7.2 makes NO changes here. Zero conflict risk.

---

## Definition of Done

- [x] `R2_PERSONAL_WHEEL_SEGMENTS` added to `src/extension/input/radial-wheel-segments.ts` with 8 default segments
- [x] `RadialWheelController` extended: `r2Held` state, R2/RT button handling, trigger swap logic, AC3 (receded release = no-op)
- [x] `RadialWheelPanelManager.swap()` method added: re-sends `WHEEL_OPEN` with updated `activeWheel`
- [x] `RadialWheel.tsx` updated: renders both L2 and R2 wheels simultaneously with correct active/inactive wrappers, swap detection via `isSwapping` state
- [x] `radial-wheel.css` updated: `.radial-wheel__stage`, `.radial-wheel__wheel`, active/inactive classes, R2 purple glow, swap transition class
- [x] `test/webview/RadialWheel.test.tsx` extended: 8 new test cases for dual-wheel rendering and swap behavior
- [x] `test/unit/input/radial-wheel-controller.test.ts` extended: 10 new test cases for R2 and trigger swap
- [x] All 726+ existing tests pass (`npm run test`) — 748 tests pass (22 new added)
- [x] `npm run lint` and `npm run typecheck` pass with no errors
- [x] AC1 verified: R2 hold shows both wheels, R2 centered, L2 offset left at 85%/50%
- [x] AC2 verified: Trigger swap animates in ~50ms ease-out
- [x] AC3 verified: Releasing receded trigger does nothing
- [ ] Story status updated to `done` after code review

---

## Dev Agent Record

### Implementation Plan

Story 7.2 extends Story 7.1 infrastructure to implement the dual-layered radial wheel system. No new files created — all changes extend existing Story 7.1 files.

**Approach:**
1. Added `R2_PERSONAL_WHEEL_SEGMENTS` constant to `radial-wheel-segments.ts` (8 placeholder segments)
2. Refactored `RadialWheelController` to track `r2Held`, `activeWheel` state; added R2/RT event handling, trigger swap via `panelManager.swap()`, and AC3 receded-trigger no-op logic
3. Added `swap()` method to `RadialWheelPanelManager` — re-sends `WHEEL_OPEN` with updated `activeWheel` (no new message types needed)
4. Rewrote `RadialWheel.tsx` render to output both L2 and R2 wheel `<div>` wrappers simultaneously using `.radial-wheel__wheel--active` / `--inactive` classes; added `isSwapping` state for 50ms swap transition detection
5. Extended `radial-wheel.css` with `.radial-wheel__stage`, `.radial-wheel__wheel`, active/inactive depth cues (translateX offset, scale 0.85, opacity 0.5, blur 1px), swap transition class, and R2 purple glow (`--vs-accent2`, `--vs-glow2`)
6. Updated existing tests that changed (`getByRole('menu')` → specific aria-label; open calls now pass `R2_PERSONAL_WHEEL_SEGMENTS`); added 8 webview tests + 10 controller tests + 4 segment data tests

### Completion Notes

- All 748 tests pass (726 existing + 22 new)
- `npm run lint` — 0 errors, 3 pre-existing warnings (unchanged)
- `npm run typecheck` — passes cleanly
- AC1: R2 hold → both wheels rendered, R2 active (full size/opacity), L2 offset -80px, scale 0.85, opacity 0.5, blur 1px
- AC2: Trigger swap via re-sending `WHEEL_OPEN` → `isSwapping` state adds `.radial-wheel--swapping` class → 50ms ease-out CSS transition
- AC3: `onL2Release()` and `onR2Release()` check `activeWheel` before dispatch; receded trigger release sets `held = false` with no action

### File List

- `src/extension/input/radial-wheel-segments.ts` — extended with `R2_PERSONAL_WHEEL_SEGMENTS`
- `src/extension/input/radial-wheel-controller.ts` — extended with R2 handling, trigger swap, AC3 logic
- `src/extension/panels/radial-wheel-panel.ts` — added `swap()` method
- `src/webview/radial-wheel/RadialWheel.tsx` — dual-wheel render, `isSwapping` state, swap detection
- `src/webview/radial-wheel/radial-wheel.css` — dual-wheel layout styles
- `test/webview/RadialWheel.test.tsx` — updated existing tests + 8 new Story 7.2 tests
- `test/unit/input/radial-wheel-controller.test.ts` — updated existing tests + 10 new Story 7.2 tests + 4 segment data tests
- `_bmad-output/implementation-artifacts/7-2-dual-layered-wheel-system-r2-personal-wheel.md` — story status and DoD updated
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status updated to review

### Change Log

- 2026-04-01: Implemented Story 7.2 — Dual Layered Wheel System (R2 Personal Wheel). Added R2_PERSONAL_WHEEL_SEGMENTS, extended RadialWheelController with R2/trigger-swap/AC3 logic, added RadialWheelPanelManager.swap(), updated RadialWheel.tsx for dual-wheel render, extended CSS with inactive-wheel depth cues and swap transition. 748 tests passing.

---

*Ultimate context engine analysis completed — comprehensive developer guide created.*
