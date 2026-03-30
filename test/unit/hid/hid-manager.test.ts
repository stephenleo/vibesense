// test/unit/hid/hid-manager.test.ts
// Unit tests for HidManager — device detection and driver factory
// All native modules (node-hid, dualsense-ts) MUST be mocked

import { vi, describe, it, expect, beforeEach } from 'vitest'

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
    on: vi.fn(),
    up: { on: vi.fn() },
    down: { on: vi.fn() },
    left: { on: vi.fn() },
    right: { on: vi.fn() },
  },
  left: {
    bumper: { on: vi.fn() },
    trigger: { on: vi.fn(), button: { on: vi.fn() }, state: { magnitude: 0 } },
    analog: {
      on: vi.fn(),
      x: { on: vi.fn() },
      y: { on: vi.fn() },
      button: { on: vi.fn() },
    },
  },
  right: {
    bumper: { on: vi.fn() },
    trigger: { on: vi.fn(), button: { on: vi.fn() }, state: { magnitude: 0 } },
    analog: {
      on: vi.fn(),
      x: { on: vi.fn() },
      y: { on: vi.fn() },
      button: { on: vi.fn() },
    },
  },
  rumble: vi.fn(),
}

const MockDualsense = vi.fn().mockImplementation(() => mockDualsenseInstance)
vi.mock('dualsense-ts', () => ({
  Dualsense: MockDualsense,
}))

// ── Mock node-hid ────────────────────────────────────────────────────────────
const mockDevices = vi.fn().mockReturnValue([])
const mockHidOn = vi.fn()
const mockHidClose = vi.fn()
const mockHidConstructor = vi.fn().mockImplementation(() => ({
  on: mockHidOn,
  close: mockHidClose,
}))

vi.mock('node-hid', () => ({
  devices: mockDevices,
  HID: mockHidConstructor,
}))

// ── Import modules under test AFTER mocks ────────────────────────────────────
const { createDriver, HidManager, DUALSENSE_VID, DUALSENSE_PIDS } = await import(
  '../../../src/extension/hid/hid-manager'
)
const { XBOX_VID, XBOX_PIDS } = await import('../../../src/extension/hid/xbox-driver')
const { DualSenseDriver } = await import('../../../src/extension/hid/dualsense-driver')
const { XboxDriver } = await import('../../../src/extension/hid/xbox-driver')
const { GenericHidDriver } = await import('../../../src/extension/hid/generic-driver')

// ── createDriver() factory tests ──────────────────────────────────────────────
describe('createDriver()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDevices.mockReturnValue([])
  })

  it('returns DualSenseDriver when DualSense VID/PID is detected', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[0],
        product: 'DualSense Wireless Controller',
        manufacturer: 'Sony',
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeInstanceOf(DualSenseDriver)
  })

  it('returns DualSenseDriver for DualSense Edge VID/PID', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[1], // 0x0df2 Edge variant
        product: 'DualSense Edge',
        manufacturer: 'Sony',
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeInstanceOf(DualSenseDriver)
  })

  it('returns XboxDriver when Xbox Series VID/PID is detected', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: XBOX_VID,
        productId: XBOX_PIDS[0], // 0x0b12
        product: 'Xbox Series X|S Controller',
        manufacturer: 'Microsoft',
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeInstanceOf(XboxDriver)
  })

  it('returns XboxDriver for all known Xbox PIDs', () => {
    for (const pid of XBOX_PIDS) {
      mockDevices.mockReturnValue([
        {
          vendorId: XBOX_VID,
          productId: pid,
          usagePage: 0x01,
          usage: 0x05,
          interface: 0,
          release: 0,
        },
      ])

      const driver = createDriver()
      expect(driver).toBeInstanceOf(XboxDriver)
    }
  })

  it('returns GenericHidDriver for unknown VID/PID with gamepad usage', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: 0x1234,
        productId: 0x5678,
        product: 'Unknown Gamepad',
        manufacturer: 'Unknown',
        usagePage: 0x01,
        usage: 0x05, // Gamepad usage
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeInstanceOf(GenericHidDriver)
  })

  it('returns null when no compatible devices found', () => {
    // No devices with gamepad usage
    mockDevices.mockReturnValue([
      {
        vendorId: 0xaaaa,
        productId: 0xbbbb,
        product: 'USB Hub',
        usagePage: 0x0b, // Telephony usage — not a gamepad
        usage: 0x01,
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeNull()
  })

  it('logs a warning when no device found', () => {
    mockDevices.mockReturnValue([])
    createDriver()
    expect(mockAppendLine).toHaveBeenCalled()
    const calls = mockAppendLine.mock.calls.map((c: string[][]) => c[0])
    expect(calls.some((msg: string) => msg.includes('WARN') || msg.includes('No compatible'))).toBe(true)
  })

  it('prioritizes DualSense over Xbox when both are connected', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: XBOX_VID,
        productId: XBOX_PIDS[0],
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[0],
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    const driver = createDriver()
    expect(driver).toBeInstanceOf(DualSenseDriver)
  })

  it('handles HID.devices() throwing and returns null', () => {
    mockDevices.mockImplementation(() => {
      throw new Error('HID access denied')
    })

    expect(() => createDriver()).not.toThrow()
    const driver = createDriver()
    expect(driver).toBeNull()
  })
})

// ── HidManager class tests ────────────────────────────────────────────────────
describe('HidManager', () => {
  let manager: InstanceType<typeof HidManager>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDevices.mockReturnValue([])
    manager = new HidManager()
  })

  it('start() returns null when no devices found', () => {
    const driver = manager.start()
    expect(driver).toBeNull()
  })

  it('start() returns a ControllerHAL when DualSense is detected', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[0],
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    const driver = manager.start()
    expect(driver).not.toBeNull()
    expect(driver).toBeInstanceOf(DualSenseDriver)
  })

  it('getDriver() returns null before start()', () => {
    expect(manager.getDriver()).toBeNull()
  })

  it('getDriver() returns the active driver after start()', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[0],
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    manager.start()
    expect(manager.getDriver()).toBeInstanceOf(DualSenseDriver)
  })

  it('stop() clears the driver', () => {
    mockDevices.mockReturnValue([
      {
        vendorId: DUALSENSE_VID,
        productId: DUALSENSE_PIDS[0],
        usagePage: 0x01,
        usage: 0x05,
        interface: 0,
        release: 0,
      },
    ])

    manager.start()
    expect(manager.getDriver()).not.toBeNull()

    manager.stop()
    expect(manager.getDriver()).toBeNull()
  })

  it('logs a warning when no compatible controller found', () => {
    manager.start()
    const calls = mockAppendLine.mock.calls.map((c: string[][]) => c[0])
    expect(calls.some((msg: string) => msg.includes('WARN'))).toBe(true)
  })

  it('does not crash when start() is called with no devices', () => {
    expect(() => manager.start()).not.toThrow()
  })

  it('does not crash when stop() is called without start()', () => {
    expect(() => manager.stop()).not.toThrow()
  })
})
