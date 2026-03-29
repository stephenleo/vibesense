# Deferred Work

## Deferred from: code review of 1-1-extension-scaffold-dual-target-build-system (2026-03-29)

- `VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'` in `src/shared/constants.ts` is Unix-only. Will need platform-aware path resolution when Windows support is added in Growth phase.

## Deferred from: code review of 1-3-shared-type-system-webview-message-protocol (2026-03-29)

- No compile-time linkage between `types.ts` manual types and `messages.ts` Zod schemas. The Zod schemas in `messages.ts` independently re-declare `AgentState`, `ControllerType`, and `Session` shapes without importing from `types.ts`. If one is updated without the other, they can drift silently. Consider adding `satisfies` type assertions in a future story to enforce compile-time sync.
