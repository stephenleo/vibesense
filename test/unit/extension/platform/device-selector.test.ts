// test/unit/extension/platform/device-selector.test.ts
// Unit tests for device-selector — manual HID device selection via QuickPick
/* eslint-disable @typescript-eslint/naming-convention */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { Device } from 'node-hid'

// ── Mock node-hid ─────────────────────────────────────────────────────────────
const mockHidDevices = vi.fn()
vi.mock('node-hid', () => ({
  devices: mockHidDevices,
}))

// ── Mock vscode ──────────────────────────────────────────────────────────────
const mockShowQuickPick = vi.fn()
const mockShowInformationMessage = vi.fn()
const mockAppendLine = vi.fn()

vi.mock('vscode', () => ({
  window: {
    showQuickPick: mockShowQuickPick,
    showInformationMessage: mockShowInformationMessage,
    createOutputChannel: vi.fn(() => ({
      appendLine: mockAppendLine,
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))

// ── Mock logger ──────────────────────────────────────────────────────────────
const mockLoggerInfo = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('../../../../src/extension/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}))

// ── Mock drivers ─────────────────────────────────────────────────────────────
const mockDualSenseStart = vi.fn()
const mockDualSenseSetHaptic = vi.fn()
const mockDualSenseOn = vi.fn()
const mockDualSenseStop = vi.fn()
const mockDualSenseSetLED = vi.fn()

// Use regular function syntax (not arrow) so Vitest recognises the constructor mock
const MockDualSenseDriver = vi.fn(function (this: Record<string, unknown>) {
  this.start = mockDualSenseStart
  this.stop = mockDualSenseStop
  this.setHaptic = mockDualSenseSetHaptic
  this.setLED = mockDualSenseSetLED
  this.on = mockDualSenseOn
})

const mockXboxStart = vi.fn()
const mockXboxOn = vi.fn()
const mockXboxStop = vi.fn()
const mockXboxSetHaptic = vi.fn()
const mockXboxSetLED = vi.fn()

const MockXboxDriver = vi.fn(function (this: Record<string, unknown>) {
  this.start = mockXboxStart
  this.stop = mockXboxStop
  this.setHaptic = mockXboxSetHaptic
  this.setLED = mockXboxSetLED
  this.on = mockXboxOn
})

const mockGenericStart = vi.fn()
const mockGenericOn = vi.fn()
const mockGenericStop = vi.fn()
const mockGenericSetHaptic = vi.fn()
const mockGenericSetLED = vi.fn()

const MockGenericHidDriver = vi.fn(function (this: Record<string, unknown>) {
  this.start = mockGenericStart
  this.stop = mockGenericStop
  this.setHaptic = mockGenericSetHaptic
  this.setLED = mockGenericSetLED
  this.on = mockGenericOn
})

vi.mock('../../../../src/extension/hid/dualsense-driver', () => ({
  DualSenseDriver: MockDualSenseDriver,
}))

vi.mock('../../../../src/extension/hid/xbox-driver', () => ({
  XboxDriver: MockXboxDriver,
  XBOX_VID: 0x045e,
  XBOX_PIDS: [0x0b12, 0x0b13, 0x02fd, 0x02e0],
}))

vi.mock('../../../../src/extension/hid/generic-driver', () => ({
  GenericHidDriver: MockGenericHidDriver,
}))

vi.mock('../../../../src/extension/hid/hid-manager', () => ({
  DUALSENSE_VID: 0x054c,
  DUALSENSE_PIDS: [0x0ce6, 0x0df2],
  HidManager: vi.fn(),
  createDriver: vi.fn(),
}))

const { listHidDevices, formatDeviceLabel, showDeviceSelector } = await import(
  '../../../../src/extension/platform/device-selector'
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeDevice(overrides: Partial<Device> = {}): Device {
  return {
    vendorId: 0x1234,
    productId: 0x5678,
    path: '/dev/hidraw0',
    product: 'Test Device',
    manufacturer: 'Test Corp',
    serialNumber: '',
    release: 1,
    interface: 0,
    usagePage: 0x01,
    usage: 0x05,
    ...overrides,
  }
}

describe('listHidDevices', () => {
  beforeEach(() => {
    mockHidDevices.mockReset()
  })

  it('returns the list of devices when hidDevices() succeeds', () => {
    const devices = [makeDevice()]
    mockHidDevices.mockReturnValue(devices)
    expect(listHidDevices()).toEqual(devices)
  })

  it('returns an empty array on error without throwing', () => {
    mockHidDevices.mockImplementation(() => { throw new Error('HID error') })
    expect(listHidDevices()).toEqual([])
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
})

describe('formatDeviceLabel', () => {
  it('formats VID/PID as 4-digit hex with 0x prefix', () => {
    const d = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    expect(formatDeviceLabel(d)).toBe('DualSense (VID: 0x054c, PID: 0x0ce6)')
  })

  it('uses Unknown Device when product is undefined', () => {
    const d = makeDevice({ vendorId: 0x1234, productId: 0x0001, product: undefined })
    expect(formatDeviceLabel(d)).toBe('Unknown Device (VID: 0x1234, PID: 0x0001)')
  })

  it('pads VID/PID to 4 digits', () => {
    const d = makeDevice({ vendorId: 0x01, productId: 0x02, product: 'Tiny' })
    expect(formatDeviceLabel(d)).toBe('Tiny (VID: 0x0001, PID: 0x0002)')
  })
})

describe('showDeviceSelector', () => {
  beforeEach(() => {
    // Use clearAllMocks (resets call counts) but NOT resetAllMocks (which clears implementations).
    // Explicitly restore driver method mocks to no-ops so test-specific implementations
    // set via .mockImplementation() in one test do not bleed into subsequent tests.
    vi.clearAllMocks()
    mockHidDevices.mockReturnValue([])
    mockShowQuickPick.mockResolvedValue(undefined)
    mockShowInformationMessage.mockResolvedValue(undefined)
    mockDualSenseStart.mockImplementation(() => undefined)
    mockDualSenseSetHaptic.mockImplementation(() => undefined)
    mockDualSenseStop.mockImplementation(() => undefined)
    mockXboxStart.mockImplementation(() => undefined)
    mockGenericStart.mockImplementation(() => undefined)
  })

  it('returns null when device list is empty', async () => {
    mockHidDevices.mockReturnValue([])
    const result = await showDeviceSelector()
    expect(result).toBeNull()
    expect(mockShowInformationMessage).toHaveBeenCalledWith('No HID devices found.')
  })

  it('returns null when user dismisses QuickPick', async () => {
    mockHidDevices.mockReturnValue([makeDevice()])
    mockShowQuickPick.mockResolvedValue(undefined)
    const result = await showDeviceSelector()
    expect(result).toBeNull()
  })

  it('instantiates DualSenseDriver for DualSense VID/PID', async () => {
    const ds = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    mockHidDevices.mockReturnValue([ds])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(ds), device: ds })
    const result = await showDeviceSelector()
    expect(MockDualSenseDriver).toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result?.controllerType).toBe('dualsense')
  })

  it('calls driver.start() after selection', async () => {
    const ds = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    mockHidDevices.mockReturnValue([ds])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(ds), device: ds })
    await showDeviceSelector()
    expect(mockDualSenseStart).toHaveBeenCalled()
  })

  it('calls driver.setHaptic("single_pulse") for DualSense', async () => {
    const ds = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    mockHidDevices.mockReturnValue([ds])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(ds), device: ds })
    await showDeviceSelector()
    expect(mockDualSenseSetHaptic).toHaveBeenCalledWith('single_pulse')
  })

  it('does not call setHaptic for non-DualSense device', async () => {
    const xbox = makeDevice({ vendorId: 0x045e, productId: 0x0b12, product: 'Xbox Controller' })
    mockHidDevices.mockReturnValue([xbox])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(xbox), device: xbox })
    const result = await showDeviceSelector()
    expect(MockXboxDriver).toHaveBeenCalledWith(0x045e, 0x0b12)
    expect(mockXboxSetHaptic).not.toHaveBeenCalled()
    expect(result?.controllerType).toBe('xbox')
  })

  it('instantiates GenericHidDriver for unknown VID/PID', async () => {
    const generic = makeDevice({ vendorId: 0xaaaa, productId: 0xbbbb, product: 'Generic' })
    mockHidDevices.mockReturnValue([generic])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(generic), device: generic })
    const result = await showDeviceSelector()
    expect(MockGenericHidDriver).toHaveBeenCalledWith(0xaaaa, 0xbbbb)
    expect(result?.controllerType).toBe('generic-hid')
  })

  it('returns null and logs error when driver.start() throws', async () => {
    const ds = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    mockHidDevices.mockReturnValue([ds])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(ds), device: ds })
    mockDualSenseStart.mockImplementation(() => { throw new Error('start failed') })
    const result = await showDeviceSelector()
    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('stops driver and returns null when setHaptic throws for DualSense', async () => {
    const ds = makeDevice({ vendorId: 0x054c, productId: 0x0ce6, product: 'DualSense' })
    mockHidDevices.mockReturnValue([ds])
    mockShowQuickPick.mockResolvedValue({ label: formatDeviceLabel(ds), device: ds })
    mockDualSenseSetHaptic.mockImplementation(() => { throw new Error('haptic failed') })
    const result = await showDeviceSelector()
    expect(result).toBeNull()
    expect(mockDualSenseStop).toHaveBeenCalled()
    expect(mockLoggerWarn).toHaveBeenCalled()
  })
})
