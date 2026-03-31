// test/unit/input/analog-scroll-controller.test.ts
// Unit tests for AnalogScrollController — all VSCode APIs and logger mocked

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ─────────────────────
const { mockExecuteCommand, mockLogger } = vi.hoisted(() => {
  return {
    mockExecuteCommand: vi.fn(),
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
import { AnalogScrollController } from '../../../src/extension/input/analog-scroll-controller'
import { SCROLL_TICK_MS } from '../../../src/shared/constants'

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('AnalogScrollController', () => {
  let controller: AnalogScrollController

  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetAllMocks() // resets call counts AND implementations (e.g. mockImplementation throwing from error resilience tests)
    controller = new AnalogScrollController()
  })

  afterEach(() => {
    controller.dispose()
    vi.useRealTimers()
  })

  // ── Dead zone — no scroll when |value| < 0.15 (AC 4) ─────────────────────
  describe('dead zone (AC 4)', () => {
    it('does not start scroll interval for left_y value within dead zone (0.10)', () => {
      controller.update('left_y', 0.10)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not start scroll interval for left_y value within dead zone (-0.10)', () => {
      controller.update('left_y', -0.10)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not start scroll interval for right_y within dead zone (0.14)', () => {
      controller.update('right_y', 0.14)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not start scroll interval for right_y within dead zone (-0.14)', () => {
      controller.update('right_y', -0.14)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('starts scroll at exactly 0.15 (boundary — not less than dead zone)', () => {
      controller.update('left_y', 0.15)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalled()
    })
  })

  // ── Scroll direction (AC 1, AC 5) ────────────────────────────────────────
  describe('scroll direction (AC 1, AC 5)', () => {
    it('fires scrollDown for positive left_y value', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.terminal.scrollDown')
    })

    it('fires scrollUp for negative left_y value', () => {
      controller.update('left_y', -0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.terminal.scrollUp')
    })

    it('fires scrollDown for positive right_y value', () => {
      controller.update('right_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.terminal.scrollDown')
    })

    it('fires scrollUp for negative right_y value', () => {
      controller.update('right_y', -0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.terminal.scrollUp')
    })
  })

  // ── Non-scroll axes are ignored ───────────────────────────────────────────
  describe('non-scroll axes ignored', () => {
    it('ignores left_x axis', () => {
      controller.update('left_x', 0.9)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('ignores right_x axis', () => {
      controller.update('right_x', 0.9)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('ignores l2 trigger axis', () => {
      controller.update('l2', 0.9)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('ignores r2 trigger axis', () => {
      controller.update('r2', 0.9)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── Proportional speed (AC 1, AC 2) ──────────────────────────────────────
  describe('proportional speed (AC 1, AC 2)', () => {
    it('fires more commands per tick at full displacement than at minimum displacement', () => {
      // Full displacement (1.0) → magnitude=1.0 → 20 lines/tick
      controller.update('left_y', 1.0)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      const countAtFull = mockExecuteCommand.mock.calls.length
      controller.dispose()

      vi.clearAllMocks()
      controller = new AnalogScrollController()

      // Minimum displacement (just above dead zone at 0.15) → magnitude≈0 → 1 line/tick
      controller.update('left_y', 0.16)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      const countAtMin = mockExecuteCommand.mock.calls.length

      expect(countAtFull).toBeGreaterThan(countAtMin)
    })

    it('fires 20 lines per tick at full displacement (value=1.0)', () => {
      controller.update('left_y', 1.0)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      // 20 executeCommand calls for scrollDown at full displacement
      expect(mockExecuteCommand).toHaveBeenCalledTimes(20)
    })

    it('fires at least 1 line per tick at minimal displacement above dead zone', () => {
      controller.update('left_y', 0.16)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      // At minimum, 1 line per tick
      expect(mockExecuteCommand.mock.calls.length).toBeGreaterThanOrEqual(1)
    })

    it('clamps absValue > 1.0 to MAX_LINES_PER_TICK (faulty hardware guard)', () => {
      controller.update('left_y', 1.5)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      // Should fire exactly 20 (MAX_LINES_PER_TICK), not more
      expect(mockExecuteCommand).toHaveBeenCalledTimes(20)
    })

    it('satisfies AC 2: at full displacement, fires enough to traverse 1000 lines in under 5 seconds', () => {
      // 20 lines/tick * 20 ticks/sec = 400 lines/sec → 1000 lines in 2.5s < 5s ✓
      controller.update('left_y', 1.0)
      // Advance by 5 seconds
      vi.advanceTimersByTime(5000)
      const totalScrollCommands = mockExecuteCommand.mock.calls.filter(
        (call) => call[0] === 'workbench.action.terminal.scrollDown',
      ).length
      expect(totalScrollCommands).toBeGreaterThanOrEqual(1000)
    })
  })

  // ── Auto-scroll restore (AC 3) ────────────────────────────────────────────
  describe('auto-scroll restore on return-to-dead-zone (AC 3)', () => {
    it('fires scrollToBottom when stick returns to dead zone after scrolling', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      // Return to dead zone
      controller.update('left_y', 0.05)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'workbench.action.terminal.scrollToBottom',
      )
    })

    it('fires scrollToBottom when right_y returns to dead zone', () => {
      controller.update('right_y', -0.9)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      controller.update('right_y', 0.0)
      expect(mockExecuteCommand).toHaveBeenCalledWith(
        'workbench.action.terminal.scrollToBottom',
      )
    })

    it('does NOT fire scrollToBottom when returning to dead zone without prior scrolling', () => {
      // Stick was never outside dead zone, so no scroll was running
      controller.update('left_y', 0.05)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('stops the scroll interval after returning to dead zone', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      controller.update('left_y', 0.05)
      vi.clearAllMocks()

      // No more scroll commands should fire after returning to dead zone
      vi.advanceTimersByTime(SCROLL_TICK_MS * 5)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })
  })

  // ── dispose() (AC 1) ──────────────────────────────────────────────────────
  describe('dispose()', () => {
    it('clears interval — no further executeCommand calls after dispose', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      controller.dispose()

      vi.advanceTimersByTime(SCROLL_TICK_MS * 10)
      expect(mockExecuteCommand).not.toHaveBeenCalled()
    })

    it('does not throw when disposed without ever scrolling', () => {
      expect(() => controller.dispose()).not.toThrow()
    })

    it('does not throw when disposed twice', () => {
      controller.update('left_y', 0.8)
      expect(() => {
        controller.dispose()
        controller.dispose()
      }).not.toThrow()
    })

    it('does NOT fire scrollToBottom on dispose (dispose is silent cleanup)', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      controller.dispose()
      expect(mockExecuteCommand).not.toHaveBeenCalledWith(
        'workbench.action.terminal.scrollToBottom',
      )
    })
  })

  // ── Error resilience (NFR-R1) ─────────────────────────────────────────────
  describe('error resilience (NFR-R1)', () => {
    it('does not throw when executeCommand throws inside tick callback', () => {
      mockExecuteCommand.mockImplementation(() => {
        throw new Error('vscode API failure')
      })
      controller.update('left_y', 0.8)
      expect(() => vi.advanceTimersByTime(SCROLL_TICK_MS)).not.toThrow()
    })

    it('logs error to logger.error when executeCommand throws', () => {
      mockExecuteCommand.mockImplementation(() => {
        throw new Error('vscode API failure')
      })
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnalogScrollController: executeCommand error',
        expect.any(Error),
      )
    })

    it('logs error when scrollToBottom throws during return-to-dead-zone', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.resetAllMocks()

      // Make scrollToBottom throw when returning to dead zone
      mockExecuteCommand.mockImplementation(() => {
        throw new Error('scrollToBottom failure')
      })
      expect(() => controller.update('left_y', 0.0)).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(
        'AnalogScrollController: scrollToBottom error',
        expect.any(Error),
      )
    })

    it('does not re-throw executeCommand errors', () => {
      mockExecuteCommand.mockImplementation(() => {
        throw new Error('vscode API failure')
      })
      controller.update('left_y', 0.8)
      // After one failing tick, subsequent ticks should still attempt (error is caught not re-thrown)
      expect(() => vi.advanceTimersByTime(SCROLL_TICK_MS * 3)).not.toThrow()
    })
  })

  // ── Scroll continues across ticks ────────────────────────────────────────
  describe('continuous scroll behavior', () => {
    it('fires scroll commands on every tick while stick is displaced', () => {
      controller.update('left_y', 1.0)
      vi.advanceTimersByTime(SCROLL_TICK_MS * 3)
      // 20 lines per tick × 3 ticks = 60 calls
      expect(mockExecuteCommand).toHaveBeenCalledTimes(60)
    })

    it('resets scroll when axis value changes direction', () => {
      controller.update('left_y', 0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      vi.clearAllMocks()

      // Change direction — should now scroll up
      controller.update('left_y', -0.8)
      vi.advanceTimersByTime(SCROLL_TICK_MS)
      expect(mockExecuteCommand).toHaveBeenCalledWith('workbench.action.terminal.scrollUp')
      expect(mockExecuteCommand).not.toHaveBeenCalledWith('workbench.action.terminal.scrollDown')
    })
  })
})
