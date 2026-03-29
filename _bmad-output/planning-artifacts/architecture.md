---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-03-29'
lastStep: 8
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
  - '_bmad-output/planning-artifacts/product-brief-vibesense-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/technical-vibesense-full-stack-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/domain-vibesense-agentic-coding-developer-tooling-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/market-VibeSense-VSCode-gaming-controller-research-2026-03-05.md'
workflowType: 'architecture'
project_name: 'vibesense'
user_name: 'Leo'
date: '2026-03-29'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
VibeSense has 59 FRs across two delivery phases. MVP FRs (Phase 1) establish the
controller-as-input-device thesis: auto-detection, button-to-key mapping with
vibe-coding defaults, terminal operations, voice PTT, session switching, per-project
binding profiles, graceful disconnect/reconnect, and an interactive onboarding tutorial.
Growth FRs (Phase 2+) build the signature experience: prompt radial wheel, agent
feedback (haptics/LED/audio), vibeSense.notify() API, HUD overlay, streaming mode,
idle mini-games, gamified stats dashboard, session quicksave/resume, and progressive
feature unlocking. Each Growth feature is architecturally additive — the MVP must be
designed to accept them without structural rework.

**Non-Functional Requirements:**
- Input latency: <16ms for VibeSense-controlled pipeline (controller input → VSCode
  action dispatched); VSCode terminal rendering adds ~5–10ms platform overhead
- Stability: Zero-crash policy; extension failures must never crash/hang VSCode
- Graceful degradation: Keyboard fallback activates immediately on controller disconnect,
  no error state, no UX disruption; persistent status bar indicator always visible
- Cross-platform: macOS at MVP (arm64 + x64); Linux/WSL2 at Phase 1.5; Windows in
  Growth tier
- Controller compatibility: DualSense (PS5) and Xbox Series at launch; any
  HID-compatible controller with basic button mapping
- Telemetry: Opt-in default; no PII; no keystrokes/content; all signals in a single
  auditable module; source open on GitHub
- VSCode Marketplace compliance: Platform-specific VSIX (one per target platform),
  activation on HID detect or terminal open only, native binary via prebuild-install

**Scale & Complexity:**
- Primary domain: VSCode Extension (Node.js TypeScript extension host + browser-context
  Webview panels)
- Complexity level: Medium-High
- Estimated architectural components: 8 major subsystems (HID HAL, Agent FSM,
  Controller-to-Command dispatcher, Webview panel manager, IPC bridge, Telemetry
  module, Profile/settings store, Platform permission handler)

### Technical Constraints & Dependencies

- Node.js version pinned to VSCode's bundled Electron (Node.js 20.x LTS as of
  VSCode 1.87+) — native modules must compile against this exact version
- node-hid with prebuild-install is the only viable HID access path in the extension
  host; WebHID is blocked in Node.js context
- Platform-specific VSIX mandatory (vsce publish --target per platform) — single VSIX
  cannot bundle multiple platform native binaries
- VSCode Webview UI Toolkit deprecated Jan 2025; React + TypeScript for all Webview
  panels
- Dual webpack/esbuild targets required: extension host bundle (Node.js) and Webview
  bundle (browser) are separate entry points with different environments
- Claude Code hooks integration is indirect: VibeSense writes shell script entries to
  ~/.claude/settings.json; scripts send IPC to extension host; MVP fallback is terminal
  output parsing
- terminal.sendText() has no completion callback (VSCode issue #207158) — agent
  completion detection requires output parsing, not API callback
- DualSense haptic/LED output requires writing packed HID output reports (64 bytes,
  USB; different structure over Bluetooth) — dualsense-ts library handles this
- macOS requires Input Monitoring permission (System Preferences); Linux requires udev
  rules — both must be detected at runtime and surfaced inline

### Cross-Cutting Concerns Identified

1. **Real-time event pipeline** — HID input events at ~4ms (250Hz USB) must be
   captured, debounced, routed through the HAL and FSM, and dispatched as VSCode
   commands within 16ms total budget. Blocking operations anywhere in this path cause
   missed inputs or latency violations.

2. **Per-session FSM + aggregate game state** — `session-manager.ts` maintains one
   `AgentFSM` per active Claude Code session (keyed by `session_id` from hook stdin).
   Haptic, LED, and HUD subsystems subscribe to per-session FSM events. The mini-game
   subscribes only to the derived `AggregateGameState` (PLAY when all sessions are
   idle/processing; PAUSE when any session is needs-input/error). This allows Sam to
   run 3+ parallel sessions with per-session LED feedback while the mini-game correctly
   pauses if any session needs attention.

3. **Webview ↔ extension host message protocol** — All Webview panels (radial wheel,
   stats dashboard, mini-game, HUD, settings) communicate with the extension host via
   postMessage. A typed, versioned message protocol is required to prevent
   cross-boundary coupling and support independent evolution of UI panels.

4. **Controller Hardware Abstraction Layer (HAL)** — DualSense and Xbox controllers
   have different HID report structures. All upper-layer code (input routing, haptic
   output, LED control) must operate against a normalized HAL interface. The Facade
   pattern over dualsense-ts and node-hid enables multi-controller support without
   upper-layer changes.

5. **Platform-specific binary distribution** — Native .node binaries must be prebuilt
   per platform and bundled in platform-specific VSIX packages. This affects the CI/CD
   pipeline (must build on Mac arm64, Mac x64, Linux x64, Windows x64) and the
   marketplace publish workflow.

6. **Telemetry isolation** — All telemetry collection, batching, and transmission is
   confined to a single module. No other module calls telemetry APIs directly. This
   enforces the privacy commitment and makes the telemetry surface trivially auditable.

## Starter Template Evaluation

### Primary Technology Domain

VSCode Extension — Node.js TypeScript extension host with React browser-context Webview panels.
VibeSense is not a web app or backend service; it lives entirely within VSCode's extension
host process and Webview sandbox. Standard web/full-stack starters do not apply.

### Starter Options Considered

| Option | Verdict |
|--------|---------|
| `yo code` (official Microsoft generator, v1.11.18) | ✅ Selected as base |
| `antfu/starter-vscode` | Reference for project structure conventions |
| `estruyf/vscode-react-webview-template` | Reference for Webview wiring pattern |
| `tjx666/vscode-extension-boilerplate` | Too opinionated; conflicts with native module setup |

### Selected Starter: `yo code` + Manual Augmentation

**Rationale:**
`yo code` produces the canonical VSCode extension manifest (`package.json` contributes,
activationEvents, engines.vscode) expected by the Marketplace and the extension host.
No community boilerplate handles `node-hid` + `prebuild-install` + Electron native module
rebuild — this configuration must be assembled manually regardless of starter choice.
`yo code` provides the minimal correct foundation; the augmentation layers are additive
and well-documented.

**Initialization Command:**

```bash
npx --package yo --package generator-code -- yo code \
  --extensionType extensionpack \
  --bundle webpack \
  --gitInit
```
Select: TypeScript, webpack bundler, no bundled web extension target.

**Three Augmentation Layers Required Post-Scaffold:**

**Layer 1 — Dual-Target Webpack:**
Split webpack config into two entry points:
- `extension.ts` → Node.js target (`target: 'node'`, externalize vscode)
- `webview/index.tsx` (per panel) → Browser target (`target: 'web'`, React bundle)
Shared `tsconfig.json` base with `tsconfig.node.json` and `tsconfig.webview.json` extends.

**Layer 2 — Native Module Setup:**
```bash
npm install node-hid dualsense-ts
npm install --save-dev electron-rebuild prebuild-install
```
Add `postinstall` script: `electron-rebuild -f -w node-hid`
Add `.vscodeignore` entry to exclude source `.node` files; platform-specific VSIX
bundles the correct prebuilt binary per target platform.
CI matrix: `vsce package --target darwin-arm64 | darwin-x64 | linux-x64 | win32-x64`

**Layer 3 — React Webview + Typed Message Protocol:**
```bash
npm install react react-dom
npm install --save-dev @types/react @types/react-dom
```
Shared `src/shared/messages.ts` — typed discriminated union for all postMessage
events between extension host and all Webview panels. Single source of truth for
the Webview ↔ host message protocol.

**Architectural Decisions Established by Starter:**

- **Language & Runtime:** TypeScript throughout; Node.js 20.x LTS (VSCode Electron-pinned)
- **Build Tooling:** webpack with dual-target config; esbuild considered but webpack
  chosen for better control over native module externalization
- **Testing:** `@vscode/test-electron` for integration tests; Vitest for unit tests
  (fast, ESM-native, no VSCode process required for pure logic testing)
- **Linting/Formatting:** ESLint + Prettier (yo code defaults; retain)
- **Code Organization:** `src/extension/` (host code), `src/webview/` (panel code),
  `src/shared/` (types and message protocol shared between both contexts)
- **Package Manager:** npm (yo code default; prebuild-install is npm-native)

**Note:** Project initialization using these commands and augmentation steps should
be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Agent FSM design and state model
- Webview ↔ extension host typed message protocol
- Named pipe IPC channel for `vibeSense.notify()` and Claude Code hooks
- Dual-target webpack configuration
- Platform-specific VSIX packaging strategy

**Important Decisions (Shape Architecture):**
- VSCode storage API usage (globalState / workspaceState / getConfiguration)
- Zod validation at all trust boundaries
- React Context + useReducer per Webview panel
- CSS strategy (custom tokens + Tailwind hybrid)
- GitHub Actions 4-platform CI matrix

**Deferred Decisions (Post-MVP):**
- Cloud telemetry backend (local-only analytics at MVP)
- Marketplace creator program infrastructure
- Community marketplace backend

### Data Architecture

**Storage layer — three VSCode-native mechanisms, no external database:**

| Storage | API | Data |
|---------|-----|------|
| Cross-session extension state | `ExtensionContext.globalState` | Achievements, XP, usage stats, telemetry consent |
| Per-project state | `ExtensionContext.workspaceState` | Active binding profile reference |
| User-facing settings | `vscode.workspace.getConfiguration('vibesense')` | Feature flags, UI preferences |
| Per-project binding profile | `.vscode/vibesense.json` (file) | Button bindings, radial wheel config |

**Schema validation:** `zod` validates `.vscode/vibesense.json` on load. Malformed profiles
log a warning and fall back to defaults — never throw or break activation.

**Agent FSM — per-session, not global:** `session-manager.ts` maintains a
`Map<sessionId, AgentFSM>` — one FSM instance per active Claude Code terminal session.
Each FSM tracks that session's state: `idle | processing | needs-input | error`.
`session_id` is the key (sourced from Claude Code's hook stdin payload — see API &
Communication section). State resets on extension re-activation.

**Aggregate game state — derived from all sessions:**
`session-manager.ts` computes a single `AggregateGameState` after every per-session
transition:
- `PLAY` — all sessions are `processing` or `idle` (no session needs attention)
- `PAUSE` — any session is `needs-input` or `error`

The mini-game panel subscribes only to `AggregateGameState` changes, not to individual
session FSMs. Haptic, LED, and HUD subsystems subscribe to individual session FSM events
(so Sam can see per-session LED colours across 4 controllers simultaneously).

### Authentication & Security

VibeSense has no user accounts. Security concerns are trust-boundary validation only:

- **Webview ↔ host messages:** All `postMessage` payloads validated against typed
  discriminated unions in `src/shared/messages.ts` using zod. Unknown message types
  are silently dropped — never executed.
- **`vibeSense.notify()` IPC:** JSON payloads over named pipe validated with zod
  against the public event schema. Unknown event types rejected with logged warning.
  Local-only (listens on localhost socket); no authentication required.
- **Webview CSP:** All Webview panels declare strict Content Security Policy:
  `default-src 'none'; script-src 'nonce-{{nonce}}'; style-src 'nonce-{{nonce}}'`.
  Nonce generated per panel instantiation. Required by VSCode and prevents XSS.
- **Telemetry:** Opt-in, no PII, all logic in isolated `src/extension/telemetry.ts`
  module. No other module imports from telemetry directly.

### API & Communication Patterns

**Three communication surfaces:**

**A. Webview ↔ Extension Host (internal)**
Typed discriminated union over VSCode's `postMessage` API. `src/shared/messages.ts`
is the single source of truth for all message shapes. Both sides validate with zod.
Extension host → Webview: `panel.webview.postMessage(msg)`.
Webview → Extension host: `vscode.postMessage(msg)` + `onDidReceiveMessage` handler.

**B. `vibeSense.notify()` Public API (external)**
Named pipe (Unix socket on macOS/Linux; Windows named pipe on Growth tier).
Extension creates socket on activate, destroys on deactivate.
Claude Code skills and custom scripts write JSON payloads to the socket.
Payload schema: `{ event: string, haptic?: HapticPattern, led?: { color: string },
audio?: AudioTone, priority?: 'low' | 'normal' | 'high' }`.
Validated with zod; unknown fields stripped; unknown event types rejected.

**C. Agent State Detection (Claude Code)**
**Primary (MVP):** Claude Code hooks via `~/.claude/settings.json`.
VibeSense writes hook entries on first activation:
- `Stop` hook → shell script → IPC message to named pipe → session FSM transitions to `idle`
- `PostToolUse` hook → shell script → IPC message → session FSM transitions to `needs-input`

Hook scripts receive a JSON payload on stdin. The `session_id` field uniquely identifies
each Claude Code terminal session and is consistent across all hook events within that
session. Hook scripts extract it and include it in the named pipe message:

```bash
#!/bin/bash
# scripts/hooks/stop.sh
PAYLOAD=$(cat /dev/stdin)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id')
echo "{\"hook\":\"stop\",\"session_id\":\"$SESSION_ID\"}" | nc -U /tmp/vibesense.sock
```

The named pipe message schema is extended to include `session_id`:
```typescript
// Inbound hook message schema (zod)
const HookMessageSchema = z.object({
  hook: z.enum(['stop', 'post_tool_use']),
  session_id: z.string(),
})
```

`message-handler.ts` routes the validated payload to `session-manager.ts`, which looks
up or creates the FSM for that `session_id` and dispatches the state transition.

**Fallback (non-Claude-Code agents, e.g. Copilot):** Terminal PTY output stream
parsing. Regex patterns detect state signals from Copilot Chat output. Lower
reliability than hooks; used only when hooks are unavailable.

### Frontend Architecture

**State management:** React Context + `useReducer` per Webview panel. Each panel
maintains its own local state, initialized from and synchronized with the extension
host via the typed message protocol. The extension host is the single source of truth;
Webview state is a derived projection. No cross-panel state sharing in the Webview
layer — panels are isolated React trees.

**Webview panel inventory:**
| Panel | Purpose |
|-------|---------|
| `SettingsPanel` | Binding configuration, feature toggles |
| `RadialWheelPanel` | SVG radial wheel overlay (HUD surface) |
| `MiniGamePanel` | HTML5 Canvas game (Snake, Tetris) |
| `StatsPanel` | XP, streaks, controller action ratio dashboard |
| `HUDPanel` | Floating button map + session state overlay |
| `OnboardingPanel` | 60-second interactive tutorial |

**CSS strategy:**
- Native VSCode status bar components: inherit `--vscode-*` theme variables directly
- Settings/stats/onboarding Webview layouts: Tailwind CSS utility layer
- Gaming aesthetic surfaces (HUD, RadialWheel, MiniGame, streaming overlay):
  custom CSS with `--vs-*` design token layer over `--vscode-*` variables
- No CSS-in-JS (adds bundle weight; complicates Webview CSP nonce setup)
- Motion: CSS custom properties for spring easing; `prefers-reduced-motion` respected

### Infrastructure & Deployment

**CI/CD — GitHub Actions 4-platform matrix:**
```
matrix:
  target: [darwin-arm64, darwin-x64, linux-x64, win32-x64]
steps:
  - npm ci
  - electron-rebuild -f -w node-hid   # rebuild native module for Electron Node
  - vsce package --target ${{ matrix.target }}
  - upload-artifact (.vsix)
```
Pre-release: push `.vsix` artifacts to GitHub Releases.
Marketplace publish: manual workflow trigger → `vsce publish --target <platform>` ×4.

**Telemetry backend:** Deferred to post-MVP. At MVP, usage stats are computed and
stored locally in `ExtensionContext.globalState` and displayed in the in-extension
stats dashboard only. No network calls for telemetry at MVP.

### Decision Impact Analysis

**Implementation Sequence:**
1. Scaffold (`yo code` + dual webpack + node-hid setup) — unblocks everything
2. HID HAL + controller auto-detection — unblocks all input features
3. Agent FSM — unblocks haptic, LED, mini-game, and HUD subsystems
4. Named pipe IPC + Claude Code hook registration — unblocks agent state detection
5. Typed Webview message protocol — unblocks all Webview panels
6. Individual Webview panels — parallelizable once protocol is established

**Cross-Component Dependencies:**
- `session-manager.ts` is the dependency anchor: owns all per-session FSMs and the aggregate game state; haptics/LED/HUD subscribe to per-session events; mini-game subscribes to aggregate state only
- Named pipe is shared between `vibeSense.notify()` (inbound) and Claude Code hooks (inbound)
- Typed message protocol in `src/shared/messages.ts` must be stable before Webview panels are built
- Platform-specific VSIX packaging is a CI concern only; does not affect runtime code

## Implementation Patterns & Consistency Rules

### Naming Patterns

| Context | Convention | Example |
|---------|------------|---------|
| TypeScript variables/functions | `camelCase` | `activeController`, `getSessionState()` |
| TypeScript types/interfaces/enums | `PascalCase` | `ControllerType`, `AgentState`, `HapticPattern` |
| React components | `PascalCase` | `RadialWheel`, `SessionPanel` |
| React component files | `PascalCase.tsx` | `RadialWheel.tsx`, `SessionPanel.tsx` |
| Non-component TS files | `kebab-case.ts` | `hid-hal.ts`, `agent-fsm.ts`, `message-protocol.ts` |
| CSS custom properties | `--vs-*` prefix | `--vs-accent`, `--vs-bg`, `--vs-glow` |
| VSCode command IDs | `vibesense.camelCase` | `vibesense.openRadialWheel`, `vibesense.approve` |
| FSM events | `SCREAMING_SNAKE_CASE` | `AGENT_PROCESSING`, `NEEDS_INPUT`, `CONTROLLER_CONNECTED` |
| Webview message type discriminants | `SCREAMING_SNAKE_CASE` | `FSM_STATE_CHANGED`, `HAPTIC_FIRE`, `WHEEL_SEGMENT_SELECTED` |
| Named pipe socket path | `/tmp/vibesense.sock` (Mac/Linux) | fixed constant in `src/shared/constants.ts` |

### Structure Patterns

**Extension host vs Webview code separation — agents must not mix these contexts:**

```
src/
  extension/          # Node.js context ONLY — HID, VSCode API, FSM, IPC
    hid/              # HAL + controller-specific drivers
    fsm/              # Agent FSM
    ipc/              # Named pipe server + Claude Code hook writer
    panels/           # Webview panel managers (host side only)
    telemetry/        # Isolated telemetry module
    commands/         # VSCode command registrations
  webview/            # Browser context ONLY — React panels
    radial-wheel/     # One folder per panel
    stats/
    mini-game/
    hud/
    settings/
    onboarding/
  shared/             # Importable from BOTH contexts — pure types only
    messages.ts       # Typed discriminated union — all Webview ↔ host messages
    constants.ts      # Shared constants (socket path, timing values, etc.)
    types.ts          # Shared domain types (AgentState, HapticPattern, etc.)

test/                 # All tests in a dedicated top-level directory (not co-located)
  unit/               # Vitest unit tests — mirrors src/extension/ and src/shared/ structure
  integration/        # @vscode/test-electron tests requiring a live VSCode instance
  webview/            # React component tests (Vitest + jsdom)
```

**Context boundary rule:** `src/extension/` must never import from `src/webview/`.
`src/webview/` must never import from `src/extension/`. Both may import from
`src/shared/` — but `src/shared/` must contain zero Node.js or browser-specific APIs
(pure TypeScript types and constants only).

### Format Patterns

**Webview message protocol** — every cross-boundary message uses this shape in `src/shared/messages.ts`:

```typescript
// Extension host → Webview
type HostMessage =
  | { type: 'FSM_STATE_CHANGED'; payload: { state: AgentState } }
  | { type: 'CONTROLLER_CONNECTED'; payload: { controllerType: ControllerType } }
  | { type: 'SESSION_LIST_UPDATED'; payload: { sessions: Session[] } }

// Webview → Extension host
type WebviewMessage =
  | { type: 'WHEEL_SEGMENT_SELECTED'; payload: { segmentIndex: number } }
  | { type: 'APPROVE_ACTION'; payload: Record<string, never> }
```

Every new cross-boundary message is added to `src/shared/messages.ts` first.
No ad-hoc `postMessage` calls with untyped payloads.

**`vibeSense.notify()` payload** — always validated against this zod schema:

```typescript
const NotifySchema = z.object({
  event: z.string(),
  haptic: z.enum(['single_pulse','double_pulse','triple_pulse','slow_rumble','none']).optional(),
  led: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i) }).optional(),
  audio: z.enum(['success','warning','error','none']).optional(),
  priority: z.enum(['low','normal','high']).default('normal'),
})
```

**HID HAL normalized event shape** — all controllers emit this type, never raw HID bytes:

```typescript
type ControllerEvent =
  | { kind: 'button'; button: ButtonId; pressed: boolean }
  | { kind: 'axis'; axis: AxisId; value: number }   // -1.0 to 1.0
  | { kind: 'connected'; controllerType: ControllerType }
  | { kind: 'disconnected' }
  | { kind: 'battery'; level: number }               // 0–100
```

### Communication Patterns

**FSM transitions — explicit dispatch only, never direct state mutation:**

```typescript
// ✅ Correct
fsm.dispatch('AGENT_PROCESSING')

// ❌ Wrong — direct state mutation
fsm.state = AgentState.Processing
```

FSM subscribers use the EventEmitter pattern:
```typescript
fsm.on('stateChanged', (prev: AgentState, next: AgentState) => { ... })
```

**Webview state** — extension host is the single source of truth; Webview state is
a derived projection driven by incoming `HostMessage` events. No Webview panel
initiates state changes unprompted — it dispatches `WebviewMessage` requests and
waits for the host to respond with a `HostMessage` update.

### Process Patterns

**Error handling in extension host — never throw across async boundaries:**

```typescript
// ✅ Correct — log and degrade gracefully
try {
  await doHidOperation()
} catch (err) {
  logger.error('HID operation failed', err)
  // activate keyboard fallback, update status bar — never re-throw
}

// ❌ Wrong — unhandled rejection crashes extension host
hidDevice.on('data', async (report) => {
  await parseReport(report)  // if this throws, VSCode extension host crashes
})
```

**Loading states in Webviews** — one pattern everywhere:

```typescript
const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle')
```

**Null/undefined handling:** Optional chaining (`?.`) and nullish coalescing (`??`)
throughout. No `if (x != null)` guards. No `any` type — use `unknown` + zod narrowing
at trust boundaries.

**Logging:** All extension host logging through a single `logger` singleton wrapping
`vscode.window.createOutputChannel('VibeSense')`. No raw `console.log` in extension
host code — it is invisible to users in production.

### Enforcement Guidelines

**All AI agents MUST:**
- Add new cross-boundary messages to `src/shared/messages.ts` before implementing them
- Validate all external inputs (IPC payloads, Webview messages, `.vscode/vibesense.json`) with zod
- Place all tests under `test/` — never co-locate test files next to source
- Never import across the extension/webview context boundary
- Use the `logger` singleton — never `console.log` in extension host code
- Dispatch FSM transitions via `fsm.dispatch()` — never mutate state directly
- Handle all async errors in extension host with try/catch — never let rejections propagate unhandled

## Project Structure & Boundaries

### Complete Project Directory Structure

```
vibesense/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Test + lint on PR
│       └── package.yml               # Build 4-platform VSIXs on tag
├── .vscode/
│   └── launch.json                   # F5 debug config (Extension Development Host)
├── docs/
│   ├── install-guide-macos.md
│   ├── install-guide-linux.md
│   ├── binding-configuration.md
│   └── notify-api-reference.md
├── scripts/
│   ├── hooks/
│   │   ├── post-tool-use.sh          # Claude Code PostToolUse hook script
│   │   └── stop.sh                   # Claude Code Stop hook script
│   └── electron-rebuild.js           # Wraps electron-rebuild for CI
├── src/
│   ├── extension/                    # Node.js context ONLY
│   │   ├── extension.ts              # activate() / deactivate() entry point
│   │   ├── hid/
│   │   │   ├── hal.ts                # ControllerHAL interface (Facade)
│   │   │   ├── dualsense-driver.ts   # DualSense-specific HID implementation
│   │   │   ├── xbox-driver.ts        # Xbox-specific HID implementation
│   │   │   ├── generic-driver.ts     # Generic HID fallback
│   │   │   └── hid-manager.ts        # Auto-detection + reconnect lifecycle
│   │   ├── fsm/
│   │   │   ├── agent-fsm.ts          # Per-session AgentState FSM + EventEmitter
│   │   │   └── states.ts             # State, event, and AggregateGameState type definitions
│   │   ├── ipc/
│   │   │   ├── pipe-server.ts        # Named pipe server (vibeSense.notify())
│   │   │   ├── hook-writer.ts        # Writes entries to ~/.claude/settings.json
│   │   │   └── message-handler.ts    # Validates + routes inbound IPC payloads
│   │   ├── input/
│   │   │   ├── input-router.ts       # Maps ControllerEvent → VSCode command
│   │   │   ├── binding-loader.ts     # Reads .vscode/vibesense.json
│   │   │   └── default-bindings.ts   # Built-in claude-code + copilot defaults
│   │   ├── commands/
│   │   │   └── register.ts           # Registers all vibesense.* commands
│   │   ├── panels/
│   │   │   ├── radial-wheel-panel.ts
│   │   │   ├── stats-panel.ts
│   │   │   ├── mini-game-panel.ts
│   │   │   ├── hud-panel.ts
│   │   │   ├── settings-panel.ts
│   │   │   └── onboarding-panel.ts
│   │   ├── output/
│   │   │   ├── haptic-controller.ts  # Fires haptic patterns via HAL
│   │   │   ├── led-controller.ts     # Sets LED color via HAL
│   │   │   └── audio-controller.ts   # Plays audio tones via HAL
│   │   ├── session/
│   │   │   ├── session-manager.ts    # Map<session_id, AgentFSM> + aggregate game state
│   │   │   └── terminal-parser.ts    # Fallback output parsing (non-Claude-Code)
│   │   ├── platform/
│   │   │   ├── permission-checker.ts # Detects macOS/Linux HID permission state
│   │   │   └── platform-guide.ts     # Surfaces inline remediation prompts
│   │   ├── telemetry/
│   │   │   └── telemetry.ts          # Isolated telemetry module (opt-in only)
│   │   ├── status-bar.ts             # Persistent status bar controller
│   │   └── logger.ts                 # Singleton logger (VSCode output channel)
│   ├── webview/                      # Browser context ONLY
│   │   ├── radial-wheel/
│   │   │   ├── index.tsx             # React root
│   │   │   ├── RadialWheel.tsx       # SVG radial wheel component
│   │   │   ├── WheelSegment.tsx
│   │   │   └── radial-wheel.css
│   │   ├── stats/
│   │   │   ├── index.tsx
│   │   │   ├── StatsPanel.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   ├── StreakDisplay.tsx
│   │   │   └── stats.css
│   │   ├── mini-game/
│   │   │   ├── index.tsx
│   │   │   ├── GameCanvas.tsx        # HTML5 Canvas wrapper
│   │   │   ├── Snake.tsx
│   │   │   ├── Tetris.tsx
│   │   │   └── mini-game.css
│   │   ├── hud/
│   │   │   ├── index.tsx
│   │   │   ├── HUDOverlay.tsx            # Main HUD; accepts streamingMode prop
│   │   │   ├── StreamingOverlay.tsx      # CINEMA-style layout for Streaming Mode
│   │   │   ├── ButtonMap.tsx
│   │   │   ├── SessionIndicator.tsx
│   │   │   └── hud.css
│   │   ├── settings/
│   │   │   ├── index.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── BindingEditor.tsx
│   │   │   └── settings.css
│   │   ├── onboarding/
│   │   │   ├── index.tsx
│   │   │   ├── OnboardingFlow.tsx
│   │   │   ├── TutorialStep.tsx
│   │   │   └── onboarding.css
│   │   ├── session/
│   │   │   ├── index.tsx             # React root
│   │   │   ├── SessionPanel.tsx      # Multi-session quick panel
│   │   │   ├── SessionCard.tsx       # Per-session status card
│   │   │   └── session.css
│   │   └── shared-ui/
│   │       ├── ControllerIcon.tsx    # Hardware-adaptive PS/Xbox/generic glyphs
│   │       ├── AchievementToast.tsx
│   │       └── tokens.css            # --vs-* design token definitions
│   └── shared/                       # Pure types — importable from both contexts
│       ├── messages.ts               # HostMessage + WebviewMessage discriminated unions
│       ├── types.ts                  # AgentState, ControllerType, HapticPattern, etc.
│       └── constants.ts              # IPC_SOCKET_PATH, timing values, etc.
├── test/
│   ├── unit/
│   │   ├── hid/
│   │   │   ├── hal.test.ts
│   │   │   └── hid-manager.test.ts
│   │   ├── fsm/
│   │   │   └── agent-fsm.test.ts
│   │   ├── ipc/
│   │   │   ├── pipe-server.test.ts
│   │   │   └── message-handler.test.ts
│   │   ├── input/
│   │   │   ├── input-router.test.ts
│   │   │   └── binding-loader.test.ts
│   │   └── shared/
│   │       └── messages.test.ts      # Message schema + zod validation tests
│   ├── integration/
│   │   ├── extension-activation.test.ts
│   │   ├── controller-detection.test.ts
│   │   └── command-dispatch.test.ts
│   └── webview/
│       ├── RadialWheel.test.tsx
│       ├── HUDOverlay.test.tsx
│       └── SessionPanel.test.tsx
├── resources/
│   ├── icons/
│   │   ├── dualsense/               # Per-button SVG glyphs
│   │   └── xbox/                    # Per-button SVG glyphs
│   └── sounds/
│       ├── success.ogg
│       ├── warning.ogg
│       └── error.ogg
├── profiles/
│   ├── claude-code-default.json     # Bundled default binding profile
│   └── copilot-default.json
├── package.json                     # Extension manifest + contributes
├── tsconfig.json                    # Base TypeScript config
├── tsconfig.node.json               # Extension host overrides
├── tsconfig.webview.json            # Webview bundle overrides
├── webpack.config.js                # Dual-target webpack (node + web)
├── vitest.config.ts                 # Unit + webview test config
├── .eslintrc.json
├── .prettierrc
├── .vscodeignore                    # Excludes source .node files from VSIX
├── .gitignore
└── README.md
```

### Architectural Boundaries

**Context boundary (enforced at import level):**
- `src/extension/` — Node.js APIs, `node-hid`, `vscode` module available
- `src/webview/` — Browser APIs, React, DOM available; `vscode` module NOT available
- `src/shared/` — No runtime APIs; pure TypeScript types and literal constants only

**Trust boundaries (validated with zod):**
- Inbound IPC socket messages (`vibeSense.notify()` callers)
- Inbound Webview `postMessage` from each panel
- Loaded `.vscode/vibesense.json` binding profiles
- Claude Code hook shell script payloads

### Feature-to-Location Mapping

| PRD Feature Area | Primary Location |
|-----------------|-----------------|
| Controller auto-detection | `src/extension/hid/hid-manager.ts` |
| Button-to-key mapping | `src/extension/input/input-router.ts` |
| Agent state (FSM) | `src/extension/fsm/agent-fsm.ts` |
| Claude Code hooks | `src/extension/ipc/hook-writer.ts` + `scripts/hooks/` |
| `vibeSense.notify()` API | `src/extension/ipc/pipe-server.ts` |
| Haptic / LED / audio output | `src/extension/output/` |
| Session management | `src/extension/session/session-manager.ts` |
| Platform permissions | `src/extension/platform/` |
| Radial wheel UI | `src/webview/radial-wheel/` |
| Mini-game | `src/webview/mini-game/` |
| Stats dashboard | `src/webview/stats/` |
| HUD overlay | `src/webview/hud/` |
| Onboarding tutorial | `src/webview/onboarding/` |
| Settings UI | `src/webview/settings/` |
| Per-project binding profiles | `profiles/` (bundled) + `.vscode/vibesense.json` (per-project) |
| Telemetry | `src/extension/telemetry/telemetry.ts` (isolated) |

### Data Flow

```
Physical controller
    ↓  USB/Bluetooth HID reports
hid-manager.ts (auto-detect, reconnect)
    ↓  ControllerEvent (normalized)
input-router.ts ──────────────────────→ vscode.commands.executeCommand()

Claude Code hooks (PostToolUse / Stop) — fires once per session
    ↓  shell script reads stdin JSON, extracts session_id
    ↓  JSON { hook, session_id } → named pipe
pipe-server.ts → message-handler.ts (zod validate)
    ↓
session-manager.ts
    ├── sessions: Map<session_id, AgentFSM>
    ├── per-session FSM dispatches state transition
    │       ↓  stateChanged(sessionId, prev, next)
    │       ├──→ haptic-controller.ts  → HAL.setHaptic()   (per-session pattern)
    │       ├──→ led-controller.ts     → HAL.setLED()       (per-session colour)
    │       └──→ hud-panel.ts         → postMessage(SESSION_STATE_CHANGED)
    │
    └── computeAggregateGameState() after every transition
            ↓  aggregateGameStateChanged(PLAY | PAUSE)
            └──→ mini-game-panel.ts   → postMessage(GAME_PAUSE / GAME_RESUME)

External (Claude Code skill / shell script via vibeSense.notify())
    ↓  JSON over named pipe
pipe-server.ts → message-handler.ts (zod validate) → haptic/led/audio controllers
```

## Architecture Validation Results

### Coherence Validation ✅

**Decision compatibility:** TypeScript + Node.js 20.x + webpack dual-target + node-hid +
dualsense-ts + React + zod + Vitest form a coherent, compatible stack within the VSCode
Electron runtime. No version conflicts identified.

**Pattern consistency:** EventEmitter-based FSM is idiomatic Node.js. React Context +
useReducer is appropriate for isolated single-panel React trees. Zod validation at trust
boundaries is consistent with the TypeScript-first approach. All patterns align with
chosen technologies.

**Structure alignment:** The dual-context split (`src/extension/` / `src/webview/` /
`src/shared/`) directly supports and enforces the dual webpack target. The `src/shared/`
pure-types constraint enforces the context boundary structurally.

### Requirements Coverage Validation ✅

**MVP FRs:** All 20 MVP functional requirements are architecturally covered:
controller auto-detection, button mapping, terminal operations, voice PTT, session
switching, multi-session panel, per-project profiles, status bar indicator, graceful
fallback, low battery warning, input buffering, onboarding tutorial, platform permission
handling.

**Growth FRs:** All Growth features have designated locations: radial wheel
(`src/webview/radial-wheel/`), agent feedback (`src/extension/output/`), notify API
(`src/extension/ipc/`), HUD + Streaming Mode (`src/webview/hud/`), mini-games
(`src/webview/mini-game/`), stats (`src/webview/stats/`), session quicksave/resume
(`src/extension/session/`), progressive feature unlocking (`extension.ts` + `commands/`).

**NFR coverage:**
- Input latency <16ms: synchronous hot path (HID → HAL → input-router → executeCommand),
  no async steps in the critical path
- Zero-crash: enforced by error handling patterns (try/catch at all async boundaries)
- Graceful degradation: `hid-manager.ts` disconnect → `status-bar.ts` update → keyboard fallback
- Cross-platform: CI matrix covers 4 targets; `platform/` handles runtime permission detection
- Telemetry isolation: single-module constraint structurally enforced

### Gap Analysis — Issues Found and Resolved

| Gap | Severity | Resolution Applied |
|-----|----------|-------------------|
| Missing `src/webview/session/` for multi-session panel Webview | Important | Added `session/` folder with `SessionPanel.tsx`, `SessionCard.tsx` |
| Streaming Mode had no explicit location | Important | Added `StreamingOverlay.tsx` in `src/webview/hud/`; mode driven by `STREAMING_MODE_TOGGLED` host message |
| Status bar controller buried in `extension.ts` | Minor | Added dedicated `src/extension/status-bar.ts` |

### Feature-to-Location Mapping (Updated)

| PRD Feature Area | Primary Location |
|-----------------|-----------------|
| Controller auto-detection | `src/extension/hid/hid-manager.ts` |
| Button-to-key mapping | `src/extension/input/input-router.ts` |
| Agent state (FSM) | `src/extension/fsm/agent-fsm.ts` |
| Claude Code hooks | `src/extension/ipc/hook-writer.ts` + `scripts/hooks/` |
| `vibeSense.notify()` API | `src/extension/ipc/pipe-server.ts` |
| Haptic / LED / audio output | `src/extension/output/` |
| Session management + quicksave | `src/extension/session/session-manager.ts` |
| Platform permissions | `src/extension/platform/` |
| Status bar indicator | `src/extension/status-bar.ts` |
| Radial wheel UI | `src/webview/radial-wheel/` |
| Mini-game | `src/webview/mini-game/` |
| Stats dashboard | `src/webview/stats/` |
| HUD overlay | `src/webview/hud/HUDOverlay.tsx` |
| Streaming Mode | `src/webview/hud/StreamingOverlay.tsx` (mode of HUD panel) |
| Multi-session panel | `src/webview/session/SessionPanel.tsx` |
| Onboarding tutorial | `src/webview/onboarding/` |
| Settings UI | `src/webview/settings/` |
| Per-project binding profiles | `profiles/` (bundled) + `.vscode/vibesense.json` (per-project) |
| Telemetry | `src/extension/telemetry/telemetry.ts` (isolated) |

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed (59 FRs across MVP + Growth)
- [x] Scale and complexity assessed (Medium-High; 8 major subsystems)
- [x] Technical constraints identified (Node.js version pin, native binary, dual webpack)
- [x] Cross-cutting concerns mapped (FSM, message protocol, HAL, telemetry isolation)

**✅ Architectural Decisions**
- [x] Critical decisions documented (FSM, IPC, HAL, message protocol, VSIX packaging)
- [x] Technology stack fully specified (TypeScript, webpack, node-hid, React, zod, Vitest)
- [x] Integration patterns defined (named pipe, Claude Code hooks, Webview postMessage)
- [x] Performance considerations addressed (<16ms synchronous hot path)

**✅ Implementation Patterns**
- [x] Naming conventions established (all contexts covered)
- [x] Structure patterns defined (context boundary rule, test directory)
- [x] Communication patterns specified (FSM dispatch, message protocol shapes)
- [x] Process patterns documented (error handling, loading states, logging)

**✅ Project Structure**
- [x] Complete directory structure defined (all files named)
- [x] Component boundaries established (extension / webview / shared)
- [x] Integration points mapped (data flow diagram)
- [x] Requirements to structure mapping complete (feature → file table)

### Architecture Readiness Assessment

**Overall Status: READY FOR IMPLEMENTATION**

**Confidence level:** High — all critical decisions are made, all requirements are
covered, all conflict points are addressed, and the implementation sequence is clear.

**Key strengths:**
- Agent FSM as central orchestration anchor keeps all subsystems decoupled
- Context boundary (extension / webview / shared) is enforceable at the TypeScript
  import level — agents cannot accidentally cross it without a type error
- Claude Code hooks integration is event-driven and reliable (not polling/parsing)
- Named pipe IPC is simple, process-agnostic, and covers both the public API and
  the hooks integration with a single server

**Implementation first priority:**
```bash
npx --package yo --package generator-code -- yo code --bundle webpack --gitInit
```
Then apply the three augmentation layers (dual webpack, node-hid, React Webview)
as specified in the Starter Template section.

### AI Agent Implementation Guidelines

- Follow all architectural decisions exactly as documented
- Never import across the `src/extension/` ↔ `src/webview/` boundary
- Add new cross-boundary messages to `src/shared/messages.ts` before implementing
- Validate all external inputs with zod at trust boundaries
- Place all tests under `test/` — never co-locate test files
- Use `fsm.dispatch()` for all FSM transitions — never mutate state directly
- Handle all async errors in extension host with try/catch
- Use the `logger` singleton — never `console.log` in extension host code
