// test/unit/ipc/message-handler.test.ts
// Unit tests for handleRawPayload() — validation + routing layer
// AC 2: invalid payloads are rejected with logged warning, never executed

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Mock vscode (required by logger) ─────────────────────────────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))

// ── Import after mocks ────────────────────────────────────────────────────────
import { handleRawPayload } from '../../../src/extension/ipc/message-handler'
import { SessionManager } from '../../../src/extension/session/session-manager'
import { logger } from '../../../src/extension/logger'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleRawPayload', () => {
  let sessionManager: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager = new SessionManager()
    vi.spyOn(sessionManager, 'handleHookMessage')
    vi.spyOn(logger, 'warn')
  })

  afterEach(() => {
    sessionManager.dispose()
  })

  // ── Valid HookMessage routing ─────────────────────────────────────────────────

  it('valid stop HookMessage → routes to sessionManager.handleHookMessage()', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'stop', session_id: 'session-abc' }

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'stop',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'session-abc',
    })
    // The IPC layer must NOT emit 'invalid payload rejected' for a valid message.
    // (FSM may emit its own warnings for state transitions — that is expected.)
    expect(logger.warn).not.toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('valid post_tool_use HookMessage → routes to sessionManager.handleHookMessage()', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'post_tool_use', session_id: 'session-xyz' }

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'post_tool_use',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'session-xyz',
    })
    // The IPC layer must NOT emit 'invalid payload rejected' for a valid message.
    // (FSM may emit its own warnings for state transitions — that is expected.)
    expect(logger.warn).not.toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  // ── Invalid payload rejection ─────────────────────────────────────────────────

  it('invalid payload (missing session_id) → logged warning, no call to handleHookMessage() (AC 2)', () => {
    const raw = { hook: 'stop' } // missing session_id

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('invalid payload (missing hook) → logged warning, no call to handleHookMessage() (AC 2)', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { session_id: 'abc' } // missing hook

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('completely non-object value → logged warning, no call to handleHookMessage() (AC 2)', () => {
    const raw = 'this is just a string'

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('null value → logged warning, no call to handleHookMessage()', () => {
    const raw = null

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('unknown hook enum value → logged warning, no call to handleHookMessage() (AC 2)', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'pre_tool_use', session_id: 'abc' } // invalid enum

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })

  it('empty object → logged warning, no call to handleHookMessage()', () => {
    const raw = {}

    handleRawPayload(raw, sessionManager)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid payload rejected', raw)
  })
})
