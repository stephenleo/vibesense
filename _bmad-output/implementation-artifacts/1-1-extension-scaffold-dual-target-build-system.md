# Story 1.1: Extension Scaffold & Dual-Target Build System

Status: done

## Story

As a developer,
I want the extension scaffolded with `yo code` and configured with a dual-target webpack build (Node.js extension host + browser Webview),
so that the extension host and Webview panel contexts are properly isolated from the start and all downstream stories have a correct foundation to build on.

## Acceptance Criteria

1. **Given** an empty repository, **When** the scaffold command is run and augmented, **Then** the project structure contains `src/extension/`, `src/webview/`, `src/shared/`, `test/unit/`, `test/integration/`, `test/webview/` as specified in the Architecture document.

2. **Given** the scaffold is in place, **When** `webpack.config.js` is inspected, **Then** it contains two entry points: `extension.ts` targeting `node` (with `vscode` externalized) and `webview/index.tsx` targeting `web`.

3. **Given** the dual-target build is configured, **When** `tsconfig.json`, `tsconfig.node.json`, and `tsconfig.webview.json` are inspected, **Then** they exist with correct extends chain.

4. **Given** all configuration is in place, **When** `npm run build` is executed, **Then** it produces two separate bundles without errors.

5. **Given** the extension bundle is built, **When** F5 is pressed in VSCode, **Then** the extension launches in the VSCode Extension Development Host without errors.

6. **Given** the dual-target build is in place, **When** a file in `src/extension/` imports from `src/webview/`, **Then** the TypeScript compiler emits an error (enforced via tsconfig path restrictions or ESLint rule).

7. **Given** the dual-target build is in place, **When** a file in `src/webview/` imports from `src/extension/`, **Then** the TypeScript compiler emits an error.

8. **Given** the extension manifest (`package.json`) is configured, **When** it is inspected, **Then** `activationEvents` uses lazy activation (only `onStartupFinished` or HID-related events — NOT `*`), satisfying FR51.

## Tasks / Subtasks

- [x] Task 1: Run scaffold command and verify base structure (AC: 1)
  - [x] Run `npx --package yo --package generator-code -- yo code --extensionType extensionpack --bundle webpack --gitInit` selecting TypeScript + webpack + no web extension target
  - [x] Verify scaffold creates `package.json` with correct `engines.vscode: "^1.85.0"` (NFR-C3)
  - [x] Remove any `*` activation event from package.json — replace with lazy activation

- [x] Task 2: Create full directory structure (AC: 1)
  - [x] Create `src/extension/` with subdirs: `hid/`, `fsm/`, `ipc/`, `input/`, `commands/`, `panels/`, `output/`, `session/`, `platform/`, `telemetry/`
  - [x] Create `src/webview/` with subdirs: `radial-wheel/`, `stats/`, `mini-game/`, `hud/`, `settings/`, `onboarding/`, `session/`, `shared-ui/`
  - [x] Create `src/shared/` for pure types (no runtime APIs)
  - [x] Create `test/unit/`, `test/integration/`, `test/webview/`
  - [x] Create `scripts/hooks/`, `resources/icons/dualsense/`, `resources/icons/xbox/`, `resources/sounds/`, `profiles/`, `docs/`, `.github/workflows/`
  - [x] Add `.gitkeep` files in empty directories to preserve structure in git

- [x] Task 3: Configure dual-target webpack (AC: 2, 4, 5)
  - [x] Replace yo code's single webpack config with dual-entry `webpack.config.js`
  - [x] Entry 1: `./src/extension/extension.ts` → `target: 'node'`, externalize `vscode`
  - [x] Entry 2: `./src/webview/radial-wheel/index.tsx` → `target: 'web'` (initial placeholder panel)
  - [x] Configure `resolve.extensions: ['.ts', '.tsx', '.js', '.jsx']`
  - [x] Add `ts-loader` for TypeScript transpilation in both targets
  - [x] Verify `npm run build` produces two bundles in `dist/`

- [x] Task 4: Configure TypeScript (AC: 3, 6, 7)
  - [x] Create `tsconfig.json` (base): `strict: true`, `moduleResolution: node`, `target: ES2020`, `lib: ['ES2020']`
  - [x] Create `tsconfig.node.json` extending base: `module: commonjs`, `types: ['node']`, include `src/extension/**/*` and `src/shared/**/*`, exclude `src/webview/**/*`
  - [x] Create `tsconfig.webview.json` extending base: `module: ESNext`, `jsx: react`, `types: ['react', 'react-dom']`, include `src/webview/**/*` and `src/shared/**/*`, exclude `src/extension/**/*`
  - [x] Add path restrictions in each tsconfig to enforce context boundary (or configure ESLint rule to prevent cross-boundary imports)
  - [x] Verify `tsc --noEmit` passes on both configs

- [x] Task 5: Set up ESLint and Prettier (AC: 6, 7)
  - [x] Configure `.eslintrc.json` with `@typescript-eslint/recommended`
  - [x] Add `no-console` rule for `src/extension/` (enforces logger singleton use per Architecture)
  - [x] Add import boundary rule to prevent `src/extension/` ↔ `src/webview/` cross-imports
  - [x] Create `.prettierrc` (retain yo code defaults)
  - [x] Add `npm run lint` and `npm run typecheck` scripts to package.json

- [x] Task 6: Create extension entry point placeholder (AC: 5)
  - [x] Create `src/extension/extension.ts` with `activate()` and `deactivate()` stubs
  - [x] Ensure `activate()` logs "VibeSense activating" via a basic console (full logger singleton deferred to Story 1.5)
  - [x] Register in package.json `main` field pointing to compiled output

- [x] Task 7: Create placeholder webview entry point (AC: 4)
  - [x] Install React dependencies: `npm install react react-dom` and `npm install --save-dev @types/react @types/react-dom`
  - [x] Create `src/webview/radial-wheel/index.tsx` with minimal React root render (placeholder only — no functionality)

- [x] Task 8: Create placeholder shared module (AC: 1)
  - [x] Create `src/shared/messages.ts` with an empty export comment noting this is the single source of truth for Webview ↔ host messages (full implementation in Story 1.3)
  - [x] Create `src/shared/types.ts` with empty exports placeholder
  - [x] Create `src/shared/constants.ts` with `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` already defined

- [x] Task 9: Configure `.vscodeignore` and `.vscode/launch.json` (AC: 5)
  - [x] Add `.vscodeignore` to exclude `src/`, `test/`, `node_modules/`, `*.ts` source, keep `dist/`
  - [x] Ensure `.vscodeignore` excludes raw `.node` binary files from the VSIX (platform-specific binaries bundled via `vsce package --target` in Story 1.4)
  - [x] Create `.vscode/launch.json` with F5 Extension Development Host config pointing to compiled extension

- [x] Task 10: Add placeholder test file as proof-of-life (AC: 1)
  - [x] Create `test/unit/.gitkeep` and `test/integration/.gitkeep` and `test/webview/.gitkeep`
  - [x] Note: Full test framework setup is Story 1.5 — this story only ensures the directories exist with correct paths

- [x] Task 11: Add npm scripts (AC: 4, 5)
  - [x] Verify `package.json` scripts include: `build`, `watch`, `lint`, `typecheck`
  - [x] Ensure `build` compiles both webpack targets
  - [x] Ensure `engines.vscode` is `"^1.85.0"` or higher

### Review Findings

- [x] [Review][Patch] Remove wildcard `paths` mapping `"*": ["./src/shared/*"]` from tsconfig.node.json and tsconfig.webview.json — catch-all path alias could mask import resolution errors and conflicts with bare module imports [tsconfig.node.json:8, tsconfig.webview.json:12] — FIXED
- [x] [Review][Patch] Fix Extension Tests launch config: path `dist/test/suite/index` does not match project test structure (`test/unit/`, `test/integration/`, `test/webview/`); added missing `sourceMaps: true` for consistency [.vscode/launch.json:22] — FIXED
- [x] [Review][Defer] `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` is Unix-only [src/shared/constants.ts:5] — deferred, architecture specifies macOS MVP; Windows support is Growth phase

## Dev Notes

### Critical Architecture Constraints

**Context Boundary Rule — STRICTLY ENFORCED:**
- `src/extension/` NEVER imports from `src/webview/`
- `src/webview/` NEVER imports from `src/extension/`
- Both may import from `src/shared/` — but `src/shared/` must contain ZERO Node.js or browser-specific APIs
- This rule must be enforced by TypeScript compiler (tsconfig `include`/`exclude` or `paths`) AND ESLint
- [Source: architecture.md#Structure Patterns]

**Dual-Target Webpack:**
- Extension host bundle: `target: 'node'`, `vscode` must be externalized (it's provided by VSCode runtime, not bundled)
- Webview bundle: `target: 'web'`, standard React/browser bundle
- Both share a single `webpack.config.js` that exports an array of two configurations
- [Source: architecture.md#Starter Template Evaluation → Layer 1]

**TypeScript config chain:**
```
tsconfig.json (base: strict, ES2020)
├── tsconfig.node.json (extends base, module: commonjs, for src/extension/)
└── tsconfig.webview.json (extends base, module: ESNext, jsx: react, for src/webview/)
```
- [Source: architecture.md#Starter Template Evaluation → Layer 1]

**Lazy Activation (FR51):**
- `activationEvents` in `package.json` must NOT include `"*"`
- Use `onStartupFinished` or specific HID events
- Extension must activate only upon controller detection or explicit user trigger
- [Source: epics.md → FR51, architecture.md#Technical Constraints]

**Node.js Version:**
- VSCode's Electron Node.js is 20.x LTS as of VSCode 1.87+
- `engines.vscode: "^1.85.0"` in package.json (NFR-C3)
- Do NOT pin a specific Node version — electron-rebuild handles native binary compatibility
- [Source: architecture.md#Technical Constraints & Dependencies]

### Project Structure Notes

**Exact directory structure from Architecture:**
```
vibesense/
├── .github/workflows/        # ci.yml, package.yml (stubs for Story 1.4)
├── .vscode/launch.json       # F5 debug config
├── docs/                     # Documentation stubs
├── scripts/hooks/            # post-tool-use.sh, stop.sh (stubs for Story 5.x)
├── src/
│   ├── extension/            # Node.js ONLY
│   │   ├── extension.ts      # activate() / deactivate()
│   │   ├── hid/
│   │   ├── fsm/
│   │   ├── ipc/
│   │   ├── input/
│   │   ├── commands/
│   │   ├── panels/
│   │   ├── output/
│   │   ├── session/
│   │   ├── platform/
│   │   ├── telemetry/
│   │   ├── status-bar.ts     # (stub)
│   │   └── logger.ts         # (stub — full implementation in Story 1.5)
│   ├── webview/              # Browser ONLY
│   │   ├── radial-wheel/index.tsx  # Minimal React placeholder
│   │   ├── stats/
│   │   ├── mini-game/
│   │   ├── hud/
│   │   ├── settings/
│   │   ├── onboarding/
│   │   ├── session/
│   │   └── shared-ui/tokens.css   # --vs-* token definitions (stub)
│   └── shared/               # Pure types — both contexts can import
│       ├── messages.ts       # Stub with comment (full in Story 1.3)
│       ├── types.ts          # Stub with comment (full in Story 1.3)
│       └── constants.ts      # VIBESENSE_SOCKET_PATH defined NOW
├── test/unit/
├── test/integration/
├── test/webview/
├── resources/icons/dualsense/
├── resources/icons/xbox/
├── resources/sounds/
├── profiles/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.webview.json
├── webpack.config.js
├── .eslintrc.json
├── .prettierrc
├── .vscodeignore
└── .gitignore
```
[Source: architecture.md#Complete Project Directory Structure]

**What to create vs stub:**
- Create with real content: `webpack.config.js`, all three tsconfigs, `package.json` (augmented), `.eslintrc.json`, `.vscodeignore`, `src/extension/extension.ts`, `src/shared/constants.ts`, `src/webview/radial-wheel/index.tsx`
- Create as stubs (empty or minimal comment): all other `*.ts`/`*.tsx` files — they exist to establish correct paths and module boundaries; downstream stories will fill them in
- Create with `.gitkeep`: all empty directories that need to be tracked

### Naming Conventions
- Non-component TS files: `kebab-case.ts` (e.g., `hid-hal.ts`, `session-manager.ts`)
- React components: `PascalCase.tsx` (e.g., `RadialWheel.tsx`)
- CSS custom properties: `--vs-*` prefix
- VSCode command IDs: `vibesense.camelCase`
- [Source: architecture.md#Naming Patterns]

### webpack.config.js Pattern

```javascript
// webpack.config.js — dual-target export
const path = require('path')

/** @type {import('webpack').Configuration} */
const extensionConfig = {
  target: 'node',
  entry: './src/extension/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: { vscode: 'commonjs vscode' },
  resolve: { extensions: ['.ts', '.js'] },
  module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
  devtool: 'nosources-source-map',
}

/** @type {import('webpack').Configuration} */
const webviewConfig = {
  target: 'web',
  entry: { 'radial-wheel': './src/webview/radial-wheel/index.tsx' },
  output: { path: path.resolve(__dirname, 'dist/webview'), filename: '[name].js' },
  resolve: { extensions: ['.ts', '.tsx', '.js', '.jsx'] },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  devtool: 'nosources-source-map',
}

module.exports = [extensionConfig, webviewConfig]
```
[Source: architecture.md#Starter Template Evaluation → Layer 1, Dual-Target Webpack]

### ESLint Context Boundary Enforcement

The `no-restricted-imports` ESLint rule should prevent cross-boundary imports:
```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      { "patterns": ["../webview/*", "../../webview/*"] }
    ]
  }
}
```
Apply this rule in an `.eslintrc.json` override for `src/extension/**` files, and similarly restrict `src/extension/**` imports from `src/webview/**` files.
[Source: architecture.md#Context boundary rule]

### constants.ts Initial Content

```typescript
// src/shared/constants.ts
// Pure constants — importable from both extension host and Webview contexts
// DO NOT add Node.js or browser-specific APIs here

export const VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'

// Timing constants (ms)
export const INPUT_BUFFER_WINDOW_MS = 250
export const CONTROLLER_RECONNECT_TIMEOUT_MS = 3000
export const GAME_LAUNCH_COUNTDOWN_MS = 5000
export const SESSION_SWITCHER_DISPLAY_MS = 800
```
[Source: architecture.md#Naming Patterns → Named pipe socket path, epics.md → Additional Requirements]

### package.json Key Fields

```json
{
  "engines": { "vscode": "^1.85.0" },
  "activationEvents": ["onStartupFinished"],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [],
    "configuration": { "title": "VibeSense", "properties": {} }
  }
}
```
- `activationEvents: ["onStartupFinished"]` satisfies FR51 lazy activation
- `main` points to compiled webpack output
- `contributes.configuration` must use `vibesense` namespace for all settings
- [Source: epics.md → FR51, architecture.md → NFR-C3]

### Testing Framework (DO NOT IMPLEMENT — Story 1.5)

This story creates the `test/` directory structure ONLY. Do not configure Vitest or `@vscode/test-electron` — that is Story 1.5's scope.

### Logger (DO NOT IMPLEMENT — Story 1.5)

`src/extension/logger.ts` should be created as a stub. The full singleton implementation using `vscode.window.createOutputChannel('VibeSense')` is Story 1.5's scope. For this story, the `extension.ts` activate() stub may use `console.log` (it will be replaced).

### node-hid / electron-rebuild (DO NOT IMPLEMENT — Story 1.2)

Do NOT install `node-hid`, `dualsense-ts`, `electron-rebuild`, or `prebuild-install` in this story. That is Story 1.2's scope. This story focuses exclusively on scaffold, build config, and directory structure.

### Zod / Message Protocol (DO NOT IMPLEMENT — Story 1.3)

Do NOT install `zod` or implement the full typed message protocol. Story 1.3 owns that. `src/shared/messages.ts` created here is a stub with a comment only.

### GitHub Actions CI (DO NOT IMPLEMENT — Story 1.4)

Do NOT write `.github/workflows/ci.yml` or `package.yml` workflows. Story 1.4 owns that. The `.github/workflows/` directory is created here as an empty directory with `.gitkeep`.

### References

- [Source: architecture.md#Starter Template Evaluation] — yo code command + 3 augmentation layers
- [Source: architecture.md#Complete Project Directory Structure] — exact file tree
- [Source: architecture.md#Structure Patterns] — context boundary rule
- [Source: architecture.md#Naming Patterns] — file naming conventions
- [Source: architecture.md#Technical Constraints & Dependencies] — Node.js version, webpack requirement
- [Source: epics.md#Story 1.1] — acceptance criteria and requirements
- [Source: epics.md#Additional Requirements] — Starter Template, Dual-Target Webpack specs
- [Source: epics.md → FR51] — lazy activation requirement

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed TS6133 error: renamed `context` to `_context` in `activate()` to comply with `noUnusedParameters`
- Fixed TS1259 React default import error: added `allowSyntheticDefaultImports: true` and `esModuleInterop: true` to `tsconfig.webview.json`
- Refined ESLint `@typescript-eslint/naming-convention` rule to allow PascalCase for functions (React components) and `import` selectors
- Added `argsIgnorePattern: ^_` to `@typescript-eslint/no-unused-vars` rule for stub parameters

### Completion Notes List

- Scaffolded VibeSense VSCode extension from scratch with dual-target build system
- `npm run build` produces `dist/extension.js` (Node.js target, vscode externalized) and `dist/webview/radial-wheel.js` (web target)
- `npm run typecheck` passes on both `tsconfig.node.json` and `tsconfig.webview.json` with zero errors
- `npm run lint` passes on entire `src/` with zero errors and zero warnings
- Context boundary enforcement verified: ESLint `no-restricted-imports` rule blocks `src/extension/` to `src/webview/` and `src/webview/` to `src/extension/` imports with error-level severity
- `package.json` uses lazy activation (`"activationEvents": ["onStartupFinished"]`) satisfying FR51
- All 11 tasks and all subtasks completed
- Note: Testing framework setup deferred to Story 1.5 per story specification

### File List

- package.json
- webpack.config.js
- tsconfig.json
- tsconfig.node.json
- tsconfig.webview.json
- .eslintrc.json
- .prettierrc
- .vscodeignore
- .gitignore
- .vscode/launch.json
- src/extension/extension.ts
- src/extension/logger.ts
- src/extension/status-bar.ts
- src/extension/hid/.gitkeep
- src/extension/fsm/.gitkeep
- src/extension/ipc/.gitkeep
- src/extension/input/.gitkeep
- src/extension/commands/.gitkeep
- src/extension/panels/.gitkeep
- src/extension/output/.gitkeep
- src/extension/session/.gitkeep
- src/extension/platform/.gitkeep
- src/extension/telemetry/.gitkeep
- src/webview/radial-wheel/index.tsx
- src/webview/shared-ui/tokens.css
- src/webview/stats/.gitkeep
- src/webview/mini-game/.gitkeep
- src/webview/hud/.gitkeep
- src/webview/settings/.gitkeep
- src/webview/onboarding/.gitkeep
- src/webview/session/.gitkeep
- src/shared/constants.ts
- src/shared/messages.ts
- src/shared/types.ts
- test/unit/.gitkeep
- test/integration/.gitkeep
- test/webview/.gitkeep
- scripts/hooks/.gitkeep
- resources/icons/dualsense/.gitkeep
- resources/icons/xbox/.gitkeep
- resources/sounds/.gitkeep
- profiles/.gitkeep
- docs/.gitkeep
- .github/workflows/.gitkeep
- _bmad-output/implementation-artifacts/sprint-status.yaml

### Change Log

- 2026-03-29: Story 1.1 implemented — extension scaffold, dual-target webpack build, TypeScript config chain, ESLint context boundary enforcement, all directory structure, placeholder source files. All 11 tasks complete.
