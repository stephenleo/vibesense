// test/unit/hid/controller-lifecycle-manager.test.ts
// Unit tests for ControllerLifecycleManager — connect, disconnect, and auto-reconnect lifecycle
// All native modules (node-hid, dualsense-ts) MUST be mocked

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// ── Mock vscode (required by logger) ────────────────────────────────────────
const mockAppendLine = vi.fn()
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: mockAppendLine,
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))

// ── Mock dualsense-ts ────────────────────────────────────────────────────────
const mockDualsenseInstance = {
  connection: { on: vi.fn(), state: false },
  cross: { on: vi.fn(), state: false },
  circle: { on: vi.fn(), state: false },
  square: { on: vi.fn(), state: false },
  triangle: { on: vi.fn(), state: false },
  options: { on: vi.fn(), state: false },
  touchpad: { on: vi.fn(), state: false },
  dpad: {
    up: { on: vi.fn() },
    down: { on: vi.fn() },
    left: { on: vi.fn() },
    right: { on: vi.fn() },
  },
  left: {
    bumper: { on: vi.fn() },
    trigger: { on: vi.fn(), button: { on: vi.fn() }, state: { magnitude: 0 } },
    analog: { on: vi.fn(), x: { on: vi.fn() }, y: { on: vi.fn() }, button: { on: vi.fn() } },
  },
  right: {
    bumper: { on: vi.fn() },
    trigger: { on: vi.fn(), button: { on: vi.fn() }, state: { magnitude: 0 } },
    analog: { on: vi.fn(), x: { on: vi.fn() }, y: { on: vi.fn() }, button: { on: vi.fn() } },
  },
  rumble: vi.fn(),
}
vi.mock('dualsense-ts', () => ({
  Dualsense: vi.fn().mockImplementation(() => mockDualsenseInstance),
}))

// ── Mock node-hid ────────────────────────────────────────────────────────────
const mockHidOn = vi.fn()
const mockHidClose = vi.fn()
vi.mock('node-hid', () => ({
  devices: vi.fn().mockReturnValue([]),
  HID: vi.fn().mockImplementation(() => ({
    on: mockHidOn,
    close: mockHidClose,
  })),
}))

// ── Mock createDriver from hid-manager ──────────────────────────────────────
const mockCreateDriver = vi.fn()
vi.mock('../../../src/extension/hid/hid-manager', () => ({
  createDriver: mockCreateDriver,
  HidManager: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockReturnValue(null),
    stop: vi.fn(),
    getDriver: vi.fn().mockReturnValue(null),
  })),
  DUALSENSE_VID: 0x054c,
  DUALSENSE_PIDS: [0x0ce6, 0x0df2],
}))

// ── Import modules under test AFTER mocks ────────────────────────────────────
const { ControllerLifecycleManager } = await import(
  '../../../src/extension/hid/controller-lifecycle-manager'
)

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a mock ControllerHAL driver backed by a real EventEmitter
 * so that `.on('data', ...)` wiring actually works.
 */
function makeMockDriver(controllerType: string = 'dualsense') {
  const emitter = new EventEmitter()
  const driver = {
    controllerType,
    on: (event: string | symbol, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener)
      return driver
    },
    start: vi.fn(),
    stop: vi.fn(),
    setHaptic: vi.fn(),
    setLED: vi.fn(),
    // Helper to emit data events for testing
    _emit: (event: unknown) => emitter.emit('data', event),
  }
  return driver
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ControllerLifecycleManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateDriver.mockReturnValue(null)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Initial state ───────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts in connected state when initialDriver is provided', () => {
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      expect(mgr.getConnectionState()).toBe('connected')
      expect(mgr.getCurrentDriver()).toBe(driver)

      mgr.stop()
    })

    it('starts in disconnected state when initialDriver is null', () => {
      vi.useFakeTimers()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(null, onConnected, onDisconnected)
      expect(mgr.getConnectionState()).toBe('disconnected')
      expect(mgr.getCurrentDriver()).toBeNull()

      mgr.stop()
    })

    it('does not invoke onConnected or onDisconnected on construction with initial driver', () => {
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      expect(onConnected).not.toHaveBeenCalled()
      expect(onDisconnected).not.toHaveBeenCalled()

      mgr.stop()
    })
  })

  // ── Disconnect detection ────────────────────────────────────────────────────

  describe('disconnect detection', () => {
    it('invokes onDisconnected when driver emits disconnected event', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      driver._emit({ kind: 'disconnected' })

      expect(onDisconnected).toHaveBeenCalledTimes(1)
      expect(mgr.getConnectionState()).toBe('disconnected')
      expect(mgr.getCurrentDriver()).toBeNull()

      mgr.stop()
    })

    it('calls stop() on the old driver when disconnect event fires (releases HID device handle)', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      // stop() should NOT have been called yet
      expect(driver.stop).not.toHaveBeenCalled()

      driver._emit({ kind: 'disconnected' })

      // stop() must be called to release the HID device file handle
      expect(driver.stop).toHaveBeenCalledTimes(1)

      mgr.stop()
    })

    it('does not invoke onConnected callback on connected event (only reconnect loop does)', () => {
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      // Emit a connected event from the driver (already connected)
      driver._emit({ kind: 'connected', controllerType: 'dualsense' })

      // onConnected is NOT invoked from handleEvent — only from reconnect loop
      expect(onConnected).not.toHaveBeenCalled()

      mgr.stop()
    })

    it('starts reconnect loop after disconnect event', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      // Advance 500ms to trigger one poll
      vi.advanceTimersByTime(500)
      // createDriver was called (poll attempt)
      expect(mockCreateDriver).toHaveBeenCalled()

      mgr.stop()
    })
  })

  // ── Auto-reconnect ──────────────────────────────────────────────────────────

  describe('auto-reconnect', () => {
    it('invokes onConnected when reconnect poll finds a new driver', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      mockCreateDriver.mockReturnValue(null) // not found initially

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      // Trigger disconnect
      driver._emit({ kind: 'disconnected' })
      expect(mgr.getConnectionState()).toBe('disconnected')

      // First poll — no driver yet
      vi.advanceTimersByTime(500)
      expect(onConnected).not.toHaveBeenCalled()

      // Second poll — driver found
      mockCreateDriver.mockReturnValue(reconnectDriver)
      vi.advanceTimersByTime(500)

      expect(onConnected).toHaveBeenCalledTimes(1)
      expect(onConnected).toHaveBeenCalledWith(reconnectDriver)
      expect(mgr.getConnectionState()).toBe('connected')
      expect(mgr.getCurrentDriver()).toBe(reconnectDriver)
      expect(reconnectDriver.start).toHaveBeenCalledTimes(1)

      mgr.stop()
    })

    it('stops polling after successful reconnect', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      mockCreateDriver.mockReturnValue(reconnectDriver) // immediately available after disconnect

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      // First poll reconnects
      vi.advanceTimersByTime(500)
      expect(onConnected).toHaveBeenCalledTimes(1)

      // No more polls — reset mock to count additional calls
      vi.clearAllMocks()
      vi.advanceTimersByTime(2000)
      expect(mockCreateDriver).not.toHaveBeenCalled()

      mgr.stop()
    })

    it('starts polling immediately when constructed with null driver', () => {
      vi.useFakeTimers()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      mockCreateDriver.mockReturnValue(reconnectDriver)

      const mgr = new ControllerLifecycleManager(null, onConnected, onDisconnected)

      vi.advanceTimersByTime(500)
      expect(onConnected).toHaveBeenCalledTimes(1)
      expect(onConnected).toHaveBeenCalledWith(reconnectDriver)

      mgr.stop()
    })

    it('reconnects within 3 seconds (6 polls at 500ms each) per NFR-R3', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      // Driver not found for first 5 polls, found on poll 6 (3000ms)
      let pollCount = 0
      mockCreateDriver.mockImplementation(() => {
        pollCount++
        return pollCount >= 6 ? reconnectDriver : null
      })

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      vi.advanceTimersByTime(3000) // 6 × 500ms
      expect(onConnected).toHaveBeenCalledTimes(1)
      expect(pollCount).toBe(6)

      mgr.stop()
    })

    it('stops polling after MAX_RECONNECT_POLLS (60 × 500ms = 30s) when controller not found', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      // createDriver always returns null
      mockCreateDriver.mockReturnValue(null)

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      // Advance well past the 30s cap
      vi.advanceTimersByTime(60000)

      // Should have polled at most 60 times, then stopped
      expect(mockCreateDriver.mock.calls.length).toBeLessThanOrEqual(61)
      // After cap, no more polls even with more time
      const callsAtCap = mockCreateDriver.mock.calls.length
      vi.advanceTimersByTime(10000)
      expect(mockCreateDriver.mock.calls.length).toBe(callsAtCap)

      // State should still be disconnected (no reconnect found)
      expect(mgr.getConnectionState()).toBe('disconnected')
      expect(onConnected).not.toHaveBeenCalled()

      mgr.stop()
    })
  })

  // ── Error handling (NFR-R1) ─────────────────────────────────────────────────

  describe('error handling (NFR-R1)', () => {
    it('continues polling when createDriver throws during reconnect', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      let callCount = 0
      mockCreateDriver.mockImplementation(() => {
        callCount++
        if (callCount === 1) throw new Error('HID access denied')
        return callCount >= 3 ? reconnectDriver : null
      })

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      // First poll throws — interval should continue
      vi.advanceTimersByTime(500)
      expect(onConnected).not.toHaveBeenCalled()

      // Third poll returns driver
      vi.advanceTimersByTime(1000)
      expect(onConnected).toHaveBeenCalledTimes(1)

      // Error was logged
      const calls = mockAppendLine.mock.calls.map((c: unknown[]) => c[0] as string)
      expect(calls.some((msg) => msg.includes('ERROR') || msg.includes('reconnect poll error'))).toBe(true)

      mgr.stop()
    })

    it('does not throw when onDisconnected callback throws', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn().mockImplementation(() => {
        throw new Error('callback error')
      })

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      expect(() => driver._emit({ kind: 'disconnected' })).not.toThrow()

      mgr.stop()
    })

    it('does not throw when onConnected callback throws', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn().mockImplementation(() => {
        throw new Error('callback error')
      })
      const onDisconnected = vi.fn()

      mockCreateDriver.mockReturnValue(reconnectDriver)

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      expect(() => vi.advanceTimersByTime(500)).not.toThrow()

      mgr.stop()
    })
  })

  // ── stop() behavior ─────────────────────────────────────────────────────────

  describe('stop()', () => {
    it('clears the reconnect polling interval', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      driver._emit({ kind: 'disconnected' })

      // Stop clears the interval
      mgr.stop()

      // Advance timers — createDriver should NOT be called after stop
      vi.advanceTimersByTime(5000)
      expect(mockCreateDriver).not.toHaveBeenCalled()
    })

    it('stops the current driver on stop()', () => {
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)
      mgr.stop()

      expect(driver.stop).toHaveBeenCalledTimes(1)
    })

    it('sets state to disconnected after stop()', () => {
      const driver = makeMockDriver()
      const mgr = new ControllerLifecycleManager(driver, vi.fn(), vi.fn())
      mgr.stop()

      expect(mgr.getConnectionState()).toBe('disconnected')
      expect(mgr.getCurrentDriver()).toBeNull()
    })

    it('does not crash when stop() is called when already disconnected', () => {
      vi.useFakeTimers()
      const mgr = new ControllerLifecycleManager(null, vi.fn(), vi.fn())
      expect(() => mgr.stop()).not.toThrow()
    })

    it('stops the reconnect polling started from null initial driver', () => {
      vi.useFakeTimers()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(null, onConnected, onDisconnected)
      mgr.stop()

      vi.advanceTimersByTime(5000)
      expect(mockCreateDriver).not.toHaveBeenCalled()
    })
  })

  // ── getConnectionState() transitions ───────────────────────────────────────

  describe('getConnectionState() state transitions', () => {
    it('transitions connected → disconnected → connected correctly', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      mockCreateDriver.mockReturnValue(reconnectDriver)

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      // Initial state
      expect(mgr.getConnectionState()).toBe('connected')

      // Disconnect
      driver._emit({ kind: 'disconnected' })
      expect(mgr.getConnectionState()).toBe('disconnected')

      // Reconnect
      vi.advanceTimersByTime(500)
      expect(mgr.getConnectionState()).toBe('connected')

      mgr.stop()
    })

    it('getCurrentDriver() returns new driver after reconnect', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const reconnectDriver = makeMockDriver()
      mockCreateDriver.mockReturnValue(reconnectDriver)

      const mgr = new ControllerLifecycleManager(driver, vi.fn(), vi.fn())
      driver._emit({ kind: 'disconnected' })
      expect(mgr.getCurrentDriver()).toBeNull()

      vi.advanceTimersByTime(500)
      expect(mgr.getCurrentDriver()).toBe(reconnectDriver)

      mgr.stop()
    })
  })

  // ── Double-disconnect guard ─────────────────────────────────────────────────

  describe('double-disconnect guard', () => {
    it('does not start duplicate reconnect loops on multiple disconnect events', () => {
      vi.useFakeTimers()
      const driver = makeMockDriver()
      const onConnected = vi.fn()
      const onDisconnected = vi.fn()

      const mgr = new ControllerLifecycleManager(driver, onConnected, onDisconnected)

      // Emit disconnect twice (e.g., driver sends error + explicit disconnect)
      driver._emit({ kind: 'disconnected' })
      driver._emit({ kind: 'disconnected' })

      // Advance timers — reconnect driver appears
      const reconnectDriver = makeMockDriver()
      mockCreateDriver.mockReturnValue(reconnectDriver)
      vi.advanceTimersByTime(500)

      // onConnected invoked exactly once (not twice from duplicated loop)
      expect(onConnected).toHaveBeenCalledTimes(1)

      mgr.stop()
    })
  })
})
