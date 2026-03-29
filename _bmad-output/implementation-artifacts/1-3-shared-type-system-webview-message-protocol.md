# Story 1.3: Shared Type System & Webview Message Protocol

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a typed discriminated union message protocol in `src/shared/messages.ts` validated with Zod, plus shared domain types in `src/shared/types.ts` and constants in `src/shared/constants.ts`,
so that all Webview↔host communication is type-safe, trust boundaries are enforced, and there is a single source of truth for domain types used across both contexts.

## Acceptance Criteria

1. **Given** Story 1.1 is merged, **When** `src/shared/messages.ts` is created, **Then** it exports `HostMessage` and `WebviewMessage` as typed discriminated unions with at minimum these initial message types: `FSM_STATE_CHANGED`, `CONTROLLER_CONNECTED`, `SESSION_LIST_UPDATED` (host→webview) and `WHEEL_SEGMENT_SELECTED`, `APPROVE_ACTION` (webview→host), **And** both the extension host and Webview contexts can import from `src/shared/` without TypeScript errors.

2. **Given** Story 1.1 is merged, **When** `src/shared/types.ts` is created, **Then** it exports `AgentState`, `HapticPattern`, `ControllerType`, `ControllerEvent`, `Session`, and `ButtonId` as defined in the Architecture document.

3. **Given** Story 1.1 is merged, **When** `src/shared/constants.ts` is inspected, **Then** it exports `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` (already defined in Story 1.1) and all timing constants.

4. **Given** a Webview posts an unknown message type to the extension host, **When** the `onDidReceiveMessage` handler receives it, **Then** the message is silently dropped — never executed, **And** no error is thrown in the extension host.

5. **Given** an incoming IPC payload or Webview message, **When** it is parsed with the corresponding Zod schema, **Then** unknown fields are stripped, **And** a `ZodError` is thrown (and caught/logged) for payloads that fail required field validation.

6. **Given** the message types and domain types are defined, **When** `npm run typecheck` is run, **Then** `tsc --noEmit` passes on both `tsconfig.node.json` and `tsconfig.webview.json` with zero errors.

7. **Given** the message protocol is defined, **When** Zod schemas for `HostMessage` and `WebviewMessage` are inspected, **Then** each message type has a corresponding Zod schema that validates the discriminant `type` field and all payload fields.

## Tasks / Subtasks

- [x] Task 1: Install Zod dependency (AC: 5, 7)
  - [x] Run `npm install zod` — Zod is the single validation library; do NOT install alternatives (ajv, joi, yup)
  - [x] Verify Zod appears in `dependencies` in `package.json` (runtime dependency, not devDependency — needed in both extension host and webview bundle)
  - [x] Confirm `npm run build` still produces both bundles without errors after install

- [x] Task 2: Implement `src/shared/types.ts` — domain types (AC: 2)
  - [x] Define `AgentState` as a string union type: `'idle' | 'processing' | 'needs-input' | 'error'`
  - [x] Define `ControllerType` as a string union type: `'dualsense' | 'xbox' | 'generic-hid'`
  - [x] Define `HapticPattern` as a string union type: `'single_pulse' | 'double_pulse' | 'triple_pulse' | 'slow_rumble' | 'none'`
  - [x] Define `ButtonId` — represent all DualSense and Xbox button identifiers (e.g., `'cross' | 'circle' | 'square' | 'triangle' | 'l1' | 'r1' | 'l2' | 'r2' | 'l3' | 'r3' | 'up' | 'down' | 'left' | 'right' | 'options' | 'touchpad' | 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'ls' | 'rs' | 'menu' | 'view'`)
  - [x] Define `AxisId` as a string union: `'left_x' | 'left_y' | 'right_x' | 'right_y' | 'l2' | 'r2'`
  - [x] Define `Session` as an interface: `{ sessionId: string; agentState: AgentState; label?: string }`
  - [x] Define `ControllerEvent` as a discriminated union using `kind` as discriminant:
    - `{ kind: 'button'; button: ButtonId; pressed: boolean }`
    - `{ kind: 'axis'; axis: AxisId; value: number }` (value: -1.0 to 1.0)
    - `{ kind: 'connected'; controllerType: ControllerType }`
    - `{ kind: 'disconnected' }`
    - `{ kind: 'battery'; level: number }` (level: 0–100)
  - [x] Verify NO Node.js or browser-specific APIs are imported — pure TypeScript types only
  - [x] Verify file exports all 7 types (AgentState, ControllerType, HapticPattern, ButtonId, AxisId, Session, ControllerEvent)

- [x] Task 3: Implement `src/shared/messages.ts` — typed discriminated unions + Zod schemas (AC: 1, 4, 5, 7)
  - [x] Define `HostMessage` TypeScript type as discriminated union (discriminant: `type`):
    - `{ type: 'FSM_STATE_CHANGED'; payload: { sessionId: string; state: AgentState } }`
    - `{ type: 'CONTROLLER_CONNECTED'; payload: { controllerType: ControllerType } }`
    - `{ type: 'SESSION_LIST_UPDATED'; payload: { sessions: Session[] } }`
  - [x] Define `WebviewMessage` TypeScript type as discriminated union (discriminant: `type`):
    - `{ type: 'WHEEL_SEGMENT_SELECTED'; payload: { segmentIndex: number } }`
    - `{ type: 'APPROVE_ACTION'; payload: Record<string, never> }`
  - [x] Create Zod schema `HostMessageSchema` matching the `HostMessage` type exactly using `z.discriminatedUnion('type', [...])`
  - [x] Create Zod schema `WebviewMessageSchema` matching the `WebviewMessage` type exactly using `z.discriminatedUnion('type', [...])`
  - [x] Export both TypeScript types AND Zod schemas from `src/shared/messages.ts`
  - [x] Use `z.discriminatedUnion` (NOT `z.union`) for both schemas — enables O(1) lookup on the `type` discriminant
  - [x] Use `.strict()` on each sub-schema object OR `.strip()` on the outer union to strip unknown fields
  - [x] Do NOT import `vscode`, `node-hid`, DOM APIs, or any Node.js built-in modules

- [x] Task 4: Verify `src/shared/constants.ts` is complete (AC: 3)
  - [x] Confirm `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` exists (defined in Story 1.1)
  - [x] Confirm timing constants exist: `INPUT_BUFFER_WINDOW_MS`, `CONTROLLER_RECONNECT_TIMEOUT_MS`, `GAME_LAUNCH_COUNTDOWN_MS`, `SESSION_SWITCHER_DISPLAY_MS` (defined in Story 1.1)
  - [x] No changes required to constants.ts — verify only; do not modify unless a constant is missing

- [x] Task 5: Validate parse helper function (AC: 4, 5)
  - [x] Add exported helper `parseWebviewMessage(raw: unknown): WebviewMessage | null` in `src/shared/messages.ts`:
    - Calls `WebviewMessageSchema.safeParse(raw)`
    - Returns parsed data on success
    - Returns `null` on failure (caller logs and drops — never throws)
  - [x] Add exported helper `parseHostMessage(raw: unknown): HostMessage | null` in `src/shared/messages.ts`:
    - Calls `HostMessageSchema.safeParse(raw)`
    - Returns parsed data on success
    - Returns `null` on failure

- [x] Task 6: Run typecheck and build verification (AC: 6)
  - [x] Run `npm run typecheck` — must produce zero errors on both tsconfig.node.json and tsconfig.webview.json
  - [x] Run `npm run build` — must produce both bundles without errors
  - [x] Run `npm run lint` — zero lint errors or warnings
  - [x] Confirm both `src/extension/extension.ts` and `src/webview/radial-wheel/index.tsx` can import from `src/shared/` without errors (test via typecheck, not at runtime)

- [x] Task 7: Write unit tests for message schemas (no testing framework yet — stub test)
  - [x] Note: Story 1.5 sets up Vitest. For this story, create `test/unit/shared/messages.test.ts` as a stub with commented-out test cases documenting what needs testing:
    - Valid `HostMessage` parse succeeds
    - Valid `WebviewMessage` parse succeeds
    - Unknown `type` discriminant returns null / ZodError
    - Extra unknown fields are stripped on valid parses
    - Missing required payload fields return null / ZodError
  - [x] The stub file should NOT contain runnable tests (no test runner configured yet) — only import statements and commented test cases to be activated in Story 1.5

## Dev Notes

### Critical Architecture Constraints

**Context Boundary Rule — STRICTLY ENFORCED:**
- `src/shared/` must contain ZERO Node.js or browser-specific APIs — pure TypeScript types and constants ONLY
- Do NOT import `vscode`, `node`, DOM APIs, `node-hid`, `dualsense-ts`, or any runtime-specific module
- Both `tsconfig.node.json` (extension host) and `tsconfig.webview.json` (Webview) include `src/shared/**/*` — any runtime API import will cause a typecheck failure on at least one config
- [Source: architecture.md#Structure Patterns]

**Zod as the ONLY validation library:**
- Zod is specified by architecture as the single validation library for all trust boundaries
- Do NOT introduce `ajv`, `joi`, `yup`, or any other validation library
- Zod must go in `dependencies` (not `devDependencies`) — it is required at runtime in both the extension host and the Webview bundle
- [Source: architecture.md#Authentication & Security, architecture.md#Data Architecture]

**Discriminant field naming:**
- Message type discriminant: `type` (SCREAMING_SNAKE_CASE values) — `HostMessage`, `WebviewMessage`
- Controller event discriminant: `kind` (lowercase) — `ControllerEvent`
- These naming conventions are locked; do not deviate
- [Source: architecture.md#Naming Patterns, architecture.md#Format Patterns]

**`z.discriminatedUnion` over `z.union`:**
- Use `z.discriminatedUnion('type', [...])` for message schemas — O(1) discriminant lookup vs O(n) union matching
- This is the correct Zod API for discriminated unions; `z.union` would be functionally correct but architecturally wrong
- [Source: architecture.md#Format Patterns — Webview message protocol]

**Silent drop pattern for unknown message types:**
- The architecture requires unknown Webview messages be silently dropped — never executed, never throw
- The `parseWebviewMessage` helper returning `null` on failure implements this pattern correctly
- The extension host's `onDidReceiveMessage` handler will call `parseWebviewMessage(msg)` and check for null
- [Source: architecture.md#Authentication & Security]

### What Story 1.1 Already Created (Do Not Re-create)

The following stubs were created in Story 1.1 and need to be REPLACED with full implementations:
- `src/shared/messages.ts` — currently `export {}` stub; replace with full content
- `src/shared/types.ts` — currently `export {}` stub; replace with full content
- `src/shared/constants.ts` — already COMPLETE with `VIBESENSE_SOCKET_PATH` and timing constants; verify only

Do NOT modify `webpack.config.js`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.webview.json`, `.eslintrc.json`, or `package.json` (other than adding `zod` as a dependency).

### Exact Type Shapes from Architecture

**`HostMessage` TypeScript type:**
```typescript
type HostMessage =
  | { type: 'FSM_STATE_CHANGED'; payload: { sessionId: string; state: AgentState } }
  | { type: 'CONTROLLER_CONNECTED'; payload: { controllerType: ControllerType } }
  | { type: 'SESSION_LIST_UPDATED'; payload: { sessions: Session[] } }
```

**`WebviewMessage` TypeScript type:**
```typescript
type WebviewMessage =
  | { type: 'WHEEL_SEGMENT_SELECTED'; payload: { segmentIndex: number } }
  | { type: 'APPROVE_ACTION'; payload: Record<string, never> }
```

**`ControllerEvent` TypeScript type:**
```typescript
type ControllerEvent =
  | { kind: 'button'; button: ButtonId; pressed: boolean }
  | { kind: 'axis'; axis: AxisId; value: number }   // -1.0 to 1.0
  | { kind: 'connected'; controllerType: ControllerType }
  | { kind: 'disconnected' }
  | { kind: 'battery'; level: number }               // 0–100
```

Note: `ControllerEvent` is defined in `src/shared/types.ts`, NOT in `src/shared/messages.ts`. Messages are Webview↔host; ControllerEvent is the HAL event shape (used in Story 2.1).

**`Session` interface:**
```typescript
interface Session {
  sessionId: string
  agentState: AgentState
  label?: string
}
```

Note: `FSM_STATE_CHANGED` payload includes `sessionId: string` to identify which session changed state — this supports the per-session FSM design where `session-manager.ts` maintains `Map<sessionId, AgentFSM>`.

### Zod Schema Pattern

```typescript
import { z } from 'zod'
import type { AgentState, ControllerType, Session } from './types'

// Re-export Zod schemas for the shared types
export const AgentStateSchema = z.enum(['idle', 'processing', 'needs-input', 'error'])
export const ControllerTypeSchema = z.enum(['dualsense', 'xbox', 'generic-hid'])
export const SessionSchema = z.object({
  sessionId: z.string(),
  agentState: AgentStateSchema,
  label: z.string().optional(),
})

export const HostMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('FSM_STATE_CHANGED'), payload: z.object({ sessionId: z.string(), state: AgentStateSchema }) }),
  z.object({ type: z.literal('CONTROLLER_CONNECTED'), payload: z.object({ controllerType: ControllerTypeSchema }) }),
  z.object({ type: z.literal('SESSION_LIST_UPDATED'), payload: z.object({ sessions: z.array(SessionSchema) }) }),
])

export const WebviewMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WHEEL_SEGMENT_SELECTED'), payload: z.object({ segmentIndex: z.number().int().nonnegative() }) }),
  z.object({ type: z.literal('APPROVE_ACTION'), payload: z.object({}) }),
])

export type HostMessage = z.infer<typeof HostMessageSchema>
export type WebviewMessage = z.infer<typeof WebviewMessageSchema>
```

**Important:** Derive the TypeScript types from the Zod schemas using `z.infer<>`. This guarantees the types and schemas are always in sync — no manual duplication needed.

### Parse Helper Pattern

```typescript
export function parseWebviewMessage(raw: unknown): WebviewMessage | null {
  const result = WebviewMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}

export function parseHostMessage(raw: unknown): HostMessage | null {
  const result = HostMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}
```

The caller (extension host `onDidReceiveMessage`) uses it like:
```typescript
panel.webview.onDidReceiveMessage((raw: unknown) => {
  const msg = parseWebviewMessage(raw)
  if (msg === null) return  // silently drop unknown messages
  // handle msg — fully typed here
})
```

### What NOT to Implement in This Story

- **Do NOT implement `onDidReceiveMessage` handler** — that is in `src/extension/panels/` (Story scope for each panel story in Epic 3, 7, 8, 9, etc.)
- **Do NOT implement `panel.webview.postMessage()` calls** — same, those are panel-specific
- **Do NOT install `node-hid` or `dualsense-ts`** — Story 1.2 scope
- **Do NOT configure Vitest or `@vscode/test-electron`** — Story 1.5 scope (test stub only for this story)
- **Do NOT add new constants** to `constants.ts` beyond what Story 1.1 already defined (unless a constant is genuinely missing from the spec)
- **Do NOT add new message types** beyond the 5 specified in acceptance criteria — future stories add their own types to this file

### Testing Framework Status

Story 1.5 has NOT been implemented yet (status: backlog). Do not configure Vitest. The test file `test/unit/shared/messages.test.ts` created in Task 7 should be a stub with commented-out tests — it will be activated by Story 1.5.

The `test/unit/` directory already exists from Story 1.1. Create `test/unit/shared/` subdirectory with `messages.test.ts`.

### Logger Status

`src/extension/logger.ts` is a stub (Story 1.5 implements the full singleton). For this story, no logging is needed — the `parseWebviewMessage` helper returns `null` on failure; the extension host caller will use the logger (when available) at the call site.

### Naming Conventions (Enforced by ESLint)

| Artifact | Convention | Example |
|----------|------------|---------|
| Types/interfaces/enums | `PascalCase` | `AgentState`, `HostMessage`, `Session` |
| Zod schemas | `PascalCase` + `Schema` suffix | `HostMessageSchema`, `AgentStateSchema` |
| Helper functions | `camelCase` | `parseWebviewMessage`, `parseHostMessage` |
| Message type discriminants | `SCREAMING_SNAKE_CASE` | `FSM_STATE_CHANGED`, `WHEEL_SEGMENT_SELECTED` |
| Controller event discriminants | `lowercase` | `button`, `axis`, `connected`, `disconnected`, `battery` |

### Project Structure Notes

- `src/shared/messages.ts` — Webview↔host message protocol (this story's primary file)
- `src/shared/types.ts` — domain types used across contexts (ControllerEvent, AgentState, etc.)
- `src/shared/constants.ts` — runtime constants (already complete from Story 1.1)
- `test/unit/shared/messages.test.ts` — test stub to activate in Story 1.5
- No other files need creation or modification for this story

**Do not create:**
- `src/shared/schemas.ts` (schemas live in messages.ts alongside their types)
- `src/shared/validation.ts` (no separate validation module)
- Any files outside `src/shared/` and `test/unit/shared/`

### References

- [Source: architecture.md#Format Patterns — Webview message protocol] — exact TypeScript shapes for HostMessage, WebviewMessage
- [Source: architecture.md#Format Patterns — HID HAL normalized event shape] — ControllerEvent type
- [Source: architecture.md#Authentication & Security] — Zod validation, silent drop pattern
- [Source: architecture.md#API & Communication Patterns — A. Webview ↔ Extension Host] — postMessage protocol
- [Source: architecture.md#Naming Patterns] — type naming, discriminant naming conventions
- [Source: architecture.md#Structure Patterns] — context boundary rule, src/shared/ constraints
- [Source: architecture.md#Enforcement Guidelines] — all-agents rules
- [Source: epics.md#Story 1.3] — acceptance criteria, depends-on, message types list
- [Source: implementation-artifacts/1-1-extension-scaffold-dual-target-build-system.md#Task 8] — confirms stubs exist, constants.ts already has VIBESENSE_SOCKET_PATH

### Review Findings

- [x] [Review][Defer] No compile-time linkage between `types.ts` manual types and `messages.ts` Zod schemas [src/shared/messages.ts, src/shared/types.ts] — deferred, pre-existing architectural choice. The Zod schemas in `messages.ts` independently re-declare `AgentState`, `ControllerType`, and `Session` shapes without importing from `types.ts`. If one is updated without the other, they can drift silently. Consider adding `satisfies` type assertions in a future story to enforce compile-time sync.

**Code review complete.** 0 `decision-needed`, 0 `patch`, 1 `defer`, 0 dismissed as noise.

Review performed by: claude-opus-4-6 (2026-03-29)
Verification: typecheck PASS, lint PASS, build PASS, runtime Zod validation PASS. All 7 acceptance criteria satisfied.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — implementation proceeded without issues.

### Completion Notes List

- Installed Zod v4.3.6 as a runtime dependency (in `dependencies`, not `devDependencies`), confirming it bundles into both the extension host and webview.
- Implemented `src/shared/types.ts` with all 7 required types: `AgentState`, `ControllerType`, `HapticPattern`, `ButtonId`, `AxisId`, `Session`, `ControllerEvent`. Zero Node.js or browser-specific API imports — pure TypeScript types only.
- Implemented `src/shared/messages.ts` with: `AgentStateSchema`, `ControllerTypeSchema`, `SessionSchema` Zod schemas; `HostMessageSchema` and `WebviewMessageSchema` as `z.discriminatedUnion` (O(1) lookup); TypeScript types `HostMessage` and `WebviewMessage` derived via `z.infer<>` for guaranteed sync; `parseWebviewMessage` and `parseHostMessage` helpers that return `null` on failure (silent drop pattern). Zod v4's default `z.object()` strips unknown fields.
- Verified `src/shared/constants.ts` already complete from Story 1.1 with `VIBESENSE_SOCKET_PATH` and all 4 timing constants.
- `npm run typecheck` passes with zero errors on both `tsconfig.node.json` and `tsconfig.webview.json`.
- `npm run build` produces both bundles (`extension.js`, `radial-wheel.js`) without errors.
- `npm run lint` passes with zero errors or warnings.
- Created `test/unit/shared/messages.test.ts` as a stub with commented-out test cases (to be activated in Story 1.5 when Vitest is configured).

### File List

- `src/shared/types.ts` — replaced stub with full domain type definitions
- `src/shared/messages.ts` — replaced stub with full Zod schemas, TypeScript types, and parse helpers
- `src/shared/constants.ts` — verified complete; no changes made
- `test/unit/shared/messages.test.ts` — created stub test file with commented-out test cases
- `package.json` — added `zod ^4.3.6` to `dependencies`
- `package-lock.json` — updated by npm install

## Change Log

- 2026-03-29: Story 1.3 implemented — shared type system and Webview message protocol. Installed Zod v4.3.6; implemented `src/shared/types.ts` with all domain types; implemented `src/shared/messages.ts` with discriminated union Zod schemas, inferred TypeScript types, and parse helpers; verified `src/shared/constants.ts` complete; all typecheck/lint/build validations pass; created test stub for Story 1.5.
