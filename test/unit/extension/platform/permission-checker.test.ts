// test/unit/extension/platform/permission-checker.test.ts
// Unit tests for permission-checker — pure Node.js, no VSCode mock needed

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Mock node-hid before importing the module under test
const mockHidDevices = vi.fn()
vi.mock('node-hid', () => ({
  devices: mockHidDevices,
}))

const {
  detectPlatform,
  isHidPermissionError,
  checkHidAccess,
} = await import('../../../../src/extension/platform/permission-checker')

describe('detectPlatform', () => {
  const originalPlatform = process.platform

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
  })

  it('returns macos when process.platform is darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    expect(detectPlatform()).toBe('macos')
  })

  it('returns linux when process.platform is linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    expect(detectPlatform()).toBe('linux')
  })

  it('returns windows when process.platform is win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })
    expect(detectPlatform()).toBe('windows')
  })

  it('returns other for an unknown platform', () => {
    Object.defineProperty(process, 'platform', { value: 'freebsd', configurable: true })
    expect(detectPlatform()).toBe('other')
  })
})

describe('isHidPermissionError', () => {
  it('returns true for Error with "cannot open device" in message', () => {
    expect(isHidPermissionError(new Error('HID: cannot open device'))).toBe(true)
  })

  it('returns true for Error with "Access denied" in message (case-insensitive)', () => {
    expect(isHidPermissionError(new Error('Access denied'))).toBe(true)
  })

  it('returns true for Error with "Permission denied" in message (case-insensitive)', () => {
    expect(isHidPermissionError(new Error('permission denied by OS'))).toBe(true)
  })

  it('returns false for a non-Error (plain string)', () => {
    expect(isHidPermissionError('Access denied')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isHidPermissionError(null)).toBe(false)
  })

  it('returns false for an Error with an unrelated message', () => {
    expect(isHidPermissionError(new Error('device not found'))).toBe(false)
  })
})

describe('checkHidAccess', () => {
  beforeEach(() => {
    mockHidDevices.mockReset()
  })

  it('returns { ok: true } when hidDevices() succeeds', () => {
    mockHidDevices.mockReturnValue([])
    expect(checkHidAccess()).toEqual({ ok: true })
  })

  it('returns { ok: false, error } when hidDevices() throws', () => {
    const err = new Error('cannot open device')
    mockHidDevices.mockImplementation(() => { throw err })
    const result = checkHidAccess()
    expect(result.ok).toBe(false)
    expect(result.error).toBe(err)
  })

  it('does not throw when hidDevices() throws', () => {
    mockHidDevices.mockImplementation(() => { throw new Error('boom') })
    expect(() => checkHidAccess()).not.toThrow()
  })
})
