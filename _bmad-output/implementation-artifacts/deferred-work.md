# Deferred Work

## Deferred from: code review of 1-1-extension-scaffold-dual-target-build-system (2026-03-29)

- `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` in `src/shared/constants.ts` is Unix-only. Will need platform-aware path resolution when Windows support is added in Growth phase.
