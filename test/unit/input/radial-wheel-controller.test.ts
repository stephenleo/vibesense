// test/unit/input/radial-wheel-controller.test.ts
// Unit tests for RadialWheelController — all VSCode APIs and logger mocked

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────
const { mockExecuteCommand, mockLogger } = vi.hoisted(() => {
  return {
    mockExecuteCommand: vi.fn().mockResolvedValue(undefined),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  commands: {
    executeCommand: mockExecuteCommand,
  },
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { RadialWheelController } from '../../../src/extension/input/radial-wheel-controller'
import { L2_SMART_WHEEL_SEGMENTS } from '../../../src/extension/input/radial-wheel-segments'
import type { WheelSegmentDef } from '../../../src/shared/types'

// ── Mock panel manager ─────────────────────────────────────────────────────────

function makeMockPanelManager() {
  return {
    open: vi.fn(),
    updateStick: vi.fn(),
    close: vi.fn(),
    dispose: vi.fn(),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RadialWheelController', () => {
  let controller: RadialWheelController
  let panelManager: ReturnType<typeof makeMockPanelManager>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    panelManager = makeMockPanelManager()
    controller = new RadialWheelController(panelManager)
  })

  afterEach(() => {
    controller.dispose()
    vi.useRealTimers()
  })

  // ── 1. L2 press opens panel ──────────────────────────────────────────────────
  describe('L2 press opens panel (AC1)', () => {
    it('calls panelManager.open with l2 and L2 segments on L2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      expect(panelManager.open).toHaveBeenCalledOnce()
      expect(panelManager.open).toHaveBeenCalledWith('l2', L2_SMART_WHEEL_SEGMENTS, [])
    })

    it('does not open panel on L2 release without prior press', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false })
      expect(panelManager.open).not.toHaveBeenCalled()
    })
  })

  // ── 2. LT press opens panel (Xbox) ──────────────────────────────────────────
  describe('LT press opens panel — Xbox controller (AC1)', () => {
    it('calls panelManager.open with l2 and L2 segments on LT press', () => {
      controller.handleEvent({ kind: 'button', button: 'lt', pressed: true })
      expect(panelManager.open).toHaveBeenCalledOnce()
      expect(panelManager.open).toHaveBeenCalledWith('l2', L2_SMART_WHEEL_SEGMENTS, [])
    })
  })

  // ── 3. L2 release with segment selected dispatches command ──────────────────
  describe('L2 release with segment selected dispatches command (AC3)', () => {
    it('dispatches vibesense.deny when segment 7 (Deny) is selected and L2 released', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      // Segment 7 = top-left: x=-1, y=-1 → angle = atan2(-1,-1)+π/2 = -3π/4+π/2 = -π/4, normalized ≈ 7π/4 → index 7
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: -0.8 })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: -0.8 })
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false })
      expect(panelManager.close).toHaveBeenCalledWith(false)
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.deny')
    })

    it('dispatches vibesense.dispatchPrompt with promptText for prompt segment (Explain This)', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      // Segment 4 = bottom: x=0, y=1
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0 })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: 1.0 })
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false })
      expect(panelManager.close).toHaveBeenCalledWith(false)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'vibesense.dispatchPrompt',
        'Explain the selected code',
      )
    })
  })

  // ── 4. L2 release with stick in dead zone cancels ───────────────────────────
  describe('L2 release in dead zone cancels without dispatch (AC4)', () => {
    it('calls panelManager.close(true) when stick is in dead zone on L2 release', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      // No stick update — stick stays at (0,0) = dead zone
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false })
      expect(panelManager.close).toHaveBeenCalledWith(true)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not call close when L2 is not held', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false })
      expect(panelManager.close).not.toHaveBeenCalled()
    })
  })

  // ── 5. Right stick ignored when wheel closed ─────────────────────────────────
  describe('right stick ignored when wheel is closed', () => {
    it('does not call panelManager.updateStick when L2 is not held', () => {
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.9 })
      expect(panelManager.updateStick).not.toHaveBeenCalled()
    })

    it('does not call updateStick for right_y when wheel is closed', () => {
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: -0.9 })
      expect(panelManager.updateStick).not.toHaveBeenCalled()
    })
  })

  // ── 6. Right stick update sent to panel when wheel is open ──────────────────
  describe('right stick update forwarded to panel manager (AC2)', () => {
    it('calls panelManager.updateStick when right_x axis event fires after L2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.8 })
      expect(panelManager.updateStick).toHaveBeenCalledWith(0.8, 0)
    })

    it('calls panelManager.updateStick when right_y axis event fires after L2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: -0.9 })
      expect(panelManager.updateStick).toHaveBeenCalledWith(0, -0.9)
    })
  })

  // ── 7. Segment index computation — top (segment 0) ──────────────────────────
  describe('segment index computation', () => {
    it('returns 0 for x=0, y=-1 (stick up = top segment)', () => {
      expect(controller.computeSegmentIndex(0, -1.0)).toBe(0)
    })

    // ── 8. Segment index computation — right (segment 2) ────────────────────
    it('returns 2 for x=1.0, y=0 (stick right = right segment)', () => {
      expect(controller.computeSegmentIndex(1.0, 0)).toBe(2)
    })

    it('returns 4 for x=0, y=1.0 (stick down = bottom segment)', () => {
      expect(controller.computeSegmentIndex(0, 1.0)).toBe(4)
    })

    it('returns 6 for x=-1.0, y=0 (stick left = left segment)', () => {
      expect(controller.computeSegmentIndex(-1.0, 0)).toBe(6)
    })

    // ── 9. Dead zone returns -1 ──────────────────────────────────────────────
    it('returns -1 for x=0.1, y=0.1 (below dead zone)', () => {
      expect(controller.computeSegmentIndex(0.1, 0.1)).toBe(-1)
    })

    it('returns -1 for x=0, y=0 (center)', () => {
      expect(controller.computeSegmentIndex(0, 0)).toBe(-1)
    })

    it('returns a valid index for x=0.3, y=0 (just above dead zone)', () => {
      const result = controller.computeSegmentIndex(0.3, 0)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(7)
    })
  })

  // ── 10. dispose clears preview timer ────────────────────────────────────────
  describe('dispose()', () => {
    it('does not throw when disposed without any events', () => {
      expect(() => controller.dispose()).not.toThrow()
    })

    it('does not throw when disposed twice', () => {
      expect(() => {
        controller.dispose()
        controller.dispose()
      }).not.toThrow()
    })

    it('clears any pending preview timer on dispose', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0 })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: -1.0 })
      // dispose before timer fires
      expect(() => controller.dispose()).not.toThrow()
      // Advance timers — should not throw
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow()
    })
  })

  // ── Error resilience ─────────────────────────────────────────────────────────
  describe('error resilience (NFR-R1)', () => {
    it('does not throw when handleEvent receives unknown event kind', () => {
      expect(() =>
        controller.handleEvent({ kind: 'connected', controllerType: 'dualsense' }),
      ).not.toThrow()
    })

    it('does not throw when panelManager.open throws', () => {
      panelManager.open.mockImplementation(() => {
        throw new Error('panel error')
      })
      expect(() =>
        controller.handleEvent({ kind: 'button', button: 'l2', pressed: true }),
      ).not.toThrow()
    })

    it('logs error when handleEvent throws internally', () => {
      panelManager.open.mockImplementation(() => {
        throw new Error('panel error')
      })
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'RadialWheelController: handleEvent error',
        expect.any(Error),
      )
    })
  })

  // ── L2 segments data ─────────────────────────────────────────────────────────
  describe('L2 Smart Wheel segments', () => {
    it('has exactly 8 segments', () => {
      expect(L2_SMART_WHEEL_SEGMENTS).toHaveLength(8)
    })

    it('has segment indices 0–7', () => {
      const indices = L2_SMART_WHEEL_SEGMENTS.map((s: WheelSegmentDef) => s.index)
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    })

    it('prompt segments (4, 5, 6) have promptText defined', () => {
      const promptSegments = L2_SMART_WHEEL_SEGMENTS.filter((s: WheelSegmentDef) => s.promptText !== undefined)
      expect(promptSegments).toHaveLength(3)
      expect(promptSegments.map((s: WheelSegmentDef) => s.index)).toEqual([4, 5, 6])
    })

    it('non-prompt segments have commandId that is not vibesense.dispatchPrompt', () => {
      const nonPromptSegments = L2_SMART_WHEEL_SEGMENTS.filter((s: WheelSegmentDef) => !s.promptText)
      for (const seg of nonPromptSegments) {
        expect(seg.commandId).not.toBe('vibesense.dispatchPrompt')
      }
    })
  })
})
