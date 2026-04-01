// test/unit/output/haptic-controller.test.ts
// Unit tests for HapticController — AC: 1, 2, 3, 4, 5

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
import { HapticController } from '../../../src/extension/output/haptic-controller'
import type { ControllerHAL, ControllerType } from '../../../src/extension/hid/hal'
import { SessionManager } from '../../../src/extension/session/session-manager'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockHal(controllerType: ControllerType = 'dualsense'): ControllerHAL & { setHaptic: ReturnType<typeof vi.fn> } {
  return {
    controllerType,
    setHaptic: vi.fn(),
    setLED: vi.fn(),
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('HapticController', () => {
  let sessionManager: SessionManager
  let mockHal: ReturnType<typeof makeMockHal>

  beforeEach(() => {
    sessionManager = new SessionManager()
    mockHal = makeMockHal('dualsense')
  })

  it('processing transition → slow_rumble called on DualSense HAL (AC 1)', () => {
    const _ctrl = new HapticController(sessionManager, () => mockHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING') // idle → processing

    // setHaptic('none') cancels in-flight, then setHaptic('slow_rumble') fires
    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('none')
    expect(calls).toContain('slow_rumble')
    expect(calls[calls.length - 1]).toBe('slow_rumble')
  })

  it('needs-input transition → double_pulse called (AC 1)', () => {
    const _ctrl = new HapticController(sessionManager, () => mockHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')
    mockHal.setHaptic.mockClear()

    fsm.dispatch('NEEDS_INPUT') // processing → needs-input

    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('none')
    expect(calls).toContain('double_pulse')
    expect(calls[calls.length - 1]).toBe('double_pulse')
  })

  it('idle transition → single_pulse called (AC 2)', () => {
    const _ctrl = new HapticController(sessionManager, () => mockHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')
    mockHal.setHaptic.mockClear()

    fsm.dispatch('AGENT_COMPLETE') // processing → idle

    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('none')
    expect(calls).toContain('single_pulse')
    expect(calls[calls.length - 1]).toBe('single_pulse')
  })

  it('error transition → double_pulse called', () => {
    const _ctrl = new HapticController(sessionManager, () => mockHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')
    mockHal.setHaptic.mockClear()

    fsm.dispatch('AGENT_ERROR') // processing → error

    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('none')
    expect(calls).toContain('double_pulse')
    expect(calls[calls.length - 1]).toBe('double_pulse')
  })

  it('non-DualSense HAL (xbox) → setHaptic never called, no error thrown (AC 4)', () => {
    const xboxHal = makeMockHal('xbox')
    const _ctrl = new HapticController(sessionManager, () => xboxHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    expect(() => fsm.dispatch('AGENT_PROCESSING')).not.toThrow()

    expect(xboxHal.setHaptic).not.toHaveBeenCalled()
  })

  it('non-DualSense HAL (generic-hid) → setHaptic never called, no error thrown (AC 4)', () => {
    const genericHal = makeMockHal('generic-hid')
    const _ctrl = new HapticController(sessionManager, () => genericHal)

    const fsm = sessionManager.getOrCreateFsm('s1')
    expect(() => fsm.dispatch('AGENT_PROCESSING')).not.toThrow()

    expect(genericHal.setHaptic).not.toHaveBeenCalled()
  })

  it('null HAL → setHaptic never called, no error thrown (AC 4)', () => {
    const _ctrl = new HapticController(sessionManager, () => null)

    const fsm = sessionManager.getOrCreateFsm('s1')
    expect(() => fsm.dispatch('AGENT_PROCESSING')).not.toThrow()
    // no hal, nothing to assert beyond no throw
  })

  it('DND suppression callback → setHaptic not called when suppressed (AC 3)', () => {
    const isDndSuppressed = vi.fn((_priority: string) => true)
    const _ctrl = new HapticController(sessionManager, () => mockHal, isDndSuppressed)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')

    expect(mockHal.setHaptic).not.toHaveBeenCalled()
    expect(isDndSuppressed).toHaveBeenCalled()
  })

  it('DND suppression off → setHaptic IS called (AC 3)', () => {
    const isDndSuppressed = vi.fn((_priority: string) => false)
    const _ctrl = new HapticController(sessionManager, () => mockHal, isDndSuppressed)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')

    expect(mockHal.setHaptic).toHaveBeenCalled()
  })

  // Story 6.5: DND priority-aware suppression tests
  it('DND suppresses haptic for normal priority state (processing) when isDndSuppressed returns true (Story 6.5, test 11)', () => {
    const isDndSuppressed = vi.fn((priority: string) => priority === 'normal')
    const _ctrl = new HapticController(sessionManager, () => mockHal, isDndSuppressed)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING') // → processing (normal priority)

    // Suppressed — setHaptic should NOT have been called
    expect(mockHal.setHaptic).not.toHaveBeenCalled()
    expect(isDndSuppressed).toHaveBeenCalledWith('normal')
  })

  it('DND passes through error state (high priority) when isDndSuppressed returns false for high (Story 6.5, test 12)', () => {
    // Only suppress non-high priorities
    const isDndSuppressed = vi.fn((priority: string) => priority !== 'high')
    const _ctrl = new HapticController(sessionManager, () => mockHal, isDndSuppressed)

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING') // normal — suppressed
    mockHal.setHaptic.mockClear()

    fsm.dispatch('AGENT_ERROR') // → error (high priority)

    // Error passes through — double_pulse should be called
    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])
    expect(calls).toContain('double_pulse')
    expect(isDndSuppressed).toHaveBeenCalledWith('high')
  })

  it('rapid successive transitions → anti-stacking: setHaptic("none") cancels in-flight before each new haptic (AC 5)', () => {
    const _ctrl = new HapticController(sessionManager, () => mockHal)

    const fsm = sessionManager.getOrCreateFsm('s1')

    // Dispatch multiple rapid transitions
    fsm.dispatch('AGENT_PROCESSING')   // → slow_rumble
    fsm.dispatch('NEEDS_INPUT')        // → double_pulse (should cancel previous)
    fsm.dispatch('AGENT_COMPLETE')     // → single_pulse (should cancel previous)

    const calls = mockHal.setHaptic.mock.calls.map((c: unknown[]) => c[0])

    // Every pattern fire should be preceded by a 'none' cancel call
    // Pattern: none, slow_rumble, none, double_pulse, none, single_pulse
    expect(calls[0]).toBe('none')
    expect(calls[1]).toBe('slow_rumble')
    expect(calls[2]).toBe('none')
    expect(calls[3]).toBe('double_pulse')
    expect(calls[4]).toBe('none')
    expect(calls[5]).toBe('single_pulse')
  })

  it('dispose() → no further haptic calls after disposal', () => {
    const ctrl = new HapticController(sessionManager, () => mockHal)

    ctrl.dispose()
    mockHal.setHaptic.mockClear()

    const fsm = sessionManager.getOrCreateFsm('s1')
    fsm.dispatch('AGENT_PROCESSING')

    expect(mockHal.setHaptic).not.toHaveBeenCalled()
  })

  it('haptic fires synchronously (within same call stack) — timing AC 1 by design', () => {
    // The SessionManager emits synchronously from AgentFSM.dispatch()
    // HapticController.handleStateChange() is called synchronously in the same tick.
    // This test confirms the call ordering is synchronous.
    let hapticCalledBeforeCallReturns = false

    const trackingHal = {
      ...mockHal,
      setHaptic: vi.fn(() => {
        hapticCalledBeforeCallReturns = true
      }),
    }

    const _ctrl = new HapticController(sessionManager, () => trackingHal)
    const fsm = sessionManager.getOrCreateFsm('timing-test')

    fsm.dispatch('AGENT_PROCESSING')
    // dispatch() returns synchronously. By the time we reach here, haptic should have fired.
    expect(hapticCalledBeforeCallReturns).toBe(true)
  })
})
