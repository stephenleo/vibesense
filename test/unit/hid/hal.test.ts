// test/unit/hid/hal.test.ts
// Unit tests for DualSenseDriver, XboxDriver, and GenericHidDriver
// All native modules (node-hid, dualsense-ts) MUST be mocked — they are not
// available in the Vitest Node.js test environment.

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Dualsense } from 'dualsense-ts'
import type { ControllerEvent } from '../../../src/shared/types'

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

// ── Mock node-hid ─────────────────────────────────────────────────────────────
// We maintain a registry of HID device listener maps so tests can trigger events.
type HidListener = (data: Buffer | Error) => void

interface MockHidDevice {
  listeners: Record<string, HidListener[]>
  on: (event: string, cb: HidListener) => void
  close: ReturnType<typeof vi.fn>
}

let mockHidDevice: MockHidDevice

function createMockHidDevice(): MockHidDevice {
  const listeners: Record<string, HidListener[]> = {}
  return {
    listeners,
    on: function (event: string, cb: HidListener) {
      if (!listeners[event]) {
        listeners[event] = []
      }
      listeners[event].push(cb)
    },
    close: vi.fn(),
  }
}

vi.mock('node-hid', () => ({
  devices: vi.fn().mockReturnValue([]),
  HID: vi.fn().mockImplementation(function () {
    mockHidDevice = createMockHidDevice()
    return mockHidDevice
  }),
}))

// ── Mock dualsense-ts ─────────────────────────────────────────────────────────
// We maintain a listener registry so tests can emit events to the mock controller.
interface DsInputListeners {
  [event: string]: Array<(input: { state: boolean | number }) => void>
}

let dsListeners: DsInputListeners

function makeMockInput() {
  return {
    get on() {
      return (event: string, cb: (input: { state: boolean | number }) => void) => {
        if (!dsListeners[event]) {
          dsListeners[event] = []
        }
        dsListeners[event].push(cb)
      }
    },
    state: false as boolean | number,
  }
}

function makeMockTrigger() {
  return {
    get on() {
      return (event: string, cb: (input: { state: { magnitude: number } }) => void) => {
        if (!dsListeners[`trigger:${event}`]) {
          dsListeners[`trigger:${event}`] = []
        }
        // Store as a cast to handle the state difference
        dsListeners[`trigger:${event}`].push(cb as unknown as (input: { state: boolean | number }) => void)
      }
    },
    state: { magnitude: 0 },
    button: makeMockInput(),
  }
}

let mockDualsenseInstance: ReturnType<typeof buildMockDualsense>

function buildMockDualsense() {
  return {
    connection: makeMockInput(),
    cross: makeMockInput(),
    circle: makeMockInput(),
    square: makeMockInput(),
    triangle: makeMockInput(),
    options: makeMockInput(),
    touchpad: { on: vi.fn(), state: false, button: makeMockInput() },
    dpad: {
      on: vi.fn(),
      up: makeMockInput(),
      down: makeMockInput(),
      left: makeMockInput(),
      right: makeMockInput(),
    },
    left: {
      bumper: makeMockInput(),
      trigger: makeMockTrigger(),
      analog: {
        on: vi.fn(),
        x: makeMockInput(),
        y: makeMockInput(),
        button: makeMockInput(),
      },
    },
    right: {
      bumper: makeMockInput(),
      trigger: makeMockTrigger(),
      analog: {
        on: vi.fn(),
        x: makeMockInput(),
        y: makeMockInput(),
        button: makeMockInput(),
      },
    },
    rumble: vi.fn(),
  }
}

vi.mock('dualsense-ts', () => ({
  Dualsense: vi.fn().mockImplementation(function () {
    dsListeners = {}
    mockDualsenseInstance = buildMockDualsense()
    return mockDualsenseInstance
  }),
}))

// ── Import modules under test AFTER mocks are set up ─────────────────────────
const { DualSenseDriver } = await import('../../../src/extension/hid/dualsense-driver')
const { XboxDriver } = await import('../../../src/extension/hid/xbox-driver')
const { GenericHidDriver } = await import('../../../src/extension/hid/generic-driver')

// Helper: emit a dualsense 'change' event to a specific input's listeners
function emitDs(event: string, payload: { state: boolean | number }): void {
  const listeners = dsListeners[event]
  if (listeners) {
    for (const cb of listeners) {
      cb(payload)
    }
  }
}

// Helper: emit a raw Buffer to the HID device's 'data' listeners
function emitHidData(data: Buffer): void {
  if (mockHidDevice?.listeners?.['data']) {
    for (const cb of mockHidDevice.listeners['data']) {
      cb(data)
    }
  }
}

// Helper: emit an error to the HID device's 'error' listeners
function emitHidError(err: Error): void {
  if (mockHidDevice?.listeners?.['error']) {
    for (const cb of mockHidDevice.listeners['error']) {
      cb(err)
    }
  }
}

// ── DualSenseDriver tests ─────────────────────────────────────────────────────
describe('DualSenseDriver', () => {
  let driver: InstanceType<typeof DualSenseDriver>
  let received: ControllerEvent[]

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new DualSenseDriver()
    received = []
    driver.on('data', (e) => received.push(e))
    driver.start()
  })

  it('emits connected event with controllerType dualsense when connection changes to true', () => {
    emitDs('change', { state: true })

    const connected = received.filter((e) => e.kind === 'connected')
    expect(connected).toHaveLength(1)
    expect(connected[0]).toEqual({ kind: 'connected', controllerType: 'dualsense' })
  })

  it('emits disconnected event when connection changes to false', () => {
    emitDs('change', { state: false })

    const disconnected = received.filter((e) => e.kind === 'disconnected')
    expect(disconnected).toHaveLength(1)
  })

  it('emits button events mapped to correct ButtonId values', () => {
    // Trigger all 'change' listeners with pressed=true to get button events
    for (const cb of dsListeners['change'] || []) {
      cb({ state: true })
    }

    const buttonEvents = received.filter((e) => e.kind === 'button') as Array<{
      kind: 'button'
      button: string
      pressed: boolean
    }>

    const buttonIds = buttonEvents.map((e) => e.button)
    // Verify known DualSense buttons are registered
    expect(buttonIds).toContain('cross')
    expect(buttonIds).toContain('circle')
    expect(buttonIds).toContain('square')
    expect(buttonIds).toContain('triangle')
    expect(buttonIds).toContain('l1')
    expect(buttonIds).toContain('r1')
    expect(buttonIds).toContain('up')
    expect(buttonIds).toContain('down')
    expect(buttonIds).toContain('left')
    expect(buttonIds).toContain('right')
    expect(buttonIds).toContain('options')
    expect(buttonIds).toContain('touchpad')
  })

  it('emits button event for cross button with pressed=true', () => {
    // Trigger all 'change' listeners
    for (const cb of dsListeners['change'] || []) {
      cb({ state: true })
    }

    const buttonEvents = received.filter((e) => e.kind === 'button') as Array<{
      kind: 'button'
      button: string
      pressed: boolean
    }>
    const crossEvent = buttonEvents.find((e) => e.button === 'cross' && e.pressed)
    expect(crossEvent).toBeDefined()
    expect(crossEvent!.pressed).toBe(true)
  })

  it('emits axis events with values in -1.0 to 1.0 range for stick axes', () => {
    // Trigger 'change' listeners with a normalized axis value
    for (const cb of dsListeners['change'] || []) {
      cb({ state: 0.75 })
    }

    const axisEvents = received.filter((e) => e.kind === 'axis') as Array<{
      kind: 'axis'
      axis: string
      value: number
    }>

    expect(axisEvents.length).toBeGreaterThan(0)
    for (const e of axisEvents) {
      expect(e.value).toBeGreaterThanOrEqual(-1.0)
      expect(e.value).toBeLessThanOrEqual(1.0)
    }
  })

  it('emits battery event with level between 0 and 100 on connect', () => {
    emitDs('change', { state: true })

    const batteryEvents = received.filter((e) => e.kind === 'battery') as Array<{
      kind: 'battery'
      level: number
    }>
    expect(batteryEvents).toHaveLength(1)
    expect(batteryEvents[0].level).toBeGreaterThanOrEqual(0)
    expect(batteryEvents[0].level).toBeLessThanOrEqual(100)
  })

  it('catches errors in connection event callback and continues operating (NFR-R1)', () => {
    // Simulate connection events — they should not throw even if internal error occurs
    expect(() => {
      emitDs('change', { state: true })
    }).not.toThrow()

    expect(() => {
      emitDs('change', { state: false })
    }).not.toThrow()
  })

  it('stop() cleans up without throwing', () => {
    expect(() => driver.stop()).not.toThrow()
  })

  it('setHaptic does not throw for any pattern', () => {
    expect(() => driver.setHaptic('single_pulse')).not.toThrow()
    expect(() => driver.setHaptic('double_pulse')).not.toThrow()
    expect(() => driver.setHaptic('triple_pulse')).not.toThrow()
    expect(() => driver.setHaptic('slow_rumble')).not.toThrow()
    expect(() => driver.setHaptic('none')).not.toThrow()
  })

  it('emits connected and battery events immediately when controller is already connected at start()', () => {
    vi.clearAllMocks()
    dsListeners = {}

    // Build a mock instance with connection.state = true (already plugged in)
    const alreadyConnectedMock = buildMockDualsense()
    alreadyConnectedMock.connection.state = true

    vi.mocked(Dualsense).mockImplementationOnce(function () {
      mockDualsenseInstance = alreadyConnectedMock
      return mockDualsenseInstance as unknown as Dualsense
    })

    const freshDriver = new DualSenseDriver()
    const freshReceived: ControllerEvent[] = []
    freshDriver.on('data', (e) => freshReceived.push(e as ControllerEvent))
    freshDriver.start()

    // No 'change' event emitted — connected + battery should still fire from initial state check
    expect(freshReceived.some((e) => e.kind === 'connected')).toBe(true)
    expect(freshReceived.some((e) => e.kind === 'battery')).toBe(true)
  })
})

// ── XboxDriver tests ──────────────────────────────────────────────────────────
describe('XboxDriver', () => {
  let driver: InstanceType<typeof XboxDriver>
  let received: ControllerEvent[]

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new XboxDriver(0x045e, 0x0b12)
    received = []
    driver.on('data', (e) => received.push(e))
    driver.start()
  })

  it('emits connected event with controllerType xbox', () => {
    const connected = received.find((e) => e.kind === 'connected')
    expect(connected).toEqual({ kind: 'connected', controllerType: 'xbox' })
  })

  it('emits button events from HID report', () => {
    received = []

    // Build a minimal Xbox HID report (16 bytes)
    // Byte 2 = 0x01 = A button pressed
    const report = Buffer.alloc(16, 0)
    report[2] = 0x01 // A button

    emitHidData(report)

    const buttonEvents = received.filter((e) => e.kind === 'button') as Array<{
      kind: 'button'
      button: string
      pressed: boolean
    }>
    const aButton = buttonEvents.find((e) => e.button === 'a' && e.pressed)
    expect(aButton).toBeDefined()
  })

  it('emits axis events with normalized values in -1.0 to 1.0 range', () => {
    received = []

    // Build report with left stick pushed right (max positive X)
    const report = Buffer.alloc(16, 0)
    report.writeInt16LE(32767, 8) // left stick X = max right

    emitHidData(report)

    const axisEvents = received.filter((e) => e.kind === 'axis') as Array<{
      kind: 'axis'
      axis: string
      value: number
    }>
    const leftX = axisEvents.find((e) => e.axis === 'left_x')
    expect(leftX).toBeDefined()
    expect(leftX!.value).toBeCloseTo(1.0, 2)
    expect(leftX!.value).toBeGreaterThanOrEqual(-1.0)
    expect(leftX!.value).toBeLessThanOrEqual(1.0)
  })

  it('catches errors in HID data callback and continues (NFR-R1)', () => {
    // Short report does not crash (returns empty array)
    const shortReport = Buffer.alloc(4, 0)
    expect(() => emitHidData(shortReport)).not.toThrow()

    // Driver still alive after short report
    const validReport = Buffer.alloc(16, 0)
    expect(() => emitHidData(validReport)).not.toThrow()
  })

  it('emits disconnected event on HID error', () => {
    received = []

    emitHidError(new Error('device disconnected'))

    const disconnected = received.find((e) => e.kind === 'disconnected')
    expect(disconnected).toBeDefined()
  })

  it('setHaptic and setLED are no-ops and do not throw', () => {
    expect(() => driver.setHaptic('single_pulse')).not.toThrow()
    expect(() => driver.setLED('#ff0000')).not.toThrow()
  })

  it('stop() closes the HID device', () => {
    driver.stop()
    expect(mockHidDevice.close).toHaveBeenCalled()
  })
})

// ── GenericHidDriver tests ────────────────────────────────────────────────────
describe('GenericHidDriver', () => {
  let driver: InstanceType<typeof GenericHidDriver>
  let received: ControllerEvent[]

  beforeEach(() => {
    vi.clearAllMocks()
    driver = new GenericHidDriver(0x1234, 0x5678)
    received = []
    driver.on('data', (e) => received.push(e))
    driver.start()
  })

  it('emits connected event with controllerType generic-hid', () => {
    const connected = received.find((e) => e.kind === 'connected')
    expect(connected).toEqual({ kind: 'connected', controllerType: 'generic-hid' })
  })

  it('emits button events from generic HID report', () => {
    received = []

    // Byte 0 = 0x01 = button 1 (mapped to 'a')
    const report = Buffer.alloc(6, 128) // axes at center (128)
    report[0] = 0x01

    emitHidData(report)

    const buttonEvents = received.filter((e) => e.kind === 'button') as Array<{
      kind: 'button'
      button: string
      pressed: boolean
    }>
    const aButton = buttonEvents.find((e) => e.button === 'a' && e.pressed)
    expect(aButton).toBeDefined()
  })

  it('emits axis events normalized to -1.0 to 1.0 from 0-255 byte range', () => {
    received = []

    const report = Buffer.alloc(6, 0)
    report[2] = 0    // left_x = full left = -1.0
    report[3] = 128  // left_y = center = ~0.0
    report[4] = 255  // right_x = full right = ~1.0

    emitHidData(report)

    const axisEvents = received.filter((e) => e.kind === 'axis') as Array<{
      kind: 'axis'
      axis: string
      value: number
    }>

    const leftX = axisEvents.find((e) => e.axis === 'left_x')
    expect(leftX).toBeDefined()
    expect(leftX!.value).toBeCloseTo(-1.0, 1)

    const leftY = axisEvents.find((e) => e.axis === 'left_y')
    expect(leftY).toBeDefined()
    expect(leftY!.value).toBeCloseTo(0.0, 1)

    const rightX = axisEvents.find((e) => e.axis === 'right_x')
    expect(rightX).toBeDefined()
    expect(rightX!.value).toBeCloseTo(1.0, 1)
  })

  it('all axis values remain within -1.0 to 1.0 range for any byte value', () => {
    received = []

    for (const byteVal of [0, 64, 128, 192, 255]) {
      const report = Buffer.alloc(6, byteVal)
      emitHidData(report)
    }

    const axisEvents = received.filter((e) => e.kind === 'axis') as Array<{
      kind: 'axis'
      axis: string
      value: number
    }>

    expect(axisEvents.length).toBeGreaterThan(0)
    for (const e of axisEvents) {
      expect(e.value).toBeGreaterThanOrEqual(-1.0)
      expect(e.value).toBeLessThanOrEqual(1.0)
    }
  })

  it('setHaptic and setLED are no-ops and do not throw (NFR-C2)', () => {
    expect(() => driver.setHaptic('single_pulse')).not.toThrow()
    expect(() => driver.setLED('#ff0000')).not.toThrow()
  })

  it('catches errors in HID data callback and continues (NFR-R1)', () => {
    // Empty report (< 2 bytes) — returns empty array, no throw
    const emptyReport = Buffer.alloc(0)
    expect(() => emitHidData(emptyReport)).not.toThrow()

    // Valid report after error condition
    const validReport = Buffer.alloc(6, 128)
    expect(() => emitHidData(validReport)).not.toThrow()
  })

  it('does not re-emit button or axis events when HID report state has not changed', () => {
    received = []
    const report = Buffer.alloc(6, 128)
    report[0] = 0x01 // button 'a' pressed

    emitHidData(report) // First report — emits initial state
    received = []

    emitHidData(report) // Identical report — nothing should re-emit
    expect(received.filter((e) => e.kind === 'button')).toHaveLength(0)
    expect(received.filter((e) => e.kind === 'axis')).toHaveLength(0)
  })
})
