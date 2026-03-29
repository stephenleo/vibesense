# Story 1.5: Testing Framework & Logger Singleton

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Vitest configured for unit/webview tests and `@vscode/test-electron` for integration tests, plus a `logger` singleton wrapping `vscode.window.createOutputChannel('VibeSense')`,
so that all logic can be tested in isolation and all extension host logging is centralized and visible to users via the Output panel.

## Acceptance Criteria

1. **Given** Story 1.1 is merged,
   **When** `npm test` is run,
   **Then** Vitest executes all files under `test/unit/` and `test/webview/` and reports results,
   **And** at least one passing unit test exists as proof-of-life.

2. **Given** the integration test suite is set up,
   **When** `npm run test:integration` is run,
   **Then** `@vscode/test-electron` launches a VSCode Extension Development Host and runs all files under `test/integration/`.

3. **Given** any module in `src/extension/` needs to log,
   **When** `logger.info()`, `logger.warn()`, or `logger.error()` is called,
   **Then** the message appears in the VibeSense Output channel in VSCode,
   **And** no `console.log` calls exist anywhere in `src/extension/` (enforced by ESLint rule `no-console` already configured in `.eslintrc.json`).

## Tasks / Subtasks

- [x] Task 1: Implement the `logger` singleton in `src/extension/logger.ts` (AC: 3)
  - [x] Replace the stub `export {}` in `src/extension/logger.ts` with a real singleton implementation
  - [x] Call `vscode.window.createOutputChannel('VibeSense')` once at module init — store in a module-level variable
  - [x] Export `logger` object with methods: `info(message: string, ...args: unknown[]): void`, `warn(message: string, ...args: unknown[]): void`, `error(message: string, ...args: unknown[]): void`
  - [x] Each method writes a formatted line to the OutputChannel: `[INFO] <timestamp> <message>`, `[WARN] ...`, `[ERROR] ...`
  - [x] Export `disposeLogger(): void` that calls `outputChannel.dispose()` — for use in `deactivate()` in `extension.ts`
  - [x] Update `src/extension/extension.ts`: remove the `// eslint-disable-next-line no-console` + `console.log('VibeSense activating')` line; replace with `logger.info('VibeSense activating')` import from `./logger`
  - [x] Call `disposeLogger()` inside `deactivate()` in `extension.ts`

- [x] Task 2: Install Vitest and configure `vitest.config.ts` (AC: 1)
  - [x] Install devDependencies: `npm install --save-dev vitest @vitest/coverage-v8 jsdom @testing-library/react @testing-library/jest-dom`
  - [x] Create `vitest.config.ts` at project root with two projects:
    - Project `unit`: `include: ['test/unit/**/*.test.ts']`, `environment: 'node'`, `globals: true`
    - Project `webview`: `include: ['test/webview/**/*.test.tsx']`, `environment: 'jsdom'`, `globals: true`
  - [x] Add `"test": "vitest run"` and `"test:watch": "vitest"` and `"test:coverage": "vitest run --coverage"` to `package.json` scripts
  - [x] Ensure `vitest.config.ts` excludes `test/integration/` (those run via `@vscode/test-electron` only)

- [x] Task 3: Write proof-of-life unit test for the logger singleton (AC: 1)
  - [x] Create `test/unit/extension/logger.test.ts`
  - [x] Mock `vscode.window.createOutputChannel` using Vitest `vi.mock()`
  - [x] Assert `logger.info('hello')` calls `outputChannel.appendLine` with a string containing `[INFO]` and `hello`
  - [x] Assert `logger.warn('caution')` calls `outputChannel.appendLine` with `[WARN]`
  - [x] Assert `logger.error('boom')` calls `outputChannel.appendLine` with `[ERROR]`
  - [x] Remove `.gitkeep` from `test/unit/` if it exists

- [x] Task 4: Configure `@vscode/test-electron` for integration tests (AC: 2)
  - [x] Install devDependency: `npm install --save-dev @vscode/test-electron`
  - [x] Create `test/integration/runTests.ts` — the entry script that calls `runTests()` from `@vscode/test-electron` with `extensionDevelopmentPath` pointing to project root and `extensionTestsPath` pointing to `test/integration/suite/index` (compiled path)
  - [x] Create `test/integration/suite/index.ts` that discovers and runs all `*.test.ts` files under `test/integration/suite/`
  - [x] Create `test/integration/suite/extension-activation.test.ts` as proof-of-life: assert the extension activates and `vscode.extensions.getExtension('stephenleo.vibesense')` is defined
  - [x] Add `"test:integration": "node ./out/test/integration/runTests.js"` to `package.json` scripts
  - [x] Add `tsconfig.test.json` extending `tsconfig.node.json` with `include: ['test/**/*']` for compiling test files — OR confirm existing tsconfig covers it
  - [x] Update `.vscode/launch.json`: add an `Extension Tests` launch configuration pointing to the integration runTests entry

- [x] Task 5: Add `npm test` to CI workflow after Story 1.5 merge (AC: 1, 2)
  - [x] Edit `.github/workflows/ci.yml` — add `npm test` step to the `lint-and-typecheck` job (or add a new `unit-test` job) so unit tests run on every PR
  - [x] Do NOT add `npm run test:integration` to CI yet — integration tests require a display and a real VSCode binary; defer to a future story or optional CI step
  - [x] Add a `# TODO: add test:integration to CI once headless VSCode runner is configured` comment

- [x] Task 6: Clean up `test/` directory structure (AC: 1)
  - [x] Remove `.gitkeep` files from `test/unit/`, `test/webview/`, `test/integration/` now that real files exist
  - [x] Verify `test/webview/` is empty except a placeholder (no webview tests needed at this stage — `test/webview/.gitkeep` can be removed or keep as future placeholder)

## Dev Notes

### Critical Implementation Details

**Logger singleton — exact file path and export shape:**
- File: `src/extension/logger.ts` (stub already exists with `export {}`)
- Architecture spec: "All extension host logging through a single `logger` singleton wrapping `vscode.window.createOutputChannel('VibeSense')`"
- The OutputChannel name MUST be `'VibeSense'` — this is what appears in the VSCode Output panel dropdown
- The singleton is module-level (created at import time) — not a class, not lazy — just a module with a single OutputChannel instance
- [Source: architecture.md#Process Patterns → Logging]

**ESLint `no-console` is already enforced:**
- `.eslintrc.json` already has `"no-console": "error"` for `src/extension/**/*.ts` (from Story 1.1)
- The `extension.ts` currently has `// eslint-disable-next-line no-console` + `console.log('VibeSense activating')` — this Story removes that escape hatch entirely
- After this story, `npm run lint` must pass with zero `no-console` violations in `src/extension/`
- [Source: .eslintrc.json overrides[0].rules, story 1.1 Task 5]

**Vitest vs Jest — why Vitest:**
- Architecture explicitly chose Vitest: "fast, ESM-native, no VSCode process required for pure logic testing"
- Do NOT use Jest — it's incompatible with the ESM-native approach
- [Source: architecture.md#Starter Template Evaluation → Layer 3 → Testing]

**`vscode` module mocking in unit tests:**
- Unit tests under `test/unit/` run in Node.js WITHOUT the VSCode Extension Development Host
- The `vscode` module is NOT available in unit tests — it must be mocked
- Use Vitest `vi.mock('vscode', ...)` to provide a fake `createOutputChannel` that returns a mock object with `appendLine`, `show`, `dispose`
- Pattern established in Story 1.1 dev notes: no `@vscode/test-electron` for unit tests — Vitest only
- [Source: architecture.md#Technical Stack → Testing]

**`@vscode/test-electron` — integration test entry:**
- The `runTests.ts` approach uses `@vscode/test-electron` v2.x API: `import { runTests } from '@vscode/test-electron'`
- The test suite file must export `run(): Promise<void>` — standard mocha-like runner pattern used by `@vscode/test-electron`
- These tests DO run in a real VSCode process — vscode APIs are available without mocking
- [Source: epics.md → Story 1.5 Acceptance Criteria 2]

**Test directory structure mirrors source:**
```
test/
  unit/
    extension/
      logger.test.ts        ← THIS story creates this (proof-of-life)
    hid/                    ← hal.test.ts, hid-manager.test.ts (Stories 2.x)
    fsm/                    ← agent-fsm.test.ts (Story 5.x)
    ipc/                    ← pipe-server.test.ts (Story 5.x)
    input/                  ← input-router.test.ts (Story 2.x)
    shared/                 ← messages.test.ts (Story 1.3)
  integration/
    suite/
      index.ts              ← THIS story creates this
      extension-activation.test.ts  ← THIS story creates this
  webview/
    RadialWheel.test.tsx    ← Future story
```
[Source: architecture.md#Complete Project Directory Structure]

**`vitest.config.ts` dual-environment setup:**
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
          environment: 'node',
          globals: true,
        },
      },
      {
        test: {
          name: 'webview',
          include: ['test/webview/**/*.test.tsx'],
          environment: 'jsdom',
          globals: true,
        },
      },
    ],
  },
})
```
- `globals: true` enables `describe`, `it`, `expect` without imports (consistent with existing extension dev ergonomics)
- Unit tests use `environment: 'node'` — no DOM, pure Node.js
- Webview tests use `environment: 'jsdom'` — full browser simulation for React component testing

**`extension.ts` console.log removal — exact diff:**
- REMOVE: the `// eslint-disable-next-line no-console` comment line
- REMOVE: `console.log('VibeSense activating')`
- ADD at top: `import { logger, disposeLogger } from './logger'`
- ADD in `activate()`: `logger.info('VibeSense activating')`
- ADD in `deactivate()`: `disposeLogger()`
- The comment `// TODO Story 1.5: Replace with logger singleton...` should also be removed

### Architecture Constraints

**Context boundary — logger is extension-only:**
- `src/extension/logger.ts` is in the Node.js context — it MUST NOT be imported from `src/webview/`
- Webview panels use browser `console.log` — the `no-console` ESLint rule does NOT apply to `src/webview/`
- [Source: architecture.md#Architectural Boundaries, .eslintrc.json overrides]

**NFR-R1 compliance:**
- The logger itself must never throw — wrap `outputChannel.appendLine` calls in a `try/catch` that silently falls back to `console.error` (acceptable only in the logger itself as a last resort)
- [Source: epics.md NFR-R1: "Any unhandled exception in the extension host must be caught, logged internally, and never propagate to the VSCode process"]

**No co-located test files:**
- Architecture strictly forbids co-located test files: "Place all tests under `test/` — never co-locate test files next to source"
- All test files go under `test/unit/`, `test/integration/`, or `test/webview/` — NEVER `src/**/*.test.ts`
- [Source: architecture.md#Enforcement Guidelines]

### Project Structure Notes

**Files to create:**
- `vitest.config.ts` — Vitest configuration at project root
- `test/unit/extension/logger.test.ts` — unit test proof-of-life
- `test/integration/runTests.ts` — @vscode/test-electron entry
- `test/integration/suite/index.ts` — test suite runner
- `test/integration/suite/extension-activation.test.ts` — integration proof-of-life

**Files to modify:**
- `src/extension/logger.ts` — replace stub with real implementation
- `src/extension/extension.ts` — remove `console.log`, add `logger.info` + `disposeLogger`
- `package.json` — add `test`, `test:watch`, `test:coverage`, `test:integration` scripts + new devDependencies
- `.github/workflows/ci.yml` — add `npm test` step (unit tests only)

**Files NOT to touch:**
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.webview.json` — no changes needed
- `.eslintrc.json` — `no-console` rule already correct from Story 1.1
- `webpack.config.js` — no changes needed
- Any `src/webview/` or `src/shared/` files — out of scope

**Naming conventions:**
- Test files: `<module-name>.test.ts` or `<Component>.test.tsx`
- All kebab-case for non-component files (consistent with existing codebase)
- [Source: story 1.1 Dev Notes → Naming Conventions]

### Previous Story Intelligence (Story 1.1)

**From Story 1.1 dev notes and review findings:**
- `src/extension/logger.ts` exists as a stub — `export {}` — needs full implementation
- `src/extension/extension.ts` has `// eslint-disable-next-line no-console` escape hatch — THIS story removes it permanently
- `test/unit/`, `test/integration/`, `test/webview/` directories exist with `.gitkeep` files — remove `.gitkeep` when adding real files
- ESLint `no-console: error` already enforced for `src/extension/**/*.ts` — no change needed
- Review fix from Story 1.1: `.vscode/launch.json` Extension Tests config path was fixed — verify the integration test launch config points to `out/test/integration/runTests.js`
- Pattern established: `tsconfig.node.json` includes only `src/extension/**/*` and `src/shared/**/*` — test files may need a separate `tsconfig.test.json` that extends `tsconfig.node.json` and adds `test/**/*`
- [Source: story 1.1 Review Findings, Task 6, Task 10]

**Git context from recent commits:**
- Last commit: `fix(story-1-1): code review fixes — remove tsconfig wildcard paths, fix launch config`
- Story 1.1 is done and merged — this story builds directly on that foundation
- No `vitest`, `@vscode/test-electron`, or testing devDependencies in `package.json` yet — all must be installed

### Key Technical Decisions

1. **Singleton pattern for logger:** Module-level variable initialized at import time is idiomatic for VSCode extensions. OutputChannel is created once and reused — calling `createOutputChannel` twice with the same name creates duplicate channels in the Output panel.

2. **Vitest `projects` config (multi-environment):** Using Vitest's built-in multi-project runner avoids needing separate config files for unit vs. webview tests. One `npm test` command runs both.

3. **Integration tests NOT in CI yet:** `@vscode/test-electron` requires a display server and downloads a VSCode binary. This is viable in CI but adds complexity. Defer to a future story or when Linux headless VSCode CI is needed. The `npm test` (Vitest) step IS added to CI in this story.

4. **`vitest.config.ts` at root (NOT inside `src/`):** The config file lives at the project root alongside `webpack.config.js`, `tsconfig.json`, etc. — consistent with project conventions.

### What NOT To Do

- Do NOT use Jest — architecture mandates Vitest
- Do NOT co-locate test files next to source (`src/**/*.test.ts`) — all tests go under `test/`
- Do NOT try to import `vscode` in unit tests without mocking — it will crash
- Do NOT add the integration test step (`npm run test:integration`) to CI in this story — it requires headless VSCode setup
- Do NOT create a second OutputChannel — always reuse the singleton
- Do NOT use `console.log` in `src/extension/` — it's an ESLint error and invisible to users in production
- Do NOT remove or modify the `no-console` ESLint rule — it's already correct
- Do NOT call `outputChannel.show()` automatically in logger methods — that would be intrusive; let users open the Output panel themselves

### References

- [Source: epics.md#Story 1.5] — User story, acceptance criteria, dependencies
- [Source: architecture.md#Starter Template Evaluation → Testing] — Vitest + @vscode/test-electron decision
- [Source: architecture.md#Process Patterns → Logging] — Logger singleton pattern, error handling example
- [Source: architecture.md#Enforcement Guidelines] — no console.log, tests under test/, logger usage
- [Source: architecture.md#Complete Project Directory Structure] — test/ directory layout, vitest.config.ts, logger.ts location
- [Source: .eslintrc.json overrides[0]] — no-console already enforced for src/extension/
- [Source: story 1.1 Task 6, Task 10, Review Findings] — logger stub, test directory gitkeep, launch.json fix
- [Source: epics.md#Additional Requirements] — "Testing framework: @vscode/test-electron for integration tests; Vitest for unit tests; all tests in top-level test/ directory (not co-located)"
- [Source: epics.md#Additional Requirements] — "Logging: All extension host logging via logger singleton wrapping vscode.window.createOutputChannel('VibeSense'); no raw console.log in extension host code"

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

No debug issues encountered. Implementation was straightforward.

### Completion Notes List

- Implemented `logger` singleton in `src/extension/logger.ts` — module-level `OutputChannel` created at import time via `vscode.window.createOutputChannel('VibeSense')`. Exports `logger` with `info`, `warn`, `error` methods, and `disposeLogger()`. Each method formats lines as `[LEVEL] <ISO timestamp> <message>`. NFR-R1 satisfied via try/catch with `eslint-disable-next-line no-console` on the last-resort fallback only.
- Updated `src/extension/extension.ts`: removed `console.log('VibeSense activating')` and its eslint-disable comment; replaced with `logger.info('VibeSense activating')` and added `disposeLogger()` in `deactivate()`.
- Installed Vitest, `@vitest/coverage-v8`, jsdom, `@testing-library/react`, `@testing-library/jest-dom`, and `@vscode/test-electron` as devDependencies.
- Created `vitest.config.ts` at project root with dual-project config: `unit` (node env) + `webview` (jsdom env). Integration tests are excluded by pattern design.
- Added `test`, `test:watch`, `test:coverage`, and `test:integration` scripts to `package.json`.
- Created `test/unit/extension/logger.test.ts` with 6 passing tests using `vi.mock('vscode', ...)`. Confirms `[INFO]`, `[WARN]`, `[ERROR]` formatting, ISO timestamp presence, extra args propagation, and `disposeLogger()` disposal.
- Created `test/integration/runTests.ts`, `test/integration/suite/index.ts`, and `test/integration/suite/extension-activation.test.ts` for `@vscode/test-electron` integration runner.
- Created `tsconfig.test.json` extending `tsconfig.node.json` with `test/**/*` include for compiling test files.
- Updated `.vscode/launch.json` `Extension Tests` config to point to `out/test/integration/suite/index`.
- Created `.github/workflows/ci.yml` with lint, typecheck, and `npm test` (unit tests) steps. Integration tests deferred per story spec.
- Removed all `.gitkeep` files from `test/unit/`, `test/integration/`, `test/webview/`.
- Final validation: `npm test` → 6/6 pass; `npm run lint` → clean; `npm run typecheck` → clean.

### File List

- `src/extension/logger.ts` (modified — replaced stub with full singleton implementation)
- `src/extension/extension.ts` (modified — removed console.log, added logger import and disposeLogger call)
- `vitest.config.ts` (created — Vitest dual-environment config)
- `tsconfig.test.json` (created — TypeScript config for test compilation)
- `package.json` (modified — added test scripts and devDependencies)
- `package-lock.json` (modified — updated by npm install)
- `.vscode/launch.json` (modified — updated Extension Tests path)
- `.github/workflows/ci.yml` (created — CI workflow with lint, typecheck, unit tests)
- `test/unit/extension/logger.test.ts` (created — logger unit tests, 6 passing)
- `test/integration/runTests.ts` (created — @vscode/test-electron entry)
- `test/integration/suite/index.ts` (created — mocha-based test suite runner)
- `test/integration/suite/extension-activation.test.ts` (created — integration proof-of-life)
- `test/unit/.gitkeep` (deleted)
- `test/integration/.gitkeep` (deleted)
- `test/webview/.gitkeep` (deleted)

## Change Log

- 2026-03-29: Story 1.5 implemented — logger singleton, Vitest framework, integration test scaffold, CI workflow (Date: 2026-03-29)
