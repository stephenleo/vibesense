// src/extension/ipc/message-handler.ts
// Validation + routing layer for inbound IPC payloads
// Separates Zod validation from socket mechanics — enables independent unit testing
// Story 5.3: AC 2 — NFR-S1 security requirement: all payloads validated before action

import { parseHookMessage } from '../../shared/messages'
import type { SessionManager } from '../session/session-manager'
import { logger } from '../logger'

/**
 * Validate and route a raw (already JSON-parsed) payload.
 * If the payload is a valid HookMessage, routes to sessionManager.handleHookMessage().
 * If the payload is invalid, logs a warning and returns — never executes the payload.
 *
 * @param raw - The already-parsed (unknown) value from the socket
 * @param sessionManager - The SessionManager to route valid messages to
 */
export function handleRawPayload(raw: unknown, sessionManager: SessionManager): void {
  const msg = parseHookMessage(raw)
  if (msg === null) {
    logger.warn('IPC: invalid payload rejected', raw)
    return
  }
  sessionManager.handleHookMessage(msg)
}
