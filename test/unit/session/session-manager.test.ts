// test/unit/session/session-manager.test.ts
// Unit tests for SessionManager — AC 1, 2, 3

import { vi, describe, it, expect, beforeEach } from 'vitest'

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

// ── Import after mock ─────────────────────────────────────────────────────────
import { SessionManager } from '../../../src/extension/session/session-manager'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SessionManager', () => {
  let manager: SessionManager

  beforeEach(() => {
    manager = new SessionManager()
  })

  it('handleHookMessage stop → FSM for session transitions to idle', () => {
    // First move session to processing so we can confirm stop brings it back
    manager.getOrCreateFsm('abc').dispatch('AGENT_PROCESSING')
    manager.handleHookMessage({ hook: 'stop', session_id: 'abc' })
    expect(manager.getSessions().get('abc')?.state).toBe('idle')
  })

  it('handleHookMessage post_tool_use → FSM for session transitions to needs-input', () => {
    // Move to processing first (post_tool_use only valid from processing)
    manager.getOrCreateFsm('abc').dispatch('AGENT_PROCESSING')
    manager.handleHookMessage({ hook: 'post_tool_use', session_id: 'abc' })
    expect(manager.getSessions().get('abc')?.state).toBe('needs-input')
  })

  it('new session_id auto-creates FSM (verify via getSessions().has())', () => {
    expect(manager.getSessions().has('abc')).toBe(false)
    manager.handleHookMessage({ hook: 'stop', session_id: 'abc' })
    expect(manager.getSessions().has('abc')).toBe(true)
  })

  it('getAggregateGameState() with 0 sessions returns PLAY', () => {
    expect(manager.getAggregateGameState()).toBe('PLAY')
  })

  it('getAggregateGameState() — one processing, one needs-input → PAUSE (AC 2)', () => {
    const fsm1 = manager.getOrCreateFsm('s1')
    const fsm2 = manager.getOrCreateFsm('s2')

    fsm1.dispatch('AGENT_PROCESSING') // s1 = processing
    fsm2.dispatch('AGENT_PROCESSING')
    fsm2.dispatch('NEEDS_INPUT')      // s2 = needs-input

    expect(manager.getAggregateGameState()).toBe('PAUSE')
  })

  it('getAggregateGameState() — all processing or idle → PLAY (AC 3)', () => {
    const fsm1 = manager.getOrCreateFsm('s1')
    const fsm2 = manager.getOrCreateFsm('s2')

    fsm1.dispatch('AGENT_PROCESSING') // s1 = processing
    // s2 stays idle

    expect(manager.getAggregateGameState()).toBe('PLAY')
  })

  it('aggregateGameStateChanged emitted after state transition', () => {
    const handler = vi.fn()
    manager.on('aggregateGameStateChanged', handler)

    const fsm = manager.getOrCreateFsm('abc')
    fsm.dispatch('AGENT_PROCESSING')

    expect(handler).toHaveBeenCalled()
  })

  it('sessionStateChanged emitted with (sessionId, prev, next) on FSM transition', () => {
    const handler = vi.fn()
    manager.on('sessionStateChanged', handler)

    const fsm = manager.getOrCreateFsm('abc')
    fsm.dispatch('AGENT_PROCESSING')

    expect(handler).toHaveBeenCalledWith('abc', 'idle', 'processing')
  })

  it('dispose() cleans up all FSMs and listeners', () => {
    manager.getOrCreateFsm('s1')
    manager.getOrCreateFsm('s2')

    const handler = vi.fn()
    manager.on('sessionStateChanged', handler)

    manager.dispose()

    expect(manager.getSessions().size).toBe(0)
    expect(manager.listenerCount('sessionStateChanged')).toBe(0)
    expect(manager.listenerCount('aggregateGameStateChanged')).toBe(0)
  })
})
