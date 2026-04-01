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
import { L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS } from '../../../src/extension/input/radial-wheel-segments'
import { computeWheelSegmentIndex } from '../../../src/shared/constants'
import type { WheelSegmentDef } from '../../../src/shared/types'

// ── Mock panel manager ─────────────────────────────────────────────────────────

function makeMockPanelManager() {
  return {
    open: vi.fn(),
    updateStick: vi.fn(),
    close: vi.fn(),
    swap: vi.fn(),
    dispose: vi.fn(),
  }
}

// ── Mock dispatch tracker ──────────────────────────────────────────────────────

function makeMockDispatchTracker() {
  return {
    getCount: vi.fn().mockReturnValue(0),
    increment: vi.fn().mockResolvedValue(undefined),
    computeLabelMode: vi.fn().mockReturnValue('full'),
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RadialWheelController', () => {
  let controller: RadialWheelController
  let panelManager: ReturnType<typeof makeMockPanelManager>
  let mockGetR2Segments: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks()
    panelManager = makeMockPanelManager()
    mockGetR2Segments = vi.fn().mockReturnValue(R2_PERSONAL_WHEEL_SEGMENTS)
    controller = new RadialWheelController(panelManager, makeMockDispatchTracker() as never, mockGetR2Segments)
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
      expect(panelManager.open).toHaveBeenCalledWith('l2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
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
      expect(panelManager.open).toHaveBeenCalledWith('l2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
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
      expect(computeWheelSegmentIndex(0, -1.0)).toBe(0)
    })

    // ── 8. Segment index computation — right (segment 2) ────────────────────
    it('returns 2 for x=1.0, y=0 (stick right = right segment)', () => {
      expect(computeWheelSegmentIndex(1.0, 0)).toBe(2)
    })

    it('returns 4 for x=0, y=1.0 (stick down = bottom segment)', () => {
      expect(computeWheelSegmentIndex(0, 1.0)).toBe(4)
    })

    it('returns 6 for x=-1.0, y=0 (stick left = left segment)', () => {
      expect(computeWheelSegmentIndex(-1.0, 0)).toBe(6)
    })

    // ── 9. Dead zone returns -1 ──────────────────────────────────────────────
    it('returns -1 for x=0.1, y=0.1 (below dead zone)', () => {
      expect(computeWheelSegmentIndex(0.1, 0.1)).toBe(-1)
    })

    it('returns -1 for x=0, y=0 (center)', () => {
      expect(computeWheelSegmentIndex(0, 0)).toBe(-1)
    })

    it('returns a valid index for x=0.3, y=0 (just above dead zone)', () => {
      const result = computeWheelSegmentIndex(0.3, 0)
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThanOrEqual(7)
    })
  })

  // ── 10. dispose ────────────────────────────────────────────────────────────
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

    it('does not throw when disposed after L2 press and stick events', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0 })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: -1.0 })
      expect(() => controller.dispose()).not.toThrow()
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

  // ── Story 7.2: R2 Personal Wheel & Trigger Swap ───────────────────────────────

  // 7.2-1: R2 press opens panel with R2 as active wheel
  describe('R2 press opens panel with R2 as active wheel', () => {
    it('calls panelManager.open with r2 and both segment arrays on R2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      expect(panelManager.open).toHaveBeenCalledOnce()
      expect(panelManager.open).toHaveBeenCalledWith('r2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
    })
  })

  // 7.2-2: RT press opens panel (Xbox)
  describe('RT press opens panel — Xbox controller', () => {
    it('calls panelManager.open with r2 on RT press', () => {
      controller.handleEvent({ kind: 'button', button: 'rt', pressed: true })
      expect(panelManager.open).toHaveBeenCalledOnce()
      expect(panelManager.open).toHaveBeenCalledWith('r2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
    })
  })

  // 7.2-3: R2 release with segment selected dispatches from R2 segments
  describe('R2 release with segment selected dispatches from R2 segments', () => {
    it('dispatches vibesense.dispatchPrompt with R2 segment 3 promptText on R2 release', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      // Segment 3 = bottom-right direction: x=0.5, y=1.0 → atan2(1.0,0.5)=63.4° → +90°=153.4° → index 3
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.5 })
      controller.handleEvent({ kind: 'axis', axis: 'right_y', value: 1.0 })
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: false })
      expect(panelManager.close).toHaveBeenCalledWith(false)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'vibesense.dispatchPrompt',
        R2_PERSONAL_WHEEL_SEGMENTS[3].promptText,
      )
    })
  })

  // 7.2-4: Trigger swap — L2 held, R2 pressed → swap to R2
  describe('trigger swap — L2 held, R2 pressed', () => {
    it('calls panelManager.swap with r2 when R2 pressed while L2 held', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      expect(panelManager.swap).toHaveBeenCalledWith('r2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
      expect(panelManager.open).toHaveBeenCalledOnce() // only first open, not second
    })
  })

  // 7.2-5: Trigger swap — R2 held, L2 pressed → swap to L2
  describe('trigger swap — R2 held, L2 pressed', () => {
    it('calls panelManager.swap with l2 when L2 pressed while R2 held', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      expect(panelManager.swap).toHaveBeenCalledWith('l2', L2_SMART_WHEEL_SEGMENTS, R2_PERSONAL_WHEEL_SEGMENTS)
      expect(panelManager.open).toHaveBeenCalledOnce() // only first open
    })
  })

  // 7.2-6: AC3 — Releasing receded trigger (L2 active, R2 receded) — no dispatch
  describe('AC3 — releasing receded R2 trigger when L2 is active', () => {
    it('does not dispatch when R2 is released while R2 is the receded trigger', () => {
      // L2 pressed (active), R2 pressed (swap to R2 active), then L2 pressed again (swap back to L2 active)
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true }) // swap → R2 active
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true }) // swap → L2 active
      // Now L2 is active, R2 is receded (r2Held = true)
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: false }) // release receded R2
      expect(panelManager.close).not.toHaveBeenCalled()
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // 7.2-7: AC3 — Releasing receded trigger (R2 active, L2 receded) — no dispatch
  describe('AC3 — releasing receded L2 trigger when R2 is active', () => {
    it('does not dispatch when L2 is released while L2 is the receded trigger', () => {
      // R2 pressed (R2 active), L2 pressed (swap → L2 active), R2 pressed (swap → R2 active)
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true }) // R2 active
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true }) // swap → L2 active
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true }) // swap → R2 active
      // Now R2 is active, L2 is receded (l2Held = true)
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: false }) // release receded L2
      expect(panelManager.close).not.toHaveBeenCalled()
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // 7.2-8: Right stick ignored when both triggers released
  describe('right stick ignored when both triggers released', () => {
    it('does not call panelManager.updateStick when neither L2 nor R2 is held', () => {
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.9 })
      expect(panelManager.updateStick).not.toHaveBeenCalled()
    })
  })

  // 7.2-9: Right stick works when R2 held
  describe('right stick works when R2 held', () => {
    it('calls panelManager.updateStick when right_x axis event fires after R2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      controller.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.8 })
      expect(panelManager.updateStick).toHaveBeenCalledWith(0.8, 0)
    })
  })

  // 7.2-10: Dispose clears state correctly after R2 held
  describe('dispose() after R2 held', () => {
    it('does not throw when disposed after R2 press', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      expect(() => controller.dispose()).not.toThrow()
    })
  })

  // ── R2 segments data ──────────────────────────────────────────────────────────
  describe('R2 Personal Wheel segments', () => {
    it('has exactly 8 segments', () => {
      expect(R2_PERSONAL_WHEEL_SEGMENTS).toHaveLength(8)
    })

    it('has segment indices 0–7', () => {
      const indices = R2_PERSONAL_WHEEL_SEGMENTS.map((s: WheelSegmentDef) => s.index)
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    })

    it('all R2 segments have promptText defined', () => {
      for (const seg of R2_PERSONAL_WHEEL_SEGMENTS) {
        expect(seg.promptText).toBeTruthy()
      }
    })

    it('all R2 segments use vibesense.dispatchPrompt commandId', () => {
      for (const seg of R2_PERSONAL_WHEEL_SEGMENTS) {
        expect(seg.commandId).toBe('vibesense.dispatchPrompt')
      }
    })
  })

  // ── Story 7.4: DispatchTracker + getR2Segments integration ───────────────────

  describe('Story 7.4 — dispatchTracker.increment() called on R2 dispatch', () => {
    it('calls dispatchTracker.increment(selectedIndex) after successful R2 dispatch', async () => {
      const mockTracker = makeMockDispatchTracker()
      const mockR2 = vi.fn().mockReturnValue(R2_PERSONAL_WHEEL_SEGMENTS)

      const localController = new RadialWheelController(panelManager, mockTracker as never, mockR2)

      // R2 pressed, stick to segment 0 (up), R2 released
      localController.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      localController.handleEvent({ kind: 'axis', axis: 'right_x', value: 0 })
      localController.handleEvent({ kind: 'axis', axis: 'right_y', value: -1.0 }) // segment 0
      localController.handleEvent({ kind: 'button', button: 'r2', pressed: false })

      // Should have called increment with index 0
      expect(mockTracker.increment).toHaveBeenCalledWith(0)
      localController.dispose()
    })

    it('does not call dispatchTracker.increment when R2 is released in dead zone', () => {
      const mockTracker = makeMockDispatchTracker()
      const mockR2 = vi.fn().mockReturnValue(R2_PERSONAL_WHEEL_SEGMENTS)
      const localController = new RadialWheelController(panelManager, mockTracker as never, mockR2)

      localController.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      // No stick update — dead zone
      localController.handleEvent({ kind: 'button', button: 'r2', pressed: false })

      expect(mockTracker.increment).not.toHaveBeenCalled()
      localController.dispose()
    })
  })

  describe('Story 7.4 — getR2Segments() callback is called on L2 press, R2 press, L2 swap, R2 swap', () => {
    it('calls getR2Segments() when L2 is pressed (wheel open)', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      expect(mockGetR2Segments).toHaveBeenCalled()
    })

    it('calls getR2Segments() when R2 is pressed (wheel open)', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      expect(mockGetR2Segments).toHaveBeenCalled()
    })

    it('calls getR2Segments() on trigger swap L2→R2 (L2 held, R2 pressed)', () => {
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      mockGetR2Segments.mockClear()
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      expect(mockGetR2Segments).toHaveBeenCalled()
    })

    it('calls getR2Segments() on trigger swap R2→L2 (R2 held, L2 pressed)', () => {
      controller.handleEvent({ kind: 'button', button: 'r2', pressed: true })
      mockGetR2Segments.mockClear()
      controller.handleEvent({ kind: 'button', button: 'l2', pressed: true })
      expect(mockGetR2Segments).toHaveBeenCalled()
    })
  })
})
