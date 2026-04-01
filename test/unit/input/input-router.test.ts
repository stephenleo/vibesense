// test/unit/input/input-router.test.ts
// Unit tests for InputRouter — all VSCode APIs and logger mocked

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────
const { mockExecuteCommand, mockLogger, mockScrollUpdate, mockScrollDispose } = vi.hoisted(() => {
  return {
    mockExecuteCommand: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockScrollUpdate: vi.fn(),
    mockScrollDispose: vi.fn(),
  }
})

// ── Mock SessionRatioTracker ──────────────────────────────────────────────────
const mockRecordControllerAction = vi.fn()
const mockRecordFeatureUsed = vi.fn()
vi.mock('../../../src/extension/stats/session-ratio-tracker', () => ({
  SessionRatioTracker: vi.fn(function () {
    return {
      recordControllerAction: mockRecordControllerAction,
      recordFeatureUsed: mockRecordFeatureUsed,
    }
  }),
  SESSION_HISTORY_KEY: 'vibesense.sessionHistory',
}))

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

// ── Mock AnalogScrollController ───────────────────────────────────────────────
vi.mock('../../../src/extension/input/analog-scroll-controller', () => ({
  AnalogScrollController: vi.fn(function () {
    return {
      update: mockScrollUpdate,
      dispose: mockScrollDispose,
    }
  }),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { InputRouter } from '../../../src/extension/input/input-router'
import { INPUT_BUFFER_WINDOW_MS } from '../../../src/shared/constants'
import type { BindingMap } from '../../../src/extension/input/default-bindings'
import type { ControllerEvent } from '../../../src/shared/types'
import type { SessionRatioTracker } from '../../../src/extension/stats/session-ratio-tracker'

// ── Helpers ────────────────────────────────────────────────────────────────────
const testBindings: BindingMap = {
  cross: 'vibesense.approve',
  circle: 'vibesense.deny',
  up: 'workbench.action.terminal.scrollUp',
}

function buttonPress(button: string): ControllerEvent {
  return { kind: 'button', button: button as never, pressed: true }
}

function buttonRelease(button: string): ControllerEvent {
  return { kind: 'button', button: button as never, pressed: false }
}

function axisEvent(value: number): ControllerEvent {
  return { kind: 'axis', axis: 'left_y', value }
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('InputRouter', () => {
  let router: InputRouter

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    router = new InputRouter(testBindings)
  })

  afterEach(() => {
    router.dispose()
    vi.useRealTimers()
  })

  // ── AC 1: Button press with binding ───────────────────────────────────────
  describe('button press with binding', () => {
    it('calls executeCommand with the correct command ID', () => {
      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledOnce()
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.approve')
    })

    it('logs the button→command mapping at debug level (AC 1)', () => {
      router.handleEvent(buttonPress('cross'))
      expect(mockLogger.debug).toHaveBeenCalledOnce()
      expect(mockLogger.debug).toHaveBeenCalledWith('InputRouter: cross → vibesense.approve')
    })

    it('routes circle to vibesense.deny', () => {
      router.handleEvent(buttonPress('circle'))
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.deny')
    })
  })

  // ── AC 3: Button press with no binding ────────────────────────────────────
  describe('button press with no binding', () => {
    it('does NOT call executeCommand (silently ignored)', () => {
      router.handleEvent(buttonPress('square'))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does NOT log an error for unbound buttons', () => {
      router.handleEvent(buttonPress('square'))
      expect(mockLogger.error).not.toHaveBeenCalled()
    })
  })

  // ── Button release (only fire on press) ───────────────────────────────────
  describe('button release', () => {
    it('does NOT call executeCommand on button release (pressed: false)', () => {
      router.handleEvent(buttonRelease('cross'))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── AC 4: Axis dead zone ──────────────────────────────────────────────────
  describe('axis dead zone (AC 4)', () => {
    it('does NOT execute any command when axis value is below dead zone (0.10)', () => {
      router.handleEvent(axisEvent(0.10))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does NOT execute any command when axis value is negative but below dead zone (-0.10)', () => {
      router.handleEvent(axisEvent(-0.10))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does NOT execute any command at exactly 0.14 (boundary — still below dead zone)', () => {
      router.handleEvent(axisEvent(0.14))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('passes through at exactly 0.15 (dead zone boundary — not less than threshold)', () => {
      // 0.15 is NOT < 0.15, so it passes through the dead zone filter into the axis handler
      expect(() => router.handleEvent(axisEvent(0.15))).not.toThrow()
    })

    it('passes through at exactly -0.15 (negative dead zone boundary)', () => {
      expect(() => router.handleEvent(axisEvent(-0.15))).not.toThrow()
    })

    it('does NOT throw when axis value is above dead zone (0.20) — handler in place', () => {
      expect(() => router.handleEvent(axisEvent(0.20))).not.toThrow()
    })

    it('does NOT throw when axis value is above dead zone in negative direction (-0.20)', () => {
      expect(() => router.handleEvent(axisEvent(-0.20))).not.toThrow()
    })
  })

  // ── AC 2: Input buffering ─────────────────────────────────────────────────
  describe('startBuffering() — AC 2', () => {
    it('buffers events and does NOT call executeCommand during buffering', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))
      router.handleEvent(buttonPress('circle'))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('replays buffered events in order after buffer window expires', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))
      router.handleEvent(buttonPress('circle'))

      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS + 10)

      expect(mockExecuteCommand).toHaveBeenCalledTimes(2)
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1, 'vibesense.approve')
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2, 'vibesense.deny')
    })

    it('does not lose any buffered events (no silent drops — AC 2)', () => {
      router.startBuffering()
      for (let i = 0; i < 5; i++) {
        router.handleEvent(buttonPress('cross'))
      }
      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS + 10)
      expect(mockExecuteCommand).toHaveBeenCalledTimes(5)
    })

    it('resets the timer if startBuffering() is called again before expiry', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))

      // Re-trigger buffering before timeout
      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS - 50)
      router.startBuffering()
      router.handleEvent(buttonPress('circle'))

      // At original expiry + a little: should NOT have flushed yet
      vi.advanceTimersByTime(60)
      expect(mockExecuteCommand).not.toHaveBeenCalled()

      // Full new window passes
      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS)
      expect(mockExecuteCommand).toHaveBeenCalledTimes(2)
    })
  })

  // ── stopBuffering() immediately flushes ───────────────────────────────────
  describe('stopBuffering()', () => {
    it('immediately flushes buffered events', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))
      router.handleEvent(buttonPress('circle'))

      router.stopBuffering()

      expect(mockExecuteCommand).toHaveBeenCalledTimes(2)
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(1, 'vibesense.approve')
      expect(mockExecuteCommand).toHaveBeenNthCalledWith(2, 'vibesense.deny')
    })

    it('does not call executeCommand again when timer naturally expires after stopBuffering()', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))
      router.stopBuffering()

      vi.clearAllMocks()
      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS + 10)

      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('after stopBuffering(), new events are dispatched immediately', () => {
      router.startBuffering()
      router.stopBuffering()
      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledOnce()
    })
  })

  // ── dispose() ─────────────────────────────────────────────────────────────
  describe('dispose()', () => {
    it('clears the buffer', () => {
      router.startBuffering()
      router.handleEvent(buttonPress('cross'))
      router.dispose()

      // Timer would have fired — but buffer was cleared on dispose
      vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS + 10)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('cancels the pending timer on dispose()', () => {
      router.startBuffering()
      router.dispose()
      // Advancing time should not cause any errors or command execution
      expect(() => vi.advanceTimersByTime(INPUT_BUFFER_WINDOW_MS + 10)).not.toThrow()
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── Error resilience (NFR-R1) ─────────────────────────────────────────────
  describe('error handling', () => {
    it('does not throw when executeCommand throws', () => {
      mockExecuteCommand.mockImplementationOnce(() => {
        throw new Error('vscode API error')
      })
      expect(() => router.handleEvent(buttonPress('cross'))).not.toThrow()
    })

    it('logs error when executeCommand throws', () => {
      mockExecuteCommand.mockImplementationOnce(() => {
        throw new Error('vscode API error')
      })
      router.handleEvent(buttonPress('cross'))
      expect(mockLogger.error).toHaveBeenCalledWith(
        'InputRouter: executeCommand error',
        expect.any(Error),
      )
    })
  })

  // ── Non-button/axis events are ignored ────────────────────────────────────
  describe('non-button/axis events', () => {
    it('ignores connected events (handled by StatusBarController)', () => {
      router.handleEvent({ kind: 'connected', controllerType: 'dualsense' })
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('ignores disconnected events', () => {
      router.handleEvent({ kind: 'disconnected' })
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('ignores battery events', () => {
      router.handleEvent({ kind: 'battery', level: 10 })
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── AC 5: Axis routing to AnalogScrollController ──────────────────────────
  describe('axis routing to AnalogScrollController (AC 4, AC 5)', () => {
    it('routes left_y axis events to scrollController.update()', () => {
      router.handleEvent({ kind: 'axis', axis: 'left_y', value: 0.8 })
      expect(mockScrollUpdate).toHaveBeenCalledWith('left_y', 0.8)
    })

    it('routes right_y axis events to scrollController.update()', () => {
      router.handleEvent({ kind: 'axis', axis: 'right_y', value: -0.6 })
      expect(mockScrollUpdate).toHaveBeenCalledWith('right_y', -0.6)
    })

    it('routes dead zone axis values to scrollController.update() (no early return — avoids missed-stop bug)', () => {
      router.handleEvent({ kind: 'axis', axis: 'left_y', value: 0.05 })
      expect(mockScrollUpdate).toHaveBeenCalledWith('left_y', 0.05)
    })

    it('routes left_x axis events to scrollController.update() (scroll controller ignores them)', () => {
      router.handleEvent({ kind: 'axis', axis: 'left_x', value: 0.9 })
      expect(mockScrollUpdate).toHaveBeenCalledWith('left_x', 0.9)
    })

    it('routes right_x axis events to scrollController.update()', () => {
      router.handleEvent({ kind: 'axis', axis: 'right_x', value: 0.9 })
      expect(mockScrollUpdate).toHaveBeenCalledWith('right_x', 0.9)
    })

    it('does not directly call executeCommand for axis events (delegated to scrollController)', () => {
      router.handleEvent({ kind: 'axis', axis: 'left_y', value: 0.8 })
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── dispose() calls scrollController.dispose() ───────────────────────────
  describe('dispose() delegates to scrollController', () => {
    it('calls scrollController.dispose() on dispose()', () => {
      router.dispose()
      expect(mockScrollDispose).toHaveBeenCalledOnce()
    })
  })

  // ── updateBindings() — Story 4.3 (AC 2, 3) ───────────────────────────────
  describe('updateBindings() (Story 4.3, AC 2, 3)', () => {
    it('fires no command after updateBindings({}) when a previously-bound button is pressed', () => {
      // Start with testBindings (cross → vibesense.approve)
      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledOnce()
      vi.clearAllMocks()

      // Hot-swap to empty map
      router.updateBindings({})
      router.handleEvent(buttonPress('cross'))

      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('fires the command from the new map after updateBindings(newMap)', () => {
      const newBindings: BindingMap = {
        cross: 'vibesense.newCommand',
        square: 'vibesense.anotherCommand',
      }
      router.updateBindings(newBindings)

      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.newCommand')
    })

    it('does not affect previously-bound buttons that are not in the new map', () => {
      // circle was in testBindings but not in newBindings
      const newBindings: BindingMap = { cross: 'vibesense.newCommand' }
      router.updateBindings(newBindings)

      router.handleEvent(buttonPress('circle'))
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('takes effect immediately — next event after update uses new bindings', () => {
      // Verify old binding first
      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.approve')
      vi.clearAllMocks()

      // Update and immediately verify new binding
      router.updateBindings({ cross: 'vibesense.deny' })
      router.handleEvent(buttonPress('cross'))
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.deny')
    })
  })

  // ── Story 9.1: SessionRatioTracker integration (AC1) ─────────────────────
  describe('SessionRatioTracker integration — controller action counting (Story 9.1, AC1)', () => {
    let routerWithTracker: InputRouter
    let mockTracker: SessionRatioTracker

    beforeEach(() => {
      mockRecordControllerAction.mockReset()
      // Create a mock tracker with just the method we need
      mockTracker = {
        recordControllerAction: mockRecordControllerAction,
      } as unknown as SessionRatioTracker
      routerWithTracker = new InputRouter(testBindings, mockTracker)
    })

    afterEach(() => {
      routerWithTracker.dispose()
    })

    it('calls recordControllerAction once per dispatched button press (AC1)', () => {
      routerWithTracker.handleEvent(buttonPress('cross'))
      expect(mockRecordControllerAction).toHaveBeenCalledOnce()
    })

    it('calls recordControllerAction for each distinct button press with a binding (AC1)', () => {
      routerWithTracker.handleEvent(buttonPress('cross'))
      routerWithTracker.handleEvent(buttonPress('circle'))
      expect(mockRecordControllerAction).toHaveBeenCalledTimes(2)
    })

    it('does NOT call recordControllerAction for button press with no binding (AC1)', () => {
      routerWithTracker.handleEvent(buttonPress('square')) // no binding in testBindings
      expect(mockRecordControllerAction).not.toHaveBeenCalled()
    })

    it('does NOT call recordControllerAction for button release (pressed: false) (AC1)', () => {
      routerWithTracker.handleEvent(buttonRelease('cross'))
      expect(mockRecordControllerAction).not.toHaveBeenCalled()
    })

    it('does NOT call recordControllerAction for axis events (scroll — AC1 constraint)', () => {
      routerWithTracker.handleEvent(axisEvent(0.8))
      expect(mockRecordControllerAction).not.toHaveBeenCalled()
    })

    it('does NOT call recordControllerAction for connected events (AC1 constraint)', () => {
      routerWithTracker.handleEvent({ kind: 'connected', controllerType: 'dualsense' })
      expect(mockRecordControllerAction).not.toHaveBeenCalled()
    })

    it('works correctly when no ratioTracker provided (optional parameter — backward compat)', () => {
      const routerNoTracker = new InputRouter(testBindings)
      expect(() => routerNoTracker.handleEvent(buttonPress('cross'))).not.toThrow()
      expect(mockExecuteCommand).toHaveBeenCalledWith('vibesense.approve')
      routerNoTracker.dispose()
    })

    it('does NOT call recordControllerAction when executeCommand throws (error in try/catch)', () => {
      mockExecuteCommand.mockImplementationOnce(() => { throw new Error('cmd error') })
      // recordControllerAction is called AFTER executeCommand in try block — so NOT called when cmd throws
      routerWithTracker.handleEvent(buttonPress('cross'))
      expect(mockRecordControllerAction).not.toHaveBeenCalled()
    })
  })
})

// ── InputRouter.classifyFeature() (Story 9.3 — AC3 feature tracking) ─────────

describe('InputRouter.classifyFeature() (Story 9.3 — AC3)', () => {
  it('classifies vibesense.switchSessionNext as sessionSwitch', () => {
    expect(InputRouter.classifyFeature('vibesense.switchSessionNext')).toBe('sessionSwitch')
  })

  it('classifies vibesense.switchSessionPrev as sessionSwitch', () => {
    expect(InputRouter.classifyFeature('vibesense.switchSessionPrev')).toBe('sessionSwitch')
  })

  it('classifies vibesense.toggleGame as miniGame', () => {
    expect(InputRouter.classifyFeature('vibesense.toggleGame')).toBe('miniGame')
  })

  it('classifies vibesense.voicePtt as voicePtt', () => {
    expect(InputRouter.classifyFeature('vibesense.voicePtt')).toBe('voicePtt')
  })

  it('classifies vibesense.openQuickPanel as quickPanel', () => {
    expect(InputRouter.classifyFeature('vibesense.openQuickPanel')).toBe('quickPanel')
  })

  it('classifies vibesense.toggleHud as hud', () => {
    expect(InputRouter.classifyFeature('vibesense.toggleHud')).toBe('hud')
  })

  it('classifies vibesense.quicksave as quicksave', () => {
    expect(InputRouter.classifyFeature('vibesense.quicksave')).toBe('quicksave')
  })

  it('returns undefined for commands that are not feature-tracked (e.g. approve, deny, openTerminal)', () => {
    expect(InputRouter.classifyFeature('vibesense.approve')).toBeUndefined()
    expect(InputRouter.classifyFeature('vibesense.deny')).toBeUndefined()
    expect(InputRouter.classifyFeature('vibesense.openTerminal')).toBeUndefined()
    expect(InputRouter.classifyFeature('vibesense.launchClaudeCode')).toBeUndefined()
    expect(InputRouter.classifyFeature('vibesense.openSettings')).toBeUndefined()
  })

  it('returns undefined for unknown command IDs', () => {
    expect(InputRouter.classifyFeature('some.unknown.command')).toBeUndefined()
    expect(InputRouter.classifyFeature('')).toBeUndefined()
  })
})
