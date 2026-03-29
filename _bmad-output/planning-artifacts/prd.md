---
stepsCompleted: [step-01-init, step-02-discovery, step-02b-vision, step-02c-executive-summary, step-03-success, step-04-journeys, step-05-domain, step-06-innovation, step-07-project-type, step-08-scoping, step-09-functional, step-10-nonfunctional, step-11-polish, step-12-complete]
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-vibesense-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/domain-vibesense-agentic-coding-developer-tooling-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/market-VibeSense-VSCode-gaming-controller-research-2026-03-05.md'
  - '_bmad-output/planning-artifacts/research/technical-vibesense-full-stack-research-2026-03-07.md'
briefCount: 1
researchCount: 3
brainstormingCount: 0
projectDocsCount: 0
classification:
  projectType: developer_tool
  domain: developer_productivity
  complexity: medium
  projectContext: greenfield
workflowType: 'prd'
---

# Product Requirements Document - vibesense

**Author:** Leo
**Date:** 2026-03-29

## Executive Summary

VibeSense is a VSCode extension that replaces the keyboard as the primary input device for agentic AI coding ("vibe coding"). As AI agents handle implementation, developers spend their time approving decisions, dispatching prompts, scrolling output, and waiting — a workflow that uses 8–10 distinct interactions instead of hundreds of keys. VibeSense maps those interactions to a gaming controller held in a natural two-handed grip, enabling a relaxed posture away from the desk while keeping the developer in the loop. When the agent is processing, the controller transitions to retro mini-games that pause automatically when attention is needed — transforming idle wait time from passive distraction into active play. The result is a complete experience where the interaction model, the hardware, and the wait-time loop all cohere into something that feels like how this should have always worked.

VibeSense targets developers who already vibe code and already own a controller. No new hardware is required. The VSCode Marketplace install is the only friction point.

### What Makes This Special

VibeSense's central claim is not that a controller is a *usable* input device for coding — it's that a controller is the *correct* input device for vibe coding. This is the iPhone analogy made concrete: the iPhone didn't offer a worse keyboard experience, it eliminated the keyboard entirely because touch was a better fit for the new interaction model. VibeSense makes the same argument for agentic coding. The keyboard was designed for continuous, dense typing across hundreds of keys. Vibe coding is not that workflow. A controller — purpose-built for a small set of intentional inputs, held with two hands, operated from any position — matches the actual interaction set with zero waste.

The timing is not accidental. Three things converged to make this buildable now: (1) agentic coding workflows are mainstream — Claude Code, GitHub Copilot Agent, and Cursor are daily-use tools for millions of developers; (2) Claude Code's native voice mode (shipped March 2026) eliminates the last keyboard dependency, with the controller button becoming the hardware push-to-talk trigger; (3) modern gaming controllers (DualSense haptics, built-in mic, LED) have reached the hardware capability floor required for a full developer peripheral experience. The window to build this opened recently. No one has built it yet.

The click moment is the full gestalt — controller ergonomics, haptic agent-state feedback, and idle mini-games combining into a session where a developer realizes they haven't touched the keyboard in two hours and didn't notice. That's the moment VibeSense is designed to create.

## Project Classification

- **Project Type:** Developer Tool (VSCode Extension)
- **Domain:** Developer Productivity
- **Complexity:** Medium — standard software domain (no regulatory burden), technically complex implementation (native HID binaries, cross-platform VSIX, Claude Code hooks integration)
- **Project Context:** Greenfield

## Success Criteria

### User Success

The north star metric is **Controller-Only Session Completion Rate** — the percentage of vibe coding sessions where the user completes the full session without touching the keyboard. When this metric is high and consistent, VibeSense has delivered on every dimension: ergonomics, input coverage, idle time transformation, and muscle memory formation.

Supporting user success metrics:
- **Session Return Rate:** % of users who return for a second session within 7 days.
- **Feature Depth Adoption:** % of active users engaging with 3+ core features (e.g., radial wheel + session switching + mini-game).
- **Idle Game Engagement Rate:** % of sessions where the mini-game triggers during AI processing.
- **Onboarding Completion Rate:** % of installs that complete the 60-second tutorial and reach their first controller-only session.
- **Controller Action Ratio:** % of all actions (keypresses, terminal inputs, VSCode commands) taken via controller vs. keyboard, tracked locally per user. Displayed as a trend over time in the stats dashboard — the in-product mirror of the north star metric.

### Business Success

**Year 1 Priority: Adoption over revenue.** VibeSense launches free. Revenue follows adoption.

**3-Month Targets (Post-Launch):**

| Metric | Target | Rationale |
|--------|--------|-----------|
| Daily Active Users (DAU) | 500+ | Signal of genuine daily habit formation |
| GitHub Stars | 500+ | Developer credibility and organic discovery |
| Total Marketplace Revenue | $1,000 | Validates willingness-to-pay before scaling |

**12-Month Targets:**

| Metric | Target |
|--------|--------|
| VSCode Marketplace Installs | 10,000+ |
| 30-Day Retention Rate | >30% (2× developer tool average) |
| DAU/MAU Ratio | >20% (genuine daily habit signal) |
| Community Discord Members | 500+ active |
| Marketplace Content Items | 25+ community-published |

Primary growth engine: word-of-mouth from streamers and viral content clips.

### Technical Success

Technical success is non-negotiable. The extension must never degrade the core IDE experience.

- **Input latency:** <16ms for the VibeSense-controlled input processing pipeline (controller input → VSCode action dispatched). VSCode terminal rendering adds ~5–10ms of platform-owned overhead beyond this — total end-to-end typically 16–26ms, within 2 frames at 60FPS.
- **Stability:** Zero-crash policy. Any crash of the extension host is a P0 blocker. Extension failures must never crash or hang VSCode.
- **Graceful degradation:** On controller disconnect, keyboard fallback activates immediately with no error state or UX disruption. A persistent status bar indicator at the bottom of VSCode shows controller connection state at all times.
- **Controller compatibility:** DualSense (PS5) and Xbox Series controllers supported at launch. Any HID-compatible controller functions with basic button mapping.
- **Platform support:** macOS at MVP; Linux (including WSL2) at Phase 1.5 (pre-Marketplace); Windows in Growth tier.

### Measurable Outcomes

- Leo completes 5+ controller-only vibe coding sessions successfully before Marketplace publish
- All core features stable and tested across DualSense and Xbox on Mac + Linux
- Controller-only session completion achievable across all three target personas
- Onboarding tutorial validated with at least one person unfamiliar with the extension

## Product Scope

### MVP — Minimum Viable Product

**Platform:** macOS (arm64 + x64). Linux/WSL2 added pre-Marketplace (Phase 1.5). Windows in Growth tier.
**Connection types:** Wired USB, 2.4GHz dongle (USB HID), Bluetooth.

- Controller auto-detection — any HID-compatible device, zero configuration
- Button-to-key mapping with vibe-coding-optimized defaults
- Open new VSCode terminal from controller
- Launch Claude Code / GitHub Copilot Chat from controller
- Voice-to-terminal via controller button as hardware push-to-talk trigger
- Analog stick terminal scrollback (variable speed)
- L1/R1 fast-switch between open terminal and agent sessions
- Multi-session quick panel
- Per-project binding profiles (`.vscode/vibesense.json`)
- Persistent status bar indicator — controller connection state always visible; graceful keyboard fallback on disconnect
- Low battery warning
- Input buffering during state transitions (200–300ms)
- Interactive 60-second onboarding tutorial
- Platform permission detection + guided inline remediation (macOS Input Monitoring, Linux udev rules)

**MVP gate:** Leo completes a full vibe coding session without touching the keyboard.

### Growth Features (Post-MVP)

- **Prompt Radial Wheel** — 8-segment, context-aware, L2-triggered
- **Agent Feedback Layer** — haptic patterns, LED color, audio tones tied to agent state
- **Agent Feedback API** (`vibeSense.notify()`) + bundled Claude Code skill
- **Floating HUD overlay** with context-sensitive button map
- **Streaming / Content Creator Mode** overlay
- **Idle mini-game system** (Snake, Tetris) with auto-pause/resume on agent state
- **Gamified stats dashboard** — XP, levels, streaks, achievement system (Bronze/Silver/Gold/Platinum), controller action ratio and trend charts, Controller-Only Session Completion Rate displayed per user
- **Windows platform support**
- **Cloud profile sync** via VSCode Settings Sync

### Vision (Future)

- Community marketplace platform with creator program and revenue sharing
- Expanded editor support (JetBrains, Neovim)
- Hardware partnership discussions with controller manufacturers
- Standalone VibeSense desktop app (editor-agnostic)
- Mobile companion app for session monitoring and achievement tracking
- Enterprise licensing for parallel AI agent teams
- Open plugin API for community-built mini-games and HUD themes

## User Journeys

### Journey 1: Alex — The Gamer-Developer (Primary Happy Path)

**Opening Scene:** It's 9pm. Alex is at their desk, MacBook open, DualSense resting on the couch cushion next to them. They've got a Claude Code session queued up to refactor an auth module — probably 90 minutes of work. The keyboard is within reach but Alex hasn't needed it in weeks for sessions like this.

**Rising Action:** Alex picks up the controller. The status bar flashes `⊙ DualSense connected` — green, bottom-left. They hit L1 to open the multi-session panel, select the Claude Code terminal, and press Circle to dispatch the refactor prompt they pre-loaded into the radial wheel slot. Agent starts processing. Alex leans back, flicks the left stick to scroll the output, and when it settles into a long processing run, the mini-game kicks in automatically — Snake, where they left off. No phone picked up. No Twitter tab opened.

**Climax:** 8 minutes later, the DualSense pulses twice — the "needs review" haptic pattern. Mini-game pauses. Alex glances at the terminal, reads the diff, hits X to approve. Agent resumes. Alex goes back to Snake. This loop runs four more times in the next hour.

**Resolution:** Session ends. Alex never touched the keyboard. The stats bar in the sidebar shows 97% controller action ratio for the session — up from 81% last week. They close the laptop and feel genuinely rested rather than screen-drained.

**Requirements revealed:** Controller auto-detection, status bar indicator, multi-session panel, radial wheel, agent state haptic feedback, mini-game auto-pause/resume, controller action ratio tracking.

---

### Journey 2: Jordan — The Coding Streamer (Secondary Happy Path)

**Opening Scene:** Jordan goes live on Twitch at 7pm for their weekly vibe coding stream. 400 viewers. Their setup is visible on camera — DualSense in hand, VSCode filling the monitor. The VibeSense HUD overlay is live in OBS: a clean dark panel showing the current button map, a mini controller silhouette with pressed buttons lighting up in real time.

**Rising Action:** Jordan dispatches a Claude Code task using the radial wheel — the on-screen wheel animation spins, segment selected, prompt fires. Chat immediately reacts: "what's that wheel thing??" Jordan narrates while the agent processes, plays a round of Tetris on-stream, explains VibeSense in two sentences. Agent completes. Jordan approves with a face button press — the HUD shows the button press with a satisfying visual flash.

**Climax:** Mid-stream, Jordan hits a complex prompt they hadn't pre-loaded. They hold the controller mic button and speak it directly into Claude Code's voice mode — the HUD shows a live mic indicator. The command goes through. Chat explodes. Someone clips it.

**Resolution:** The clip of the radial wheel dispatch gets shared on X. Three new GitHub stars appear overnight. Two comments ask "what extension is that?" — organic discovery engine working as designed.

**Requirements revealed:** Streaming Mode overlay (OBS-compatible), HUD with live button-press visualization, radial wheel on-screen animation, mic button PTT indicator in HUD, controller-native voice input.

---

### Journey 3: Sam — The Multi-Agent Power Developer (Secondary Happy Path)

**Opening Scene:** Sam has four terminals open: Claude Code on a backend refactor, Copilot on tests, a third agent drafting docs, a fourth monitoring the CI run. It's Tuesday afternoon and Sam is running at full parallel capacity. The keyboard sits unused — Sam's hands are on the Xbox controller.

**Rising Action:** R1 flicks between agent terminals. Each has a different LED color on the controller: blue for processing, amber for needs-attention, green for complete. Sam doesn't need to watch all four windows — the controller tells them which session is live. L2 opens the radial wheel to dispatch a follow-up prompt to the docs agent without switching focus.

**Climax:** Two agents complete simultaneously. The controller vibrates in a distinct double-pulse pattern. Sam reviews both, approves with X, dispatches next tasks in under 10 seconds — no keyboard, no mouse, no alt-tab.

**Resolution:** Sam wraps four parallel workstreams in two hours. The stats dashboard shows the session: 4 agents managed, 23 approvals dispatched, 0 keyboard touches. Sam screenshots it and posts it to the Discord.

**Requirements revealed:** Multi-session LED color coding per agent state, distinct haptic patterns per event type, L1/R1 session switching, multi-session quick panel, parallel agent state monitoring.

---

### Journey 4: Alex — First Install & Setup (Configuration Journey)

**Opening Scene:** Alex saw a VibeSense clip on Reddit. Installs from the VSCode Marketplace in 30 seconds. First launch.

**Rising Action:** VibeSense auto-detects the DualSense. A welcome panel opens: "Controller found: DualSense. Start the 60-second setup?" Alex steps through the tutorial — each face button lights up on the on-screen controller diagram as Alex presses it, confirming the binding. Defaults are pre-loaded for Claude Code (X = approve, Circle = deny, L2 = radial wheel). Alex tweaks two bindings to match their muscle memory.

The setup creates `.vscode/vibesense.json` in the current project. Alex glances at the file, sees it's plain JSON, and understands immediately: this commits with the project. Settings sync to GitHub via VSCode's existing Settings Sync — no extra config needed. If Alex opens this repo on another machine, the bindings are there.

**Climax:** Tutorial ends. Alex fires up a Claude Code session immediately. Presses X for the first approval. It works. That's the moment.

**Resolution:** Alex's bindings are saved locally and synced. They never visit the setup panel again — unless they want to customize further. No account required, no cloud dependency, no friction beyond the initial 60 seconds.

**Requirements revealed:** Controller auto-detection on first launch, interactive 60-second onboarding tutorial, default binding profiles for Claude Code + Copilot, `.vscode/vibesense.json` per-project profile, VSCode Settings Sync compatibility, settings UI for manual binding customization.

---

### Journey 5: Developer — API Integration (`vibeSense.notify()`)

**Opening Scene:** A developer has built a custom Claude Code skill that runs a long deployment pipeline. They want VibeSense to fire a specific haptic pattern — three short pulses — when the deployment succeeds, and a slow warning rumble if it fails. They find the `vibeSense.notify()` API docs in the README.

**Rising Action:** They call `vibeSense.notify({ event: 'deploy_success', haptic: 'triple_pulse', led: { color: '#00ff00' } })` from their Claude Code skill. VibeSense receives the IPC call from the skill, validates the payload, fires the haptic and LED output to the DualSense. They test the failure path too — slow warning rumble, red LED.

**Climax:** The custom notification fires during a real deployment. The developer feels three pulses and looks up — green LED. Deployed. They never opened the terminal to check.

**Resolution:** They publish the skill to their team's Claude Code config. The `vibeSense.notify()` call becomes the ambient feedback layer for any custom agentic workflow, not just the built-in ones.

**Requirements revealed:** `vibeSense.notify()` public API with typed event schema, IPC bridge from Claude Code skill context to extension host, haptic and LED output parameterized by API call, bundled example skill, API documentation.

---

### Journey 6: Alex — Failure Recovery (Edge Cases)

**Scenario A — Controller Battery Dies Mid-Session:**
The DualSense hits 5% battery during a session. The status bar changes to `⚠ DualSense: low battery`. Alex ignores it. Battery hits 0 — controller disconnects. VibeSense catches the disconnect event immediately: status bar updates to `○ No controller — keyboard active`, the mini-game pauses, and the active terminal stays focused. Alex continues the session from the keyboard without losing context. No crash, no error dialog, no lost work. When Alex plugs in the controller, VibeSense reconnects automatically and the status bar returns to green.

**Requirements revealed:** Low battery threshold warning, disconnect detection, immediate graceful keyboard fallback, auto-reconnect on controller re-plug, persistent status bar state.

**Scenario B — Controller Not Detected on First Launch:**
Alex installs VibeSense on a Linux machine. The DualSense is connected via Bluetooth but doesn't auto-detect. The status bar shows `○ No controller detected`. A notification appears: "Controller not found. Check connection or select device manually." Alex clicks it — a dropdown appears with available HID devices. Alex selects the DualSense manually. VibeSense confirms with a brief haptic pulse.

**Requirements revealed:** Manual HID device selection fallback, Bluetooth detection path, actionable "not detected" notification with recovery path, confirmation haptic on successful connection.

**Scenario C — Voice Mode Fails:**
Alex presses the controller mic button to dispatch a voice prompt. Claude Code's voice mode isn't active or the mic permission hasn't been granted. VibeSense detects no PTT response. A status bar message shows: "Voice input unavailable — use radial wheel or keyboard." The radial wheel opens as an automatic fallback for prompt dispatch. Alex selects from pre-loaded prompts instead. Session continues without interruption.

**Requirements revealed:** Voice mode availability detection, graceful fallback to radial wheel when voice unavailable, non-blocking failure messaging via status bar (no modal dialogs).

---

### Journey Requirements Summary

| Capability Area | Revealed By |
|-----------------|-------------|
| Controller auto-detection + manual fallback | Journey 4, 6B |
| Persistent status bar (connect state, battery, voice) | Journey 1, 6A, 6C |
| Onboarding tutorial + default binding profiles | Journey 4 |
| Per-project binding profiles + Settings Sync | Journey 4 |
| Radial wheel (input + on-screen animation) | Journey 1, 2, 6C |
| Agent state haptic patterns (per-event, distinct) | Journey 1, 3, 6A |
| LED color coding per agent/session state | Journey 3 |
| Mini-game auto-pause/resume on agent state | Journey 1, 6A |
| Multi-session panel + L1/R1 switching | Journey 1, 3 |
| Controller action ratio + stats dashboard | Journey 1 |
| Streaming Mode HUD overlay | Journey 2 |
| Voice PTT via controller button | Journey 2, 6C |
| `vibeSense.notify()` API + IPC bridge | Journey 5 |
| Graceful keyboard fallback on disconnect | Journey 6A |
| Auto-reconnect on controller re-plug | Journey 6A |

## Domain-Specific Requirements

### Privacy & Telemetry

VibeSense collects opt-in anonymous usage analytics to support KPI measurement. Telemetry is **disabled by default** and requires explicit user opt-in during onboarding and adjustable at any time via VSCode settings.

**Data collected (when opted in):**
- Controller-Only Session Completion Rate (boolean: session completed without keyboard touch)
- Controller action ratio per session (aggregate %, not individual keystrokes)
- Feature usage signals (which features were active: radial wheel, mini-game, multi-session panel, etc.)
- Session duration and agent interaction count (counts only, no content)
- Controller type (DualSense / Xbox / HID-generic)
- Platform (Mac / Linux / Windows)

**Data never collected:**
- Keystrokes, terminal content, prompts, or any code
- File names, project names, or workspace identifiers
- Any personally identifiable information

**Transparency commitments:**
- Full source code open on GitHub — all telemetry signals are auditable by anyone
- Aggregated anonymous usage statistics published publicly on `vibesense.dev`
- Explicit changelog entry for any change to collected signals
- Telemetry implementation isolated in a single auditable module

### VSCode Marketplace Compliance

VibeSense accesses native HID devices and makes outbound network calls (telemetry endpoint). Both require declaration in `package.json` and README per Microsoft's extension guidelines:
- `activationEvents` must not trigger on all VSCode starts — activate only when a HID device is detected or a terminal is opened
- Network access must be disclosed in the extension's Marketplace listing description
- The extension must pass the Marketplace security scan — no bundled executables beyond prebuilt `node-hid` native binaries via `prebuild-install`

### Platform Permission Requirements

**macOS — Input Monitoring Permission:**
VibeSense requires "Input Monitoring" access (System Settings → Privacy & Security → Input Monitoring) to read HID input from the controller. On first launch, if the permission is not granted:
- VibeSense detects the missing permission via a failed HID read
- Displays a non-blocking notification: "Controller input requires Input Monitoring permission. [Open Settings]"
- The notification links directly to the relevant macOS System Settings pane
- Documented in install guide with screenshots

**Linux — udev Rules:**
HID device access without root requires a udev rule. VibeSense cannot write this automatically. On first launch, if HID access fails:
- VibeSense detects the permission error
- Displays a notification with a copy-paste terminal command:
  ```
  echo 'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="054c", MODE="0666"' | sudo tee /etc/udev/rules.d/99-vibesense.rules && sudo udevadm control --reload-rules
  ```
- Prompts user to reconnect controller after applying the rule
- Documented in install guide for all supported Linux distributions and WSL2

**Windows (Growth tier):**
Xbox controllers use XInput and are typically plug-and-play. DualSense over USB uses standard HID. No special permissions required beyond standard driver installation. Documented in install guide.

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Telemetry erodes user trust | Opt-in default, open source signals, public aggregated stats page — trust through transparency |
| HID permission friction causes install abandonment | Detect failures immediately, surface copy-paste fixes inline, never require re-install |
| Marketplace rejection due to native binary bundling | Use `prebuild-install` pattern (established, accepted by Marketplace); document in CONTRIBUTING.md |
| Telemetry endpoint becomes a data liability | Collect counts and ratios only — no content, no PII, no reversible identifiers |

## Innovation & Novel Patterns

### Detected Innovation Areas

**Innovation 1 — New Input Paradigm for a New Developer Workflow**

VibeSense challenges a foundational assumption of developer tooling: that the keyboard is the correct input device for writing software. This assumption was valid when software development meant continuous dense typing. Agentic AI coding ("vibe coding") has created a qualitatively different workflow — approve, dispatch, scroll, wait — that uses 8–10 distinct interactions instead of hundreds of keys. VibeSense's core innovation is identifying that this new workflow has a different optimal input device, and building it.

This is paradigm-level innovation, not feature innovation. The product doesn't make keyboard coding better — it argues the keyboard is the wrong tool for this workflow and provides the replacement.

**Innovation 2 — Idle Time Reclamation as Product Feature**

No existing developer tool has treated AI processing wait time as a product surface. VibeSense turns minutes of dead agent processing time into active gameplay — not as a gimmick, but as a coherent product experience made possible by the controller already being in the developer's hands. The innovation is recognizing that the controller in hand for input naturally enables gaming during idle time, creating a complete session loop that no keyboard-based tool can replicate.

**Innovation 3 — Ambient Physical Feedback for Agent State**

Haptic patterns, LED color coding, and audio tones as the primary notification channel for AI agent state is a novel UX pattern for developer tools — borrowed from IoT ambient indicators and gaming hardware, applied for the first time to the agentic coding context. The insight is that physical feedback bypasses the attention split problem entirely: developers don't need to watch the screen to know the agent's state.

**Innovation 4 — Hardware-as-Moat in a Software Category**

Most VSCode extensions have zero hardware dependency and are trivially replicable. VibeSense's deep integration with DualSense haptics, LED, mic, and adaptive triggers creates hardware-specific behavior that cannot be absorbed by a purely software competitor. Combined with controller-type-specific optimizations and an eventual hardware partnership path, this is a defensible moat in a category (VSCode extensions) that normally has none.

### Market Context & Competitive Landscape

Research confirms VibeSense enters a **genuine white-space category**:
- Exhaustive VSCode Marketplace search: zero controller extensions for developer workflows
- Adjacent tools (JoyToKey, reWASD, Steam Input) are gaming-context remappers with no VSCode or agentic AI awareness
- No AI coding tool (Claude Code, Copilot, Cursor) has pursued hardware peripheral integration
- The category does not exist yet — VibeSense creates it

Three market forces converged to make this the right moment:
1. Agentic coding is mainstream (92% of US developers use AI tools daily; 15–22% of GitHub projects using coding agents)
2. Claude Code native voice mode (March 2026) eliminated the last keyboard dependency for the vibe coding loop
3. DualSense hardware capabilities (haptics, mic, LED, adaptive triggers) reached the threshold for a genuine developer peripheral experience

The TAM at the intersection of VSCode users (75.9% of developers), agentic coding adopters, and developer-gamers is estimated at 7–10M potential users.

### Validation Approach

**MVP validation (before Marketplace publish):**
- Leo completes 5+ controller-only sessions — validates the core thesis on real hardware
- Measures controller action ratio trending toward 100% — quantitative signal of the paradigm shift working
- Tests on DualSense and Xbox across Mac and Linux — validates cross-platform and cross-controller viability

**Market validation (post-Marketplace launch):**
- Controller-Only Session Completion Rate as north star — if users achieve and sustain keyboard-free sessions, the paradigm argument is proven in the market
- Streaming clip virality — if streamers generate organic content, the visual innovation signal is landing
- 7-day return rate — if users return within a week, the interaction model change is sticking
- Feature depth adoption (3+ features) — validates that the gestalt experience (not just one feature) is the retention driver

**Paradigm validation signal:**
The definitive validation moment is when a developer publicly states "I don't understand how I vibe coded without this" — the same post-hoc rationalization that iPhone users expressed about the on-screen keyboard. That quote, organically appearing in reviews or social posts, is the signal that the paradigm shift has landed.

### Risk Mitigation

| Innovation Risk | Likelihood | Mitigation |
|-----------------|------------|------------|
| "Controller for coding" perceived as a gimmick | Medium | Lead with the ergonomic thesis (correct tool for new workflow), not gaming identity; gimmick perception fades after first session |
| Hardware compatibility fragmentation slows adoption | Medium | DualSense + Xbox covers ~80% of target users at launch; HAL abstraction enables expansion without rework |
| Agentic coding paradigm shifts again (less waiting) | Low | Core input ergonomics argument holds regardless of wait time; radial wheel + multi-session management remain valuable even if agents get faster |
| First-mover advantage eroded by a well-resourced competitor | Low | Community marketplace flywheel, hardware-specific depth, and open source trust moat take 12–18 months to replicate; speed to market is the defense |
| Voice mode improvement makes controller PTT redundant | Low | Controller PTT is one feature; the full gestalt (ergonomics + haptics + mini-games + session management) has no voice equivalent |

## Developer Tool Specific Requirements

### Project-Type Overview

VibeSense is a VSCode extension — a developer tool that is itself embedded inside the primary IDE it targets. This creates a unique dynamic: the product's "integration" is the VSCode Extension API itself, and the distribution channel (VSCode Marketplace) is the same platform the product lives in. The extension runs in the Node.js extension host process, with a separate Webview context for any UI panels.

### Technical Architecture Considerations

**Runtime Environment:**
- Extension host: Node.js (version pinned to VSCode's bundled Electron — Node.js 20.x LTS as of VSCode 1.87+)
- Webview panels (settings UI, stats dashboard): sandboxed browser context (React + TypeScript)
- Native HID layer: `node-hid` with `prebuild-install` for prebuilt platform binaries
- Build: dual-target webpack or esbuild (separate bundles for extension host and Webview)

**Platform-Specific VSIX Packaging:**
The most critical distribution decision. `node-hid` ships native `.node` binaries per platform. VibeSense must publish platform-specific VSIX packages (Mac arm64, Mac x64, Linux x64, Windows x64) so users get the correct prebuilt binary on Marketplace install — no local compilation required. The `vsce publish --target` flag supports this pattern.

### Language Matrix

| Context | Language | Notes |
|---------|----------|-------|
| Extension host | TypeScript | Primary language; all HID, terminal, and VSCode API logic |
| Webview UI | TypeScript + React | Settings panel, stats dashboard, onboarding tutorial |
| Build tooling | JavaScript (webpack/esbuild config) | Dual-target build pipeline |
| Claude Code skills | Shell / any | `vibeSense.notify()` called from skills via IPC; language-agnostic |
| Binding profiles | JSON | `.vscode/vibesense.json` schema; human-readable and git-committable |

### Installation Methods

**Primary — VSCode Marketplace:**
Single-click install from Marketplace. Platform-specific VSIX ensures correct native binary. No post-install steps on Windows. macOS and Linux require one-time permission setup (detected and prompted inline by the extension).

**Secondary — GitHub Releases (`.vsix` direct download):**
Pre-release and beta builds distributed as `.vsix` files on GitHub Releases. Installed via `Extensions: Install from VSIX...` command in VSCode. Used for testing before Marketplace publish and for users on air-gapped machines.

**Platform Setup (post-install, one-time):**
- macOS: Input Monitoring permission — extension detects and links to System Settings
- Linux: udev rules — extension detects and surfaces copy-paste terminal command
- WSL2: Same udev rules as Linux; controller passed through via USB/IP or native WSL2 USB support
- Windows (Growth): Plug-and-play for Xbox; DualSense standard HID — no extra steps

### API Surface

**`vibeSense.notify()` — Public Extension API:**

Called from Claude Code skills, custom scripts, or any process that can send an IPC message to the extension host.

```typescript
vibeSense.notify({
  event: string,           // Named event identifier (e.g. 'deploy_success')
  haptic?: HapticPattern,  // 'single_pulse' | 'double_pulse' | 'triple_pulse' | 'slow_rumble' | 'none'
  led?: { color: string }, // Hex color string (DualSense only)
  audio?: AudioTone,       // 'success' | 'warning' | 'error' | 'none'
  priority?: 'low' | 'normal' | 'high' // Respects Do Not Disturb suppression
})
```

**VSCode Commands (controller-triggerable):**

VibeSense registers named VSCode commands that can be bound to controller buttons or triggered via `vscode.commands.executeCommand`:
- `vibesense.openSessionPanel` — open multi-session quick panel
- `vibesense.openRadialWheel` — open prompt radial wheel
- `vibesense.switchSessionNext` / `vibesense.switchSessionPrev` — session navigation
- `vibesense.toggleMiniGame` — manually toggle idle mini-game
- `vibesense.openStats` — open controller action ratio stats panel

**`.vscode/vibesense.json` Schema:**

Per-project binding profile. Committed with the project. Synced via VSCode Settings Sync.

```json
{
  "profile": "claude-code-default",
  "bindings": {
    "cross": "vibesense.approve",
    "circle": "vibesense.deny",
    "l2": "vibesense.openRadialWheel",
    "l1": "vibesense.switchSessionPrev",
    "r1": "vibesense.switchSessionNext"
  },
  "radialWheel": {
    "segments": ["fix this", "explain this", "add tests", "commit", "..."]
  }
}
```

### Code Examples

**Bundled with the extension:**
1. Example Claude Code skill: `vibesense-notify.md` — demonstrates `vibeSense.notify()` for deployment feedback
2. Default binding profile: `claude-code-default.json` — optimized defaults for Claude Code workflows
3. Default binding profile: `copilot-default.json` — optimized defaults for GitHub Copilot Chat

### Documentation Requirements

| Doc | Location | Audience |
|-----|----------|----------|
| README + Marketplace listing | GitHub + VSCode Marketplace | New users, discovery |
| Install guide (per OS) | GitHub docs/ | All users — Mac, Linux, WSL2, Windows |
| Binding configuration guide | GitHub docs/ | Power users customizing profiles |
| `vibeSense.notify()` API reference | GitHub docs/ | Developers integrating the API |
| CONTRIBUTING.md | GitHub root | Contributors building from source (native binary notes) |
| In-extension onboarding tutorial | Extension Webview | First-time users (60-second interactive) |

### Implementation Considerations

- **No `vscode.window.showInputBox` for controller input** — all text input must route through voice PTT or radial wheel to maintain keyboard-free sessions
- **Extension activation** must be lazy — activate only on HID device detection or explicit user command, never on all VSCode starts (Marketplace policy + performance)
- **Webview UI Toolkit is deprecated** (January 2025) — use React + shadcn/ui for all Webview panels
- **`terminal.sendText` has no completion callback** — agent state detection must use output stream parsing or Claude Code hooks, not terminal send confirmation
- **`prebuild-install` fallback** — if prebuilt binary unavailable for a platform, `node-gyp` builds from source; document build tool prerequisites (Xcode CLT on Mac, `build-essential` on Linux)

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — the success gate is not "does the controller technically function?" but "does the controller *feel like the right tool* for vibe coding?" A technically functional but ergonomically awkward MVP fails the thesis. The experience must cohere from first session.

**Resource Requirements:** Solo developer (Leo) with Claude Code parallel agents for build acceleration. Scope is deliberately Mac-first to match the developer's own testing environment and reduce CI/CD surface area at MVP.

> The feature lists below expand on the `Product Scope` section with rationale and phase-specific context.

---

### MVP Feature Set (Phase 1 — Mac)

**Platform:** macOS (arm64 + x64). Single-platform VSIX at MVP. Linux/WSL2 added pre-Marketplace. Windows in Growth tier.

**Supported Connection Types:** Wired USB, 2.4GHz dongle (presents as USB HID — same code path as wired), Bluetooth. Dongle is the recommended connection method for lowest latency (1–4ms). Bluetooth supported but higher latency (8–20ms).

**Core User Journeys Supported:**
- Journey 1: Alex — Gamer-Developer happy path (full controller-only session)
- Journey 4: First install & setup (onboarding tutorial)
- Journey 6A/6B/6C: Failure recovery (battery, detection, voice fallback)

**Must-Have Capabilities:**

| Capability | Rationale |
|------------|-----------|
| Controller auto-detection (USB, dongle, Bluetooth) | Zero-friction entry; experience starts at plug-in |
| Button-to-key mapping with vibe-coding defaults | Core thesis; must work out of the box |
| Open VSCode terminal from controller | Keyboard-free session start |
| Launch Claude Code / Copilot Chat from controller | Full session lifecycle controller-native |
| Voice PTT via controller button (Claude Code + Copilot voice) | Eliminates last keyboard dependency |
| Analog stick terminal scrollback (variable speed) | Core navigation; no keyboard equivalent |
| L1/R1 session switching | Multi-terminal without keyboard |
| Multi-session quick panel | Session visibility and selection |
| Per-project binding profiles (`.vscode/vibesense.json`) | Commit-with-project; Settings Sync compatible |
| Persistent status bar (connect state, battery, voice) | Always-on ambient awareness |
| Low battery warning | Graceful session management |
| Input buffering 200–300ms | Prevents missed inputs during state transitions |
| Graceful disconnect → keyboard fallback → auto-reconnect | Stability non-negotiable |
| Interactive 60-second onboarding tutorial | Required to reach first controller-only session |
| macOS Input Monitoring permission detection + guided fix | Removes Mac-specific install friction |

**MVP Gate:** Leo completes 5+ controller-only vibe coding sessions on Mac without touching the keyboard.

---

### Post-MVP Phases

**Phase 1.5 — Linux/WSL2 (Pre-Marketplace, before public launch):**
- Linux x64 VSIX build added to CI
- udev rules detection + copy-paste prompt
- WSL2 USB passthrough validation (USB/IP) — covers both wired and dongle connections
- DualSense + Xbox confirmed on Linux

**Phase 2 — Growth (Post-Marketplace launch):**

| Feature | Value |
|---------|-------|
| Prompt Radial Wheel (8-segment, L2-triggered) | Signature UX interaction; viral content moment |
| Agent Feedback Layer (haptics / LED / audio) | Ambient awareness; closes the "is it done?" loop |
| `vibeSense.notify()` API + bundled Claude Code skill | Platform play; opens ecosystem |
| Floating HUD overlay + Streaming Mode | Jordan persona; organic marketing asset |
| Idle mini-game system (Snake, Tetris) | Completes the gestalt experience |
| Gamified stats dashboard (XP, streaks, controller action ratio trend) | Retention driver; north star metric in-product |
| Windows x64 VSIX build + XInput/Xbox Wireless Adapter support | Expands TAM |
| Cloud profile sync via VSCode Settings Sync | Reduces cross-device friction |
| Opt-in anonymous telemetry + `vibesense.dev` stats page | KPI instrumentation |

**Phase 3 — Vision (Post-traction validation):**

- Community marketplace (creator program, revenue sharing)
- Expanded editor support (JetBrains, Neovim)
- Hardware partnership discussions (DualSense, GameSir)
- Standalone desktop app (editor-agnostic)
- Mobile companion app
- Enterprise licensing
- Open plugin API for mini-games and HUD themes

---

### Risk Mitigation Strategy

**Technical Risks:**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Claude Code hooks integration (indirect IPC path) | High | Confirmed approach: VibeSense writes hook entries to `~/.claude/settings.json` pointing to a local script that sends IPC to the extension host. Fallback: terminal output stream parsing for agent state detection. Build hooks integration in MVP as a stub; expand in Growth. |
| Platform-specific VSIX builds (native binaries) | Medium | `prebuild-install` handles binary distribution; `vsce --target` handles per-platform publish. Mac-first reduces surface area. GitHub Actions matrix builds for each platform. |
| Bluetooth HID detection on Linux/WSL2 | Medium | Phase 1.5 allocated for Linux validation. Dongle connections (USB HID) avoid this entirely and are the recommended connection method for lowest latency. Bluetooth fallback documented; WSL2 USB passthrough via USB/IP covers both wired and dongle. |
| `terminal.sendText` no completion callback | Low-Medium | Agent state detected via Claude Code hooks (primary) or output stream parsing (fallback). Do not depend on terminal send confirmation. |

**Market Risks:**

| Risk | Mitigation |
|------|------------|
| "Gimmick" perception at launch | Lead with ergonomic thesis in all copy ("the correct tool, not a gimmick"); first-session experience must convert skeptics |
| No existing search category on VSCode Marketplace | Launch strategy must be content-first: streaming clips, Product Hunt, Hacker News, r/ClaudeAI — discovery via social proof, not organic search |
| Slow initial adoption delays marketplace viability | Year 1 is adoption-only, revenue-deferred; no revenue pressure in first 12 months |

**Resource Risks:**

| Risk | Mitigation |
|------|------------|
| Solo developer bandwidth | Mac-first scope; Claude Code parallel agents for build; strict MVP discipline (nothing in MVP that isn't on the must-have list) |
| CI/CD complexity of multi-platform native builds | Deferred to Phase 1.5 (Linux) and Phase 2 (Windows); MVP is single-platform VSIX |
| Feature creep from rich product vision | Scope locked at this PRD; Growth features require explicit re-prioritization decision before implementation |

## Functional Requirements

### Controller Connection & Input

- **FR1:** The system can auto-detect a connected controller (wired USB, 2.4GHz dongle, Bluetooth) without user configuration on extension activation
- **FR2:** The system can detect when a controller disconnects and immediately activate keyboard fallback without interrupting the active session
- **FR3:** The system can auto-reconnect to a controller when it is re-plugged or re-pairs wirelessly
- **FR4:** The system can detect low controller battery level and alert the user via a non-blocking status notification
- **FR5:** The user can manually select a HID device from a list of available devices when auto-detection fails
- **FR6:** The user can map any controller button or input to any registered VSCode command or key sequence
- **FR7:** The system provides pre-built binding profiles optimized for Claude Code and GitHub Copilot Chat workflows, active without manual configuration
- **FR8:** The user can customize controller binding profiles through a settings interface
- **FR9:** The system buffers controller inputs during state transitions to prevent dropped actions

### VSCode Integration & Session Management

- **FR10:** The user can open a new VSCode terminal using a controller input
- **FR11:** The user can launch a Claude Code agent session using a controller input
- **FR12:** The user can launch GitHub Copilot Chat using a controller input
- **FR13:** The user can navigate between open terminal and agent sessions using dedicated controller inputs
- **FR14:** The user can view and select from all open agent sessions via a quick panel triggered from the controller
- **FR15:** The user can scroll terminal output using the analog stick with speed proportional to stick displacement
- **FR16:** The user can trigger any registered VSCode command using a controller button
- **FR17:** The user can activate push-to-talk voice input using a designated controller button, delegating to Claude Code or Copilot voice mode

### Agent State Awareness

- **FR18:** The system can detect when a Claude Code agent session transitions between states (processing, needs input, complete, error)
- **FR19:** The system can register lifecycle hooks in Claude Code's configuration to receive agent state events
- **FR20:** The system can parse terminal output streams as a fallback mechanism for agent state detection when hooks are unavailable
- **FR21:** The system can detect when voice input mode is unavailable and surface a non-blocking fallback prompt
- **FR22:** External Claude Code skills and scripts can call `vibeSense.notify()` to deliver agent state events to the extension
- **FR23:** The `vibeSense.notify()` API accepts named haptic patterns, LED colors, audio tones, and notification priority as parameters
- **FR56:** The user can access a quick-action menu from the controller when an agent session enters an error state, presenting common recovery actions

### Ambient Feedback

- **FR24:** The system can emit distinct haptic patterns on the controller for different agent state events (processing, complete, needs input, error)
- **FR25:** The system can set the controller LED color to reflect the current agent or session state
- **FR26:** The system can emit audio tones through the controller speaker for agent state events
- **FR27:** The system displays a persistent controller connection and state indicator in the VSCode status bar at all times
- **FR28:** The user can configure a Do Not Disturb mode that suppresses ambient feedback below a specified priority threshold
- **FR29:** The user can view a floating HUD overlay showing the active controller button map in context

### Idle Gaming

- **FR30:** The system can detect when an agent session is idle/processing and automatically present a mini-game
- **FR31:** The system can automatically pause an active mini-game when an agent requires user attention
- **FR32:** The system can resume a paused mini-game when the agent returns to idle/processing state
- **FR33:** The system persists mini-game state (score, progress level) across VSCode sessions
- **FR34:** The user can manually launch or dismiss the mini-game at any time via a controller input

### User Configuration & Profiles

- **FR35:** The system stores per-project binding profiles in `.vscode/vibesense.json`, committable to version control and readable as plain JSON
- **FR36:** Binding profiles synchronize across devices using VSCode's built-in Settings Sync (GitHub-backed), requiring no additional account
- **FR37:** The user can complete an interactive onboarding flow that establishes a working controller configuration within 60 seconds of first launch
- **FR38:** The user can configure radial wheel segments with custom prompt text, accessible and triggerable from the controller
- **FR39:** The system detects missing platform permissions (macOS Input Monitoring, Linux udev rules) on first launch and provides inline copy-paste remediation steps
- **FR40:** The user can configure all VibeSense settings through the standard VSCode Settings UI

### Analytics & Stats

- **FR41:** The system tracks the ratio of controller-initiated versus keyboard/mouse actions per session, stored locally on device
- **FR42:** The user can view their controller action ratio trend over time in an in-extension stats dashboard
- **FR43:** The user can view their Controller-Only Session Completion Rate (sessions completed with zero keyboard touches) in the stats dashboard
- **FR44:** The system can collect anonymous usage telemetry when the user has explicitly opted in via VSCode settings
- **FR45:** The user can change their telemetry opt-in preference at any time through VSCode settings
- **FR46:** Telemetry payloads contain only aggregate counts and ratios — no keystrokes, terminal content, file names, project names, or any identifiable data
- **FR53:** The user earns XP, progresses through levels, and maintains usage streaks based on controller session milestones, tracked locally
- **FR54:** The system delivers a celebration feedback signature (haptic pattern + LED color + audio tone) when the user unlocks an achievement

### Streaming & Creator Mode

- **FR47:** The user can enable a streaming overlay mode that renders controller inputs, button maps, and radial wheel interactions as an on-screen visual layer
- **FR48:** The streaming overlay is compositable with OBS and standard screen capture tools without additional plugin installation
- **FR49:** The streaming overlay displays live button-press animations in real time as controller inputs occur

### Platform & Distribution

- **FR50:** The extension installs from the VSCode Marketplace with the correct platform-native binaries without requiring local compilation on the user's machine
- **FR51:** The extension activates lazily — only upon controller detection or explicit user trigger — not on every VSCode startup
- **FR52:** Pre-release builds are available as downloadable `.vsix` files on GitHub Releases for testing prior to Marketplace publish
- **FR55:** Aggregated anonymous usage statistics from opted-in users are published publicly on `vibesense.dev`

## Non-Functional Requirements

### Performance

- **NFR-P1:** Controller input processing latency must be <16ms from HID input receipt to VSCode action dispatch, measured at the VibeSense extension host layer
- **NFR-P2:** Total end-to-end latency (controller input → visible terminal response) is expected to be 16–26ms; the 5–10ms above NFR-P1 is VSCode platform-owned rendering overhead and is not a VibeSense responsibility
- **NFR-P3:** Extension activation must complete within 500ms of controller detection — the status bar indicator must be visible and the controller responsive within this window
- **NFR-P4:** The VibeSense extension host process must add no more than 50MB to VSCode's baseline memory footprint during an active session
- **NFR-P5:** HID polling must not measurably degrade VSCode editor performance (typing responsiveness, file rendering, extension host CPU) during active coding

### Reliability

- **NFR-R1:** Any unhandled exception in the extension host must be caught, logged internally, and never propagate to the VSCode process — the editor must remain fully functional under all VibeSense failure conditions
- **NFR-R2:** Keyboard fallback must activate within 100ms of controller disconnect detection — no user action required
- **NFR-R3:** Controller auto-reconnect must complete within 3 seconds of the device being re-plugged or re-paired
- **NFR-R4:** The extension must remain fully functional as a VSCode extension when Claude Code, GitHub Copilot, or VS Code Speech are not installed — agent state and voice features degrade gracefully, core controller input functions normally
- **NFR-R5:** Writes to `~/.claude/settings.json` for Claude Code hook registration must be atomic — a failed or interrupted write must never leave the file in a corrupt or unparseable state

### Security

- **NFR-S1:** The `vibeSense.notify()` API must validate and sanitize all input parameters — invalid payloads are rejected with a descriptive error, never executed or forwarded
- **NFR-S2:** All telemetry transmission to the `vibesense.dev` backend must use HTTPS with TLS 1.2 or higher
- **NFR-S3:** The extension must not request VSCode API permissions, file system access, or network capabilities beyond what is declared in `package.json` `contributes` and `activationEvents`
- **NFR-S4:** Telemetry payloads must be inspectable — the exact JSON sent to the telemetry endpoint must be loggable locally when VSCode developer tools are open, so users can verify what is transmitted

### Compatibility

- **NFR-C1:** DualSense (PS5) and Xbox Series controllers must support the full VibeSense feature set including haptics, LED, and audio at launch
- **NFR-C2:** Any HID-compatible controller must support basic button mapping and terminal input functionality, even without haptic or LED output capabilities
- **NFR-C3:** The extension must support VSCode 1.85 or later (Node.js 20.x Electron baseline)
- **NFR-C4:** macOS arm64 and x64 are fully supported at MVP; Linux x64 (including WSL2) at Phase 1.5; Windows x64 at Phase 2
- **NFR-C5:** Wired USB, 2.4GHz dongle, and Bluetooth connection types must all be supported; dongle connections (presenting as USB HID) follow the same code path as wired

### Integration

- **NFR-I1:** Claude Code hooks integration must degrade gracefully if Claude Code is not installed, hooks are disabled, or the `~/.claude/settings.json` file is inaccessible — terminal output stream parsing activates as automatic fallback
- **NFR-I2:** Voice PTT integration must degrade gracefully if VS Code Speech extension or Claude Code voice mode is not available — the controller button surfaces a non-blocking status message and the radial wheel opens as fallback
- **NFR-I3:** VibeSense must not interfere with the functionality of other VSCode extensions, including Claude Code, GitHub Copilot, and any extension that registers terminal or keyboard handlers

### Accessibility

- **NFR-A1:** All VibeSense Webview panels (settings UI, stats dashboard, onboarding tutorial) must be fully keyboard-navigable for users who are configuring the extension without a controller connected
- **NFR-A2:** Status bar indicators and HUD overlay elements must use text labels or icons in addition to color — color alone must not be the sole signal for any state (color-blind accommodation)
- **NFR-A3:** All in-extension notifications must be non-modal and dismissible without requiring controller input — keyboard and mouse dismiss paths must always exist
