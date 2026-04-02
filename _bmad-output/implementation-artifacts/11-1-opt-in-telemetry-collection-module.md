# Story 11.1: Opt-In Telemetry Collection Module

## Story

**As the VibeSense team,**
I want an isolated `src/extension/telemetry/telemetry.ts` module that collects aggregate-only, non-PII usage signals when the user has explicitly opted in,
So that we can measure product adoption and feature usage while maintaining full user trust.

**Depends on:** Epic 9 complete (stats tracking exists as the data foundation)
**Can run in parallel with:** Story 11.2

---

## Acceptance Criteria

**AC1 — Telemetry payload on session end:**
Given a user has opted in to telemetry,
When a session ends,
Then the telemetry module batches and sends: Controller-Only Session Completion Rate (boolean), controller action ratio (aggregate %), feature usage signals (which features were active), session duration (count), agent interaction count (count), controller type, platform,
And no keystrokes, terminal content, file names, project names, or PII are ever included.

**AC2 — Payload inspectability (NFR-S4):**
Given the telemetry module sends a payload,
When VSCode Developer Tools are open,
Then the exact JSON payload being transmitted is loggable locally,
And it uses HTTPS with TLS 1.2+ (enforced by Node.js default TLS stack; no HTTP fallback).

**AC3 — Telemetry isolation (Architecture — Telemetry Isolation):**
Given the telemetry module is the only module that calls telemetry APIs,
When any other module is reviewed,
Then no imports from `src/extension/telemetry/` exist outside of the activation entry point (`src/extension/extension.ts`),
And this is enforced by an ESLint rule.

---

## Tasks / Subtasks

- [x] **Task 1: Create telemetry schema and types**
  - [x] 1.1 Create `src/extension/telemetry/telemetry-schema.ts` with Zod schema for `TelemetryPayload`
  - [x] 1.2 Schema must enforce: no PII fields, only aggregate counts/booleans/ratios

- [x] **Task 2: Create TelemetryCollector module**
  - [x] 2.1 Create `src/extension/telemetry/telemetry.ts` with `TelemetryCollector` class
  - [x] 2.2 Constructor accepts `globalState: vscode.Memento` (reads opt-in setting) and `getConfig: () => vscode.WorkspaceConfiguration` (live opt-in reads)
  - [x] 2.3 `collectSession(record, context)` method: reads opt-in setting, builds payload from SessionRecord + context, logs payload via logger (inspectability — AC2), queues for transmission
  - [x] 2.4 Payload includes: controllerOnly (boolean), controllerActionRatio (number 0–1), featuresActive (string[]), sessionDurationMs (number), agentInteractionCount (number), controllerType (ControllerType | null), platform (string)
  - [x] 2.5 Payload MUST NOT include: keystrokes, file names, project names, terminal content, any user-identifiable fields
  - [x] 2.6 `isOptedIn()` method: reads `vibesense.telemetry.enabled` from VSCode config — returns false by default (opt-in, not opt-out)
  - [x] 2.7 No-op when opted out (collectSession returns immediately if !isOptedIn())

- [x] **Task 3: Add `vibesense.telemetry.enabled` VSCode setting**
  - [x] 3.1 Add setting to `package.json` contributes.configuration.properties
  - [x] 3.2 Default: `false` (opt-in — telemetry OFF by default, per FR44/FR45)
  - [x] 3.3 Description clearly states what is and is NOT collected

- [x] **Task 4: Add ESLint isolation rule**
  - [x] 4.1 Add `no-restricted-imports` rule to `.eslintrc.json` restricting telemetry imports outside of `src/extension/extension.ts`
  - [x] 4.2 Rule pattern: block `**/telemetry/**` from all `src/extension/**` files EXCEPT `extension.ts`

- [x] **Task 5: Wire TelemetryCollector into extension.ts**
  - [x] 5.1 Instantiate `TelemetryCollector` in `activate()`
  - [x] 5.2 Call `telemetryCollector.collectSession(latest, context)` in the session finalization dispose handler (after XP award)
  - [x] 5.3 Add story comment: `// Story 11.1: Telemetry collection — opt-in only`

- [x] **Task 6: Add globalState key constant**
  - [x] 6.1 Add `TELEMETRY_QUEUE_KEY = 'vibesense.telemetryQueue'` to `src/shared/constants.ts`

- [x] **Task 7: Write unit tests**
  - [x] 7.1 Create `test/unit/extension/telemetry/telemetry.test.ts`
  - [x] 7.2 Test: no-op when opted out
  - [x] 7.3 Test: collects payload when opted in
  - [x] 7.4 Test: payload contains correct fields (controllerOnly, ratio, platform, etc.)
  - [x] 7.5 Test: payload never contains PII fields
  - [x] 7.6 Test: logs payload for inspectability (NFR-S4)
  - [x] 7.7 Test: isOptedIn() returns false by default
  - [x] 7.8 Test: isOptedIn() returns true when setting is true

---

## Dev Notes

### Architecture Requirements
- `src/extension/telemetry/` is the ONLY place that builds or queues telemetry payloads
- Only `src/extension/extension.ts` may import from `src/extension/telemetry/`
- Use `logger.info()` with the serialized JSON payload to satisfy NFR-S4 (inspectability when DevTools open)
- At MVP: telemetry is collected locally only — no network calls yet (Story 11.3 activates transmission)
- Use `vscode.workspace.getConfiguration('vibesense').get<boolean>('telemetry.enabled') ?? false` pattern for live opt-in reads
- Default must be `false` — opt-in, NOT opt-out

### Payload Schema (non-exhaustive)
```typescript
interface TelemetryPayload {
  version: string          // payload schema version ("1.0")
  timestamp: number        // Unix epoch ms (session end time)
  controllerOnly: boolean  // from SessionRecord.controllerOnly
  controllerActionRatio: number  // from SessionRecord.ratio
  featuresActive: string[] // from SessionRatioTracker.getDistinctFeatureNames() — feature names only, no user data
  sessionDurationMs: number  // endedAt - startedAt
  agentInteractionCount: number  // from SessionRecord.controllerActions
  controllerType: string | null  // 'dualsense' | 'xbox' | 'generic-hid' | null
  platform: string         // process.platform ('darwin', 'linux', 'win32')
}
```

### PII Constraints
The following must NEVER appear in payloads:
- File names, project names, workspace paths
- Terminal content, command text
- User name, machine name, extension path
- Any free-text string from user input

### Testing Patterns
- Use Vitest (not Jest) — see existing test files
- Mock `vscode` and `logger` at top of test file
- Use `vi.fn()` for all mocks
- Use `vi.mock()` for module mocks
- Mock `vscode.workspace.getConfiguration` to control opt-in state

---

## Dev Agent Record

### Implementation Plan
Story 11.1 implements an isolated telemetry collection module:
1. Schema + types in `telemetry-schema.ts` (Zod validation)
2. `TelemetryCollector` class in `telemetry.ts` — collects aggregate session data when opted in, logs for inspectability
3. ESLint import isolation rule in `.eslintrc.json`
4. Package.json setting (`vibesense.telemetry.enabled`, default false)
5. Wire into extension.ts session finalization handler
6. Comprehensive unit tests

### Debug Log
_No issues encountered during implementation._

### Completion Notes
- Implemented `TelemetryCollector` class in `src/extension/telemetry/telemetry.ts`
- Implemented Zod schema in `src/extension/telemetry/telemetry-schema.ts`
- Added `vibesense.telemetry.enabled` setting to `package.json` (default: false)
- Added `TELEMETRY_QUEUE_KEY` constant to `src/shared/constants.ts`
- Added ESLint no-restricted-imports rule for telemetry isolation (AC3)
- Wired into `src/extension/extension.ts` session finalization
- 24 unit tests covering all ACs: no-op when opted out, payload correctness, PII exclusion, inspectability, isOptedIn() behavior
- All tests pass, no regressions

---

## File List

- `src/extension/telemetry/.gitkeep` (deleted — replaced by actual files)
- `src/extension/telemetry/telemetry.ts` (new)
- `src/extension/telemetry/telemetry-schema.ts` (new)
- `src/extension/extension.ts` (modified — wire TelemetryCollector)
- `src/shared/constants.ts` (modified — add TELEMETRY_QUEUE_KEY)
- `package.json` (modified — add vibesense.telemetry.enabled setting)
- `.eslintrc.json` (modified — add telemetry isolation rule)
- `test/unit/extension/telemetry/telemetry.test.ts` (new)

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-02 | Initial implementation of opt-in telemetry collection module (Story 11.1) | Dev Agent |

---

## Status

review
