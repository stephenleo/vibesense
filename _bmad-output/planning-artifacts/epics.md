---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation, step-05-readiness-fixes-2026-03-29]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# vibesense - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for vibesense, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: The system can auto-detect a connected controller (wired USB, 2.4GHz dongle, Bluetooth) without user configuration on extension activation
FR2: The system can detect when a controller disconnects and immediately activate keyboard fallback without interrupting the active session
FR3: The system can auto-reconnect to a controller when it is re-plugged or re-pairs wirelessly
FR4: The system can detect when controller battery level drops below 20% and alert the user via a non-blocking status bar notification
FR5: The user can manually select a HID device from a list of available devices when auto-detection fails
FR6: The user can map any controller button or input to any registered VSCode command or key sequence
FR7: The system provides pre-built binding profiles optimized for Claude Code and GitHub Copilot Chat workflows, active without manual configuration
FR8: The user can customize controller binding profiles through a settings interface
FR9: The system buffers controller inputs during state transitions (200–300ms window) to prevent dropped actions
FR10: The user can open a new VSCode terminal using a controller input
FR11: The user can launch a Claude Code agent session using a controller input
FR12: The user can launch GitHub Copilot Chat using a controller input
FR13: The user can navigate between open terminal and agent sessions using dedicated controller inputs
FR14: The user can view and select from all open agent sessions via a quick panel triggered from the controller
FR15: The user can scroll terminal output using the analog stick with speed proportional to stick displacement
FR16: The user can trigger any registered VSCode command using a controller button
FR17: The user can activate push-to-talk voice input using a designated controller button, delegating to Claude Code or Copilot voice mode
FR18: The system can detect when a Claude Code agent session transitions between states (processing, needs input, complete, error)
FR19: The system can register lifecycle hooks in Claude Code's configuration to receive agent state events
FR20: The system can parse terminal output streams as a fallback mechanism for agent state detection when hooks are unavailable
FR21: The system can detect when voice input mode is unavailable and surface a non-blocking fallback prompt
FR22: External Claude Code skills and scripts can call vibeSense.notify() to deliver agent state events to the extension
FR23: The vibeSense.notify() API accepts named haptic patterns, LED colors, audio tones, and notification priority as parameters
FR24: The system can emit distinct haptic patterns on the controller for different agent state events (processing, complete, needs input, error)
FR25: The system can set the controller LED color to reflect the current agent or session state (blue=processing, amber=needs input, green=complete, red=error)
FR26: The system can emit audio tones through the controller speaker for agent state events
FR27: The system displays a persistent controller connection and state indicator in the VSCode status bar at all times
FR28: The user can configure a Do Not Disturb mode that suppresses ambient feedback below a specified priority threshold
FR29: The user can view a floating HUD overlay showing the active controller button map in context
FR30: The system can detect when an agent session enters idle/processing state and display a visible 5-second countdown, then automatically launch the mini-game; countdown duration is user-configurable
FR31: The system can automatically pause an active mini-game when an agent requires user attention
FR32: The system can resume a paused mini-game when the agent returns to idle/processing state
FR33: The system persists mini-game state (score, progress level) across VSCode sessions
FR34: The user can manually launch or dismiss the mini-game at any time via a controller input
FR35: The system stores per-project binding profiles in .vscode/vibesense.json, committable to version control and readable as plain JSON
FR36: The user can synchronize binding profiles across devices using VSCode's built-in Settings Sync, requiring no additional account
FR37: The user can complete an interactive onboarding flow that establishes a working controller configuration within 60 seconds of first launch
FR38: The user can configure up to 8 radial wheel segments with custom prompt text, accessible and triggerable from the controller
FR39: The system detects missing platform permissions (macOS Input Monitoring, Linux udev rules) on first launch and provides inline copy-paste remediation steps
FR40: The user can configure all VibeSense settings through the standard VSCode Settings UI
FR41: The system tracks the ratio of controller-initiated versus keyboard/mouse actions per session, stored locally on device
FR42: The user can view their controller action ratio trend over time in an in-extension stats dashboard
FR43: The user can view their Controller-Only Session Completion Rate in the stats dashboard
FR44: The system can collect anonymous usage telemetry when the user has explicitly opted in via VSCode settings
FR45: The user can change their telemetry opt-in preference at any time through VSCode settings
FR46: The system can transmit telemetry payloads containing only aggregate counts and ratios — no keystrokes, terminal content, file names, project names, or any identifiable data
FR47: The user can enable a streaming overlay mode that renders controller inputs, button maps, and radial wheel interactions as an on-screen visual layer
FR48: The streaming overlay is compositable with OBS and standard screen capture tools without additional plugin installation
FR49: The streaming overlay displays live button-press animations in real time as controller inputs occur
FR50: The extension installs from the VSCode Marketplace with the correct platform-native binaries without requiring local compilation
FR51: The extension activates lazily — only upon controller detection or explicit user trigger — not on every VSCode startup
FR52: Developers can download pre-release builds as .vsix files from GitHub Releases for testing prior to Marketplace publish
FR53: The user earns XP, progresses through levels, and maintains usage streaks based on controller session milestones (completing a controller-only session: +100 XP; achieving ≥80% controller action ratio: +50 XP; using 3+ distinct features: +25 XP; consecutive daily sessions: +streak bonus); level thresholds start at 500 XP for Level 2 and double each level; all data tracked locally
FR54: The system delivers a celebration feedback signature (haptic pattern + LED color + audio tone) when the user unlocks an achievement
FR55: Any user can view aggregated anonymous usage statistics from opted-in users published publicly on vibesense.dev
FR56: The user can access a quick-action menu from the controller when an agent session enters an error state, presenting: Retry last command, Clear terminal output, Open new agent session, and View error log
FR57: The user can view a persistent session health bar showing live controller action ratio, session duration, and XP earned in the current session, displayed in the sidebar or HUD without opening the stats dashboard
FR58: The user can quicksave the current session state (open terminals, active agent sessions, radial wheel segment configuration) and restore it on next VSCode launch via a controller input
FR59: The system starts new users in Guided mode exposing only core bindings (approve, deny, scroll, session switch); the user can switch to Full mode at any time via VSCode settings, and Full mode auto-unlocks upon completing the onboarding tutorial

### NonFunctional Requirements

NFR-P1: Controller input processing latency must be <16ms from HID input receipt to VSCode action dispatch (VibeSense extension host layer)
NFR-P2: Total end-to-end latency (controller input → visible terminal response) expected 16–26ms; VSCode platform-owned rendering overhead is not a VibeSense responsibility
NFR-P3: Extension activation must complete within 500ms of controller detection — status bar visible and controller responsive within this window
NFR-P4: VibeSense extension host process must add no more than 50MB to VSCode's baseline memory footprint during an active session
NFR-P5: HID polling must not increase VSCode extension host CPU usage by more than 5% above baseline under normal load (single workspace, 10+ open files)
NFR-R1: Any unhandled exception in the extension host must be caught, logged internally, and never propagate to the VSCode process
NFR-R2: Keyboard fallback must activate within 100ms of controller disconnect detection — no user action required
NFR-R3: Controller auto-reconnect must complete within 3 seconds of the device being re-plugged or re-paired
NFR-R4: The extension must remain fully functional as a VSCode extension when Claude Code, GitHub Copilot, or VS Code Speech are not installed
NFR-R5: Writes to ~/.claude/settings.json for Claude Code hook registration must be atomic — a failed write must never leave the file corrupt or unparseable
NFR-S1: The vibeSense.notify() API must validate and sanitize all input parameters — invalid payloads rejected with descriptive error, never executed
NFR-S2: All telemetry transmission must use HTTPS with TLS 1.2 or higher
NFR-S3: The extension must not request VSCode API permissions or capabilities beyond what is declared in package.json
NFR-S4: Telemetry payloads must be inspectable — exact JSON loggable locally when VSCode developer tools are open
NFR-C1: DualSense (PS5) and Xbox Series controllers must support the full VibeSense feature set including haptics, LED, and audio at launch
NFR-C2: Any HID-compatible controller must support basic button mapping and terminal input functionality, even without haptic or LED capabilities
NFR-C3: The extension must support VSCode 1.85 or later (Node.js 20.x Electron baseline)
NFR-C4: macOS arm64 and x64 fully supported at MVP; Linux x64 (including WSL2) at Phase 1.5; Windows x64 at Phase 2
NFR-C5: Wired USB, 2.4GHz dongle, and Bluetooth connection types must all be supported
NFR-I1: Claude Code hooks integration must degrade gracefully if Claude Code is not installed or hooks are disabled — terminal output stream parsing activates as automatic fallback
NFR-I2: Voice PTT integration must degrade gracefully if VS Code Speech or Claude Code voice mode is not available — non-blocking status message + radial wheel fallback
NFR-I3: VibeSense must not prevent other VSCode extensions from receiving keyboard events, registering commands, or processing terminal input
NFR-A1: All VibeSense Webview panels (settings UI, stats dashboard, onboarding tutorial) must be fully keyboard-navigable
NFR-A2: Status bar indicators and HUD overlay elements must use text labels or icons in addition to color — color alone must not be the sole signal for any state
NFR-A3: All in-extension notifications must be non-modal and dismissible without requiring controller input

### Additional Requirements

- **Starter Template (Epic 1, Story 1):** Project must be scaffolded using `yo code` + Manual Augmentation: `npx --package yo --package generator-code -- yo code --extensionType extensionpack --bundle webpack --gitInit` (TypeScript, webpack, no web extension target)
- **Dual-target webpack:** Split webpack config into two entry points — `extension.ts` → Node.js target; `webview/index.tsx` (per panel) → browser target; shared tsconfig.json base with tsconfig.node.json and tsconfig.webview.json extends
- **Native module setup:** Install node-hid + dualsense-ts; electron-rebuild + prebuild-install; postinstall script: `electron-rebuild -f -w node-hid`; platform-specific VSIX packaging via `vsce package --target`
- **React Webview + typed message protocol:** src/shared/messages.ts as single source of truth for all typed discriminated union Webview↔host messages; both sides validate with zod
- **Zod validation at all trust boundaries:** All external inputs (IPC payloads, Webview messages, .vscode/vibesense.json) must be validated with zod; unknown fields stripped; unknown message types silently dropped
- **Agent FSM:** session-manager.ts maintains Map<sessionId, AgentFSM> — one FSM per Claude Code terminal; states: idle | processing | needs-input | error; AggregateGameState derived (PLAY when all sessions idle/processing; PAUSE when any needs-input/error)
- **Named pipe IPC:** Unix socket at /tmp/vibesense.sock (Mac/Linux); constant in src/shared/constants.ts; created on activate, destroyed on deactivate
- **Claude Code hook registration:** VibeSense writes Stop and PostToolUse hook entries to ~/.claude/settings.json on first activation; hook scripts send IPC to named pipe with session_id
- **VSCode storage layer:** ExtensionContext.globalState (achievements, XP, usage stats, telemetry consent); workspaceState (active binding profile reference); getConfiguration('vibesense') (feature flags, UI preferences); .vscode/vibesense.json file (button bindings, radial wheel config)
- **GitHub Actions 4-platform CI matrix:** darwin-arm64, darwin-x64, linux-x64, win32-x64; steps: npm ci → electron-rebuild → vsce package --target → upload-artifact (.vsix)
- **Context boundary rule:** src/extension/ never imports from src/webview/; src/webview/ never imports from src/extension/; both may import from src/shared/ (pure types/constants only)
- **Telemetry backend deferred:** Local-only analytics at MVP; no network calls for telemetry at MVP; stats computed in ExtensionContext.globalState only
- **Webview CSP:** All panels declare strict CSP: `default-src 'none'; script-src 'nonce-{{nonce}}'; style-src 'nonce-{{nonce}}'`; nonce generated per panel instantiation
- **Testing framework:** @vscode/test-electron for integration tests; Vitest for unit tests; all tests in top-level test/ directory (not co-located)
- **Logging:** All extension host logging via logger singleton wrapping vscode.window.createOutputChannel('VibeSense'); no raw console.log in extension host code

### UX Design Requirements

UX-DR1: Implement dual layered radial wheel system — L2 wheel (Smart/System: agent-state actions, voice mode, AI-detected frequent prompts) and R2 wheel (Personal: user-defined prompts, blank on first install); both wheels visible simultaneously when either trigger held; active wheel centered + full opacity + full size; inactive wheel ~85% scale + ~50% opacity + 1px blur + offset 80px in trigger direction; snaps open <25ms (transition: none); spring close 120ms; wheel swap on opposite trigger press ~50ms ease-out; dead zone at stick center prevents accidental dispatch; both wheels collapse on dispatch or cancel
UX-DR2: Implement hardware-adaptive ControllerIcon component — auto-switches between PS5 (Cross/Circle/Square/Triangle glyphs), Xbox (A/B/X/Y glyphs), and generic HID sprite sets on controller detection; PS button colors: Cross #4A90D9, Circle #E05555, Square #D45FC9, Triangle #4DB89A; never renders generic icons when specific hardware is detected
UX-DR3: Implement SlidePanel right-edge overlay — position: fixed at right edge; 200px expanded / 12px retracted drag handle; backdrop-filter: blur(16px) + background: rgba(14,14,28,0.94); slides in on controller connect; does not push editor content; slide transition translateX(188px) ↔ translateX(0) at 150ms ease-out; respects minimap position; auto-retracts to 12px handle when editor width < 800px; R3 press toggles expand/retract; contains active sessions, current button map, session stats
UX-DR4: Implement SessionCard component with four states: active-processing (cyan #00C8FF slow-pulse dot), active-needs-input (amber #FFB800 fast-pulse dot), idle (static #7A8BAA dot), error (static #E05555 dot); active session receives box-shadow: 0 0 16px var(--vs-glow) and pulsing dot; state/color/LED mapping consistent across all surfaces (SessionCard, SlidePanel, HUDPanel, StreamingOverlay)
UX-DR5: Implement StatusBarController with three states (connected, disconnected, low-battery) using both color indicator and text label (not color alone); follows VSCode status bar conventions; always visible at bottom of editor
UX-DR6: Implement VOID design token layer as CSS custom properties on top of --vscode-* variables: --vs-bg (#09090F), --vs-surface (#0E0E1C), --vs-surface2 (#13132A), --vs-accent (#00C8FF), --vs-accent2 (#7B5CFA), --vs-text (#EFF4FF), --vs-text2 (#7A8BAA), --vs-border (rgba(0,200,255,0.18)), --vs-glow (rgba(0,200,255,0.35)), --vs-glow2 (rgba(123,92,250,0.35)); motion tokens: --vs-duration-fast (120ms), --vs-duration-base (240ms), --vs-duration-slow (400ms), --vs-easing-spring; controller button semantic color tokens; no CSS-in-JS
UX-DR7: Implement GameWindow as detachable VSCode WebviewPanel — opens in bottom panel tab (tab label: "VibeSense · Game"); HTML5 Canvas rendering with devicePixelRatio scaling; auto-launches on agent processing state (after configurable countdown FR30); auto-pauses on agent attention event; game state (score, position, level) persists across dock/undock via extension state storage; game fills available space on detach with centered layout + score overlay
UX-DR8: Implement AchievementBurst component — non-modal milestone celebration overlay paired with haptic celebration signature (FR54); fires on keyboard-free session detection, streak milestones, level-up; states: hidden → animating → fading-out; never interrupts coding flow
UX-DR9: Implement SessionSwitcher brief overlay confirming L1/R1 session change — flashes session name and number for 800ms then auto-dismisses; paired with haptic session-switch tick
UX-DR10: Implement stats dashboard Webview with StatsCard (streak, XP, controller% tile; milestone-glow on new personal best), XPBar (gradient --vs-accent → --vs-accent2, animates on XP gain), and AchievementGrid (locked/unlocked/newly-unlocked states; newly-unlocked has pulsing border) — all data sourced from ExtensionContext.globalState
UX-DR11: Implement ProfileSwitcher component in SlidePanel showing active binding profile name with per-project display; shoulder-button chord profile cycling; per-project profiles show project name and last-used date
UX-DR12: Implement StreamingOverlay (CINEMA mode) — OBS-compositable overlay with button-map-visible, wheel-visible, and score-visible states; single-screen composition (game band overlaid on dimmed editor); visually distinctive; activatable via explicit Streaming Mode toggle; live button-press animations in real time
UX-DR13: Implement label-fading progression on radial wheel segments — full text at 0–4 dispatches → short abbreviation at 5–14 dispatches → icon-only at 15+ dispatches; per-segment dispatch count tracked in ExtensionContext.globalState; configurable in settings; power-user override to force icon-only from day one
UX-DR14: Implement haptic-first feedback anatomy for all state transitions — haptic fires before visual update; physical feedback leads, LED confirms, visual follows; zero modal or toast notifications during active coding sessions; all feedback via status bar + haptic + LED only during sessions
UX-DR15: Implement ButtonMapDisplay component within SlidePanel — shows current binding layout with hardware-matched glyphs (PS icons for DualSense, Xbox icons for Xbox); updates automatically on profile switch
UX-DR16: Implement HapticPreview component in settings UI — visual waveform representation of haptic pattern; plays live on connected controller on hover/focus of haptic setting; states: idle, previewing, playing
UX-DR17: Implement responsive layout for SlidePanel — CSS custom property --vs-panel-width controls width; auto-retracts to 12px at < 800px editor width; drag handle (12px strip) always visible and accessible at all widths; radial wheel centers in viewport at any editor width
UX-DR18: Implement WCAG AA accessibility throughout all Webview panels — semantic HTML (button, label, fieldset); aria-live="polite" on session status regions; role="menu" on RadialWheel with each segment role="menuitem" + aria-label = full prompt text; all SVG components include title and aria-label; focus management: SlidePanel expand focuses first interactive element; :focus-visible global 2px --vs-accent focus rings; skip link "Skip to bindings" in settings webview; keyboard mirror of all controller bindings
UX-DR19: Implement prefers-reduced-motion global CSS rule — @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } } — applied globally across all Webview panels; haptic feedback unaffected by motion preference
UX-DR20: Implement 60-second interactive onboarding tutorial as OnboardingPanel Webview — shows actual PS/Xbox button icons from detected hardware (not generic icons); interactive (user does each action): face button bindings → L2/R2 radial wheels → L1/R1 session switching; each step requires user to press the actual button; haptic celebration burst on completion; triggers Full mode unlock (FR59); auto-starts on first controller detect

### FR Coverage Map

| FR | Epic | Summary |
|---|---|---|
| FR1 | Epic 2 | Controller auto-detect |
| FR2 | Epic 2 | Disconnect → keyboard fallback |
| FR3 | Epic 2 | Auto-reconnect |
| FR4 | Epic 2 | Battery warning |
| FR5 | Epic 2 | Manual HID selection |
| FR6 | Epic 2 | Button mapping |
| FR7 | Epic 2 | Pre-built binding profiles |
| FR8 | Epic 2 | Binding customization UI |
| FR9 | Epic 2 | Input buffering |
| FR10 | Epic 3 | Open terminal from controller |
| FR11 | Epic 3 | Launch Claude Code |
| FR12 | Epic 3 | Launch Copilot Chat |
| FR13 | Epic 3 | Session navigation L1/R1 |
| FR14 | Epic 3 | Multi-session quick panel |
| FR15 | Epic 3 | Analog stick terminal scroll |
| FR16 | Epic 3 | Trigger VSCode commands |
| FR17 | Epic 3 | Voice PTT |
| FR18 | Epic 5 | Agent state detection |
| FR19 | Epic 5 | Claude Code hooks registration |
| FR20 | Epic 5 | Terminal output stream fallback |
| FR21 | Epic 3 | Voice unavailable fallback |
| FR22 | Epic 6 | vibeSense.notify() external API |
| FR23 | Epic 6 | API parameter schema |
| FR24 | Epic 6 | Haptic patterns per agent state |
| FR25 | Epic 6 | LED color per agent state |
| FR26 | Epic 6 | Audio tones per agent state |
| FR27 | Epic 2 | Persistent status bar |
| FR28 | Epic 6 | Do Not Disturb mode |
| FR29 | Epic 7 | Floating HUD overlay |
| FR30 | Epic 8 | Mini-game auto-launch countdown |
| FR31 | Epic 8 | Mini-game auto-pause |
| FR32 | Epic 8 | Mini-game auto-resume |
| FR33 | Epic 8 | Mini-game state persistence |
| FR34 | Epic 8 | Manual mini-game toggle |
| FR35 | Epic 4 | .vscode/vibesense.json profiles |
| FR36 | Epic 4 | VSCode Settings Sync |
| FR37 | Epic 4 | 60-second onboarding tutorial |
| FR38 | Epic 7 | Radial wheel segments (up to 8) |
| FR39 | Epic 2 | Platform permission detection |
| FR40 | Epic 4 | VSCode Settings UI |
| FR41 | Epic 9 | Controller action ratio tracking |
| FR42 | Epic 9 | Stats dashboard trend chart |
| FR43 | Epic 9 | Controller-Only Session Completion Rate |
| FR44 | Epic 11 | Opt-in telemetry collection |
| FR45 | Epic 11 | Telemetry preference toggle |
| FR46 | Epic 11 | Telemetry payload constraints |
| FR47 | Epic 10 | Streaming overlay mode |
| FR48 | Epic 10 | OBS compositable |
| FR49 | Epic 10 | Live button-press animations |
| FR50 | Epic 1 | Marketplace platform-specific VSIX |
| FR51 | Epic 1 | Lazy activation |
| FR52 | Epic 1 | GitHub Releases pre-release builds |
| FR53 | Epic 9 | XP, levels, streaks |
| FR54 | Epic 6 | Achievement celebration feedback signature |
| FR55 | Epic 11 | Public stats page vibesense.dev |
| FR56 | Epic 5 | Error quick-action menu |
| FR57 | Epic 9 | Session health bar |
| FR58 | Epic 9 | Session quicksave/resume |
| FR59 | Epic 4 | Guided/Full mode progressive unlock |

## Epic List

### Epic 1: Project Foundation & Distribution Infrastructure
Developer can scaffold the extension, build it for all target platforms, publish pre-release builds, and run automated CI — unblocking all subsequent implementation work.
**FRs covered:** FR50, FR51, FR52
**Architecture covered:** yo code scaffold, dual-target webpack, node-hid + electron-rebuild + prebuild-install, React + typed message protocol, GitHub Actions 4-platform CI matrix, Zod validation setup, testing framework, context boundary rules

### Epic 2: Controller Detection, Core Input & Status Bar
User connects a DualSense or Xbox controller and VibeSense immediately recognizes it, maps buttons to vibe-coding defaults, and displays persistent connection status — establishing trust in the first 10 seconds.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR27, FR39
**NFRs addressed:** NFR-P1, NFR-P5, NFR-R1, NFR-R2, NFR-R3, NFR-C1, NFR-C2, NFR-C5, NFR-I3, NFR-A2, NFR-A3

### Epic 3: Keyboard-Free Vibe Coding Sessions
User can launch Claude Code, open and navigate terminals, scroll output, switch between agent sessions, and trigger voice PTT entirely from the controller — achieving a complete vibe coding session without touching the keyboard.
**FRs covered:** FR10, FR11, FR12, FR13, FR14, FR15, FR16, FR17, FR21
**NFRs addressed:** NFR-R4, NFR-I2

### Epic 4: Onboarding, Configuration & Per-Project Profiles
User completes the 60-second interactive tutorial on first launch, customizes bindings, commits per-project profiles to version control, and starts in Guided mode before unlocking Full mode.
**FRs covered:** FR35, FR36, FR37, FR40, FR59
**NFRs addressed:** NFR-A1, NFR-R5, NFR-S3

### Epic 5: Agent State Detection
VibeSense detects Claude Code agent state transitions (processing → needs input → complete → error) via Claude Code hooks, with terminal output stream parsing as automatic fallback — enabling all state-aware features in future epics.
**FRs covered:** FR18, FR19, FR20, FR56
**NFRs addressed:** NFR-I1, NFR-R5

### Epic 6: Ambient Hardware Feedback (Agent Feedback Layer)
User feels what their agent is doing via distinct haptic patterns, LED colors, and audio tones — and external Claude Code skills can trigger VibeSense feedback via the vibeSense.notify() public API.
**FRs covered:** FR22, FR23, FR24, FR25, FR26, FR28, FR54
**NFRs addressed:** NFR-S1

### Epic 7: Prompt Radial Wheel & HUD Overlay
User dispatches AI prompts via the dual L2/R2 radial wheel without typing — the signature VibeSense interaction — while a floating HUD displays the active button map in context.
**FRs covered:** FR29, FR38
**UX:** RadialWheel (dual layered L2 smart + R2 personal, label-fading), HUDPanel, ButtonMapDisplay

### Epic 8: Idle Mini-Games (Wait-Time Transformation)
User plays Snake or Tetris automatically while waiting for the AI agent to process, with the game pausing the instant attention is needed — transforming dead wait time into active play.
**FRs covered:** FR30, FR31, FR32, FR33, FR34
**UX:** Detachable GameWindow (HTML5 Canvas VSCode WebviewPanel)

### Epic 9: Gamified Stats, Achievements & Session Management
User tracks controller-only session progress, earns XP, unlocks achievements, views trend charts in the stats dashboard, and manages session health and state persistence.
**FRs covered:** FR41, FR42, FR43, FR53, FR57, FR58
**UX:** StatsPanel, StatsCard, XPBar, AchievementGrid, AchievementBurst, session health bar

### Epic 10: Streaming & Creator Mode
Jordan can stream VibeSense vibe coding content on Twitch/YouTube using an OBS-compositable CINEMA overlay showing live controller inputs, button maps, and radial wheel interactions.
**FRs covered:** FR47, FR48, FR49
**UX:** StreamingOverlay (CINEMA mode), live button-press animations

### Epic 11: Telemetry & Public Analytics
Team can measure VibeSense adoption via opt-in anonymous telemetry, and any user can view aggregated public usage statistics on vibesense.dev.
**FRs covered:** FR44, FR45, FR46, FR55
**NFRs addressed:** NFR-S2, NFR-S3, NFR-S4

---

## Epic 1: Project Foundation & Distribution Infrastructure

Developer (Leo) can scaffold the extension, build platform-specific VSIXs for all target platforms, run automated CI, and have all architectural patterns in place — unblocking every subsequent story in the project.

> **Note:** Story 1.1 must be merged before any other story begins. After 1.1 is merged, Stories 1.2, 1.3, 1.4, and 1.5 can all run in parallel — 4 independent workstreams.

### Story 1.1: Extension Scaffold & Dual-Target Build System

As a developer,
I want the extension scaffolded with `yo code` and configured with a dual-target webpack build (Node.js extension host + browser Webview),
So that the extension host and Webview panel contexts are properly isolated from the start and all downstream stories have a correct foundation to build on.

**Depends on:** None — this is the first story; must be merged before any other story begins.
**Can run in parallel with:** Nothing — foundational blocker.

**Acceptance Criteria:**

**Given** an empty repository,
**When** the scaffold command `npx --package yo --package generator-code -- yo code --extensionType extensionpack --bundle webpack --gitInit` is run and augmented,
**Then** the project structure matches `src/extension/`, `src/webview/`, `src/shared/`, `test/unit/`, `test/integration/`, `test/webview/` as specified in the Architecture document,
**And** `webpack.config.js` contains two entry points: `extension.ts` targeting `node` (with `vscode` externalized) and `webview/index.tsx` targeting `web`,
**And** `tsconfig.json`, `tsconfig.node.json`, and `tsconfig.webview.json` exist with correct extends chain,
**And** `npm run build` produces two separate bundles without errors,
**And** the extension can be launched in the VSCode Extension Development Host without errors.

**Given** the dual-target build is in place,
**When** a file in `src/extension/` imports from `src/webview/`,
**Then** the TypeScript compiler emits an error (enforced via tsconfig path restrictions or ESLint rule),
**And** the same error occurs if `src/webview/` imports from `src/extension/`.

**Requirements:** Architecture — Starter Template, Dual-Target Webpack, Context Boundary Rule; FR51 (lazy activation); NFR-C3 (VSCode 1.85+)

---

### Story 1.2: Native Module Setup (node-hid + electron-rebuild)

As a developer,
I want `node-hid` installed and rebuilt against VSCode's Electron Node.js version via `electron-rebuild` and `prebuild-install`,
So that the extension can read raw HID device input without requiring users to compile native code on their machines.

**Depends on:** Story 1.1 (scaffold must exist)
**Can run in parallel with:** Stories 1.3, 1.4, 1.5

**Acceptance Criteria:**

**Given** Story 1.1 is merged,
**When** `npm install node-hid dualsense-ts` and `npm install --save-dev electron-rebuild prebuild-install` are run and the `postinstall` script `electron-rebuild -f -w node-hid` is added,
**Then** `require('node-hid')` succeeds in the extension host context without throwing a native module error,
**And** the correct prebuilt `.node` binary for the current platform is selected by `prebuild-install`,
**And** `npm run build` still produces both bundles without errors.

**Given** a platform-specific VSIX is packaged (`vsce package --target darwin-arm64`),
**When** the VSIX is installed in VSCode,
**Then** `node-hid` loads the correct prebuilt binary for that platform without compilation,
**And** no `node-gyp` build is triggered during install.

**Given** no prebuilt binary exists for an unsupported platform,
**When** `prebuild-install` fails to find a binary,
**Then** `node-gyp` falls back to building from source,
**And** the build prerequisites (Xcode CLT on macOS, `build-essential` on Linux) are documented in CONTRIBUTING.md.

**Requirements:** Architecture — Native Module Setup, Platform-Specific VSIX; FR50 (Marketplace packaging); NFR-C3, NFR-C4

---

### Story 1.3: Shared Type System & Webview Message Protocol

As a developer,
I want a typed discriminated union message protocol in `src/shared/messages.ts` validated with Zod, plus shared domain types in `src/shared/types.ts` and constants in `src/shared/constants.ts`,
So that all Webview↔host communication is type-safe, trust boundaries are enforced, and there is a single source of truth for domain types used across both contexts.

**Depends on:** Story 1.1 (scaffold must exist)
**Can run in parallel with:** Stories 1.2, 1.4, 1.5

**Acceptance Criteria:**

**Given** Story 1.1 is merged,
**When** `src/shared/messages.ts` is created,
**Then** it exports `HostMessage` and `WebviewMessage` as typed discriminated unions with at minimum these initial message types: `FSM_STATE_CHANGED`, `CONTROLLER_CONNECTED`, `SESSION_LIST_UPDATED` (host→webview) and `WHEEL_SEGMENT_SELECTED`, `APPROVE_ACTION` (webview→host),
**And** `src/shared/types.ts` exports `AgentState`, `HapticPattern`, `ControllerType`, `ControllerEvent`, `Session`, and `ButtonId` as defined in the Architecture document,
**And** `src/shared/constants.ts` exports `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` and timing constants,
**And** both the extension host and Webview contexts can import from `src/shared/` without TypeScript errors.

**Given** a Webview posts an unknown message type to the extension host,
**When** the `onDidReceiveMessage` handler receives it,
**Then** the message is silently dropped — never executed,
**And** no error is thrown in the extension host.

**Given** an incoming IPC payload or Webview message,
**When** it is parsed with the corresponding Zod schema,
**Then** unknown fields are stripped,
**And** a `ZodError` is thrown (and caught/logged) for payloads that fail required field validation.

**Requirements:** Architecture — Shared Type System, Webview Message Protocol, Zod Validation; NFR-S1

---

### Story 1.4: GitHub Actions CI Matrix (4 Platforms)

As a developer,
I want a GitHub Actions CI workflow that builds and packages platform-specific VSIXs for `darwin-arm64`, `darwin-x64`, `linux-x64`, and `win32-x64` on every PR,
So that every change is validated across all target platforms and `.vsix` release artifacts are produced automatically.

**Depends on:** Story 1.1 (scaffold must exist; package.json and webpack config must be in place)
**Can run in parallel with:** Stories 1.2, 1.3, 1.5

**Acceptance Criteria:**

**Given** a pull request is opened against `main`,
**When** the CI workflow runs,
**Then** `npm ci`, `electron-rebuild -f -w node-hid`, and `vsce package --target <platform>` execute successfully for all four targets in a matrix strategy,
**And** four `.vsix` artifacts are uploaded as workflow artifacts.

**Given** the CI workflow is configured,
**When** a lint or type-check step runs,
**Then** ESLint and `tsc --noEmit` pass without errors on the codebase.

**Given** a tag matching `v*` is pushed,
**When** a separate release workflow runs,
**Then** the four `.vsix` artifacts are attached to a GitHub Release automatically,
**And** the release is marked as pre-release when the tag contains `-beta` or `-rc`.

**Requirements:** Architecture — GitHub Actions CI Matrix; FR52 (GitHub Releases pre-release builds); NFR-C4 (platform support)

---

### Story 1.5: Testing Framework & Logger Singleton

As a developer,
I want Vitest configured for unit/webview tests and `@vscode/test-electron` for integration tests, plus a `logger` singleton wrapping `vscode.window.createOutputChannel('VibeSense')`,
So that all logic can be tested in isolation and all extension host logging is centralized and visible to users via the Output panel.

**Depends on:** Story 1.1 (scaffold must exist)
**Can run in parallel with:** Stories 1.2, 1.3, 1.4

**Acceptance Criteria:**

**Given** Story 1.1 is merged,
**When** `npm test` is run,
**Then** Vitest executes all files under `test/unit/` and `test/webview/` and reports results,
**And** at least one passing unit test exists as proof-of-life.

**Given** the integration test suite is set up,
**When** `npm run test:integration` is run,
**Then** `@vscode/test-electron` launches a VSCode Extension Development Host and runs all files under `test/integration/`.

**Given** any module in `src/extension/` needs to log,
**When** `logger.info()`, `logger.warn()`, or `logger.error()` is called,
**Then** the message appears in the VibeSense Output channel in VSCode,
**And** no `console.log` calls exist anywhere in `src/extension/` (enforced by ESLint rule `no-console`).

**Requirements:** Architecture — Testing Framework, Logging; NFR-R1 (errors never propagate to VSCode)

---

## Epic 2: Controller Detection, Core Input & Status Bar

User connects a DualSense or Xbox controller and VibeSense immediately recognizes it, maps buttons to vibe-coding defaults, and displays persistent connection status — establishing trust in the first 10 seconds.

> **Parallel tracks:** After Story 2.1 is merged, Stories 2.2, 2.3, 2.4, and 2.6 can all run in parallel (4 independent workstreams). Story 2.5 starts after 2.2 merges. Story 2.7 starts after 2.5 merges.

### Story 2.1: HID Hardware Abstraction Layer (HAL)

As a developer,
I want a HID HAL in `src/extension/hid/hid-hal.ts` that normalizes DualSense and Xbox controller raw HID reports into a unified `ControllerEvent` stream,
So that all upper-layer code (command dispatcher, haptic engine, LED controller) works against a single interface regardless of which controller is connected.

**Depends on:** Epic 1 complete (Stories 1.1, 1.2, 1.3 merged)
**Can run in parallel with:** Nothing within Epic 2 — this is the foundation for all Epic 2 stories.

**Acceptance Criteria:**

**Given** a DualSense or Xbox Series controller is connected,
**When** the HAL is initialized,
**Then** it emits `{ kind: 'connected', controllerType: 'dualsense' | 'xbox' }` on the `ControllerEvent` stream,
**And** subsequent button presses emit `{ kind: 'button', button: ButtonId, pressed: boolean }`,
**And** analog stick movement emits `{ kind: 'axis', axis: AxisId, value: number }` where value is normalized to -1.0 to 1.0,
**And** battery level polling emits `{ kind: 'battery', level: number }` where level is 0–100.

**Given** any HID-compatible controller (non-DualSense, non-Xbox) is connected,
**When** the HAL receives its HID reports,
**Then** basic button and axis events are emitted (no haptic/LED output for generic devices),
**And** `controllerType` is set to `'generic-hid'`.

**Given** the HAL is processing events,
**When** any unhandled error occurs in HID data parsing,
**Then** the error is caught, logged via the logger singleton, and the HAL continues operating — never crashing the extension host.

**Requirements:** Architecture — HID HAL, Controller HAL Normalized Event Shape; NFR-P1 (<16ms latency), NFR-R1, NFR-C1, NFR-C2, NFR-C5

---

### Story 2.2: Controller Auto-Detect, Disconnect & Reconnect

As a vibe coder,
I want the extension to automatically detect my controller when it connects (USB, dongle, or Bluetooth), activate keyboard fallback immediately on disconnect, and auto-reconnect when I re-plug,
So that I never need to manually pair or restart the extension during a session.

**Depends on:** Story 2.1 (HAL must exist)
**Can run in parallel with:** Stories 2.3, 2.4, 2.6

**Acceptance Criteria:**

**Given** VSCode is open and VibeSense is active,
**When** a DualSense or Xbox controller is connected via USB, 2.4GHz dongle, or Bluetooth,
**Then** the HAL emits a `connected` event within 500ms,
**And** the status bar updates to show the controller type and connection icon.

**Given** a controller is connected and active,
**When** the controller is physically disconnected,
**Then** VibeSense detects the disconnect within 100ms,
**And** keyboard fallback activates immediately with no error dialog and no interruption to the active terminal session,
**And** the status bar updates to `○ No controller — keyboard active`.

**Given** a controller was disconnected and keyboard fallback is active,
**When** the same controller is re-plugged or re-pairs wirelessly,
**Then** VibeSense auto-reconnects within 3 seconds without any user action,
**And** the status bar returns to the connected state.

**Given** a controller is plugged in and VibeSense activates,
**When** activation completes,
**Then** the status bar controller indicator is visible and the controller is responsive to button inputs within 500ms of the HAL emitting the `connected` event (NFR-P3).

**Requirements:** FR1, FR2, FR3; NFR-P3 (500ms full activation pipeline), NFR-R2 (100ms fallback), NFR-R3 (3s reconnect), NFR-I3

---

### Story 2.3: StatusBarController & Battery Warning

As a vibe coder,
I want a persistent VSCode status bar indicator showing controller connection state and battery level, with a non-blocking warning when battery drops below 20%,
So that I always know VibeSense's status at a glance and can avoid unexpected disconnections mid-session.

**Depends on:** Story 2.1 (HAL battery events needed)
**Can run in parallel with:** Stories 2.2, 2.4, 2.6

**Acceptance Criteria:**

**Given** a controller is connected,
**When** the StatusBarController renders,
**Then** it shows a green dot + controller type label (e.g., `⊙ DualSense`) in the VSCode status bar at all times,
**And** it uses both color AND a text label (never color alone) per NFR-A2.

**Given** a controller is disconnected,
**When** the StatusBarController renders,
**Then** it shows `○ No controller — keyboard active` in the status bar.

**Given** a connected controller's battery level drops below 20%,
**When** the HAL emits a battery event with `level < 20`,
**Then** the status bar updates to show a battery warning icon + label (e.g., `⚠ DualSense: low battery`),
**And** the warning is non-blocking — no modal dialog, no interruption to the active session.

**Given** the controller battery reaches 0% and disconnects,
**When** VibeSense detects the disconnect,
**Then** keyboard fallback activates per Story 2.2 criteria.

**Given** VibeSense is active with a connected controller and a normal coding session is running,
**When** memory usage is measured via the VSCode extension host process inspector,
**Then** the VibeSense extension host adds no more than 50MB above VSCode's baseline memory footprint (NFR-P4).

**Requirements:** FR4, FR27; NFR-P4 (≤50MB memory), NFR-A2, NFR-A3

---

### Story 2.4: VOID Design System & ControllerIcon Component

As a developer building VibeSense UI panels,
I want the VOID design token layer (CSS custom properties on top of `--vscode-*` variables) and a hardware-adaptive `ControllerIcon` Webview component,
So that all VibeSense UI surfaces share a consistent gaming aesthetic and always render the correct PS5 or Xbox button glyphs for the connected hardware.

**Depends on:** Story 1.3 (shared types + Webview scaffold); Story 2.2 (controller type detection needed to drive icon switching)
**Can run in parallel with:** Stories 2.2, 2.3, 2.6 (can start after Story 1.3 and 2.1; full icon-switching integration completes after 2.2)

**Acceptance Criteria:**

**Given** any VibeSense Webview panel is rendered,
**When** the VOID token layer is loaded,
**Then** CSS custom properties `--vs-bg`, `--vs-surface`, `--vs-surface2`, `--vs-accent` (`#00C8FF`), `--vs-accent2` (`#7B5CFA`), `--vs-text`, `--vs-text2`, `--vs-border`, `--vs-glow`, `--vs-glow2` are available,
**And** motion tokens `--vs-duration-fast` (120ms), `--vs-duration-base` (240ms), `--vs-duration-slow` (400ms), `--vs-easing-spring` are defined,
**And** controller button semantic color tokens for Cross/A, Circle/B, Square/X, Triangle/Y are defined.

**Given** a DualSense is connected,
**When** a `ControllerIcon` component is rendered for any button,
**Then** it renders the PS5 glyph (Cross ✕, Circle ○, Square □, Triangle △) in the correct semantic color,
**And** never renders a generic gamepad icon.

**Given** an Xbox Series controller is connected,
**When** `ControllerIcon` renders,
**Then** it renders the Xbox glyph (A, B, X, Y) in the correct semantic color.

**Given** `prefers-reduced-motion` is enabled in the OS,
**When** any VibeSense Webview panel renders,
**Then** all CSS transitions and animations are disabled (`transition: none !important; animation: none !important`),
**And** haptic feedback is unaffected.

**Requirements:** UX-DR2, UX-DR6, UX-DR19; NFR-A2

---

### Story 2.5: Button-to-Command Dispatcher & Input Buffering

As a vibe coder,
I want controller button and axis events routed to VSCode commands via a configurable mapping layer with 200–300ms input buffering during state transitions,
So that button presses reliably trigger the intended action with <16ms latency and no inputs are dropped when the extension changes state.

**Depends on:** Story 2.2 (controller must be connected and emitting events)
**Can run in parallel with:** Story 2.6 (which also starts after 2.1)

**Acceptance Criteria:**

**Given** a controller button is pressed and a binding exists for it,
**When** the dispatcher processes the event,
**Then** the mapped VSCode command is executed within 16ms of the HID input receipt,
**And** `logger` records the input→command mapping at debug level.

**Given** the extension is in a state transition (e.g., panel opening/closing),
**When** controller inputs arrive,
**Then** inputs are buffered for 200–300ms,
**And** buffered inputs are replayed in order once the transition completes,
**And** no inputs are silently dropped.

**Given** a button is pressed with no binding configured,
**When** the dispatcher processes the event,
**Then** the input is silently ignored (no error, no notification),
**And** other extensions continue to receive keyboard events normally (NFR-I3).

**Given** the analog stick is moved,
**When** the dispatcher processes axis events,
**Then** a dead zone is applied (no output when stick displacement < 15% of full range),
**And** output magnitude is proportional to stick displacement beyond the dead zone.

**Requirements:** FR6, FR9, FR16; NFR-P1 (<16ms latency), NFR-P5 (CPU overhead), NFR-I3

---

### Story 2.6: Manual HID Device Selection & Platform Permission Detection

As a vibe coder,
I want to manually select my controller from a dropdown of detected HID devices when auto-detection fails, and receive inline copy-paste remediation when platform permissions are missing,
So that I can connect in edge cases (Bluetooth not auto-paired, permissions not granted) without abandoning the install.

**Depends on:** Story 2.1 (HAL must exist)
**Can run in parallel with:** Stories 2.2, 2.3, 2.4

**Acceptance Criteria:**

**Given** a controller is connected but not auto-detected,
**When** VibeSense activates,
**Then** the status bar shows `○ No controller detected` with a clickable notification: "Controller not found. Check connection or select device manually.",
**And** clicking the notification opens a dropdown of all available HID devices,
**And** selecting the correct device triggers a confirmation haptic pulse (if DualSense) and updates the status bar.

**Given** VibeSense launches on macOS without Input Monitoring permission,
**When** HID read fails due to missing permission,
**Then** a non-blocking notification appears: "Controller input requires Input Monitoring permission. [Open Settings]",
**And** clicking [Open Settings] links directly to the macOS System Settings Input Monitoring pane,
**And** no modal dialog is shown.

**Given** VibeSense launches on Linux without a udev rule for the controller,
**When** HID access fails,
**Then** a notification appears with a copy-paste terminal command to install the udev rule,
**And** the notification prompts the user to reconnect the controller after applying the rule.

**Requirements:** FR5, FR39; NFR-A3

---

### Story 2.7: Pre-Built Binding Profiles & Profile Schema

As a vibe coder,
I want VibeSense to ship with pre-built binding profiles for Claude Code and GitHub Copilot Chat that work immediately out of the box, stored in `.vscode/vibesense.json` validated with Zod,
So that I start vibe coding with correct defaults and no manual setup required.

**Depends on:** Story 2.5 (dispatcher must exist to execute bindings)
**Can run in parallel with:** Nothing in Epic 2 (final Epic 2 story)

**Acceptance Criteria:**

**Given** VibeSense is installed with no prior configuration,
**When** the extension activates with a Claude Code workflow,
**Then** the `claude-code-default` profile is automatically active with bindings: Cross/A = approve, Circle/B = deny, L2 = radial wheel, L1 = switch session prev, R1 = switch session next,
**And** `.vscode/vibesense.json` is created in the current workspace with the default profile schema.

**Given** `.vscode/vibesense.json` exists in the workspace,
**When** the extension activates,
**Then** the profile is loaded and validated with Zod against the schema,
**And** if validation fails (malformed JSON or unknown fields), a warning is logged and the default profile is used — the extension never crashes or blocks activation.

**Given** `.vscode/vibesense.json` is a plain JSON file,
**When** a developer commits it to version control,
**Then** the file is human-readable and committed with the project,
**And** it is listed in `.gitignore` docs as intentionally committable (not ignored).

**Requirements:** FR7, FR35; NFR-R4 (works without Claude Code); Architecture — .vscode/vibesense.json Schema

---

## Epic 3: Keyboard-Free Vibe Coding Sessions

User can launch Claude Code, open and navigate terminals, scroll output, switch between agent sessions, and trigger voice PTT entirely from the controller — achieving a complete vibe coding session without touching the keyboard.

> **Parallel tracks:** After Epic 2 is complete, Stories 3.1, 3.2, and 3.4 can all start in parallel (3 independent workstreams). Stories 3.3 and 3.6 start after 3.1; Story 3.5 starts after 3.3.

### Story 3.1: Open Terminal & Launch AI Agents from Controller

As a vibe coder,
I want to open a new VSCode terminal, launch Claude Code, and launch GitHub Copilot Chat using controller button inputs,
So that I can start a vibe coding session without touching the keyboard.

**Depends on:** Epic 2 complete (Stories 2.5, 2.7 — dispatcher + profiles must exist)
**Can run in parallel with:** Stories 3.2, 3.4

**Acceptance Criteria:**

**Given** a controller is connected with the default Claude Code profile active,
**When** the designated "open terminal" chord is pressed (e.g., L1+R1 hold),
**Then** a new VSCode integrated terminal opens within 500ms,
**And** focus moves to the new terminal.

**Given** a terminal is open,
**When** the "launch Claude Code" button is pressed,
**Then** the Claude Code session starts in the active terminal (equivalent to typing `claude` and pressing Enter),
**And** the controller remains the active input device throughout.

**Given** the "launch Copilot Chat" button is pressed,
**When** Copilot Chat is installed,
**Then** the Copilot Chat panel opens,
**And** if Copilot Chat is not installed, a non-blocking status bar message appears: "GitHub Copilot Chat not installed" with no modal dialog.

**Requirements:** FR10, FR11, FR12; NFR-R4 (graceful without Copilot)

---

### Story 3.2: Analog Stick Terminal Scroll

As a vibe coder,
I want to scroll terminal output using the left or right analog stick with scroll speed proportional to stick displacement,
So that I can review agent output from the couch without reaching for the keyboard or mouse.

**Depends on:** Epic 2 complete (Stories 2.5 dispatcher)
**Can run in parallel with:** Stories 3.1, 3.4

**Acceptance Criteria:**

**Given** a terminal has scrollable output and a controller is connected,
**When** the analog stick is pushed toward the scroll direction,
**Then** the terminal scrolls in that direction,
**And** scroll speed increases proportionally as the stick is pushed further from center,
**And** scroll stops immediately when the stick returns to the dead zone.

**Given** the analog stick is at full displacement,
**When** scrolling terminal output,
**Then** the scroll speed is fast enough to traverse 1000 lines of output in under 5 seconds.

**Given** the stick is returned to center,
**When** the terminal has reached the bottom (live output),
**Then** terminal auto-scroll (follow new output) resumes automatically.

**Requirements:** FR15

---

### Story 3.3: L1/R1 Session Switching & SessionSwitcher Overlay

As a vibe coder,
I want to switch between open terminal and agent sessions using L1 (previous) and R1 (next) shoulder buttons, with a brief 800ms overlay confirming the switch,
So that I can navigate between multiple active agents instantly without touching the keyboard or mouse.

**Depends on:** Story 3.1 (sessions must exist to switch between)
**Can run in parallel with:** Story 3.6

**Acceptance Criteria:**

**Given** multiple terminal sessions are open,
**When** R1 is pressed,
**Then** focus moves to the next terminal session within 100ms,
**And** the `SessionSwitcher` overlay flashes the session name and number for 800ms then auto-dismisses,
**And** a haptic tick fires on the controller (if DualSense — deferred to Epic 6 for haptics, but session switch event is emitted now).

**Given** L1 is pressed,
**When** the previous session is selected,
**Then** the same overlay and behavior applies in reverse.

**Given** only one terminal session is open,
**When** L1 or R1 is pressed,
**Then** no switch occurs and no overlay appears.

**Requirements:** FR13; UX-DR9

---

### Story 3.4: SlidePanel & SessionCard Components

As a vibe coder,
I want a translucent SLIDE panel on the right edge of VSCode showing all open sessions with per-session status indicators, appearing on controller connect and retractable via R3 press,
So that I always know which agents are processing, need input, or have completed without switching focus.

**Depends on:** Stories 1.3 (message protocol), 2.4 (VOID design system + ControllerIcon)
**Can run in parallel with:** Stories 3.1, 3.2

**Acceptance Criteria:**

**Given** a controller connects,
**When** the SlidePanel renders,
**Then** it appears from the right edge (200px wide), uses `backdrop-filter: blur(16px)` background, and does not push editor content,
**And** it slides in with `transform: translateX(188px) → translateX(0)` at 150ms ease-out.

**Given** the SlidePanel is expanded and R3 (right stick click) is pressed,
**When** the toggle fires,
**Then** the panel retracts to the 12px drag handle,
**And** the 12px handle remains always visible and accessible.

**Given** an agent session is in the `processing` state,
**When** the corresponding `SessionCard` renders,
**Then** it shows a slow-pulsing cyan (`#00C8FF`) dot and the session name,
**And** changes to fast-pulsing amber (`#FFB800`) when in `needs-input` state,
**And** changes to static red (`#E05555`) when in `error` state.

**Given** the editor width is less than 800px (e.g., split-view),
**When** the SlidePanel renders,
**Then** it auto-retracts to the 12px handle and the drag handle remains accessible.

**Requirements:** FR27 (partial — session list); UX-DR3, UX-DR4, UX-DR17; NFR-A2

---

### Story 3.5: Multi-Session Quick Panel

As a vibe coder,
I want to open a quick panel from the controller that lists all open agent sessions for direct selection,
So that I can jump to any session instantly without cycling through them one by one with L1/R1.

**Depends on:** Story 3.3 (session switching must work before a multi-session panel makes sense)
**Can run in parallel with:** Story 3.6

**Acceptance Criteria:**

**Given** multiple terminal sessions are open,
**When** the designated "open session panel" button is pressed,
**Then** the multi-session quick panel opens within 200ms showing all open sessions with their current status (processing, needs-input, idle, error),
**And** the D-pad or analog stick navigates between sessions,
**And** pressing Cross/A selects the highlighted session and closes the panel.

**Given** the quick panel is open,
**When** Circle/B or Back is pressed,
**Then** the panel closes without switching sessions.

**Given** there is only one session open,
**When** the quick panel button is pressed,
**Then** the panel opens with the single session visible (not suppressed).

**Requirements:** FR14

---

### Story 3.6: Voice PTT & Voice Unavailable Fallback

As a vibe coder,
I want to activate push-to-talk voice input via a designated controller button for Claude Code or Copilot voice mode, with a non-blocking fallback message and radial wheel fallback when voice is unavailable,
So that I can dispatch verbal prompts without touching the keyboard, and I'm never left stranded if voice mode isn't set up.

**Depends on:** Story 3.1 (agent sessions must be launchable from controller)
**Can run in parallel with:** Story 3.5

**Acceptance Criteria:**

**Given** VS Code Speech and Claude Code voice mode are available and active,
**When** the designated mic button is held,
**Then** push-to-talk mode activates (mic opens), the status bar shows a live mic indicator,
**And** releasing the button ends the recording and dispatches the spoken prompt to the active agent.

**Given** the mic button is pressed and Claude Code voice mode is not active or VS Code Speech is not installed,
**When** VibeSense detects no PTT response,
**Then** the status bar shows a non-blocking message: "Voice input unavailable — use radial wheel or keyboard",
**And** no modal dialog appears,
**And** the session continues without interruption.

**Requirements:** FR17, FR21; NFR-I2, NFR-A3

---

## Epic 4: Onboarding, Configuration & Per-Project Profiles

User completes the 60-second interactive tutorial on first launch, customizes bindings, commits per-project profiles to version control, and starts in Guided mode before unlocking Full mode.

> **Parallel tracks:** After Epic 2 is complete, Stories 4.1 and 4.2 can start in parallel (2 independent workstreams). **Story 4.3 requires Story 3.1 (Epic 3) to also be merged** before it can start — it depends on terminal/session commands existing. Story 4.4 starts after both 4.1 and 4.3 are merged.

### Story 4.1: VSCode Settings UI & Binding Customization

As a developer,
I want to view and customize all controller bindings through the standard VSCode Settings UI, rendered with hardware-matched button glyphs for the connected controller,
So that I can adjust the default profile without editing JSON files directly.

**Depends on:** Epic 2 complete (Stories 2.5, 2.7 — dispatcher + profile schema)
**Can run in parallel with:** Stories 4.2, 4.3

**Acceptance Criteria:**

**Given** VibeSense is installed and a controller is connected,
**When** the user opens VSCode Settings and searches for "vibesense",
**Then** all VibeSense settings are visible and configurable through the standard Settings UI,
**And** binding settings display hardware-matched button glyphs (PS5 icons for DualSense, Xbox icons for Xbox controller) — never generic icons.

**Given** a binding is changed in the Settings UI,
**When** the change is applied,
**Then** the new binding takes effect immediately (no restart required),
**And** `.vscode/vibesense.json` is updated atomically.

**Given** a "Reset to defaults" action is available in each settings section,
**When** it is triggered,
**Then** the section's settings revert to factory defaults and the binding profile updates accordingly.

**Requirements:** FR6, FR8, FR40; UX-DR15; NFR-A1 (keyboard navigable settings), NFR-S3

---

### Story 4.2: VSCode Settings Sync & Profile Portability

As a developer,
I want my per-project binding profile in `.vscode/vibesense.json` to commit with my project and sync across devices via VSCode's built-in Settings Sync,
So that my controller configuration follows me to every machine without needing a separate VibeSense account.

**Depends on:** Story 2.7 (profile schema must be established)
**Can run in parallel with:** Stories 4.1, 4.3

**Acceptance Criteria:**

**Given** a `.vscode/vibesense.json` profile exists in the workspace,
**When** the file is committed to version control,
**Then** the file is plain JSON, human-readable, and reopening the project on another machine loads the same bindings automatically.

**Given** VSCode Settings Sync is enabled on the user's account,
**When** global VibeSense settings (not per-project bindings) are changed,
**Then** they are synced across devices via VSCode's built-in Settings Sync (no VibeSense cloud required),
**And** no additional account or authentication is needed.

**Requirements:** FR35, FR36

---

### Story 4.3: Guided Mode / Full Mode Progressive Unlock

As a new VibeSense user,
I want to start in Guided mode with only essential bindings exposed (approve, deny, scroll, session switch), and unlock Full mode by completing the onboarding tutorial or toggling manually in settings,
So that I'm not overwhelmed by the full feature set on day one.

**Depends on:** Stories 2.7 (profiles), 3.1 (terminal/session commands)
**Can run in parallel with:** Stories 4.1, 4.2

**Acceptance Criteria:**

**Given** VibeSense is installed for the first time,
**When** the extension activates,
**Then** it starts in Guided mode exposing only: approve (Cross/A), deny (Circle/B), scroll (analog stick), session switch (L1/R1),
**And** all other bindings (radial wheel, HUD, mini-game, etc.) are hidden from the active binding set.

**Given** the user is in Guided mode,
**When** they complete the onboarding tutorial (Story 4.4),
**Then** Full mode is automatically unlocked and all configured bindings become active.

**Given** the user wants to switch modes manually,
**When** they toggle "Full Mode" in VSCode Settings,
**Then** the mode switches immediately with all bindings activating or deactivating accordingly.

**Requirements:** FR59

---

### Story 4.4: 60-Second Interactive Onboarding Tutorial

As a first-time VibeSense user,
I want to complete an interactive 60-second onboarding tutorial on first controller connect, using my controller's actual button icons and requiring me to physically press each button,
So that I reach my first working controller session without reading documentation and immediately unlock Full mode.

**Depends on:** Stories 4.1 (Settings UI), 4.3 (Guided mode — tutorial unlocks Full mode)
**Can run in parallel with:** Nothing — final Epic 4 story.

**Acceptance Criteria:**

**Given** VibeSense activates for the first time with a controller connected,
**When** the extension detects this is the first launch,
**Then** the OnboardingPanel Webview opens automatically with the welcome screen,
**And** the tutorial shows the detected controller's actual hardware button icons (PS5 or Xbox glyphs — never generic).

**Given** the tutorial is running,
**When** the tutorial instructs the user to press Cross/A to approve,
**Then** the tutorial waits for the physical button press before advancing,
**And** the on-screen controller diagram highlights the pressed button in real-time.

**Given** the tutorial covers: (1) face button bindings, (2) L2/R2 wheels, (3) L1/R1 session switching,
**When** all three sections are completed,
**Then** a haptic celebration burst fires (deferred to Epic 6 for full haptics — event emitted now),
**And** Full mode unlocks (Story 4.3),
**And** the tutorial closes and the user is returned to the active session.

**Given** the user closes the tutorial mid-way,
**When** they re-open it via `VibeSense: Start Onboarding` command,
**Then** the tutorial resumes from the beginning (not mid-way).

**Requirements:** FR37, FR59; UX-DR20; NFR-A1 (keyboard navigable for users without controller)

---

## Epic 5: Agent State Detection

VibeSense detects Claude Code agent state transitions (processing → needs-input → complete → error) via Claude Code hooks, with terminal output stream parsing as automatic fallback — enabling all state-aware features in future epics.

> **Parallel tracks:** After Story 5.1 is merged, Stories 5.2, 5.3, and 5.4 can all run in parallel (3 independent workstreams). Story 5.5 starts after Story 5.1 and Epic 3's Story 3.5.

### Story 5.1: Agent FSM & Session Manager

As a developer,
I want a `session-manager.ts` that maintains a `Map<sessionId, AgentFSM>` with states `idle | processing | needs-input | error`, and derives an `AggregateGameState` (PLAY/PAUSE) for the mini-game,
So that each Claude Code terminal session's state is tracked independently and subscribable by haptic, LED, HUD, and mini-game subsystems.

**Depends on:** Epic 1 complete (Stories 1.1, 1.3 — scaffold + shared types)
**Can run in parallel with:** Nothing in Epic 5 — this is the foundation.

**Acceptance Criteria:**

**Given** a Claude Code session starts,
**When** session-manager receives a `{ hook: 'stop', session_id: 'abc' }` event,
**Then** the FSM for `session_id 'abc'` transitions to `idle`,
**And** subscribers of that FSM's `stateChanged` event are notified with `(prev, next)`.

**Given** two sessions are open (one `processing`, one `needs-input`),
**When** `session-manager.getAggregateGameState()` is called,
**Then** it returns `PAUSE` (because at least one session is `needs-input`).

**Given** all open sessions are `processing` or `idle`,
**When** `getAggregateGameState()` is called,
**Then** it returns `PLAY`.

**Given** FSM transitions are dispatched,
**When** `fsm.dispatch('AGENT_PROCESSING')` is called,
**Then** the state updates correctly,
**And** attempting direct state mutation (`fsm.state = AgentState.Processing`) is blocked by TypeScript (private field).

**Requirements:** Architecture — Agent FSM, Session Manager; FR18; NFR-R1

---

### Story 5.2: Claude Code Hooks Registration

As a developer,
I want VibeSense to write `Stop` and `PostToolUse` hook entries to `~/.claude/settings.json` on first activation using atomic writes, pointing to local shell scripts that send IPC messages to the named pipe,
So that Claude Code automatically notifies VibeSense of agent state transitions without manual configuration.

**Depends on:** Story 5.1 (FSM must exist to receive events); Story 1.3 (socket path constant `VIBESENSE_SOCKET_PATH` must exist in `src/shared/constants.ts` for hook scripts to reference)
**Can run in parallel with:** Stories 5.3, 5.4

**Acceptance Criteria:**

**Given** VibeSense activates and Claude Code is installed,
**When** hook registration runs,
**Then** `~/.claude/settings.json` gains `Stop` and `PostToolUse` hook entries pointing to VibeSense's hook scripts,
**And** existing hook entries in the file are preserved (not overwritten),
**And** the write is atomic — a failed write leaves the file unchanged (using a temp file + rename pattern).

**Given** the Stop hook fires during a Claude Code session,
**When** the hook script runs,
**Then** it extracts `session_id` from stdin JSON and writes `{"hook":"stop","session_id":"<id>"}` to the named pipe,
**And** the session-manager FSM for that session transitions to `idle`.

**Given** Claude Code is not installed,
**When** VibeSense activates,
**Then** hook registration is skipped gracefully with a logged info message — no error, no disruption.

**Requirements:** FR19; NFR-I1, NFR-R5; Architecture — Claude Code Hooks, Agent State Detection

---

### Story 5.3: Named Pipe IPC Server

As a developer,
I want a named pipe IPC server at `/tmp/vibesense.sock` (macOS/Linux) created on extension activation and destroyed on deactivation, accepting Zod-validated JSON payloads and routing them to the session manager,
So that Claude Code hook scripts and the `vibeSense.notify()` API (Epic 6) can deliver events to the extension.

**Depends on:** Story 5.1 (session manager must exist to route events to)
**Can run in parallel with:** Stories 5.2, 5.4

**Acceptance Criteria:**

**Given** the extension activates,
**When** the IPC server initializes,
**Then** a Unix socket is created at `/tmp/vibesense.sock`,
**And** the socket path constant is sourced from `src/shared/constants.ts`.

**Given** a JSON payload is written to the socket,
**When** the server receives it,
**Then** it is validated against the `HookMessageSchema` (Zod),
**And** valid payloads are routed to the session manager,
**And** invalid payloads are rejected with a logged warning — never executed.

**Given** the extension deactivates,
**When** the deactivation hook fires,
**Then** the socket file is removed and all connections are closed cleanly.

**Requirements:** FR22 (partially — socket infrastructure for notify() API); Architecture — Named Pipe IPC; NFR-S1

---

### Story 5.4: Terminal Output Stream Parsing Fallback

As a developer,
I want VibeSense to parse terminal PTY output streams to detect Copilot Chat agent state signals via regex patterns when Claude Code hooks are unavailable,
So that agent state awareness works for Copilot Chat users and degrades gracefully across all agent types.

**Depends on:** Story 5.1 (FSM must exist to receive state transitions)
**Can run in parallel with:** Stories 5.2, 5.3

**Acceptance Criteria:**

**Given** Claude Code hooks are unavailable (Claude Code not installed, hooks disabled),
**When** a Copilot Chat terminal session produces output matching a "processing complete" pattern,
**Then** the FSM for that session transitions to `idle` via the terminal parser,
**And** the transition is indistinguishable to subscribers from a hook-based transition.

**Given** the terminal parser is active,
**When** it receives output that matches no known patterns,
**Then** no FSM transition is triggered and no error is logged.

**Given** Claude Code hooks ARE available,
**When** both hooks and the terminal parser are active simultaneously,
**Then** the hooks take precedence and the terminal parser does not double-fire transitions.

**Requirements:** FR20; NFR-I1

---

### Story 5.5: Error State Quick-Action Menu

As a vibe coder,
I want a quick-action menu accessible from the controller when an agent session enters an error state, offering: Retry last command, Clear terminal output, Open new agent session, View error log,
So that I can recover from errors without reaching for the keyboard.

**Depends on:** Stories 5.1 (error state detection), 3.5 (quick panel infrastructure)
**Can run in parallel with:** Nothing — requires both FSM error state and session panel.

**Acceptance Criteria:**

**Given** an agent session transitions to `error` state,
**When** the controller user presses the designated quick-action button,
**Then** the quick-action menu opens with four options: (1) Retry last command, (2) Clear terminal output, (3) Open new agent session, (4) View error log.

**Given** the quick-action menu is open,
**When** "Retry last command" is selected,
**Then** the last terminal command is re-sent and the session FSM transitions back to `processing`.

**Given** the quick-action menu is open,
**When** Circle/B is pressed,
**Then** the menu closes without any action taken.

**Requirements:** FR56

---

## Epic 6: Ambient Hardware Feedback (Agent Feedback Layer)

User feels what their agent is doing via distinct haptic patterns, LED colors, and audio tones — and external Claude Code skills can trigger VibeSense feedback via the `vibeSense.notify()` public API.

> **Parallel tracks:** After Epic 5 is complete, Stories 6.1, 6.2, and 6.3 can all run in parallel (3 independent workstreams). Story 6.4 starts after all three are merged. Story 6.5 can start after any one of 6.1/6.2/6.3 is merged.

### Story 6.1: Haptic Pattern Engine (DualSense)

As a vibe coder,
I want distinct haptic patterns emitted on my DualSense for each agent state event — single pulse (complete), rising pulse (needs-input), slow rumble (processing start), double pulse (error) — so that I feel my agent's state in my hands without looking at the screen.

**Depends on:** Epic 5 complete (FSM state events available); Story 2.1 (HAL with haptic output capability)
**Can run in parallel with:** Stories 6.2, 6.3

**Acceptance Criteria:**

**Given** a DualSense is connected and an agent session transitions to `needs-input`,
**When** the haptic engine fires,
**Then** a rising escalating pulse plays on the DualSense within 50ms of the FSM transition,
**And** the haptic fires BEFORE any visual update (per UX-DR14 haptic-first principle).

**Given** an agent session transitions to `idle` (complete),
**When** the haptic engine fires,
**Then** a single short pulse plays.

**Given** a Do Not Disturb mode is active with priority threshold = `high` (Story 6.5),
**When** a `normal` priority haptic would fire,
**Then** the haptic is suppressed.

**Given** an Xbox controller or generic HID device is connected,
**When** agent state transitions occur,
**Then** no haptic output is attempted (Xbox rumble motors use different APIs — tracked as **Growth backlog: Story 6.X Xbox Haptics via Rumble Motors**),
**And** no error is thrown.

**Requirements:** FR24, FR54 (celebration haptic infrastructure); UX-DR14; Architecture — dualsense-ts

> **Growth backlog:** Story 6.X — Xbox Haptics via Rumble Motors. When Xbox haptic support is prioritized, add a new story to Epic 6 implementing `IHapticOutput` for Xbox via the `node-hid` rumble API. The HAL abstraction in `hid-hal.ts` is already designed to accept this addition without rework.

---

### Story 6.2: LED Color State Controller

As a vibe coder,
I want my DualSense LED to reflect the current agent state (cyan=processing, amber=needs-input, green=complete, red=error),
So that I know my agent's state at a glance from any position, even without looking at the screen.

**Depends on:** Epic 5 complete; Story 2.1 (HAL with LED output capability)
**Can run in parallel with:** Stories 6.1, 6.3

**Acceptance Criteria:**

**Given** a DualSense is connected and an agent session is `processing`,
**When** the LED controller fires,
**Then** the DualSense LED is set to cyan (`#00C8FF`) within 50ms of the FSM transition.

**Given** the agent transitions to `needs-input`,
**When** the LED controller fires,
**Then** the LED changes to amber (`#FFB800`) with a slow pulsing pattern.

**Given** multiple sessions are open with different states,
**When** the LED controller must pick a single color,
**Then** it uses the highest-priority state: `error` > `needs-input` > `processing` > `idle`.

**Given** an Xbox or generic HID device is connected,
**When** LED output is attempted,
**Then** the operation is silently skipped — no error.

**Requirements:** FR25; UX-DR4 (state/LED mapping)

---

### Story 6.3: Audio Tone System

As a vibe coder,
I want audio tones emitted through the DualSense built-in speaker for agent state events (success tone on complete, warning tone on needs-input, error tone on error),
So that I have an additional ambient feedback channel that works even when I'm not watching the screen.

**Depends on:** Epic 5 complete; Story 2.1 (HAL)
**Can run in parallel with:** Stories 6.1, 6.2

**Acceptance Criteria:**

**Given** a DualSense is connected and an agent session completes,
**When** the audio system fires,
**Then** a success tone plays through the DualSense speaker.

**Given** an agent requires input,
**When** the audio system fires,
**Then** a warning tone plays.

**Given** the user has disabled audio feedback in VSCode Settings,
**When** agent state transitions occur,
**Then** no audio tone fires, but haptic and LED feedback are unaffected.

**Requirements:** FR26

---

### Story 6.4: vibeSense.notify() Public API

As a Claude Code skill author or custom script developer,
I want to call `vibeSense.notify()` over the named pipe IPC with a typed payload (event name, haptic pattern, LED color, audio tone, priority) and have VibeSense execute the requested hardware feedback,
So that my custom agentic workflows can trigger VibeSense feedback programmatically without modifying the extension.

**Depends on:** Stories 6.1, 6.2, 6.3 (feedback systems must exist); Story 5.3 (named pipe IPC server must exist)
**Can run in parallel with:** Story 6.5

**Acceptance Criteria:**

**Given** a Claude Code skill writes `{"event":"deploy_success","haptic":"triple_pulse","led":{"color":"#00ff00"},"audio":"success","priority":"high"}` to `/tmp/vibesense.sock`,
**When** the IPC server receives and validates the payload,
**Then** a triple haptic pulse fires, the LED changes to green, and a success tone plays.

**Given** a payload with an invalid LED hex color is received,
**When** Zod validation runs,
**Then** the payload is rejected with a logged descriptive error,
**And** no partial feedback fires.

**Given** a payload with unknown fields is received,
**When** Zod parses it,
**Then** unknown fields are stripped and the valid fields are processed normally.

**Given** a bundled example Claude Code skill (`vibesense-notify.md`) is shipped with the extension,
**When** a developer installs the skill,
**Then** it demonstrates deployment success/failure feedback using `vibeSense.notify()`.

**Requirements:** FR22, FR23; NFR-S1; Architecture — vibeSense.notify() Public API

---

### Story 6.5: Do Not Disturb Mode

As a vibe coder,
I want to configure a Do Not Disturb mode that suppresses all haptic, LED, and audio feedback below a specified priority threshold (low/normal/high),
So that I can focus during critical work without physical interruptions.

**Depends on:** Stories 6.1, 6.2, 6.3 (feedback systems must exist to suppress)
**Can run in parallel with:** Story 6.4

**Acceptance Criteria:**

**Given** Do Not Disturb is enabled with threshold = `high`,
**When** an agent state event with `priority: 'normal'` fires,
**Then** all haptic, LED, and audio feedback for that event is suppressed,
**And** the status bar still updates normally (visual feedback is not suppressed).

**Given** Do Not Disturb is enabled,
**When** an event with `priority: 'high'` fires (e.g., achievement unlock or critical error),
**Then** the feedback plays through regardless of DND threshold.

**Given** DND mode is configurable in VSCode Settings,
**When** the setting is toggled,
**Then** it takes effect immediately for subsequent events.

**Requirements:** FR28

---

## Epic 7: Prompt Radial Wheel & HUD Overlay

User dispatches AI prompts via the dual L2/R2 radial wheel without typing — the signature VibeSense interaction — while a floating HUD displays the active button map in context.

> **Parallel tracks:** After Epic 2 is complete, Stories 7.1 and 7.3 can start in parallel (2 independent workstreams, with UX/Webview work on 7.3 and core wheel logic on 7.1). Story 7.2 starts after 7.1. Story 7.4 starts after 7.2.

### Story 7.1: Radial Wheel Core (L2 Smart Wheel)

As a vibe coder,
I want to hold L2 to open an 8-segment radial Smart wheel pre-populated with system/agent-state actions and voice mode trigger, navigate by tilting the right stick, and dispatch on release,
So that I can send AI prompts and trigger agent actions without typing.

**Depends on:** Epic 2 complete (dispatcher + ControllerIcon); Story 1.3 (message protocol); Story 2.4 (VOID design system)
**Can run in parallel with:** Story 7.3

**Acceptance Criteria:**

**Given** L2 is held,
**When** the RadialWheel opens,
**Then** both wheels snap into view in <25ms (`transition: none` on open),
**And** the L2 Smart wheel is centered (full size, full opacity),
**And** a dead zone at stick center means no segment is pre-selected on open (no accidental dispatch).

**Given** the right stick is tilted toward a segment,
**When** the stick enters a segment's activation zone,
**Then** the segment scales to `1.05` with `box-shadow: 0 0 12px var(--vs-glow)` and a micro-tick haptic fires (deferred to Epic 6 for haptics — event emitted now),
**And** holding on a segment for 200ms previews the full prompt text below the wheel.

**Given** L2 is released with a segment selected,
**When** the dispatch fires,
**Then** the corresponding prompt or command is sent to the active agent,
**And** both wheels collapse with a spring ease at 120ms.

**Given** the stick returns to center and L2 is released,
**When** the cancel fires,
**Then** both wheels collapse with a subtle dismiss haptic and no action is taken.

**Requirements:** FR38 (partial — L2 Smart wheel); UX-DR1; Architecture — Webview panel RadialWheelPanel

---

### Story 7.2: Dual Layered Wheel System (R2 Personal Wheel)

As a vibe coder,
I want both the L2 Smart wheel and R2 Personal wheel visible simultaneously when either trigger is held, with the active wheel centered and the inactive wheel receded at ~85% scale + 50% opacity, and pressing the opposite trigger swapping foreground/background,
So that I can switch between system prompts and personal prompts with one trigger press.

**Depends on:** Story 7.1 (L2 wheel must exist as the base)
**Can run in parallel with:** Story 7.3

**Acceptance Criteria:**

**Given** R2 is held (without L2),
**When** both wheels render,
**Then** the R2 Personal wheel is centered (full size, full opacity),
**And** the L2 Smart wheel is offset 80px to the left at ~85% scale, ~50% opacity, 1px blur.

**Given** L2 is held and then R2 is also pressed,
**When** the trigger swap fires,
**Then** the R2 wheel slides forward to center and L2 steps back in ~50ms ease-out,
**And** right stick navigation now controls the R2 wheel.

**Given** the non-active (receded) trigger is released,
**When** only the release event fires,
**Then** no action occurs (only releasing the active centered trigger dispatches).

**Requirements:** FR38 (full dual-wheel); UX-DR1 (dual layered wheel system)

---

### Story 7.3: HUD Overlay (Floating Button Map)

As a vibe coder,
I want a floating HUD overlay that displays the current active controller button map in context, updating automatically when the profile changes,
So that I can reference my bindings without leaving my session or opening settings.

**Depends on:** Epic 2 complete (ControllerIcon, VOID tokens); Story 1.3 (message protocol)
**Can run in parallel with:** Stories 7.1, 7.2

**Acceptance Criteria:**

**Given** a controller is connected and VibeSense is active,
**When** the HUD is toggled on via the designated binding,
**Then** a floating panel renders showing the current button-map layout with hardware-matched button glyphs,
**And** the HUD does not block terminal content (overlays at a corner of the editor).

**Given** the active binding profile changes (e.g., project switch),
**When** the HUD is visible,
**Then** the displayed button map updates immediately to reflect the new profile.

**Given** the user is in Guided mode (Story 4.3),
**When** the HUD renders,
**Then** it shows only the Guided mode bindings (not the full binding set).

**Requirements:** FR29; UX-DR15 (ButtonMapDisplay)

---

### Story 7.4: Radial Wheel Customization & Label Fading

As a vibe coder,
I want to configure up to 8 segments on my R2 Personal wheel with custom prompt text via `.vscode/vibesense.json`, and have segment labels progressively fade to icon-only as I build muscle memory,
So that my wheel becomes more efficient over time and cluttered labels fade as they're no longer needed.

**Depends on:** Story 7.2 (dual wheel must exist for Personal wheel customization)
**Can run in parallel with:** Nothing in Epic 7 — final story.

**Acceptance Criteria:**

**Given** `.vscode/vibesense.json` contains `"radialWheel": { "segments": ["fix this", "explain this", "add tests", "commit", "..."] }`,
**When** the R2 Personal wheel opens,
**Then** each segment shows the configured prompt text at the correct position.

**Given** a segment has been dispatched 5 times,
**When** the wheel renders,
**Then** the segment label shortens to its abbreviated form.

**Given** a segment has been dispatched 15+ times,
**When** the wheel renders,
**Then** the segment shows icon-only (no text label).

**Given** a power user wants icon-only from day one,
**When** they set "forceIconOnly: true" in VSCode Settings,
**Then** all wheel labels render icon-only regardless of usage count.

**Requirements:** FR38; UX-DR13 (label fading); Architecture — .vscode/vibesense.json radialWheel schema

---

## Epic 8: Idle Mini-Games (Wait-Time Transformation)

User plays Snake or Tetris automatically while waiting for the AI agent to process, with the game pausing the instant attention is needed — transforming dead wait time into active play.

> **Parallel tracks:** After Story 8.1 is merged, Stories 8.2 and 8.3 can run in parallel. Story 8.4 starts after 8.2.

### Story 8.1: GameWindow WebviewPanel & Snake Game

As a vibe coder,
I want a VSCode WebviewPanel hosting an HTML5 Canvas Snake game that auto-launches in the bottom panel tab when the agent enters processing state (after a configurable countdown), with the right analog stick controlling the snake,
So that I have something engaging to do during AI wait time without switching away from VSCode.

**Depends on:** Epic 5 complete (agent state events needed); Story 1.3 (Webview scaffold); Story 2.4 (VOID design system)
**Can run in parallel with:** Nothing in Epic 8 — Stories 8.2 and 8.3 both depend on this story

**Acceptance Criteria:**

**Given** an agent session transitions to `processing`,
**When** the configurable countdown (default 5 seconds) completes with the session still `processing`,
**Then** the GameWindow WebviewPanel opens in the bottom panel tab (tab label: "VibeSense · Game"),
**And** Snake launches with the right analog stick as the directional input.

**Given** the GameWindow is active,
**When** the right stick is tilted,
**Then** the snake turns in the corresponding direction,
**And** the canvas uses `devicePixelRatio` scaling for crisp rendering at any display density.

**Given** the game is running and the VSCode panel is dragged out to a separate window,
**When** the window detaches (VSCode 1.85+ native detach),
**Then** the game continues without resetting,
**And** the canvas scales to fill the detached window.

**Requirements:** FR30, FR34 (manual launch/dismiss); UX-DR7

---

### Story 8.2: Game Auto-Pause & Auto-Resume on Agent State

As a vibe coder,
I want the mini-game to automatically pause the instant an agent requires my attention (any session enters `needs-input` or `error`) and resume when all sessions return to `processing` or `idle`,
So that I never miss an agent event while gaming and never have to manually manage the game/work context switch.

**Depends on:** Story 8.1 (GameWindow must exist)
**Can run in parallel with:** Story 8.3

**Acceptance Criteria:**

**Given** the Snake game is running and an agent session transitions to `needs-input`,
**When** `AggregateGameState` changes to `PAUSE`,
**Then** the game pauses immediately (within one game tick),
**And** a haptic attention pattern fires (deferred to Epic 6 for full haptics — event emitted now),
**And** the SlidePanel highlights the session needing attention.

**Given** the game is paused and the user resolves the agent (approves/denies),
**When** all sessions return to `processing` or `idle`,
**Then** `AggregateGameState` changes to `PLAY`,
**And** the game resumes from exactly where it was paused.

**Requirements:** FR31, FR32; UX-DR7 (auto-pause/resume)

---

### Story 8.3: Tetris Game Mode

As a vibe coder,
I want Tetris as an alternative idle game option, selectable from VSCode Settings or via controller toggle,
So that I have variety during longer AI processing sessions and am not limited to one game.

**Depends on:** Story 8.1 (GameWindow canvas infrastructure and auto-launch logic)
**Can run in parallel with:** Story 8.2

**Acceptance Criteria:**

**Given** the user has selected Tetris as their idle game in VSCode Settings,
**When** an agent session enters `processing` and the countdown completes,
**Then** the Tetris game launches in the GameWindow instead of Snake,
**And** the tab label updates to "VibeSense · Tetris".

**Given** Tetris is running,
**When** the left analog stick or D-pad is used,
**Then** pieces move left/right and down as expected,
**And** the right stick or a button rotates pieces.

**Given** the game auto-pauses (Story 8.2 criteria),
**When** Tetris resumes,
**Then** the current Tetris board state is preserved (piece positions, score, level).

**Requirements:** FR30 (mini-game system); UX-DR7

---

### Story 8.4: Game State Persistence & Session Continuity

As a vibe coder,
I want my mini-game score and progress level to persist across VSCode restarts, and game state to survive panel dock/undock operations,
So that I never lose my game progress between coding sessions.

**Depends on:** Story 8.2 (game must run and pause/resume before persistence makes sense)
**Can run in parallel with:** Nothing in Epic 8 — final story.

**Acceptance Criteria:**

**Given** a Snake game is in progress with a score of 450,
**When** VSCode is closed and reopened,
**Then** the high score is preserved in `ExtensionContext.globalState`,
**And** the game starts fresh (not mid-game) but the high score leaderboard is intact.

**Given** the GameWindow is docked in the bottom panel,
**When** the user drags it out to a separate monitor,
**Then** the game continues without a reset,
**And** the canvas re-scales to fill the new window dimensions.

**Requirements:** FR33; UX-DR7 (state persists across dock/undock)

---

## Epic 9: Gamified Stats, Achievements & Session Management

User tracks controller-only session progress, earns XP, unlocks achievements, views trend charts in the stats dashboard, and manages session health and state persistence.

> **Parallel tracks:** After Story 9.1 is merged, Stories 9.2 and 9.3 can run in parallel. After 9.3 merges, Story 9.4 can start immediately. **Story 9.5 requires both Story 9.3 AND Epic 6 complete** (haptic engine needed for achievement celebrations). Story 9.6 starts after Epic 3 and Epic 7 are complete.

### Story 9.1: Controller Action Ratio Tracking

As a vibe coder,
I want VibeSense to track the ratio of controller-initiated vs keyboard/mouse actions per session, stored locally in `ExtensionContext.globalState`,
So that I can measure my progress toward keyboard-free sessions and the extension has the data foundation for all gamification features.

**Depends on:** Epic 2 complete (Story 2.5 — dispatcher tracks controller inputs)
**Can run in parallel with:** Stories 9.3 (XP system can be designed in parallel if signal schema is agreed)

**Acceptance Criteria:**

**Given** a vibe coding session is active,
**When** a controller input triggers a VSCode action,
**Then** the event is counted as a controller action in the session tally.

**Given** the user types on the keyboard during a session,
**When** VibeSense detects keyboard input,
**Then** the event is counted as a keyboard action.

**Given** a session ends (terminal closed or VSCode closes),
**When** the session completes,
**Then** the final controller action ratio (controller_actions / total_actions) is stored in `ExtensionContext.globalState` with the session timestamp,
**And** whether the session was "controller-only" (zero keyboard touches) is recorded as a boolean.

**Requirements:** FR41, FR43

---

### Story 9.2: Stats Dashboard (Ratio Trend & Session Completion Rate)

As a vibe coder,
I want to view my controller action ratio trend over time and Controller-Only Session Completion Rate in an in-extension stats dashboard panel,
So that I can see my improvement at a glance and stay motivated.

**Depends on:** Story 9.1 (data must be collected before it can be displayed)
**Can run in parallel with:** Story 9.3

**Acceptance Criteria:**

**Given** the user triggers `VibeSense: Open Stats` command or presses the designated controller button,
**When** the StatsPanel Webview opens,
**Then** it shows: (1) controller action ratio trend chart over the last 30 sessions, (2) Controller-Only Session Completion Rate as a percentage, (3) current streak (consecutive daily sessions).

**Given** fewer than 5 sessions have been recorded,
**When** the stats panel opens,
**Then** it shows available data and a friendly placeholder for missing data (not an error state).

**Requirements:** FR42, FR43; UX-DR10 (StatsCard, XPBar, AchievementGrid)

---

### Story 9.3: XP System, Levels & Streaks

As a vibe coder,
I want to earn XP for controller milestones, progress through levels (Level 2 = 500 XP, doubling each level), and maintain a usage streak,
So that each session feels rewarding and I'm motivated to build better controller habits over time.

**Depends on:** Story 9.1 (session data foundation)
**Can run in parallel with:** Story 9.2

**Acceptance Criteria:**

**Given** a controller-only session completes (zero keyboard touches),
**When** the session ends,
**Then** +100 XP is added to the user's total in `ExtensionContext.globalState`.

**Given** a session achieves ≥80% controller action ratio,
**When** the session ends,
**Then** +50 XP is added.

**Given** 3+ distinct VibeSense features are used in a session (e.g., radial wheel + session switching + mini-game),
**When** the session ends,
**Then** +25 XP is added.

**Given** consecutive daily sessions are maintained,
**When** each day's session ends,
**Then** a streak bonus is applied (streak count × 10 XP per consecutive day).

**Given** the user's total XP crosses a level threshold (Level 2 = 500 XP, Level 3 = 1000 XP, Level 4 = 2000 XP, etc.),
**When** the threshold is crossed,
**Then** a level-up event is emitted that triggers the AchievementBurst (Story 9.5).

**Requirements:** FR53

---

### Story 9.4: Session Health Bar

As a vibe coder,
I want a persistent session health bar in the SlidePanel or HUD showing live controller action ratio, session duration, and XP earned in the current session,
So that I have at-a-glance session momentum throughout my work without opening the full stats dashboard.

**Depends on:** Stories 9.1 (ratio tracking), 9.3 (XP system — for live XP display)
**Can run in parallel with:** Story 9.5

**Acceptance Criteria:**

**Given** a session is active and a controller is connected,
**When** the session health bar renders,
**Then** it displays: live controller action ratio percentage, current session duration, and XP earned so far this session,
**And** the ratio percentage updates in real-time as actions are taken.

**Given** the controller action ratio drops below 50%,
**When** the health bar renders the ratio,
**Then** the ratio indicator uses amber/warning styling.

**Given** the ratio is above 80%,
**When** the health bar renders,
**Then** the ratio indicator uses the accent cyan styling.

**Requirements:** FR57; UX-DR10

---

### Story 9.5: Achievement System & AchievementBurst

As a vibe coder,
I want to unlock achievements (Bronze/Silver/Gold/Platinum tiers) for controller milestones, with a haptic + LED + visual `AchievementBurst` celebration when each achievement unlocks,
So that meaningful milestones are celebrated in a way that makes me feel proud and excited to continue.

**Depends on:** Stories 9.3 (XP/levels), 6.1 (haptic engine for celebrations — Epic 6 must be complete)
**Can run in parallel with:** Story 9.4

**Acceptance Criteria:**

**Given** the user completes their first controller-only session,
**When** the achievement "First Steps" (Bronze) unlocks,
**Then** the `AchievementBurst` overlay fires (non-modal, non-blocking),
**And** an extended celebration haptic plays on the controller,
**And** the LED cycles through a rainbow pattern,
**And** the achievement is recorded in `ExtensionContext.globalState`.

**Given** an achievement has already been unlocked,
**When** the same trigger condition fires again,
**Then** the celebration does not repeat (idempotent unlock).

**Given** the `AchievementBurst` overlay fires,
**When** it plays,
**Then** it auto-dismisses after the animation completes (fades out),
**And** the user can continue interacting with the editor during the animation.

**Requirements:** FR54; UX-DR8 (AchievementBurst)

---

### Story 9.6: Session Quicksave & Resume

As a multi-agent power developer,
I want to quicksave my current session state (open terminals, active agent sessions, radial wheel segment configuration) via a controller input and restore it on the next VSCode launch,
So that I never have to rebuild my working context from scratch after closing VSCode.

**Depends on:** Epic 3 complete (sessions exist to save); Epic 7 complete (radial wheel config exists to save)
**Can run in parallel with:** Story 9.5 (if both 9.5 and 9.6 unblocked simultaneously)

**Acceptance Criteria:**

**Given** multiple terminal sessions and a configured radial wheel are active,
**When** the user triggers quicksave via the designated controller input,
**Then** the current session state is saved to `ExtensionContext.globalState` including: open terminal names, agent session IDs, and R2 Personal wheel segment configuration.

**Given** a quicksave exists,
**When** VSCode launches and VibeSense activates,
**Then** a non-blocking notification appears: "Resume previous session? [Yes] [Dismiss]",
**And** selecting "Yes" restores the saved terminals and radial wheel configuration.

**Requirements:** FR58

---

## Epic 10: Streaming & Creator Mode

Jordan can stream VibeSense vibe coding content on Twitch/YouTube using an OBS-compositable CINEMA overlay showing live controller inputs, button maps, and radial wheel interactions.

> **Parallel tracks:** After Story 10.1 is merged, Stories 10.2 and 10.3 can run in parallel. Note: Story 10.3 also depends on Epic 7 (radial wheel) being complete.

### Story 10.1: Streaming Overlay Base (CINEMA Mode Frame)

As a streaming vibe coder (Jordan),
I want to enable a Streaming Mode that activates a CINEMA-style OBS-compositable overlay showing my active button map, session state, and a game band over the editor,
So that my Twitch/YouTube audience can see what I'm doing with the controller without needing to explain it.

**Depends on:** Epic 3 complete (sessions), Epic 2 complete (ControllerIcon, VOID tokens)
**Can run in parallel with:** Nothing in Epic 10 — base for 10.2 and 10.3.

**Acceptance Criteria:**

**Given** the user triggers `VibeSense: Enable Streaming Mode`,
**When** Streaming Mode activates,
**Then** the CINEMA game band overlay renders over the editor at a compositable position,
**And** the overlay is capturable by OBS/screen capture tools without additional plugins.

**Given** Streaming Mode is active,
**When** the session state changes,
**Then** the overlay updates in real-time to reflect the new state (agent processing, needs input, etc.).

**Given** Streaming Mode is disabled,
**When** the toggle fires,
**Then** the overlay is removed and the default SLIDE panel layout resumes.

**Requirements:** FR47, FR48; UX-DR12

---

### Story 10.2: Live Button-Press Animations

As a streaming vibe coder,
I want the streaming overlay to show real-time button-press animations as I interact with the controller,
So that my audience has instant visual feedback of every controller action and can follow along without narration.

**Depends on:** Story 10.1 (overlay frame must exist)
**Can run in parallel with:** Story 10.3

**Acceptance Criteria:**

**Given** Streaming Mode is active and the user presses Cross/A,
**When** the button-press event fires,
**Then** the Cross glyph in the overlay briefly scales up with a glow effect and fades back within 300ms.

**Given** multiple buttons are pressed in rapid succession,
**When** the animation system fires,
**Then** each press animates independently without cancelling prior animations.

**Requirements:** FR49; UX-DR12 (button-map-visible state)

---

### Story 10.3: Radial Wheel Animation in Streaming Overlay

As a streaming vibe coder,
I want the radial wheel interaction to be visible in the streaming overlay with animated segment selection and dispatch feedback,
So that my audience can see the signature VibeSense interaction — the defining moment that gets clipped and shared.

**Depends on:** Story 10.1 (overlay frame); Epic 7 complete (radial wheel logic must exist to mirror)
**Can run in parallel with:** Story 10.2

**Acceptance Criteria:**

**Given** Streaming Mode is active and L2 or R2 is held,
**When** the radial wheel opens,
**Then** a mirrored visual representation of the radial wheel appears in the streaming overlay.

**Given** the user selects a segment and dispatches,
**When** the dispatch fires,
**Then** the overlay shows a visual confirmation (segment highlight + collapse animation) in the streaming layer.

**Requirements:** FR47, FR49; UX-DR12 (wheel-visible state)

---

## Epic 11: Telemetry & Public Analytics

Team can measure VibeSense adoption via opt-in anonymous telemetry, and any user can view aggregated public usage statistics on vibesense.dev.

> **Parallel tracks:** Stories 11.1 and 11.2 run **sequentially** — Story 11.2 starts after Story 11.1 is merged (the Settings UI must wire into an existing telemetry module to be meaningful). Story 11.3 starts after both are merged.

### Story 11.1: Opt-In Telemetry Collection Module

As the VibeSense team,
I want an isolated `src/extension/telemetry/telemetry.ts` module that collects aggregate-only, non-PII usage signals when the user has explicitly opted in,
So that we can measure product adoption and feature usage while maintaining full user trust.

**Depends on:** Epic 9 complete (stats tracking exists as the data foundation)
**Can run in parallel with:** Story 11.2

**Acceptance Criteria:**

**Given** a user has opted in to telemetry,
**When** a session ends,
**Then** the telemetry module batches and sends: Controller-Only Session Completion Rate (boolean), controller action ratio (aggregate %), feature usage signals (which features were active), session duration (count), agent interaction count (count), controller type, platform,
**And** no keystrokes, terminal content, file names, project names, or PII are ever included.

**Given** the telemetry module sends a payload,
**When** VSCode Developer Tools are open,
**Then** the exact JSON payload being transmitted is loggable locally,
**And** it uses HTTPS with TLS 1.2+.

**Given** the telemetry module is the only module that calls telemetry APIs,
**When** any other module is reviewed,
**Then** no imports from `src/extension/telemetry/` exist outside of the activation entry point,
**And** this is enforced by an ESLint rule.

**Requirements:** FR44, FR46; NFR-S2, NFR-S3, NFR-S4; Architecture — Telemetry Isolation

---

### Story 11.2: Telemetry Consent Management UI

As a VibeSense user,
I want to see a clear opt-in prompt during onboarding and be able to change my telemetry preference at any time via VSCode Settings,
So that I have full transparency and control over what data is collected.

**Depends on:** Story 11.1 (telemetry module must exist and be wired up before consent UI is meaningful)
**Can run in parallel with:** Nothing in Epic 11 — starts after Story 11.1 merges

**Acceptance Criteria:**

**Given** VibeSense is installed for the first time and the onboarding tutorial completes,
**When** the consent prompt appears,
**Then** it clearly states what is collected and what is NOT collected, with [Enable anonymous analytics] and [No thanks] options,
**And** telemetry remains OFF until the user explicitly selects [Enable].

**Given** the user has previously opted in,
**When** they open VSCode Settings and search for "vibesense telemetry",
**Then** they can toggle telemetry off at any time,
**And** the change takes effect immediately for subsequent sessions.

**Requirements:** FR44, FR45; NFR-S4

---

### Story 11.3: Telemetry Transmission & Public Stats Page *(Phase: Post-MVP — activates when vibesense.dev backend is deployed)*

As the VibeSense team,
I want telemetry payloads transmitted to the `vibesense.dev` backend (Note: telemetry backend is deferred to post-MVP — this story implements the transmission client and the public stats page once the backend exists),
So that aggregated community usage statistics are publicly visible and reinforce the open, trustworthy telemetry commitment.

**Depends on:** Stories 11.1, 11.2 (telemetry must be collected and consented before transmitting)
**Can run in parallel with:** Nothing in Epic 11 — final story.

**Acceptance Criteria:**

**Given** the telemetry backend is deployed at `vibesense.dev`,
**When** a batched telemetry payload is ready to transmit,
**Then** it is sent via HTTPS POST with TLS 1.2+,
**And** transmission failures are retried with exponential backoff and never crash the extension.

**Given** `vibesense.dev/stats` is live,
**When** any user visits it,
**Then** it shows aggregated anonymous statistics from opted-in users (DAU trends, feature adoption, controller type breakdown),
**And** no individual user data is identifiable.

**Note:** At MVP, this story is a stub — telemetry is collected locally only (Story 11.1). This story activates the transmission layer when the vibesense.dev backend is ready.

**Requirements:** FR44, FR46, FR55; NFR-S2

