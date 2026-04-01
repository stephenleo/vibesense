// test/unit/output/led-controller.test.ts
// Unit tests for LedController — LED color state controller (Story 6.2)
// Tests: state-to-color mapping, priority resolution, amber pulsing, dispose, HAL hot-swap

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import type { SessionManager } from '../../../src/extension/session/session-manager'
import type { ControllerHAL } from '../../../src/extension/hid/hal'
import type { AgentFSM } from '../../../src/extension/fsm/agent-fsm'

// ── Mock vscode (required by logger transitively) ─────────────────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

// ── Import module under test AFTER mocks ─────────────────────────────────────
const { LedController } = await import('../../../src/extension/output/led-controller')

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock SessionManager using EventEmitter so on()/removeListener()/emit() work naturally.
 */
function buildMockSessionManager(
  sessions: Map<string, { state: string }> = new Map(),
): SessionManager & { getSessions: ReturnType<typeof vi.fn> } {
  const emitter = new EventEmitter() as SessionManager & { getSessions: ReturnType<typeof vi.fn> }
  emitter.getSessions = vi.fn().mockReturnValue(sessions)
  return emitter
}

/**
 * Build a mock ControllerHAL with spied setLED.
 */
function buildMockHal(controllerType: 'dualsense' | 'xbox' | 'generic-hid' = 'dualsense'): ControllerHAL {
  return {
    controllerType,
    setLED: vi.fn(),
    setHaptic: vi.fn(),
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

/**
 * Build a mock AgentFSM with a given state.
 */
function buildMockFsm(state: string): AgentFSM {
  return { state } as unknown as AgentFSM
}

/**
 * Emit a sessionStateChanged event on the mock session manager.
 */
function emitStateChanged(
  sm: SessionManager,
  sessionId: string,
  prev: string,
  next: string,
): void {
  sm.emit('sessionStateChanged', sessionId, prev, next)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LedController', () => {
  let mockHal: ControllerHAL
  let mockSessionManager: SessionManager & { getSessions: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    vi.useFakeTimers()
    mockHal = buildMockHal()
    mockSessionManager = buildMockSessionManager()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── AC1: processing → cyan ──────────────────────────────────────────────────
  it('sets LED to cyan (#00C8FF) when session is processing', () => {
    const sessions = new Map([['s1', buildMockFsm('processing')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')

    expect(mockHal.setLED).toHaveBeenCalledWith('#00C8FF')
    controller.dispose()
  })

  // ── AC2: needs-input → amber with pulsing ───────────────────────────────────
  it('sets LED to amber (#FFB800) immediately when session is needs-input', () => {
    const sessions = new Map([['s1', buildMockFsm('needs-input')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'processing', 'needs-input')

    // First setLED call: initial amber (pulse starts with on=true)
    expect(mockHal.setLED).toHaveBeenCalledWith('#FFB800')
    controller.dispose()
  })

  it('pulses between amber and off when needs-input is active', () => {
    const sessions = new Map([['s1', buildMockFsm('needs-input')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'processing', 'needs-input')

    vi.mocked(mockHal.setLED).mockClear()

    // After one 500ms half-period tick — should toggle to off
    vi.advanceTimersByTime(500)
    expect(mockHal.setLED).toHaveBeenCalledWith('#000000')

    vi.mocked(mockHal.setLED).mockClear()

    // After another 500ms — should toggle back to amber
    vi.advanceTimersByTime(500)
    expect(mockHal.setLED).toHaveBeenCalledWith('#FFB800')

    controller.dispose()
  })

  // ── AC3: idle → off ─────────────────────────────────────────────────────────
  it('sets LED to off (#000000) when session transitions from processing to idle', () => {
    // First: simulate processing state (sets currentColor to #00C8FF)
    const processingSessions = new Map([['s1', buildMockFsm('processing')]])
    mockSessionManager.getSessions.mockReturnValue(processingSessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')
    expect(mockHal.setLED).toHaveBeenCalledWith('#00C8FF')

    vi.mocked(mockHal.setLED).mockClear()

    // Now transition to idle — computeColor returns null → applyColor('#000000')
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('idle')]]))
    emitStateChanged(mockSessionManager, 's1', 'processing', 'idle')

    expect(mockHal.setLED).toHaveBeenCalledWith('#000000')
    controller.dispose()
  })

  // ── AC4: error → red ────────────────────────────────────────────────────────
  it('sets LED to red (#E05555) when session is error', () => {
    const sessions = new Map([['s1', buildMockFsm('error')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'processing', 'error')

    expect(mockHal.setLED).toHaveBeenCalledWith('#E05555')
    controller.dispose()
  })

  // ── AC5: priority — error + processing → red ────────────────────────────────
  it('uses error color when error and processing sessions coexist', () => {
    const sessions = new Map<string, AgentFSM>([
      ['s1', buildMockFsm('error')],
      ['s2', buildMockFsm('processing')],
    ])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's2', 'idle', 'processing')

    expect(mockHal.setLED).toHaveBeenCalledWith('#E05555')
    controller.dispose()
  })

  // ── AC5: priority — needs-input + processing → amber ───────────────────────
  it('uses needs-input color (amber) when needs-input and processing sessions coexist', () => {
    const sessions = new Map<string, AgentFSM>([
      ['s1', buildMockFsm('needs-input')],
      ['s2', buildMockFsm('processing')],
    ])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'needs-input')

    expect(mockHal.setLED).toHaveBeenCalledWith('#FFB800')
    controller.dispose()
  })

  // ── AC7: updateHal(null) — no throw; subsequent state changes silently skipped ──
  it('does not throw and silently skips setLED when hal is null', () => {
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('processing')]]))

    const controller = new LedController(mockSessionManager, null)
    expect(() => {
      emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')
    }).not.toThrow()

    controller.dispose()
  })

  it('does not throw when updateHal(null) is called', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    expect(() => controller.updateHal(null)).not.toThrow()
    controller.dispose()
  })

  // ── updateHal(newHal) — new HAL receives subsequent state changes ──────────
  it('calls setLED on new hal after updateHal(newHal)', () => {
    const controller = new LedController(mockSessionManager, null)
    const newHal = buildMockHal()

    controller.updateHal(newHal)

    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('processing')]]))
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')

    expect(newHal.setLED).toHaveBeenCalledWith('#00C8FF')
    // Old null hal not called
    expect(mockHal.setLED).not.toHaveBeenCalled()
    controller.dispose()
  })

  // ── dispose() — removes listener and clears pulse timer ────────────────────
  it('dispose() removes session listener and does not throw', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    expect(() => controller.dispose()).not.toThrow()

    // After dispose, state changes should not trigger setLED
    vi.mocked(mockHal.setLED).mockClear()
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('processing')]]))
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')
    expect(mockHal.setLED).not.toHaveBeenCalled()
  })

  it('dispose() clears pulse timer for needs-input state without throwing', () => {
    const sessions = new Map([['s1', buildMockFsm('needs-input')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'processing', 'needs-input')

    // Pulse is running
    vi.mocked(mockHal.setLED).mockClear()

    // Dispose clears pulse
    expect(() => controller.dispose()).not.toThrow()

    // After dispose, no more pulse ticks
    vi.mocked(mockHal.setLED).mockClear()
    vi.advanceTimersByTime(1000)
    expect(mockHal.setLED).not.toHaveBeenCalled()
  })

  // ── AC6: Xbox/generic-hid — setLED is still called (HAL is a no-op internally) ──
  it('calls setLED on Xbox HAL (HAL handles no-op internally)', () => {
    const xboxHal = buildMockHal('xbox')
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('processing')]]))

    const controller = new LedController(mockSessionManager, xboxHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')

    // LedController always calls setLED; the HAL's own no-op handles Xbox
    expect(xboxHal.setLED).toHaveBeenCalledWith('#00C8FF')
    controller.dispose()
  })

  it('calls setLED on generic-hid HAL (HAL handles no-op internally)', () => {
    const genericHal = buildMockHal('generic-hid')
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('error')]]))

    const controller = new LedController(mockSessionManager, genericHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'error')

    expect(genericHal.setLED).toHaveBeenCalledWith('#E05555')
    controller.dispose()
  })

  // ── Story 6.5: DND suppression tests ────────────────────────────────────────

  it('DND suppresses LED update when isDndSuppressed returns true for normal priority state (Story 6.5, test 9)', () => {
    const sessions = new Map([['s1', buildMockFsm('processing')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    // Suppress normal priority
    const isDndSuppressed = vi.fn((priority: string) => priority === 'normal')
    const controller = new LedController(mockSessionManager, mockHal, isDndSuppressed)

    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')

    // processing has normal priority → should be suppressed → setLED not called
    expect(mockHal.setLED).not.toHaveBeenCalled()
    expect(isDndSuppressed).toHaveBeenCalledWith('normal')
    controller.dispose()
  })

  it('DND passes through error state (high priority) when isDndSuppressed returns false for high (Story 6.5, test 10)', () => {
    const sessions = new Map([['s1', buildMockFsm('error')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    // Only suppress non-high priorities (error has high priority — passes through)
    const isDndSuppressed = vi.fn((priority: string) => priority !== 'high')
    const controller = new LedController(mockSessionManager, mockHal, isDndSuppressed)

    emitStateChanged(mockSessionManager, 's1', 'processing', 'error')

    // error has high priority → not suppressed → setLED('#E05555') called
    expect(mockHal.setLED).toHaveBeenCalledWith('#E05555')
    expect(isDndSuppressed).toHaveBeenCalledWith('high')
    controller.dispose()
  })

  it('DND does NOT suppress idle transition — error→idle always clears the LED even when DND threshold=high (Story 6.5 bug fix)', () => {
    // Start in error state
    const errorSessions = new Map([['s1', buildMockFsm('error')]])
    mockSessionManager.getSessions.mockReturnValue(errorSessions)

    // DND suppresses everything except high-priority (i.e. suppresses normal/low)
    const isDndSuppressed = vi.fn((priority: string) => priority !== 'high')
    const controller = new LedController(mockSessionManager, mockHal, isDndSuppressed)

    emitStateChanged(mockSessionManager, 's1', 'idle', 'error')
    expect(mockHal.setLED).toHaveBeenCalledWith('#E05555')
    vi.mocked(mockHal.setLED).mockClear()

    // Now error resolves → idle. idle has 'normal' priority, but must NOT be suppressed.
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('idle')]]))
    emitStateChanged(mockSessionManager, 's1', 'error', 'idle')

    // LED must clear (#000000) — should NOT stay stuck on red
    expect(mockHal.setLED).toHaveBeenCalledWith('#000000')
    controller.dispose()
  })

  it('LedController works normally with default isDndSuppressed (no DND — always returns false)', () => {
    const sessions = new Map([['s1', buildMockFsm('processing')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    // Default: no DND callback provided → never suppresses
    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'processing')

    expect(mockHal.setLED).toHaveBeenCalledWith('#00C8FF')
    controller.dispose()
  })

  // ── computeColor — direct unit tests ────────────────────────────────────────
  it('computeColor returns null when no sessions exist', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    const result = controller.computeColor(new Map())
    expect(result).toBeNull()
    controller.dispose()
  })

  it('computeColor returns null when all sessions are idle', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    const sessions = new Map([
      ['s1', buildMockFsm('idle')],
      ['s2', buildMockFsm('idle')],
    ])
    const result = controller.computeColor(sessions)
    expect(result).toBeNull()
    controller.dispose()
  })

  it('computeColor returns #E05555 for error state', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    const result = controller.computeColor(new Map([['s1', buildMockFsm('error')]]))
    expect(result).toBe('#E05555')
    controller.dispose()
  })

  it('computeColor returns #FFB800 for needs-input state', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    const result = controller.computeColor(new Map([['s1', buildMockFsm('needs-input')]]))
    expect(result).toBe('#FFB800')
    controller.dispose()
  })

  it('computeColor returns #00C8FF for processing state', () => {
    const controller = new LedController(mockSessionManager, mockHal)
    const result = controller.computeColor(new Map([['s1', buildMockFsm('processing')]]))
    expect(result).toBe('#00C8FF')
    controller.dispose()
  })

  // ── Stops pulse when state transitions away from needs-input ────────────────
  it('stops amber pulse when state transitions from needs-input to processing', () => {
    const sessions = new Map([['s1', buildMockFsm('needs-input')]])
    mockSessionManager.getSessions.mockReturnValue(sessions)

    const controller = new LedController(mockSessionManager, mockHal)
    emitStateChanged(mockSessionManager, 's1', 'idle', 'needs-input')

    // Advance to confirm pulsing started
    vi.advanceTimersByTime(500)
    vi.mocked(mockHal.setLED).mockClear()

    // Transition to processing
    mockSessionManager.getSessions.mockReturnValue(new Map([['s1', buildMockFsm('processing')]]))
    emitStateChanged(mockSessionManager, 's1', 'needs-input', 'processing')

    // Should set cyan immediately after stopping pulse
    expect(mockHal.setLED).toHaveBeenCalledWith('#00C8FF')

    // No more pulse ticks
    vi.mocked(mockHal.setLED).mockClear()
    vi.advanceTimersByTime(1000)
    expect(mockHal.setLED).not.toHaveBeenCalled()

    controller.dispose()
  })
})
