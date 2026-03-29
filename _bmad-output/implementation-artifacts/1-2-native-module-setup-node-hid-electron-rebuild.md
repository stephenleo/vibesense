# Story 1.2: Native Module Setup (node-hid + electron-rebuild)

Status: ready-for-dev

## Story

As a developer,
I want `node-hid` installed and rebuilt against VSCode's Electron Node.js version via `@electron/rebuild` and `prebuild-install`,
so that the extension can read raw HID device input without requiring users to compile native code on their machines.

## Acceptance Criteria

1. **Given** Story 1.1 is merged, **When** `npm install node-hid dualsense-ts` and `npm install --save-dev @electron/rebuild prebuild-install` are run and the `postinstall` script `electron-rebuild -f -w node-hid` is added to `package.json`, **Then** `require('node-hid')` succeeds in the extension host context without throwing a native module error, **And** the correct prebuilt `.node` binary for the current platform is selected by `prebuild-install`, **And** `npm run build` still produces both webpack bundles without errors.

2. **Given** `node-hid` is installed with a postinstall rebuild step, **When** `npm install` is run on a fresh checkout, **Then** `@electron/rebuild` rebuilds `node-hid` against VSCode's Electron automatically, **And** no manual rebuild command is required from the developer.

3. **Given** a platform-specific VSIX is packaged (`vsce package --target darwin-arm64`), **When** the VSIX is installed in VSCode, **Then** `node-hid` loads the correct prebuilt binary for that platform without compilation, **And** no `node-gyp` build is triggered during install.

4. **Given** no prebuilt binary exists for an unsupported platform, **When** `prebuild-install` fails to find a binary, **Then** `node-gyp` falls back to building from source, **And** the build prerequisites (Xcode CLT on macOS, `build-essential` on Linux) are documented in `CONTRIBUTING.md`.

5. **Given** `node-hid` is installed and rebuilt, **When** `webpack.config.js` is inspected, **Then** `node-hid` is externalized from the webpack bundle (it must NOT be bundled — it uses a native `.node` binary loaded at runtime), **And** `npm run build` still produces both bundles without errors.

6. **Given** the extension is loaded in the Extension Development Host (F5), **When** the extension activates, **Then** `node-hid` can enumerate HID devices without a native module binding error in the Output panel.

## Tasks / Subtasks

- [ ] Task 1: Install runtime dependencies (AC: 1, 2)
  - [ ] Run `npm install node-hid dualsense-ts`
  - [ ] Run `npm install --save-dev @electron/rebuild prebuild-install`
  - [ ] Verify `package.json` dependencies section now includes `node-hid` and `dualsense-ts`
  - [ ] Verify `package.json` devDependencies section now includes `@electron/rebuild` and `prebuild-install`

- [ ] Task 2: Configure postinstall script (AC: 1, 2)
  - [ ] Add `"postinstall": "electron-rebuild -f -w node-hid"` to `package.json` scripts
  - [ ] Verify that running `npm install` on a fresh checkout triggers the rebuild step automatically
  - [ ] Confirm `electron-rebuild` completes without error (check for `node-hid` native `.node` binary in `node_modules/node-hid/build/Release/` or `node_modules/node-hid/prebuilds/`)

- [ ] Task 3: Externalize `node-hid` from webpack (AC: 5)
  - [ ] Edit `webpack.config.js` to add `node-hid` to the `externals` object of the extension host config (the Node.js target config)
  - [ ] The externals entry must be: `'node-hid': 'commonjs node-hid'`
  - [ ] Also externalize `dualsense-ts` if it ships a native component: `'dualsense-ts': 'commonjs dualsense-ts'`
  - [ ] Verify `npm run build` still produces both bundles without errors
  - [ ] Confirm the extension bundle does NOT inline `node-hid` (check bundle size — it should not grow by several MB)

- [ ] Task 4: Update `.vscodeignore` for native binary inclusion (AC: 3)
  - [ ] Review the current `.vscodeignore` — it currently excludes ALL `**/*.node` files (correct for VSIX distribution where only the platform-targeted prebuilt binary should be included)
  - [ ] The `.vscodeignore` entry `**/*.node` is correct as-is: `vsce package --target <platform>` includes only the correct platform prebuilt binary and excludes all others
  - [ ] Ensure `node_modules/` is NOT excluded from `.vscodeignore` — `node-hid` and `dualsense-ts` must be present in the VSIX (they are runtime dependencies, not devDependencies)
  - [ ] Add an exclusion for the `node_modules/@electron/rebuild` and `node_modules/prebuild-install` build tooling (devDependencies should not be in the VSIX)

- [ ] Task 5: Verify HID device enumeration in Extension Development Host (AC: 6)
  - [ ] Create a smoke-test stub in `src/extension/extension.ts` `activate()` function that calls `require('node-hid').devices()` and logs the result via `console.log` (temporary — will be replaced in Story 2.1 with the HAL)
  - [ ] Press F5 to launch Extension Development Host
  - [ ] Open the Output panel and select "VibeSense" (or Developer Tools console for extension host)
  - [ ] Confirm no "Could not locate the bindings file" or "MODULE_NOT_FOUND" error appears
  - [ ] Remove the smoke-test call after validation — leave `activate()` as it was post-Story 1.1

- [ ] Task 6: Create CONTRIBUTING.md with build prerequisites (AC: 4)
  - [ ] Create `CONTRIBUTING.md` at project root documenting:
    - macOS: requires Xcode Command Line Tools (`xcode-select --install`)
    - Linux: requires `build-essential`, `libudev-dev`, and `libusb-1.0-0-dev` (for node-hid compilation from source)
    - Windows: requires Visual Studio Build Tools (Growth phase — macOS MVP only)
    - Node.js version: must match VSCode's embedded Electron Node.js (20.x LTS)
    - The `npm install` flow (postinstall handles electron-rebuild automatically)
  - [ ] Include a section on `vsce package --target <platform>` and the 4-platform matrix (darwin-arm64, darwin-x64, linux-x64, win32-x64)

- [ ] Task 7: Verify webpack build still passes (AC: 1, 5)
  - [ ] Run `npm run build` and confirm both bundles emit without error
  - [ ] Run `npm run typecheck` and confirm zero TypeScript errors
  - [ ] Run `npm run lint` and confirm zero ESLint errors
  - [ ] Confirm `dist/extension.js` does NOT contain inline `node-hid` native code

## Dev Notes

### Critical: `@electron/rebuild` vs `electron-rebuild`

**Use `@electron/rebuild` (the scoped package), NOT the legacy `electron-rebuild` package.**

The legacy `electron-rebuild` (latest: 3.2.9, last published 4+ years ago) is deprecated. The official current package is `@electron/rebuild` (latest: 4.0.x, actively maintained). There is no API change — the CLI command is still `electron-rebuild` in both packages. Architecture specifies `electron-rebuild` as the tool; use `@electron/rebuild` as the npm package name.

```bash
# Install the CURRENT package name:
npm install --save-dev @electron/rebuild prebuild-install

# The postinstall script CLI command stays the same:
"postinstall": "electron-rebuild -f -w node-hid"
```

[Source: npmjs.com @electron/rebuild — v4.0.x, last published 2025]

### Critical: node-hid 3.x is NAPI-based — prebuilts are NAPI ABI, not Node/Electron version-specific

As of node-hid v3.x (current: 3.3.0), node-hid is built against Node-API (NAPI), NOT the old V8 ABI. This is significant:

- **NAPI modules are forward-compatible** across Node.js and Electron versions that support the same NAPI version
- node-hid ships prebuilt NAPI binaries for common platforms via `prebuild-install`
- The `electron-rebuild` step remains necessary to ensure the correct prebuilt binary is resolved for VSCode's specific Electron ABI (some prebuilt binaries may still be Electron-ABI-specific; electron-rebuild handles this correctly)
- On macOS (MVP target), the prebuilt NAPI binary should load without source compilation in most cases

**Do not remove the postinstall step** just because node-hid is NAPI. The rebuild step ensures correctness for VSCode's Electron runtime and avoids the "Could not locate the bindings file" error at activation time.

[Source: npmjs.com/package/node-hid — NAPI note]
[Source: github.com/node-hid/node-hid]

### Critical: `node-hid` MUST be externalized from webpack — never bundled

`node-hid` loads a native `.node` binary at runtime using `bindings` or `node-pre-gyp`. This **cannot be webpack-bundled**. If you attempt to bundle it, webpack will fail to resolve the native binary and the extension will crash at activation with a module not found error.

The extension host `webpack.config.js` `externals` must include:

```javascript
externals: {
  vscode: 'commonjs vscode',
  'node-hid': 'commonjs node-hid',
  'dualsense-ts': 'commonjs dualsense-ts',   // depends on node-hid; externalize to be safe
},
```

This follows the same pattern already established for `vscode` in Story 1.1.
[Source: architecture.md#Starter Template Evaluation → Layer 2]
[Source: Story 1.1 Dev Notes — webpack.config.js Pattern]

### `node-hid` async API — use it, not the legacy sync API

node-hid 3.x introduced an async API. The **async API is recommended** to avoid blocking the Node.js event loop (which would violate NFR-P1 <16ms latency budget). This story does not implement the full HAL (that is Story 2.1), but code in `extension.ts` must not use the synchronous `read()` call.

**This story only verifies that `node-hid` loads without error.** The actual async usage pattern (`device.readAsync()`, `device.on('data', ...)`) is Story 2.1's concern.

[Source: npmjs.com/package/node-hid — async API recommendation]

### `.vscodeignore` — `node_modules` MUST be included for runtime deps

The `.vscodeignore` from Story 1.1 correctly excludes source `.node` files via `**/*.node`. **Do not add `node_modules/` to `.vscodeignore`** — `vsce` already handles devDependencies automatically (they are excluded from the VSIX by inspecting `package.json` devDependencies). Runtime dependencies (`node-hid`, `dualsense-ts`, `react`, `react-dom`) are included automatically.

The `**/*.node` exclusion in `.vscodeignore` works correctly with `vsce package --target <platform>`: `vsce` includes only the platform-appropriate prebuilt binary in the final VSIX.

**Current `.vscodeignore` is correct — do not modify it for native binary handling.**

[Source: Story 1.1 File List — .vscodeignore]
[Source: architecture.md#Starter Template Evaluation → Layer 2]

### dualsense-ts peer dependency on node-hid

`dualsense-ts` uses `node-hid` as a peer dependency in Node.js context (as opposed to WebHID in the browser). Since both are installed, the DualSense library will resolve node-hid from `node_modules`. This is the expected configuration. Do NOT install `@types/node-hid` — the types are bundled with the `node-hid` package itself since v3.x.

[Source: npmjs.com/package/dualsense-ts — Node.js usage: "npm add node-hid"]

### Webpack externals — only apply to extension host config

`node-hid` and `dualsense-ts` externals must only be in the **extension host** webpack config (the `target: 'node'` entry). The webview config (`target: 'web'`) must NOT reference these packages — the context boundary rule from Story 1.1 prohibits it, and WebHID is the browser-side API (not used in this extension since we use node-hid in the extension host).

```javascript
// webpack.config.js — only extensionConfig gets the node-hid externals
const extensionConfig = {
  target: 'node',
  // ...
  externals: {
    vscode: 'commonjs vscode',
    'node-hid': 'commonjs node-hid',
    'dualsense-ts': 'commonjs dualsense-ts',
  },
}

const webviewConfig = {
  target: 'web',
  // NO node-hid externals here — browser context cannot use node-hid
  externals: {},
}
```

[Source: Story 1.1 Dev Notes — webpack.config.js Pattern]
[Source: architecture.md#Structure Patterns — context boundary rule]

### Smoke-test pattern for Task 5 — minimal and non-breaking

The smoke test in `activate()` must use `require('node-hid')` (CommonJS require, not ES import) because the extension bundle is CommonJS (`target: 'node'`, `libraryTarget: 'commonjs2'`). After verification, remove the smoke test — `activate()` must be left clean per Story 1.1.

```typescript
// TEMPORARY smoke test — remove after verification
import * as vscode from 'vscode'

export function activate(_context: vscode.ExtensionContext): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const HID = require('node-hid') as typeof import('node-hid')
  console.log('node-hid loaded, devices:', HID.devices().length)
}
```

### postinstall script — `electron-rebuild` flags

```json
"postinstall": "electron-rebuild -f -w node-hid"
```

Flags:
- `-f` / `--force`: Force rebuild even if prebuilt binary exists — ensures correct Electron ABI match
- `-w node-hid` / `--which-module node-hid`: Rebuild only `node-hid` (not all native modules — faster CI)

Do NOT add `-p` (parallel) flag in the postinstall script — it can cause race conditions during `npm install`.

[Source: github.com/electron/rebuild — README]

### CONTRIBUTING.md — Linux udev rules note

On Linux, `node-hid` requires a udev rule to allow non-root HID device access. This is separate from the build prerequisites. Include in CONTRIBUTING.md:

```
# /etc/udev/rules.d/99-vibesense.rules
SUBSYSTEM=="hidraw", GROUP="plugdev", MODE="0664"
SUBSYSTEM=="usb", ATTRS{idVendor}=="054c", GROUP="plugdev", MODE="0664"  # Sony (DualSense)
SUBSYSTEM=="usb", ATTRS{idVendor}=="045e", GROUP="plugdev", MODE="0664"  # Microsoft (Xbox)
```

This is a runtime requirement, not a build prerequisite — document it in the "Linux" section of CONTRIBUTING.md for completeness.

[Source: architecture.md — NFR-C4 Linux platform support]

### Project Structure Notes

- `package.json` changes: add `node-hid` and `dualsense-ts` to `dependencies`; add `@electron/rebuild` and `prebuild-install` to `devDependencies`; add `postinstall` to `scripts`
- `webpack.config.js`: add `node-hid` and `dualsense-ts` to `externals` of `extensionConfig` only
- New file: `CONTRIBUTING.md` at project root
- No new source files in `src/` — HAL implementation is Story 2.1
- No changes to tsconfig files, ESLint config, or test directory
- `src/extension/extension.ts`: temporary smoke-test addition then removal (no net change in final commit)
- Context boundary: `node-hid` and `dualsense-ts` are Node.js-only — NEVER import them from `src/webview/` or `src/shared/`

### Naming Conventions

- New npm packages: install as-is (`node-hid`, `dualsense-ts`, `@electron/rebuild`, `prebuild-install`)
- No new TypeScript files added in this story — naming conventions (kebab-case.ts) apply starting Story 2.1
- `CONTRIBUTING.md` is all-caps by convention (standard open source practice)

[Source: architecture.md#Naming Patterns]

### Testing Framework (DO NOT IMPLEMENT — Story 1.5)

This story does not add tests. The smoke-test in `activate()` is a manual verification step only — it is not a Vitest unit test. Full test framework (Vitest + `@vscode/test-electron`) is Story 1.5's scope.

### HID HAL (DO NOT IMPLEMENT — Story 2.1)

Do NOT create `src/extension/hid/hal.ts`, `dualsense-driver.ts`, `xbox-driver.ts`, `hid-manager.ts`, or any HID abstraction. This story only installs and verifies the native module loads. The HAL is Epic 2's scope and requires the shared type system from Story 1.3 to be in place first.

### References

- [Source: architecture.md#Starter Template Evaluation → Layer 2] — Native Module Setup specification
- [Source: architecture.md#Technical Constraints & Dependencies] — node-hid as the only viable HID path in extension host; prebuild-install; platform-specific VSIX
- [Source: architecture.md#Structure Patterns] — context boundary rule (node-hid in extension host only)
- [Source: epics.md#Story 1.2] — acceptance criteria and requirements
- [Source: epics.md → FR50] — Marketplace platform-specific VSIX packaging
- [Source: epics.md → NFR-C3, NFR-C4] — VSCode 1.85+ / Node.js 20.x / macOS MVP
- [Source: Story 1.1 Dev Notes — webpack.config.js Pattern] — established externals pattern
- [Source: Story 1.1 File List — .vscodeignore] — existing native binary exclusion config
- [Source: npmjs.com/@electron/rebuild] — v4.0.x current package, deprecation of legacy electron-rebuild
- [Source: npmjs.com/package/node-hid] — v3.3.0, NAPI-based, async API recommended
- [Source: npmjs.com/package/dualsense-ts] — requires node-hid as peer dep in Node.js context

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

### File List
