# Story Dependency Graph
_Last updated: 2026-03-29T16:30:00Z_

## Stories

| Story | Title | Sprint Status | Issue | PR | PR Status | Dependencies | Ready to Work |
|-------|-------|--------------|-------|----|-----------|--------------|---------------|
| 1.1 | Extension Scaffold & Dual-Target Build System | done | #13 | #65 | merged | none | ✅ Yes (done) |
| 1.2 | Native Module Setup (node-hid + electron-rebuild) | done | #14 | #69 | open | 1.1 | ✅ Yes (done) |
| 1.3 | Shared Type System & Webview Message Protocol | done | #15 | #68 | open | 1.1 | ✅ Yes (done) |
| 1.4 | GitHub Actions CI Matrix (4 Platforms) | done | #16 | #67 | open | 1.1 | ✅ Yes (done) |
| 1.5 | Testing Framework & Logger Singleton | done | #17 | #70 | open | 1.1 | ✅ Yes (done) |
| 2.1 | HID Hardware Abstraction Layer (HAL) | backlog | #18 | — | — | 1.1, 1.2, 1.3 | ❌ No (1.1, 1.2, 1.3 not merged) |
| 2.2 | Controller Auto-Detect, Disconnect & Reconnect | backlog | #19 | — | — | 2.1 | ❌ No (2.1 not merged) |
| 2.3 | StatusBarController & Battery Warning | backlog | #20 | — | — | 2.1 | ❌ No (2.1 not merged) |
| 2.4 | VOID Design System & ControllerIcon Component | backlog | #21 | — | — | 1.3, 2.2 | ❌ No (1.3, 2.2 not merged) |
| 2.5 | Button-to-Command Dispatcher & Input Buffering | backlog | #22 | — | — | 2.2 | ❌ No (2.2 not merged) |
| 2.6 | Manual HID Device Selection & Platform Permission Detection | backlog | #23 | — | — | 2.1 | ❌ No (2.1 not merged) |
| 2.7 | Pre-Built Binding Profiles & Profile Schema | backlog | #24 | — | — | 2.5 | ❌ No (2.5 not merged) |
| 3.1 | Open Terminal & Launch AI Agents from Controller | backlog | #25 | — | — | 2.5, 2.7 | ❌ No (2.5, 2.7 not merged) |
| 3.2 | Analog Stick Terminal Scroll | backlog | #26 | — | — | 2.5 | ❌ No (2.5 not merged) |
| 3.3 | L1/R1 Session Switching & SessionSwitcher Overlay | backlog | #27 | — | — | 3.1 | ❌ No (3.1 not merged) |
| 3.4 | SlidePanel & SessionCard Components | backlog | #28 | — | — | 1.3, 2.4 | ❌ No (1.3, 2.4 not merged) |
| 3.5 | Multi-Session Quick Panel | backlog | #29 | — | — | 3.3 | ❌ No (3.3 not merged) |
| 3.6 | Voice PTT & Voice Unavailable Fallback | backlog | #30 | — | — | 3.1 | ❌ No (3.1 not merged) |
| 4.1 | VSCode Settings UI & Binding Customization | backlog | #31 | — | — | 2.5, 2.7 | ❌ No (2.5, 2.7 not merged) |
| 4.2 | VSCode Settings Sync & Profile Portability | backlog | #32 | — | — | 2.7 | ❌ No (2.7 not merged) |
| 4.3 | Guided Mode / Full Mode Progressive Unlock | backlog | #33 | — | — | 2.7, 3.1 | ❌ No (2.7, 3.1 not merged) |
| 4.4 | 60-Second Interactive Onboarding Tutorial | backlog | #34 | — | — | 4.1, 4.3 | ❌ No (4.1, 4.3 not merged) |
| 5.1 | Agent FSM & Session Manager | backlog | #35 | — | — | 1.1, 1.3 | ❌ No (1.1, 1.3 not merged) |
| 5.2 | Claude Code Hooks Registration | backlog | #36 | — | — | 5.1, 1.3 | ❌ No (5.1 not merged) |
| 5.3 | Named Pipe IPC Server | backlog | #37 | — | — | 5.1 | ❌ No (5.1 not merged) |
| 5.4 | Terminal Output Stream Parsing Fallback | backlog | #38 | — | — | 5.1 | ❌ No (5.1 not merged) |
| 5.5 | Error State Quick-Action Menu | backlog | #39 | — | — | 5.1, 3.5 | ❌ No (5.1, 3.5 not merged) |
| 6.1 | Haptic Pattern Engine (DualSense) | backlog | #40 | — | — | Epic 5 (5.1–5.5), 2.1 | ❌ No (Epic 5, 2.1 not merged) |
| 6.2 | LED Color State Controller | backlog | #41 | — | — | Epic 5 (5.1–5.5), 2.1 | ❌ No (Epic 5, 2.1 not merged) |
| 6.3 | Audio Tone System | backlog | #42 | — | — | Epic 5 (5.1–5.5), 2.1 | ❌ No (Epic 5, 2.1 not merged) |
| 6.4 | vibeSense.notify() Public API | backlog | #43 | — | — | 6.1, 6.2, 6.3, 5.3 | ❌ No (6.1–6.3 not merged) |
| 6.5 | Do Not Disturb Mode | backlog | #44 | — | — | 6.1, 6.2, 6.3 | ❌ No (6.1–6.3 not merged) |
| 7.1 | Radial Wheel Core (L2 Smart Wheel) | backlog | #45 | — | — | Epic 2 (2.1–2.7), 1.3, 2.4 | ❌ No (Epic 2 not merged) |
| 7.2 | Dual Layered Wheel System (R2 Personal Wheel) | backlog | #46 | — | — | 7.1 | ❌ No (7.1 not merged) |
| 7.3 | HUD Overlay (Floating Button Map) | backlog | #47 | — | — | Epic 2 (2.1–2.7), 1.3, 2.4 | ❌ No (Epic 2 not merged) |
| 7.4 | Radial Wheel Customization & Label Fading | backlog | #48 | — | — | 7.2 | ❌ No (7.2 not merged) |
| 8.1 | GameWindow WebviewPanel & Snake Game | backlog | #49 | — | — | Epic 5 (5.1–5.5), 1.3, 2.4 | ❌ No (Epic 5 not merged) |
| 8.2 | Game Auto-Pause & Auto-Resume on Agent State | backlog | #50 | — | — | 8.1 | ❌ No (8.1 not merged) |
| 8.3 | Tetris Game Mode | backlog | #51 | — | — | 8.1 | ❌ No (8.1 not merged) |
| 8.4 | Game State Persistence & Session Continuity | backlog | #52 | — | — | 8.2 | ❌ No (8.2 not merged) |
| 9.1 | Controller Action Ratio Tracking | backlog | #53 | — | — | 2.5 | ❌ No (2.5 not merged) |
| 9.2 | Stats Dashboard (Ratio Trend & Session Completion Rate) | backlog | #54 | — | — | 9.1 | ❌ No (9.1 not merged) |
| 9.3 | XP System, Levels & Streaks | backlog | #55 | — | — | 9.1 | ❌ No (9.1 not merged) |
| 9.4 | Session Health Bar | backlog | #56 | — | — | 9.1, 9.3 | ❌ No (9.1, 9.3 not merged) |
| 9.5 | Achievement System & AchievementBurst | backlog | #57 | — | — | 9.3, 6.1 | ❌ No (9.3, 6.1 not merged) |
| 9.6 | Session Quicksave & Resume | backlog | #58 | — | — | Epic 3 (3.1–3.6), Epic 7 (7.1–7.4) | ❌ No (Epic 3, Epic 7 not merged) |
| 10.1 | Streaming Overlay Base (CINEMA Mode Frame) | backlog | #59 | — | — | Epic 3 (3.1–3.6), Epic 2 (2.1–2.7) | ❌ No (Epic 3, Epic 2 not merged) |
| 10.2 | Live Button-Press Animations | backlog | #60 | — | — | 10.1 | ❌ No (10.1 not merged) |
| 10.3 | Radial Wheel Animation in Streaming Overlay | backlog | #61 | — | — | 10.1, Epic 7 (7.1–7.4) | ❌ No (10.1, Epic 7 not merged) |
| 11.1 | Opt-In Telemetry Collection Module | backlog | #62 | — | — | Epic 9 (9.1–9.6) | ❌ No (Epic 9 not merged) |
| 11.2 | Telemetry Consent Management UI | backlog | #63 | — | — | 11.1 | ❌ No (11.1 not merged) |
| 11.3 | Telemetry Transmission & Public Stats Page | backlog | #64 | — | — | 11.1, 11.2 | ❌ No (11.1, 11.2 not merged) |

## Dependency Chains

- **1.2** depends on: 1.1
- **1.3** depends on: 1.1
- **1.4** depends on: 1.1
- **1.5** depends on: 1.1
- **2.1** depends on: 1.1, 1.2, 1.3
- **2.2** depends on: 2.1 → (1.1, 1.2, 1.3)
- **2.3** depends on: 2.1 → (1.1, 1.2, 1.3)
- **2.4** depends on: 1.3, 2.2 → (1.1, 1.2, 1.3, 2.1)
- **2.5** depends on: 2.2 → (1.1, 1.2, 1.3, 2.1)
- **2.6** depends on: 2.1 → (1.1, 1.2, 1.3)
- **2.7** depends on: 2.5 → (..., 2.2, 2.1)
- **3.1** depends on: 2.5, 2.7
- **3.2** depends on: 2.5
- **3.3** depends on: 3.1 → (2.5, 2.7)
- **3.4** depends on: 1.3, 2.4
- **3.5** depends on: 3.3 → (3.1, 2.5, 2.7)
- **3.6** depends on: 3.1
- **4.1** depends on: 2.5, 2.7
- **4.2** depends on: 2.7
- **4.3** depends on: 2.7, 3.1
- **4.4** depends on: 4.1, 4.3
- **5.1** depends on: 1.1, 1.3
- **5.2** depends on: 5.1, 1.3
- **5.3** depends on: 5.1
- **5.4** depends on: 5.1
- **5.5** depends on: 5.1, 3.5
- **6.1** depends on: Epic 5 (5.1, 5.2, 5.3, 5.4, 5.5), 2.1
- **6.2** depends on: Epic 5 (5.1, 5.2, 5.3, 5.4, 5.5), 2.1
- **6.3** depends on: Epic 5 (5.1, 5.2, 5.3, 5.4, 5.5), 2.1
- **6.4** depends on: 6.1, 6.2, 6.3, 5.3
- **6.5** depends on: 6.1, 6.2, 6.3
- **7.1** depends on: Epic 2 (2.1–2.7), 1.3, 2.4
- **7.2** depends on: 7.1
- **7.3** depends on: Epic 2 (2.1–2.7), 1.3, 2.4
- **7.4** depends on: 7.2
- **8.1** depends on: Epic 5 (5.1–5.5), 1.3, 2.4
- **8.2** depends on: 8.1
- **8.3** depends on: 8.1
- **8.4** depends on: 8.2
- **9.1** depends on: 2.5
- **9.2** depends on: 9.1
- **9.3** depends on: 9.1
- **9.4** depends on: 9.1, 9.3
- **9.5** depends on: 9.3, 6.1
- **9.6** depends on: Epic 3 (3.1–3.6), Epic 7 (7.1–7.4)
- **10.1** depends on: Epic 3 (3.1–3.6), Epic 2 (2.1–2.7)
- **10.2** depends on: 10.1
- **10.3** depends on: 10.1, Epic 7 (7.1–7.4)
- **11.1** depends on: Epic 9 (9.1–9.6)
- **11.2** depends on: 11.1
- **11.3** depends on: 11.1, 11.2

## Notes

**All Epic 1 stories are done** (1.1 merged; 1.2–1.5 have open PRs with CI green, awaiting merge). Once 1.2 and 1.3 merge, stories 2.1 and 5.1 will become unblocked.

**Parallelization opportunities once 1.1 merges:** Stories 1.2, 1.3, 1.4, 1.5 can all run simultaneously. Additionally, 5.1 depends only on 1.1 + 1.3, so it can begin as soon as 1.3 merges.

**Key bottlenecks:**
- Story 1.1 blocks everything
- Story 2.1 (HAL) blocks all of Epic 2
- Epic 2 is a prerequisite for Epics 3, 4, 7, 9, 10
- Epic 5 is a prerequisite for Epic 6 and Epic 8
- Story 5.5 creates a cross-epic dependency: it needs both Epic 5 (5.1) and Epic 3 (3.5)
- Story 9.5 creates a cross-epic dependency: needs Epic 9 (9.3) and Epic 6 (6.1)

**Critical path to first "vibe coding session" (Epic 3):**
1.1 → 1.2 + 1.3 → 2.1 → 2.2 → 2.5 → 2.7 → 3.1
