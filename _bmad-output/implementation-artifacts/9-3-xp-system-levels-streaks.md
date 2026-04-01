# Story 9.3: XP System, Levels & Streaks

**Status:** review
**Epic:** 9 — Gamified Stats, Achievements & Session Management
**Story ID:** 9.3
**Story Key:** 9-3-xp-system-levels-streaks
**Created:** 2026-04-01

---

## Story

As a vibe coder,
I want to earn XP for controller milestones, progress through levels (Level 2 = 500 XP, doubling each level), and maintain a usage streak,
So that each session feels rewarding and I'm motivated to build better controller habits over time.

**Depends on:** Story 9.1 (session data foundation)
**Can run in parallel with:** Story 9.2

---

## Acceptance Criteria

**AC1 — Controller-only session earns +100 XP:**
Given a controller-only session completes (zero keyboard touches),
When the session ends,
Then +100 XP is added to the user's total in `ExtensionContext.globalState`.

**AC2 — High-ratio session earns +50 XP:**
Given a session achieves ≥80% controller action ratio,
When the session ends,
Then +50 XP is added.

**AC3 — Multi-feature session earns +25 XP:**
Given 3+ distinct VibeSense features are used in a session (e.g., radial wheel + session switching + mini-game),
When the session ends,
Then +25 XP is added.

**AC4 — Consecutive daily streak bonus:**
Given consecutive daily sessions are maintained,
When each day's session ends,
Then a streak bonus is applied (streak count × 10 XP per consecutive day).

**AC5 — Level-up event emitted on threshold crossing:**
Given the user's total XP crosses a level threshold (Level 2 = 500 XP, Level 3 = 1000 XP, Level 4 = 2000 XP, etc.),
When the threshold is crossed,
Then a `levelUp` event is emitted from `XpManager` (for Story 9.5 AchievementBurst integration).

**AC6 — XP and level data persisted in globalState:**
Given the session ends and XP is awarded,
When globalState is read,
Then `vibesense.xpRecord` contains the updated `totalXp`, `level`, `streakDays`, and `lastSessionDate`.

---

## Tasks / Subtasks

- [x] Task 1: Add `XpRecord` type and XP constants to shared modules
  - [x] 1.1 Add `XpRecord` interface to `src/shared/types.ts`: `{ totalXp: number, level: number, streakDays: number, lastSessionDate: string | null }`
  - [x] 1.2 Add XP constants to `src/shared/constants.ts`: `XP_KEY`, `XP_CONTROLLER_ONLY`, `XP_HIGH_RATIO`, `XP_MULTI_FEATURE`, `XP_STREAK_PER_DAY`, `HIGH_RATIO_THRESHOLD`, `MULTI_FEATURE_MIN_COUNT`, `LEVEL_2_XP_THRESHOLD`

- [x] Task 2: Add feature-use tracking to `SessionRatioTracker`
  - [x] 2.1 Add `recordFeatureUsed(feature: string): void` method to `SessionRatioTracker` — records distinct feature names used this session into a `Set<string>`
  - [x] 2.2 Add `getDistinctFeatureCount(): number` method — returns the count of distinct features used
  - [x] 2.3 Define feature categories: `'radialWheel'`, `'sessionSwitch'`, `'miniGame'`, `'voicePtt'`, `'quickPanel'`, `'hud'`, `'quicksave'` — mapped from command IDs

- [x] Task 3: Wire feature tracking in `InputRouter` and `RadialWheelController`
  - [x] 3.1 In `InputRouter.executeCommand()`, classify the commandId into a feature category and call `ratioTracker?.recordFeatureUsed(feature)` when a known feature command fires
  - [x] 3.2 In `RadialWheelController`, call `ratioTracker?.recordFeatureUsed('radialWheel')` when a wheel dispatch occurs

- [x] Task 4: Create `src/extension/stats/xp-manager.ts`
  - [x] 4.1 Implement `XpManager` as an `EventEmitter` subclass with `constructor(globalState: vscode.Memento)`
  - [x] 4.2 Implement `load(): XpRecord` — reads from `globalState` with `XP_KEY`; returns defaults if absent (totalXp=0, level=1, streakDays=0, lastSessionDate=null); defensive zod parse
  - [x] 4.3 Implement `computeLevelForXp(xp: number): number` — pure function: Level 1 = 0–499, Level 2 = 500–999, Level 3 = 1000–1999, Level 4 = 2000–3999, ... (threshold doubles each level)
  - [x] 4.4 Implement `awardSessionXp(sessionRecord: SessionRecord, distinctFeatureCount: number): Promise<void>` — computes earned XP, updates streak, checks level up, persists to globalState, emits `'levelUp'` event if level increased
  - [x] 4.5 Streak logic: if `lastSessionDate` was yesterday (UTC date string), increment `streakDays`; if today, no change (already counted); if older or null, reset to 1
  - [x] 4.6 All methods wrapped in try/catch with `logger.error` — never throw (NFR-R1)

- [x] Task 5: Add `XpRecordSchema` to `src/extension/stats/session-record-schema.ts`
  - [x] 5.1 Add `XpRecordSchema` zod schema for defensive parse of stored `XpRecord`

- [x] Task 6: Wire `XpManager` into `extension.ts`
  - [x] 6.1 Instantiate `XpManager` after `globalState` is available
  - [x] 6.2 In session finalization dispose handler, after `ratioTracker.finalizeSession()`, call `xpManager.awardSessionXp(latestRecord, ratioTracker.getDistinctFeatureCount())` using the latest session record from history
  - [x] 6.3 Wire `xpManager.on('levelUp', ...)` listener with a log message (Story 9.5 will wire the AchievementBurst here)

- [x] Task 7: Write unit tests
  - [x] 7.1 Unit tests for `XpManager`: XP computation per AC1–AC4; level calculation; streak logic; error resilience (NFR-R1)
  - [x] 7.2 Unit tests for `SessionRatioTracker`: `recordFeatureUsed()` deduplicates; `getDistinctFeatureCount()` returns correct count
  - [x] 7.3 Unit tests for feature classification in `InputRouter`: known commands map to correct feature categories

---

## Dev Notes

### What This Story Builds

Story 9.3 adds the XP, levelling, and daily streak subsystem on top of Story 9.1's session ratio data. When a session ends, `XpManager.awardSessionXp()` inspects the `SessionRecord` and the count of distinct features used to compute how much XP was earned, updates the streak, checks if the level threshold was crossed, persists the updated `XpRecord` to `globalState`, and emits a `'levelUp'` event for Story 9.5.

**Scope boundary:** This story does NOT implement:
- Any stats dashboard UI (Story 9.2)
- The AchievementBurst visual/haptic (Story 9.5 — only the event emission hook is wired)
- Any session health bar display (Story 9.4)

### Architecture Compliance

**Storage API:** Use `ExtensionContext.globalState` with key `vibesense.xpRecord`. Consistent with `GameHighScoreStore`, `ModeManager`, `RadialWheelDispatchTracker`, `SessionRatioTracker`.

**Error handling (NFR-R1):** All `globalState.update()` calls wrapped in try/catch with `logger.error`, never rethrow.

**Event emitter pattern:** `XpManager extends EventEmitter` — emits `'levelUp'` with `{ previousLevel, newLevel, totalXp }` payload. Story 9.5 subscribes to this event for AchievementBurst. Same EventEmitter pattern as `SessionManager`.

**Feature tracking:** Add `recordFeatureUsed(feature: string)` to `SessionRatioTracker` (not a new class) — keeps all per-session metrics in one place.

**Level formula:** Level 1 threshold = 0 XP. Level 2 threshold = 500 XP. Each subsequent level threshold = previous × 2. `computeLevelForXp(xp)` iterates: threshold starts at 500, doubles each iteration; level counter starts at 2 and increments while `xp >= threshold`.

**Date comparison for streaks:** Use UTC date strings (`new Date().toISOString().slice(0, 10)` = `'YYYY-MM-DD'`). "Yesterday" = today's date minus 1 day.

### Critical File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/types.ts` | EXTEND | Add `XpRecord` interface |
| `src/shared/constants.ts` | EXTEND | Add XP constants |
| `src/extension/stats/xp-manager.ts` | CREATE | `XpManager` class |
| `src/extension/stats/session-record-schema.ts` | EXTEND | Add `XpRecordSchema` |
| `src/extension/stats/session-ratio-tracker.ts` | EXTEND | Add feature tracking methods |
| `src/extension/input/input-router.ts` | EXTEND | Wire feature classification |
| `src/extension/input/radial-wheel-controller.ts` | EXTEND | Wire radialWheel feature usage |
| `src/extension/extension.ts` | EXTEND | Instantiate `XpManager`; wire session finalization |
| `test/unit/extension/stats/xp-manager.test.ts` | CREATE | Unit tests for `XpManager` |
| `test/unit/extension/stats/session-ratio-tracker.test.ts` | EXTEND | Add feature tracking tests |
| `test/unit/input/input-router.test.ts` | EXTEND | Add feature classification tests |

### XP Award Logic

```typescript
// XP earned per session:
let earned = 0
if (record.controllerOnly) earned += XP_CONTROLLER_ONLY        // +100
if (record.ratio >= HIGH_RATIO_THRESHOLD) earned += XP_HIGH_RATIO  // +50
if (distinctFeatureCount >= MULTI_FEATURE_MIN_COUNT) earned += XP_MULTI_FEATURE  // +25
earned += streakDays * XP_STREAK_PER_DAY                        // streak × 10
```

### Feature Categories (for `recordFeatureUsed`)

| Feature Key | Triggered By |
|-------------|-------------|
| `'radialWheel'` | L2/R2 hold + right stick dispatch (`RadialWheelController`) |
| `'sessionSwitch'` | `vibesense.switchSessionNext` / `vibesense.switchSessionPrev` |
| `'miniGame'` | `vibesense.toggleGame` |
| `'voicePtt'` | `vibesense.voicePtt` |
| `'quickPanel'` | `vibesense.openQuickPanel` |
| `'hud'` | `vibesense.toggleHud` |
| `'quicksave'` | `vibesense.quicksave` |

---

## Dev Agent Record

### Implementation Plan

Story 9.3 XP System implementation:
1. Add `XpRecord` type + constants
2. Add feature tracking to `SessionRatioTracker`
3. Wire feature tracking in `InputRouter` and `RadialWheelController`
4. Create `XpManager` with level/streak/XP award logic
5. Add `XpRecordSchema` for defensive parsing
6. Wire into `extension.ts`
7. Write tests

### Debug Log

_No issues encountered during implementation._

### Completion Notes

Implemented the full XP system, level progression, and daily usage streak for Story 9.3:

- **`XpRecord` type + XP constants:** Added `XpRecord` interface to `src/shared/types.ts` and 8 XP constants to `src/shared/constants.ts` (keys, XP amounts, thresholds).
- **`XpManager`:** Created `src/extension/stats/xp-manager.ts` as an `EventEmitter` subclass. Implements `load()` (defensive zod parse), `computeLevelForXp()` (pure function, level doubles at each threshold), `computeStreak()` (pure, handles all date edge cases), and `awardSessionXp()` (stacks all XP bonuses, emits `'levelUp'` event on threshold crossing, persists to globalState). All methods wrapped in try/catch (NFR-R1).
- **`XpRecordSchema`:** Added to `src/extension/stats/session-record-schema.ts` for defensive globalState parsing.
- **Feature tracking:** Added `recordFeatureUsed()` and `getDistinctFeatureCount()` to `SessionRatioTracker`. Added `InputRouter.classifyFeature()` static method to map command IDs to 7 feature categories. Wired into both `InputRouter.executeCommand()` and `RadialWheelController` dispatch points (L2 and R2). Feature set is cleared on `reset()`.
- **Extension wiring:** `XpManager` instantiated in `extension.ts`, levelUp event logged, session finalization dispose handler reads latest `SessionRecord` from history and calls `xpManager.awardSessionXp()`. Reordered instantiation to fix `ratioTracker`/`radialWheelController` ordering issue. Imported `SESSION_HISTORY_KEY` and `SessionHistorySchema` statically.
- **Tests:** 42 tests in `xp-manager.test.ts` covering all ACs, level formula, streak edge cases (month/year boundaries), error resilience. 7 tests added to `session-ratio-tracker.test.ts` for feature tracking. 9 tests added to `input-router.test.ts` for `classifyFeature()`. All 965 tests pass.

---

## File List

- `src/shared/types.ts` — EXTENDED: added `XpRecord` interface
- `src/shared/constants.ts` — EXTENDED: added XP_KEY, XP_CONTROLLER_ONLY, XP_HIGH_RATIO, XP_MULTI_FEATURE, XP_STREAK_PER_DAY, HIGH_RATIO_THRESHOLD, MULTI_FEATURE_MIN_COUNT, LEVEL_2_XP_THRESHOLD
- `src/extension/stats/xp-manager.ts` — CREATED: `XpManager` class with XP award, level computation, streak logic, levelUp event
- `src/extension/stats/session-record-schema.ts` — EXTENDED: added `XpRecordSchema`
- `src/extension/stats/session-ratio-tracker.ts` — EXTENDED: added `recordFeatureUsed()`, `getDistinctFeatureCount()`, `featuresUsed` Set, reset() updated
- `src/extension/input/input-router.ts` — EXTENDED: added `classifyFeature()` static method, wired feature tracking in `executeCommand()`
- `src/extension/input/radial-wheel-controller.ts` — EXTENDED: added optional `ratioTracker` constructor param, wired `recordFeatureUsed('radialWheel')` in L2 and R2 dispatch paths
- `src/extension/extension.ts` — EXTENDED: imported `SESSION_HISTORY_KEY`, `SessionHistorySchema`, `XpManager`; instantiated `XpManager`; wired levelUp log listener; extended dispose handler for XP award; passed `ratioTracker` to `RadialWheelController`; fixed instantiation ordering
- `test/unit/extension/stats/xp-manager.test.ts` — CREATED: 42 unit tests
- `test/unit/extension/stats/session-ratio-tracker.test.ts` — EXTENDED: 7 feature tracking tests
- `test/unit/input/input-router.test.ts` — EXTENDED: updated mock + 9 classifyFeature tests
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — UPDATED: 9-3 → review
- `_bmad-output/implementation-artifacts/9-3-xp-system-levels-streaks.md` — CREATED: story file

---

## Change Log

- 2026-04-01: Story 9.3 implemented — XP system, levels, and daily usage streaks. 16 new tests added (42 total in xp-manager.test.ts, 7 feature tracking in session-ratio-tracker.test.ts, 9 InputRouter.classifyFeature in input-router.test.ts). All 965 tests pass.
