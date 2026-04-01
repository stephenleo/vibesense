// src/extension/ipc/message-handler.ts
// Validation + routing layer for inbound IPC payloads
// Separates Zod validation from socket mechanics — enables independent unit testing
// Story 5.3: AC 2 — NFR-S1 security requirement: all payloads validated before action
// Story 6.4: Extended to route NotifyMessage payloads to NotifyDispatcher

import { parseHookMessage, parseNotifyMessage } from '../../shared/messages'
import type { SessionManager } from '../session/session-manager'
import type { NotifyDispatcher } from './notify-dispatcher'
import { logger } from '../logger'

/**
 * Validate and route a raw (already JSON-parsed) payload.
 * Tries HookMessage first (has `hook` field), then NotifyMessage (has `event` field).
 * If neither matches, logs a warning and returns — never executes the payload.
 *
 * @param raw - The already-parsed (unknown) value from the socket
 * @param sessionManager - The SessionManager to route valid hook messages to
 * @param notifyDispatcher - The NotifyDispatcher to route valid notify messages to
 */
export function handleRawPayload(
  raw: unknown,
  sessionManager: SessionManager,
  notifyDispatcher: NotifyDispatcher,
): void {
  // Try HookMessage first (identified by `hook` field)
  if (isHookLike(raw)) {
    const msg = parseHookMessage(raw)
    if (msg === null) {
      logger.warn('IPC: invalid HookMessage payload rejected', raw)
      return
    }
    sessionManager.handleHookMessage(msg)
    return
  }

  // Try NotifyMessage (identified by `event` field)
  if (isNotifyLike(raw)) {
    const msg = parseNotifyMessage(raw)
    if (msg === null) {
      logger.warn('IPC: invalid NotifyMessage payload rejected', raw)
      return
    }
    notifyDispatcher.dispatch(msg)
    return
  }

  logger.warn('IPC: unrecognized payload rejected', raw)
}

/** Quick heuristic: does the raw value look like a hook message? */
function isHookLike(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'hook' in raw
}

/** Quick heuristic: does the raw value look like a notify message? */
function isNotifyLike(raw: unknown): boolean {
  return typeof raw === 'object' && raw !== null && 'event' in raw
}
