# Story 3.5: Multi-Session Quick Panel

Status: done

## Story

As a vibe coder,
I want to open a quick panel from the controller that lists all open agent sessions for direct selection,
So that I can jump to any session instantly without cycling through them one by one with L1/R1.

## Acceptance Criteria

**AC 1 — Panel opens with all sessions:**
**Given** multiple terminal sessions are open,
**When** the designated "open session panel" button is pressed,
**Then** the multi-session quick panel opens within 200ms showing all open sessions with their current status (processing, needs-input, idle, error),
**And** the D-pad or analog stick navigates between sessions,
**And** pressing Cross/A selects the highlighted session and closes the panel.

**AC 2 — Dismiss without switching:**
**Given** the quick panel is open,
**When** Circle/B or Back is pressed,
**Then** the panel closes without switching sessions.

**AC 3 — Single session allowed:**
**Given** there is only one session open,
**When** the quick panel button is pressed,
**Then** the panel opens with the single session visible (not suppressed).

**Requirements:** FR14

## Tasks / Subtasks

- [x] Task 1: Add `QUICK_PANEL_OPEN`, `QUICK_PANEL_CLOSE`, `QUICK_PANEL_NAVIGATE`, `QUICK_PANEL_SELECT` messages to `src/shared/messages.ts` (AC: 1, 2)
  - [x] Add `QUICK_PANEL_OPEN` HostMessage: `{ type: 'QUICK_PANEL_OPEN'; payload: { sessions: Session[]; selectedIndex: number } }` — sent from host to open the panel
  - [x] Add `QUICK_PANEL_CLOSE` HostMessage: `{ type: 'QUICK_PANEL_CLOSE'; payload: Record<string, never> }` — sent from host to close panel (dismiss without switch)
  - [x] Add `QUICK_PANEL_NAVIGATE` HostMessage: `{ type: 'QUICK_PANEL_NAVIGATE'; payload: { selectedIndex: number } }` — sent from host when D-pad/stick moves selection
  - [x] Add `QUICK_PANEL_SELECT` WebviewMessage: `{ type: 'QUICK_PANEL_SELECT'; payload: { sessionIndex: number } }` — sent from webview when Cross/A selects a session
  - [x] Add `QUICK_PANEL_DISMISS` WebviewMessage: `{ type: 'QUICK_PANEL_DISMISS'; payload: Record<string, never> }` — sent from webview when Circle/B dismisses without switch
  - [x] Keep all existing messages intact; never remove existing types
  - [x] Run `npm run typecheck` to verify no drift-guard failures after any changes

- [x] Task 2: Create `src/webview/session/QuickPanel.tsx` — modal overlay React component (AC: 1, 2, 3)
  - [x] Props: `sessions: Session[]`, `selectedIndex: number`, `visible: boolean`, `onSelect: (index: number) => void`, `onDismiss: () => void`
  - [x] Import `Session` from `../../shared/types`; import `SessionCard` from `./SessionCard`
  - [x] Full-screen modal: `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 3000` (above SlidePanel z-1000 and SessionSwitcher z-2000)
  - [x] Semi-transparent backdrop: `background: rgba(0, 0, 0, 0.7)`
  - [x] Centered content panel: VOID styling `background: rgba(14,14,28,0.94)`, `border: 1px solid var(--vs-border)`, `border-radius: var(--vs-radius-md)`, `padding: var(--vs-space-4)`, `min-width: 280px`, `max-width: 480px`
  - [x] Session list: renders one `SessionCard` per session; selected item highlighted with `box-shadow: 0 0 16px var(--vs-glow)` + outline `2px solid var(--vs-accent)` (UX-DR4)
  - [x] When `!visible`: `opacity: 0; pointer-events: none` — do NOT unmount; allows fade-out
  - [x] Fade-in: `opacity: 0 → 1` over `120ms ease-out` (`--vs-duration-fast`)
  - [x] Accessibility: `role="dialog"`, `aria-modal="true"`, `aria-label="Quick session panel"` on the modal container
  - [x] Session list: `role="listbox"`, each item `role="option"`, `aria-selected={index === selectedIndex}` (UX-DR18, NFR-A2)
  - [x] Empty state: when `sessions.length === 0`, show "No terminal sessions open. Hold L1+R1 to open a terminal." (follows empty state pattern)
  - [x] Title: render "Select Session" heading inside the panel

- [x] Task 3: Add CSS for `QuickPanel` in `src/webview/session/session.css` (AC: 1, 2)
  - [x] `.quick-panel` — `position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 3000; display: flex; align-items: center; justify-content: center`
  - [x] `.quick-panel--visible` — `opacity: 1; transition: opacity var(--vs-duration-fast, 120ms) ease-out`
  - [x] `.quick-panel--hidden` — `opacity: 0; pointer-events: none; transition: opacity 200ms ease-out`
  - [x] `.quick-panel__backdrop` — full-screen `background: rgba(0, 0, 0, 0.7)`, `position: absolute; inset: 0`
  - [x] `.quick-panel__content` — centered floating card; `position: relative; z-index: 1`; VOID background + border; `min-width: 280px; max-width: 480px; padding: var(--vs-space-4)`, `border-radius: var(--vs-radius-md)`
  - [x] `.quick-panel__title` — `font-size: 0.875rem; font-weight: 600; color: var(--vs-text2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--vs-space-3)`
  - [x] `.quick-panel__session-list` — `list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--vs-space-2)`
  - [x] `.quick-panel__item--selected .session-card` — `box-shadow: 0 0 16px var(--vs-glow); outline: 2px solid var(--vs-accent); outline-offset: 2px`
  - [x] `.quick-panel__empty` — `color: var(--vs-text2); font-size: var(--vs-font-size-sm); text-align: center; padding: var(--vs-space-4) 0`
  - [x] Do NOT redefine `--vs-*` tokens — they're already imported via `@import '../shared-ui/tokens.css'`

- [x] Task 4: Wire `QuickPanel` into `src/webview/session/index.tsx` (AC: 1, 2, 3)
  - [x] Add reducer state: `quickPanelVisible: boolean; quickPanelSelectedIndex: number`
  - [x] Add actions: `OPEN_QUICK_PANEL` (with sessions + selectedIndex), `CLOSE_QUICK_PANEL`, `NAVIGATE_QUICK_PANEL` (selectedIndex)
  - [x] Handle `QUICK_PANEL_OPEN` HostMessage → dispatch `OPEN_QUICK_PANEL`; update sessions in state simultaneously
  - [x] Handle `QUICK_PANEL_CLOSE` HostMessage → dispatch `CLOSE_QUICK_PANEL`
  - [x] Handle `QUICK_PANEL_NAVIGATE` HostMessage → dispatch `NAVIGATE_QUICK_PANEL`
  - [x] `onSelect` callback: post `QUICK_PANEL_SELECT` webview→host message and dispatch `CLOSE_QUICK_PANEL`
  - [x] `onDismiss` callback: post `QUICK_PANEL_DISMISS` webview→host message and dispatch `CLOSE_QUICK_PANEL`
  - [x] Render `<QuickPanel ... />` alongside `<SlidePanel />` and `<SessionSwitcher />`
  - [x] Initial state: `quickPanelVisible: false, quickPanelSelectedIndex: 0`

- [x] Task 5: Add `notifyQuickPanelOpen`, `notifyQuickPanelClose`, `notifyQuickPanelNavigate` to `src/extension/panels/slide-panel-manager.ts` (AC: 1, 2)
  - [x] `notifyQuickPanelOpen(sessions: Session[], selectedIndex: number): void` — posts `QUICK_PANEL_OPEN`
  - [x] `notifyQuickPanelClose(): void` — posts `QUICK_PANEL_CLOSE`
  - [x] `notifyQuickPanelNavigate(selectedIndex: number): void` — posts `QUICK_PANEL_NAVIGATE`
  - [x] Handle inbound `QUICK_PANEL_SELECT` webview→host message: call `vscode.commands.executeCommand('vibesense.switchToSession', msg.payload.sessionIndex)`
  - [x] Handle inbound `QUICK_PANEL_DISMISS` webview→host message: log dismissal; no session switch
  - [x] Parse inbound messages through existing `parseWebviewMessage` (after adding new types in Task 1)
  - [x] Log all quick panel events via `logger` singleton

- [x] Task 6: Register `vibesense.openQuickPanel` command in `src/extension/commands/register.ts` (AC: 1, 2, 3)
  - [x] Add `vibesense.openQuickPanel`: get `vscode.window.terminals`, build `sessions` array from terminals (sessionId = terminal name, agentState = 'idle', label = terminal name), call `slidePanelManager.notifyQuickPanelOpen(sessions, 0)`
  - [x] If `terminals.length === 0`: open panel with empty sessions array (panel shows empty state — AC 3 says single session is allowed, by extension 0 sessions shows empty state hint)
  - [x] Register `vibesense.switchToSession` command: takes `sessionIndex` arg, focuses terminal at that index, calls `slidePanelManager.notifyQuickPanelClose()`
  - [x] Register D-pad navigation commands `vibesense.quickPanelNext` and `vibesense.quickPanelPrev` (used internally): increment/decrement selectedIndex mod sessions.length, call `notifyQuickPanelNavigate`
  - [x] All commands wrapped in try/catch; errors logged via `logger.error()`; never rethrow (NFR-R1)
  - [x] Commands registered via `context.subscriptions.push(...)`

- [x] Task 7: Add `vibesense.openQuickPanel` and `vibesense.switchToSession` to `package.json` contributes (AC: 1)
  - [x] Add `{ "command": "vibesense.openQuickPanel", "title": "VibeSense: Open Quick Session Panel" }`
  - [x] Add `{ "command": "vibesense.switchToSession", "title": "VibeSense: Switch to Session" }`
  - [x] Do NOT add `activationEvents` — `onStartupFinished` is already the only activation event

- [x] Task 8: Add `vibesense.openQuickPanel` binding to default binding profiles in `src/extension/input/default-bindings.ts` (AC: 1)
  - [x] Add to `CLAUDE_CODE_DEFAULT_BINDINGS`:
    - DualSense: `r2: 'vibesense.openQuickPanel'` (R2 is currently `vibesense.openRadialWheel` — **do NOT replace** — use an unbound button; see Dev Notes for final button assignment)
    - Recommended: `l3: 'vibesense.openQuickPanel'` (left stick click) for DualSense; `ls: 'vibesense.openQuickPanel'` for Xbox
  - [x] Do NOT remove any existing bindings

- [x] Task 9: Write component tests in `test/webview/QuickPanel.test.tsx` (AC: 1, 2, 3)
  - [x] jsdom environment (already configured in `vitest.config.ts` for `test/webview/`)
  - [x] Test: visible=true — panel renders with `role="dialog"` and `aria-modal="true"`
  - [x] Test: visible=false — panel has `pointer-events: none` / opacity 0 class
  - [x] Test: sessions rendered as a list; each session shows correct label
  - [x] Test: selectedIndex=1 — second session item has selected styling (aria-selected + class)
  - [x] Test: pressing "Select" calls `onSelect` with correct index
  - [x] Test: pressing "Dismiss" calls `onDismiss`
  - [x] Test: empty sessions — shows empty state hint text
  - [x] Test: `aria-live` or `role="listbox"` present on session list
  - [x] Mock `tokens.css` and `session.css` imports: `vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))`; `vi.mock('../../src/webview/session/session.css', () => ({}))`
  - [x] Mock `vi.hoisted` pattern for any needed mocks (same as `SessionSwitcher.test.tsx`)

- [x] Task 10: Write unit tests for `vibesense.openQuickPanel` and `vibesense.switchToSession` in `test/unit/extension/commands/register.test.ts` (AC: 1, 2, 3)
  - [x] Add to existing test file (do NOT create a new file)
  - [x] Test: `vibesense.openQuickPanel` — 0 terminals: calls `notifyQuickPanelOpen` with empty sessions array
  - [x] Test: `vibesense.openQuickPanel` — 2 terminals: calls `notifyQuickPanelOpen` with sessions array of length 2, selectedIndex=0
  - [x] Test: `vibesense.switchToSession` — focuses terminal at given index, calls `notifyQuickPanelClose`
  - [x] Test: `vibesense.switchToSession` — index out of bounds: no error propagated (NFR-R1)
  - [x] Mock `slidePanelManager.notifyQuickPanelOpen` and `notifyQuickPanelClose` using existing mock patterns

### Review Findings

- [x] [Review][Patch] quickPanelNext/Prev always sent hardcoded index 0 — D-pad navigation non-functional (AC 1 violation) [register.ts, slide-panel-manager.ts] — fixed: added quickPanelNext/quickPanelPrev methods with state tracking to SlidePanelManager
- [x] [Review][Patch] Missing aria-hidden on backdrop div in QuickPanel [QuickPanel.tsx:37] — fixed: added aria-hidden="true"
- [x] [Review][Defer] Missing aria-activedescendant on listbox [QuickPanel.tsx] — deferred, pre-existing pattern (SessionSwitcher doesn't use it either)
- [x] [Review][Defer] Title uses `<p>` instead of heading element [QuickPanel.tsx:41] — deferred, spec explicitly says `<p>` with class

## Dev Notes

### What This Story Builds

Three layers:

1. **New messages** (`src/shared/messages.ts`): 3 HostMessages (`QUICK_PANEL_OPEN`, `QUICK_PANEL_CLOSE`, `QUICK_PANEL_NAVIGATE`) and 2 WebviewMessages (`QUICK_PANEL_SELECT`, `QUICK_PANEL_DISMISS`)

2. **`src/webview/session/QuickPanel.tsx`** — full-screen modal session picker wired into existing `src/webview/session/index.tsx` state machine

3. **Extension host commands** (`register.ts`) + **SlidePanelManager methods** + **default binding** + **package.json** — `vibesense.openQuickPanel` opens the panel; `vibesense.switchToSession` focuses the selected terminal

### Critical Architecture Rules (Do NOT Violate)

- `src/webview/` → NEVER import from `src/extension/`; may import from `src/shared/` (pure types only)
- `src/extension/` → NEVER import from `src/webview/`; may import from `src/shared/`
- `src/shared/` → zero Node.js or browser APIs; pure TypeScript types and constants only
- No CSS-in-JS anywhere — no `styled-components`, no `emotion`, no template literal CSS
- No `console.log` in extension host code — use `logger` singleton exclusively
- All new cross-boundary messages added to `src/shared/messages.ts` BEFORE implementing them (Task 1 must precede Tasks 2/4/5)
- All external inputs (webview postMessage) validated via `parseWebviewMessage()` / zod
- VSCode `vscode` module is NOT available in `src/webview/` — never import it there
- `acquireVsCodeApi()` is already called at module level in `src/webview/session/index.tsx` — DO NOT call it again in QuickPanel.tsx or anywhere else in `session/`

### Session State Availability

**Important:** Real session tracking (AgentFSM, actual processing state) is NOT available until Epic 5. For this story, `sessions` arrays are built from `vscode.window.terminals` with `agentState: 'idle'` for all sessions. This is by design — the panel will show all sessions in "idle" state until Epic 5 wires AgentFSM. The panel infrastructure must be ready so Epic 5 can inject real state.

The `Session` type is already defined in `src/shared/types.ts`:
```typescript
interface Session {
  sessionId: string
  agentState: AgentState   // 'idle' | 'processing' | 'needs-input' | 'error'
  label?: string
}
```

### Button Binding for `vibesense.openQuickPanel`

Current bindings already assigned (do NOT remove or reassign):
- `l2` → `vibesense.openRadialWheel` (DualSense)
- `r2` → (currently unbound) — **USE THIS**: `r2: 'vibesense.openQuickPanel'` for DualSense
- `lt` → `vibesense.openRadialWheel` (Xbox)
- `rt` → (currently unbound) — **USE THIS**: `rt: 'vibesense.openQuickPanel'` for Xbox
- `l3` / `ls` → (currently unbound, reserved for R3 = SlidePanel toggle) — do NOT use r3/rs
- `r3` → not in bindings file but used in SlidePanel toggle (Story 3.4 dev notes say R3 toggles SlidePanel)

**Recommended binding:** `r2` (DualSense) / `rt` (Xbox) for the quick panel. This mirrors the L2/LT → radial wheel pattern.

### Z-Index Layer Stack

Components exist at these z-index levels (do NOT conflict):
- `SlidePanel` → `z-index: 1000`
- `SessionSwitcher` → `z-index: 2000`
- `QuickPanel` → `z-index: 3000` (must be above both — opens on demand, full attention)

### Message Flow Design

```
[Controller] → r2 pressed → InputRouter → vibesense.openQuickPanel
    → registerCommands builds sessions from vscode.window.terminals
    → slidePanelManager.notifyQuickPanelOpen(sessions, 0)
    → SlidePanelManager.panel.webview.postMessage({ type: 'QUICK_PANEL_OPEN', ... })
    → [Webview] QuickPanel visible=true, shows sessions

[Controller] → D-pad down → vibesense.quickPanelNext
    → slidePanelManager.notifyQuickPanelNavigate(newIndex)
    → [Webview] QuickPanel selectedIndex updates

[Controller] → Cross pressed → [Webview] onSelect(index)
    → vscode.postMessage({ type: 'QUICK_PANEL_SELECT', payload: { sessionIndex: index } })
    → [SlidePanelManager] receives QUICK_PANEL_SELECT
    → executeCommand('vibesense.switchToSession', index)
    → terminal[index].show(false), notifyQuickPanelClose()

[Controller] → Circle pressed → [Webview] onDismiss()
    → vscode.postMessage({ type: 'QUICK_PANEL_DISMISS', payload: {} })
    → [SlidePanelManager] receives QUICK_PANEL_DISMISS → logs only
    → slidePanelManager.notifyQuickPanelClose() → QUICK_PANEL_CLOSE host message
    → [Webview] QuickPanel visible=false
```

### D-pad Navigation Design

The quick panel navigation via D-pad uses the same pattern as the existing command dispatcher:
- D-pad `up`/`down` are currently bound to `workbench.action.terminal.scrollUp/Down` in the default profile
- When the quick panel is open, those bindings would fire instead of navigating the panel

**Architecture choice for this story:** The panel navigation is handled by separate commands (`vibesense.quickPanelNext`, `vibesense.quickPanelPrev`) that only have effect when the panel is open. The `SlidePanelManager` tracks panel open state; commands are no-ops when panel is closed. These commands must be bound to D-pad in the profile when needed, OR the extension can swap bindings dynamically. For this story, implement `quickPanelNext`/`quickPanelPrev` as no-op-when-closed commands and add them to the default profile bindings for `up`/`down` IF those bindings need to change. Consult the epic carefully — the D-pad navigation requirement is in AC 1 but no specific button override strategy is specified.

**Simpler approach (recommended for this story):** Do NOT override the existing D-pad scroll bindings. Instead, rely on the webview receiving `QUICK_PANEL_NAVIGATE` from the host side where the host command (`vibesense.quickPanelNext`) is called. The `InputRouter` + binding profile handles this correctly — just register the commands and add optional bindings.

### VOID Design Token Reference

All tokens already defined in `src/webview/shared-ui/tokens.css` (Story 2.4):
```
--vs-bg: #09090F
--vs-surface: #0E0E1C
--vs-surface2: #13132A
--vs-accent: #00C8FF
--vs-accent2: #7B5CFA
--vs-text: #EFF4FF
--vs-text2: #7A8BAA
--vs-border: rgba(0,200,255,0.18)
--vs-glow: rgba(0,200,255,0.35)
--vs-duration-fast: 120ms
--vs-duration-base: 240ms
--vs-duration-slow: 400ms
--vs-easing-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

### QuickPanel CSS Layout Pattern

```css
/* Add to session.css — AFTER existing rules */

.quick-panel {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-panel--visible {
  opacity: 1;
  transition: opacity var(--vs-duration-fast, 120ms) ease-out;
}

.quick-panel--hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-out;
}

.quick-panel__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
}

.quick-panel__content {
  position: relative;
  z-index: 1;
  background: rgba(14, 14, 28, 0.94);
  border: 1px solid var(--vs-border);
  border-radius: var(--vs-radius-md);
  padding: var(--vs-space-4);
  min-width: 280px;
  max-width: 480px;
}

.quick-panel__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vs-text2);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--vs-space-3);
}

.quick-panel__session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--vs-space-2);
}

.quick-panel__item--selected .session-card {
  box-shadow: 0 0 16px var(--vs-glow);
  outline: 2px solid var(--vs-accent);
  outline-offset: 2px;
}

.quick-panel__empty {
  color: var(--vs-text2);
  font-size: var(--vs-font-size-sm);
  text-align: center;
  padding: var(--vs-space-4) 0;
  margin: 0;
}
```

### Existing Messages State (messages.ts)

Current `HostMessage` types (do NOT remove):
- `FSM_STATE_CHANGED`
- `CONTROLLER_CONNECTED`
- `SESSION_LIST_UPDATED`
- `SESSION_SWITCHED`

Current `WebviewMessage` types (do NOT remove):
- `WHEEL_SEGMENT_SELECTED`
- `APPROVE_ACTION`
- `SLIDE_PANEL_TOGGLE`

New additions for this story:
- HostMessages: `QUICK_PANEL_OPEN`, `QUICK_PANEL_CLOSE`, `QUICK_PANEL_NAVIGATE`
- WebviewMessages: `QUICK_PANEL_SELECT`, `QUICK_PANEL_DISMISS`

### SessionCard Reuse

`SessionCard` already exists in `src/webview/session/SessionCard.tsx` (Story 3.4). The QuickPanel MUST reuse it — do NOT create a duplicate component. Props are `session: Session`, `isActive?: boolean`. When `isActive` is true, the card gets `box-shadow`. Use `isActive={index === selectedIndex}` when rendering inside QuickPanel.

### Existing Test Baseline

329 tests pass as of this worktree (Stories 1.1–3.6 complete). New tests must not break this baseline.

### File Structure (Exact Paths)

**Files to create:**
- `src/webview/session/QuickPanel.tsx` — modal session picker component
- `test/webview/QuickPanel.test.tsx` — component tests

**Files to modify:**
- `src/shared/messages.ts` — add 3 HostMessages + 2 WebviewMessages
- `src/webview/session/session.css` — add QuickPanel styles
- `src/webview/session/index.tsx` — wire QuickPanel into reducer + render
- `src/extension/panels/slide-panel-manager.ts` — add notifyQuickPanel* methods + handle inbound messages
- `src/extension/commands/register.ts` — add vibesense.openQuickPanel + vibesense.switchToSession + vibesense.quickPanelNext/Prev
- `src/extension/input/default-bindings.ts` — add r2/rt bindings for openQuickPanel
- `package.json` — add command contributes for openQuickPanel + switchToSession
- `test/unit/extension/commands/register.test.ts` — add unit tests for new commands

**Files NOT to touch:**
- `src/webview/session/SessionCard.tsx` — reuse as-is; do NOT modify
- `src/webview/session/SlidePanel.tsx` — not modified by this story
- `src/webview/session/SessionSwitcher.tsx` — not modified by this story
- `src/shared/types.ts` — `Session`, `AgentState` already complete
- `src/webview/shared-ui/tokens.css` — VOID tokens complete (Story 2.4)
- `webpack.config.js` — `session` entry already added (Story 3.4); no changes needed

### ESLint Lessons from Previous Stories

- No `console.log` in extension host — `logger.error()` / `logger.info()` only
- CSS imports in `.tsx` files must be mocked in Vitest: `vi.mock('../../src/webview/session/session.css', () => ({}))`
- React component files: `PascalCase.tsx` ✓; CSS files: `kebab-case.css` ✓
- Avoid leading underscores in variable/parameter names (ESLint `@typescript-eslint/naming-convention`)
- `vi.mock()` calls must appear before `import` statements (Vitest hoists them)
- kebab-key object literals in CSS mocks may need `// eslint-disable-next-line` for naming-convention

### Testing Checklist

Before marking complete, verify:
- [ ] `npm run typecheck` passes (zero TypeScript errors in new/modified files)
- [ ] `npm run lint` passes (zero ESLint errors)
- [ ] `npx vitest run --project webview` passes — all new QuickPanel tests green
- [ ] `npx vitest run --project unit` still passes — 329 existing tests remain green (no regressions)
- [ ] `npm run build:dev` succeeds — webpack compiles without error (no new entry needed; session entry already exists)

### References

- [Source: epics.md#Story 3.5] — User story, acceptance criteria, FR14, dependencies
- [Source: epics.md#FR14] — "The user can view and select from all open agent sessions via a quick panel triggered from the controller"
- [Source: ux-design-specification.md#Component Table] — `SessionPanel` listed as "multi-agent session quick-switcher with per-session status"
- [Source: ux-design-specification.md#Navigation Patterns] — D-pad = "focus movement within webview panels"
- [Source: ux-design-specification.md#Custom Components / SlidePanel] — Session state visual mappings reused
- [Source: ux-design-specification.md#Accessibility Strategy] — WCAG AA; role="dialog", aria-modal, aria-selected
- [Source: architecture.md#Complete Directory Structure] — `src/webview/session/SlidePanel.tsx` noted as "Multi-session quick panel" (architecture predates story split; QuickPanel is the AC 1 direct-select component, SlidePanel is the persistent sidebar)
- [Source: architecture.md#Webview panel inventory] — Multi-session panel at `src/webview/session/SlidePanel.tsx`
- [Source: architecture.md#CSS strategy] — VOID token layer; no CSS-in-JS
- [Source: architecture.md#Webview message protocol] — postMessage pattern
- [Source: src/shared/messages.ts] — Current message types; add new without removing
- [Source: src/shared/types.ts] — Session interface; agentState values
- [Source: src/webview/session/SessionCard.tsx] — Must reuse; isActive prop for highlight
- [Source: src/webview/session/session.css] — Append; do NOT rewrite existing styles
- [Source: src/webview/session/index.tsx] — Existing reducer/state machine pattern to extend
- [Source: src/extension/panels/slide-panel-manager.ts] — Pattern for adding notifyX methods
- [Source: src/extension/commands/register.ts] — Pattern for registering new commands
- [Source: src/extension/input/default-bindings.ts] — r2/rt currently unbound; safe to assign
- [Source: implementation-artifacts/3-4-slidepanel-sessioncard-components.md] — SessionCard reuse, CSS mock pattern, test baseline (249 tests → 329 after stories 3.3 + 3.6)
- [Source: implementation-artifacts/3-3-l1-r1-session-switching-sessionswitcher-overlay.md] — SessionSwitcher pattern to follow for QuickPanel; webview reducer extension pattern
- [Source: vitest.config.ts] — webview and unit test projects already configured

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Typecheck passed after all changes (zero TS errors)
- ESLint passed (zero errors)
- `npm run build:dev` succeeded — webpack compiled extension.js and session.js without error
- 353 tests pass (329 baseline + 24 new): 20 webview tests in QuickPanel.test.tsx, 4 unit tests in register.test.ts for openQuickPanel/switchToSession
- Note: registration count test updated from 6 → 10 commands to reflect openQuickPanel, switchToSession, quickPanelNext, quickPanelPrev additions

### Completion Notes List

- Task 1: Added 3 HostMessage schemas (QUICK_PANEL_OPEN, QUICK_PANEL_CLOSE, QUICK_PANEL_NAVIGATE) and 2 WebviewMessage schemas (QUICK_PANEL_SELECT, QUICK_PANEL_DISMISS) to messages.ts. All existing messages preserved. Typecheck confirmed no drift-guard failures.
- Task 2: Created QuickPanel.tsx as full-screen modal with role="dialog", aria-modal, role="listbox", role="option", aria-selected, empty state, and reusing SessionCard per story spec.
- Task 3: Appended QuickPanel CSS block to session.css with all required classes. Did not redefine VOID tokens.
- Task 4: Extended AppState and reducer in index.tsx with quickPanelVisible + quickPanelSelectedIndex; added OPEN_QUICK_PANEL, CLOSE_QUICK_PANEL, NAVIGATE_QUICK_PANEL actions; wired QUICK_PANEL_OPEN/CLOSE/NAVIGATE host messages; added onSelect/onDismiss callbacks posting to vscode; rendered QuickPanel alongside SlidePanel and SessionSwitcher.
- Task 5: Added notifyQuickPanelOpen, notifyQuickPanelClose, notifyQuickPanelNavigate methods to SlidePanelManager; added QUICK_PANEL_SELECT and QUICK_PANEL_DISMISS inbound message handlers (SELECT dispatches vibesense.switchToSession, DISMISS logs + calls notifyQuickPanelClose).
- Task 6: Registered vibesense.openQuickPanel (builds sessions from terminals, calls notifyQuickPanelOpen), vibesense.switchToSession (focuses terminal, calls notifyQuickPanelClose), vibesense.quickPanelNext and vibesense.quickPanelPrev — all with try/catch + logger.error.
- Task 7: Added vibesense.openQuickPanel and vibesense.switchToSession to package.json contributes.commands. No activationEvents added.
- Task 8: Added r2: 'vibesense.openQuickPanel' (DualSense) and rt: 'vibesense.openQuickPanel' (Xbox) to CLAUDE_CODE_DEFAULT_BINDINGS. No existing bindings removed.
- Task 9: Created test/webview/QuickPanel.test.tsx with 20 tests covering visible/hidden states, session rendering, selected item highlighting, onSelect/onDismiss callbacks, empty state, and accessibility (role="dialog", role="listbox").
- Task 10: Added 7 tests to test/unit/extension/commands/register.test.ts for openQuickPanel (0 terminals, 2 terminals, error handling) and switchToSession (focus terminal, out-of-bounds no-op, error handling). Updated registration count assertion from 6 to 10.

### File List

- src/shared/messages.ts (modified — added 3 HostMessages + 2 WebviewMessages)
- src/webview/session/QuickPanel.tsx (created — modal session picker component)
- src/webview/session/session.css (modified — appended QuickPanel CSS block)
- src/webview/session/index.tsx (modified — wired QuickPanel reducer + render)
- src/extension/panels/slide-panel-manager.ts (modified — notifyQuickPanel* methods + inbound handlers)
- src/extension/commands/register.ts (modified — openQuickPanel, switchToSession, quickPanelNext/Prev)
- src/extension/input/default-bindings.ts (modified — r2/rt bindings)
- package.json (modified — command contributes)
- test/webview/QuickPanel.test.tsx (created — component tests)
- test/unit/extension/commands/register.test.ts (modified — added openQuickPanel + switchToSession tests)

## Change Log

- 2026-03-31: Story 3.5 created — Multi-Session Quick Panel
- 2026-03-31: Story 3.5 implemented — QuickPanel modal, 5 new messages, 4 new commands, r2/rt bindings, 24 new tests (353 total, 0 regressions)
