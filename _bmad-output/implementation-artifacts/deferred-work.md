# Deferred Work

## Deferred from: code review of 1-1-extension-scaffold-dual-target-build-system (2026-03-29)

- `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` in `src/shared/constants.ts` is Unix-only. Will need platform-aware path resolution when Windows support is added in Growth phase.

## Deferred from: code review of 1-2-native-module-setup-node-hid-electron-rebuild (2026-03-29)

- `**/*.node` in `.vscodeignore` excludes all native `.node` binaries from the VSIX. While `vsce package --target <platform>` may handle platform-specific binary inclusion, the blanket exclusion could cause runtime failures if packaging is done without `--target`. Resolution belongs in Story 1.4 (CI/packaging matrix).
- `postinstall` script (`electron-rebuild -f -w node-hid`) runs unconditionally on every `npm install`, including in CI environments where Electron may not be available. A CI guard or conditional check should be added in Story 1.4.
