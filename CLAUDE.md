# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Production webpack build (both extension host + webview targets)
npm run watch        # Incremental build for development
npm run lint         # ESLint (zero errors expected)
npm run typecheck    # TypeScript check (tsconfig.node.json + tsconfig.webview.json)
npm test             # Vitest (unit + webview test projects)
npm run package      # Multi-platform VSIX: darwin-arm64, darwin-x64, linux-x64, win32-x64
```

Run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

VibeSense is a VSCode extension for controller-driven development (DualSense, Xbox) with haptic feedback, radial menus, and gamified stats.

### Dual-Process Structure

The extension has two isolated runtime targets, both bundled by Webpack:

| Target | Entry | Runtime | Purpose |
|--------|-------|---------|---------|
| Extension host | `src/extension/extension.ts` | Node.js | HID device lifecycle, VSCode API, command registration |
| Webview SPAs | `src/webview/*/index.tsx` | Browser (jsdom) | React UIs: session panel, settings, onboarding, radial wheel |

**Shared layer** (`src/shared/`) contains Zod-validated message types and protocol — no runtime-specific imports allowed here. ESLint enforces this boundary.

### Extension Host Subsystems (`src/extension/`)

- **`hid/`** — Device detection, driver factory, connection lifecycle (DualSense via `dualsense-ts`, Xbox, generic HID via `node-hid`)
- **`input/`** — Button/axis routing, binding profile system, mode manager (Guided → Full)
- **`panels/`** — Webview panel managers (session list, settings, onboarding)
- **`commands/`** — VSCode command registration (launch Claude Code, terminal, etc.)
- **`platform/`** — macOS/Linux HID permission checks, device selection UI
- **`logger.ts`** — Structured logging; errors are swallowed and logged, never thrown (NFR-R1)
- **`status-bar.ts`** — Controller connection state (icon + text, never color-only per NFR-A2)

### Webview SPAs (`src/webview/`)

- **`session/`** — Slide panel + session switcher + quick panel (React reducer pattern)
- **`settings/`** — Live binding customization UI
- **`onboarding/`** — 60-second interactive tutorial (auto-advances on correct input, unlocks Full mode)
- **`radial-wheel/`** — Directional pie menu (placeholder)

## Key Patterns

**Zod Drift Guards** — `src/shared/messages.ts` uses compile-time assertions to keep TypeScript types and Zod schemas in sync. Add new message types here; both sides of the webview ↔ extension message bridge use these types.

**Error Swallowing (NFR-R1)** — All user-facing code catches errors, logs via `logger.ts`, and continues. Never let errors bubble to the VSCode process.

**Hot-reloadable Bindings** — Binding profiles in `.vscode/vibesense.json` sync via VSCode Settings Sync and apply without restart. Default profiles: `profiles/claude-code-default.json` and `profiles/copilot-default.json`.

**HAL Pattern** — Controllers implement a common interface; the driver factory (`src/extension/hid/`) selects the right driver (DualSense, Xbox, Generic) at connection time.

**Async Non-blocking** — `node-hid` uses `readAsync()` + event emitters. Target: <16ms input latency (NFR-P1).

**Mode Management** — Guided mode enforces restricted bindings during onboarding; completing the tutorial unlocks Full mode (persisted in `globalState` + `vibesense.fullMode` setting).

## Pre-PR Test Plan

**All errors and findings must be automatically resolved before a PR is submitted. Do not open a PR with any outstanding lint errors, type errors, test failures, build errors, or unresolved code review findings. Fix everything first, then re-run the full sequence to confirm a clean pass.**

Run all checks locally in this exact order:

```bash
npm run lint         # Must pass with zero errors — fix all ESLint violations before continuing
npm run typecheck    # Both tsconfig.node.json and tsconfig.webview.json must pass — fix all type errors before continuing
npm test             # All Vitest unit + webview tests must pass — fix all failures before continuing
npm run build        # Production webpack build must succeed without errors — fix all build errors before continuing
```

### Run Claude code review

After all local checks pass, run the code review skill against the branch:

```bash
/code-review:code-review
```

**All findings must be resolved before opening the PR.** Fix every blocking issue the review raises, then re-run the review to confirm a clean pass.

### PR description requirements

The PR body must include a **Test Results** section documenting the outcome of every step above. Use this template:

```markdown
## Test Results

| Check | Status | Notes |
|-------|--------|-------|
| `npm run lint` | ✅ Pass / ❌ Fail | |
| `npm run typecheck` | ✅ Pass / ❌ Fail | |
| `npm test` | ✅ Pass / ❌ Fail | e.g. "42 tests passed across unit + webview" |
| `npm run build` | ✅ Pass / ❌ Fail | |
| Claude code review | ✅ Pass / ❌ Fail | |

### Code review findings resolved
<!-- List every finding raised by /code-review:code-review and how it was fixed.
     If the review was clean, write "No findings." -->
- [finding description] → [fix applied]
```

All rows must show ✅ Pass. A PR may not be submitted if any row is ❌ or the findings list contains unresolved items.

### PR checklist

- [ ] `npm run lint` — zero errors
- [ ] `npm run typecheck` — zero errors on both tsconfigs
- [ ] `npm test` — all tests pass
- [ ] `npm run build` — production build clean
- [ ] Claude code review — all findings resolved
- [ ] PR description includes completed Test Results section

### Test configuration

Tests use **Vitest** with two projects configured in `vitest.config.ts`:
- `node` environment — extension host unit tests (`test/unit/**/*.test.ts`)
- `jsdom` environment — webview component tests (`test/webview/**/*.test.tsx`)

`node-hid` and `vscode` are mocked. Run a single file with:
```bash
npx vitest run test/unit/path/to/file.test.ts
```

Coverage report: `npm run test:coverage`

Integration tests (`npm run test:integration`) are disabled in CI pending a headless VSCode runner — do not rely on them as a gate.

## Build Notes

- Webpack rebuilds native `node-hid` `.node` binaries per platform via `node-pre-gyp`
- Platform-specific binaries are included/excluded via `.vscodeignore`
- CI runs lint + typecheck + test on Ubuntu, then packages for all 4 platforms in parallel
