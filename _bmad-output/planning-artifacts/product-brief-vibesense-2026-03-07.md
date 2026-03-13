---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-03-01-now.md'
  - '_bmad-output/planning-artifacts/research/market-VibeSense-VSCode-gaming-controller-research-2026-03-05.md'
  - '_bmad-output/planning-artifacts/research/domain-vibesense-agentic-coding-developer-tooling-research-2026-03-07.md'
  - '_bmad-output/planning-artifacts/research/technical-vibesense-full-stack-research-2026-03-07.md'
date: 2026-03-07
author: Leo
---

# Product Brief: vibesense

## Executive Summary

VibeSense is a VSCode extension that makes a gaming controller the purpose-built,
ergonomically superior input device for agentic AI coding sessions ("vibe coding").

The agentic coding paradigm has fundamentally changed what developers do at the keyboard
— instead of writing code, they approve decisions, redirect agents, scroll through output,
and dispatch prompts. This minimal, repetitive interaction set uses a tiny fraction of
the keyboard's surface area, making the full keyboard an over-engineered tool for the job.
A gaming controller — held in a natural two-handed grip, operated from the couch or
recliner, with directional inputs, shoulder buttons, and analog sticks — maps directly
to this interaction set while reducing wrist strain and enabling a more relaxed coding
posture.

With the controller already in hand, VibeSense unlocks a second major value: when the AI
is processing (which can be minutes at a time), developers no longer default to mindless
social media browsing. Instead, they play retro mini-games, chase high scores, and use
that idle time for something genuinely fulfilling. This is a natural bonus — not the
headline — enabled by the controller already being in the developer's hands.

VibeSense's long-term moat is its community platform: a Roblox-style marketplace for
mini-games, HUD themes, haptic packs, and achievement sets. This ecosystem — and the
breadth of hardware support across DualSense, Xbox, and any HID-compatible controller
— is something no AI coding tool or IDE plugin can absorb.

---

## Core Vision

### Problem Statement

Agentic AI coding ("vibe coding") has created a fundamentally new developer interaction
pattern: instead of writing code line-by-line, developers approve agent decisions,
dispatch prompts, scroll through output, and wait — often for minutes at a time — while
AI processes tasks. The traditional keyboard is poorly suited for this paradigm. It was
designed for dense, continuous typing across hundreds of keys, but vibe coding requires
only 8-10 distinct, repetitive interactions. Meanwhile, minutes of idle AI processing
time accumulate into hours per week, currently lost to passive social media consumption
("brainrot").

### Problem Impact

- Developers are using a complex, full-size keyboard — designed for continuous typing —
  for what amounts to 8-10 distinct interactions. A significant ergonomic and cognitive
  mismatch that also locks developers into a desk-and-chair posture.
- Minutes of idle AI processing time accumulate into hours per week, currently filled
  with low-quality passive content that offers no skill development or fulfillment.
- No purpose-built input experience exists for the vibe coding workflow — developers are
  adapting general-purpose tools to a new interaction paradigm.

### Why Existing Solutions Fall Short

Generic controller mapping tools (Joy2Key, reWASD, Steam Input) exist but are purpose-built
for gaming, not developer workflows. They have no awareness of VSCode, terminal sessions,
or agentic AI tools (Claude Code, GitHub Copilot). They require full manual configuration
with no vibe-coding defaults, no prompt macros, no radial wheel for AI prompting, and no
connection to agent state for idle-time detection. No tool has been built from the ground
up for the developer using an AI agent.

### Proposed Solution

VibeSense is a VSCode extension that makes a gaming controller the natural, purpose-built
input device for agentic coding. The core MVP value — controller input replacing keyboard
for vibe coding interactions — works cross-platform and cross-controller with any
HID-compatible device. It provides out-of-the-box bindings optimized for vibe coding,
voice-to-terminal input via the controller mic, a prompt radial wheel for dispatching AI
instructions, and session management for parallel agent terminals.

When the AI is processing, the controller seamlessly transitions to retro mini-games —
pausing automatically when the agent needs attention. This idle gaming is a natural bonus,
not the product's core identity.

Phase 2 adds an optional two-way feedback layer: haptic patterns, LED colors, and audio
tones that communicate agent state ambientally. These features are platform-dependent
enhancements built on top of the solid cross-platform MVP foundation.

### Key Differentiators

1. **Purpose-built for vibe coding** — not a generic key mapper. Every default binding,
   interaction, and UX pattern is designed around the agentic coding workflow. The
   ergonomic case is concrete: two-handed grip, relaxed posture, reduced wrist load,
   minimal-key surface perfectly matched to the interaction set.
2. **Controller as superior input device** — a defensible thesis, not a gimmick. Vibe
   coding is the first developer workflow where a controller's button count and layout
   is genuinely a better fit than a full keyboard. This argument stands independent of
   gaming identity and applies to any developer who vibe codes.
3. **Transforms idle time** — turns minutes of AI processing from passive consumption
   into active, fulfilling gameplay. Skill-building replaces brainrot. The gaming angle
   is enabled by the controller already being in the developer's hands — it's not the
   reason to adopt VibeSense, it's the bonus you discover after.
4. **Agent-aware** — connects to Claude Code and Copilot Chat state for ambient feedback
   and automatic mini-game pause/resume.
5. **Hardware-agnostic moat** — works across DualSense, Xbox, GameSir, and any
   HID-compatible controller. Combined with the community marketplace flywheel (games,
   themes, haptic packs, achievement sets) and deep customization depth, VibeSense builds
   ecosystem advantages that no AI coding tool or IDE plugin can absorb.

---

## Target Users

### Primary Users

#### Persona 1: The Gamer-Developer — "Alex"

**Background:** Alex is a software developer, either employed at a tech company or
building side projects as a solo founder. Gaming is a core part of their identity —
they own at least one modern controller (PS5 DualSense, Xbox, or GameSir), log regular
hours on console or PC games, and are deeply comfortable with controller ergonomics.
They've adopted agentic AI coding tools (Claude Code, GitHub Copilot) as a core part of
their workflow and identify as a "vibe coder" — someone who delegates implementation to
AI and focuses on directing, reviewing, and approving.

**The Problem They Experience:**
Alex sits at a desk with a full keyboard to vibe code, but only uses a handful of keys.
During AI processing (which can stretch 2-5 minutes), they pick up their phone and scroll
social media — then lose track of time, miss the agent's completion, and have to
context-switch back. The idle time feels wasted but there's no better option within the
coding environment itself.

**Why VibeSense Clicks Immediately:**
Alex already owns the hardware. The controller feels natural in their hands. The moment
they map approve/deny to face buttons and the radial wheel to their most-used prompts,
the vibe coding loop feels like playing a game — dispatch, wait, play Snake, feel the
haptic pulse, eyes back on screen. Zero learning curve, immediate ergonomic benefit.

**Success Moment:**
"I went through a full 3-hour coding session without touching my keyboard once. And I
beat my Snake high score twice while waiting."

---

#### Persona 2: The Coding Streamer / Content Creator — "Jordan"

**Background:** Jordan streams live coding sessions on Twitch or publishes vibe coding
content on YouTube. Their audience watches for the process — AI-assisted development,
real-time problem solving, the aesthetic of the workflow. Jordan is always looking for
ways to make their content more visually engaging and distinctive. They may or may not
be a hardcore gamer, but they understand that what's on screen (and what's in their
hands) is part of their brand.

**The Problem They Experience:**
Jordan's live coding content has a "watching someone type" problem — it's not visually
compelling during AI processing time. Dead air and screen-staring are low-engagement
moments. They need something that makes the workflow watchable and sets their content
apart from the sea of screen-recording tutorials.

**Why VibeSense Clicks:**
The controller is inherently visual and novel on camera. The HUD overlay showing live
button mappings, the radial wheel animation, the LED state changes — these are all
content moments. Streaming Mode renders every controller interaction as an on-screen
overlay, so viewers see exactly what Jordan is doing and why. Playing a mini-game
on-stream while waiting for the agent generates chat engagement. VibeSense turns dead
processing time into live entertainment.

**Success Moment:**
"My clip of the radial wheel prompt dispatch got 40k views. Three people in the comments
asked 'what extension is that?' Every stream now."

---

### Secondary Users

#### Persona 3: The Multi-Agent Power Developer — "Sam"

**Background:** Sam is an experienced developer — likely a senior engineer, tech lead,
or prolific solo founder — who runs multiple AI agent sessions simultaneously. They might
have Claude Code handling a backend refactor in one terminal, Copilot working on tests
in another, and a third agent drafting documentation. Sam's bottleneck is not typing —
it's orchestrating and switching between parallel workstreams without losing context.

**The Problem They Experience:**
Managing 3-4 agent sessions with a keyboard and mouse is a constant context-switching
juggle. Alt-tabbing between terminals, remembering which agent is doing what, catching
completions across sessions — it's cognitively exhausting. Sam doesn't have an idle
problem so much as an orchestration problem.

**Why VibeSense Clicks:**
The L1/R1 shoulder button session-switching and Multi-Session Quick Panel become Sam's
primary interface. Flicking between active agent terminals with a button press — without
touching the mouse or keyboard — reduces orchestration friction dramatically. The
haptic/LED state feedback means Sam knows which session needs attention without watching
all four windows simultaneously. The controller becomes a conductor's baton for a
multi-agent orchestra.

**Success Moment:**
"I'm running four agents in parallel and I know exactly which one needs me without
looking at any of them. The controller just tells me."

---

### User Journey

#### Alex's Journey (Primary — Gamer-Developer)

**Discovery:** Sees a clip on Twitter/Reddit of someone vibe coding with a controller —
the radial wheel animation or mini-game mid-session. Thinks "that's exactly my setup."
Searches VSCode Marketplace, installs immediately.

**Onboarding:** Auto-detection finds their controller on first launch. Guided 60-second
tutorial walks through face button bindings. Recognizes the PS/Xbox button icons
instantly — zero translation needed. First session: "oh, this just works."

**Core Usage:** Uses the controller for every vibe coding session. Develops muscle memory
for approve (X/A), radial wheel (L2), session switch (L1/R1). Idle mini-games become
the reward rhythm of long sessions.

**Aha Moment:** First session where they don't touch the keyboard for 90+ minutes. The
controller didn't feel like a workaround — it felt like the right tool.

**Long-term:** Commits per-project binding profiles to their repos. Customizes radial
wheel with project-specific prompts. Browses the marketplace for new mini-games and
HUD themes.

---

#### Jordan's Journey (Secondary — Streaming Content Creator)

**Discovery:** Sees VibeSense featured in a "VSCode extensions for vibe coders" video,
or a clip of another streamer using it goes viral. Downloads it to see what the fuss is
about.

**Onboarding:** Enables Streaming Mode on first setup. Immediately sees the controller
overlay on their OBS preview — clean, visually distinctive, on-brand.

**Core Usage:** Uses VibeSense as part of their standard streaming setup. Controller
input and on-screen overlay become a visual signature of their content style.

**Aha Moment:** A viewer clip of the radial wheel or mid-stream mini-game goes viral.
VibeSense becomes part of their creator brand.

**Long-term:** Installs HUD theme packs to match their stream aesthetic. Potentially
creates and publishes their own theme pack to the marketplace.

---

## Success Metrics

### User Success Metrics

The north star metric for VibeSense is:

> **Controller-Only Session Completion Rate** — the percentage of vibe coding sessions
> where the user completes the full session without touching the keyboard.

This metric captures the core product promise in a single, measurable behavior. When a
user finishes a session controller-only, VibeSense has delivered on every dimension:
ergonomics, input coverage, idle time, and muscle memory. Supported by:

- **Session Return Rate** — % of users who return for a second session within 7 days.
  Indicates whether the first experience was compelling enough to change behavior.
- **Feature Depth Adoption** — % of active users who engage with at least 3 core
  features (e.g. radial wheel + session switching + mini-game). Shallow usage predicts
  churn; deep usage predicts retention.
- **Idle Game Engagement Rate** — % of sessions where mini-game is triggered during AI
  processing. Proxy for whether users are experiencing the full vibe coding loop.

---

### Business Objectives

**Year 1 Priority: Adoption over revenue.** VibeSense launches free. The goal is to
build a developer audience large enough to make the marketplace compelling for creators.
Revenue follows adoption — not the other way around.

**3-Month Targets (Post-Launch):**

| Metric | Target | Rationale |
|--------|--------|-----------|
| Daily Active Users (DAU) | 500+ | Meaningful signal of genuine daily habit formation |
| GitHub Stars | 500+ | Developer credibility and organic discovery signal |
| Total Marketplace Revenue | $1,000 | Validates willingness-to-pay before scaling creator program |

**12-Month Vision:**

| Metric | Target |
|--------|--------|
| VSCode Marketplace Installs | 10,000+ |
| 30-Day Retention Rate | >30% (2x developer tool average) |
| DAU/MAU Ratio | >20% (indicates genuine daily habit) |
| Community Discord Members | 500+ active members |
| Marketplace Content Items | 25+ community-published items |

**Strategic note:** VSCode Marketplace install count is a lagging indicator — it will
grow as a consequence of high retention and engagement, not as a primary lever.
Word-of-mouth from streamers and viral content (controller coding clips) is the primary
growth engine.

---

### Key Performance Indicators

**Acquisition:**
- VSCode Marketplace install count (weekly)
- GitHub stars (cumulative)
- Referral source breakdown (stream clips, Reddit, blog posts, direct search)

**Activation:**
- % of installs that complete the 60-second onboarding tutorial
- % of installs that complete their first controller-only session

**Retention:**
- 7-day return rate
- 30-day retention rate
- Controller-only session completion rate (primary north star)

**Engagement:**
- DAU and DAU/MAU ratio
- Average session length with controller active
- Feature depth score (# of distinct features used per active user)

**Marketplace & Ecosystem:**
- # of community content submissions (games, themes, achievement packs, haptic packs)
- Marketplace conversion rate (free installs → paid content purchases)
- Total marketplace revenue (creator earnings + platform commission)
- Discord active member count and weekly message volume

**Content Creator / Viral:**
- # of VibeSense stream clips shared publicly (tracked via mentions/tags)
- Referral installs attributed to streaming content

---

## MVP Scope

### Release Model

VibeSense follows a three-stage release model:

1. **Local MVP** — smallest working version on your own machine. Proves the core thesis:
   controller replaces keyboard for vibe coding.
2. **Pre-Marketplace** — all phases working locally before any public release. The
   VSCode Marketplace publish is a quality gate, not a starting point.
3. **VSCode Marketplace Launch** — full polished experience across all phases, including
   radial wheel, agent feedback, mini-games, and streaming mode.

---

### Stage 1: Local MVP — "Does the Controller Work?"

**Goal:** Prove that a gaming controller can fully replace the keyboard for a vibe
coding session. One developer (Leo), one controller, one Claude Code session,
keyboard untouched.

**Core Features:**
- Controller auto-detection — any HID-compatible device, zero configuration
- Button-to-key mapping with vibe-coding-optimized defaults (approve, deny, scroll,
  navigate, common terminal interactions)
- **Open new VSCode terminal from controller** — create a new terminal instance without
  touching the keyboard
- **Launch Claude Code / GitHub Copilot Chat from controller** — start an agent session
  directly from a button combo or quick panel, making the full session lifecycle
  (create → direct → switch → close) controller-native
- Voice-to-terminal input — leveraging native Claude Code and GitHub Copilot voice
  features; simple integration, not custom speech recognition
- Analog stick terminal scrollback (variable speed)
- L1/R1 fast-switch between open terminal and Copilot sessions
- Multi-session quick panel (terminals, Git, Copilot sessions)
- Per-project binding profiles stored in `.vscode/vibesense.json`
- Graceful controller disconnect/reconnect with keyboard fallback
- Low battery warning
- Input buffering during state transitions (200-300ms)

**Success Gate:** Leo completes a full vibe coding session without touching the keyboard.

---

### Stage 2: Pre-Marketplace — "All Phases Working Locally"

**Goal:** Everything that will ship on the Marketplace works end-to-end on a local
machine before a single user touches it. This is the full product experience — not
a phased rollout.

**Additions over Local MVP:**

*Must-have before Marketplace publish:*
- **Prompt Radial Wheel** — 8-segment, context-aware, trigger-activated (L2). The
  signature UX interaction of VibeSense.

*Phase 2 — Agent Feedback Layer:*
- Haptic patterns for agent state (processing, complete, needs input, error)
- LED color-coded agent state (DualSense + compatible controllers)
- Pleasant audio tones via controller speaker
- Unified multi-sensory feedback signatures
- Agent Feedback API (`vibeSense.notify()`) + bundled Claude Code skill
- Agent Error Quick-Action Menu
- Floating HUD overlay with context-sensitive button map
- Notification priority tiers with Do Not Disturb suppression
- Interactive 60-second onboarding tutorial
- Streaming / Content Creator Mode overlay

*Phase 3 — Vibe Coding Experience:*
- Idle mini-game system (Snake, Tetris) with auto-pause/resume tied to agent state
- Game state persistence across sessions
- Gamified stats dashboard (XP, levels, streaks)
- Achievement system (Bronze/Silver/Gold/Platinum) with celebration feedback signatures
- Session health bar

**Success Gate:** All phases tested and stable locally. Controller-only session
completion rate consistently achievable across all three user personas.

---

### Stage 3: VSCode Marketplace Launch

**Goal:** Public release. Full experience, polished onboarding, cross-platform
validation (Windows, Mac, Linux), broad controller compatibility confirmed.

**Additional polish for launch:**
- Progressive feature unlocking with user choice (Guided vs. Full mode)
- Comprehensive accessibility configuration
- Cloud profile sync via VSCode Settings Sync
- Session state quicksave/resume
- Native VSCode Settings UI with dynamic PS/Xbox controller icons

---

### Out of Scope for Marketplace Launch

The following are explicitly deferred until after the Marketplace launch and initial
adoption signals are validated:

| Feature | Rationale |
|---------|-----------|
| Community Marketplace platform | Requires adoption base first; revenue model validated post-launch |
| Creator program and revenue dashboard | Follows marketplace platform |
| HUD theme packs / haptic & audio packs | Community-created; requires marketplace |
| Leaderboards and social features | Privacy/data-sharing design needed; Phase 3 extra |
| Analog stick as mouse/cursor | Low priority; keyboard covers edge cases |
| Team presence indicators | Data-sharing concerns; needs careful design |

---

### MVP Success Criteria

**Gate to proceed from Local MVP → Pre-Marketplace:**
- Leo completes at least 5 controller-only vibe coding sessions successfully
- All core input features work reliably on target hardware (DualSense / GameSir G7 Pro)
- Voice-to-terminal integration confirmed working with Claude Code and Copilot

**Gate to proceed from Pre-Marketplace → Marketplace Launch:**
- All three phases stable and tested locally
- Radial wheel, mini-games, haptics, and agent feedback all functional end-to-end
- Tested on at least 2 controller types and 2 platforms (Windows required)
- Onboarding tutorial tested with at least one person unfamiliar with the extension

---

### Future Vision

VibeSense's long-term trajectory beyond the Marketplace launch is contingent on
demonstrated marketplace commercial viability — the degree to which users pay for
community content determines which of these paths are worth pursuing:

**If marketplace gains traction:**
- Full community marketplace platform with creator program and revenue sharing
- Expand to additional editors (JetBrains, Neovim) to grow the addressable audience
- Hardware partnership discussions with controller manufacturers (DualSense, GameSir)
  for certified compatibility and co-marketing

**If marketplace gains significant traction:**
- Standalone VibeSense desktop app (editor-agnostic, broader hardware support)
- Mobile companion app for session monitoring and achievement tracking
- Enterprise licensing for developer teams using parallel AI agents at scale

**Always on the roadmap (adoption-driven, not revenue-driven):**
- Expanded controller compatibility (any new HID devices)
- Community Discord with creator spotlights and achievement pack submissions
- Open plugin API for community-built mini-games and HUD themes
