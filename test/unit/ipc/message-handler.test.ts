// test/unit/ipc/message-handler.test.ts
// Unit tests for handleRawPayload() — validation + routing layer
// AC 2: invalid payloads are rejected with logged warning, never executed
// Story 6.4: Extended to cover NotifyMessage routing

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
import type { NotifyDispatcher } from '../../../src/extension/ipc/notify-dispatcher'
import { logger } from '../../../src/extension/logger'

// ── Mock NotifyDispatcher ─────────────────────────────────────────────────────
function makeMockNotifyDispatcher(): NotifyDispatcher {
  return {
    dispatch: vi.fn(),
  } as unknown as NotifyDispatcher
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('handleRawPayload', () => {
  let sessionManager: SessionManager
  let mockNotifyDispatcher: NotifyDispatcher

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager = new SessionManager()
    vi.spyOn(sessionManager, 'handleHookMessage')
    vi.spyOn(logger, 'warn')
    mockNotifyDispatcher = makeMockNotifyDispatcher()
  })

  afterEach(() => {
    sessionManager.dispose()
    vi.clearAllMocks()
  })

  // ── Valid HookMessage routing ─────────────────────────────────────────────────

  it('valid stop HookMessage → routes to sessionManager.handleHookMessage()', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'stop', session_id: 'session-abc' }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'stop',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'session-abc',
    })
    expect(logger.warn).not.toHaveBeenCalledWith('IPC: invalid HookMessage payload rejected', raw)
  })

  it('valid post_tool_use HookMessage → routes to sessionManager.handleHookMessage()', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'post_tool_use', session_id: 'session-xyz' }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'post_tool_use',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'session-xyz',
    })
    expect(logger.warn).not.toHaveBeenCalledWith('IPC: invalid HookMessage payload rejected', raw)
  })

  // ── Invalid HookMessage rejection ─────────────────────────────────────────────

  it('invalid HookMessage (missing session_id) → logged warning, no call to handleHookMessage() (AC 2)', () => {
    const raw = { hook: 'stop' } // missing session_id

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid HookMessage payload rejected', raw)
  })

  it('unknown hook enum value → logged warning, no call to handleHookMessage() (AC 2)', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'pre_tool_use', session_id: 'abc' } // invalid enum

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid HookMessage payload rejected', raw)
  })

  // ── Unrecognized payload ───────────────────────────────────────────────────────

  it('completely non-object value → logged unrecognized warning, no call to either handler (AC 2)', () => {
    const raw = 'this is just a string'

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: unrecognized payload rejected', raw)
  })

  it('null value → logged unrecognized warning, no call to either handler', () => {
    const raw = null

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: unrecognized payload rejected', raw)
  })

  it('empty object → logged unrecognized warning, no call to either handler', () => {
    const raw = {}

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: unrecognized payload rejected', raw)
  })

  // ── Story 6.4: NotifyMessage routing ──────────────────────────────────────────

  // Test 11: Valid NotifyMessage → routed to notifyDispatcher.dispatch()
  it('valid NotifyMessage payload → routed to notifyDispatcher.dispatch()', () => {
    const raw = { event: 'test', haptic: 'single_pulse' }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(mockNotifyDispatcher.dispatch).toHaveBeenCalledOnce()
    expect(mockNotifyDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'test', haptic: 'single_pulse' }),
    )
    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
  })

  // Test 12: Invalid NotifyMessage (bad LED hex) → logged warning, not dispatched
  it('invalid NotifyMessage (bad LED hex) → logged warning, not dispatched', () => {
    const raw = { event: 'test', led: { color: 'badcolor' } }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: invalid NotifyMessage payload rejected', raw)
  })

  // Test 13: Payload with both hook and event → treated as HookMessage (hook check runs first)
  it('payload with both hook and event fields → treated as HookMessage', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const raw = { hook: 'stop', session_id: 'abc', event: 'x' }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).toHaveBeenCalledOnce()
    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
  })

  // Test 14: Payload with unknown top-level fields only → unrecognized warning
  it('payload with unknown top-level fields only → unrecognized warning, neither handler called', () => {
    const raw = { foo: 'bar' }

    handleRawPayload(raw, sessionManager, mockNotifyDispatcher)

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
    expect(mockNotifyDispatcher.dispatch).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('IPC: unrecognized payload rejected', raw)
  })
})
