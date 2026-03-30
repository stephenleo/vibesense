// test/unit/extension/platform/platform-guide.test.ts
// Unit tests for platform-guide — permission guidance notifications
/* eslint-disable @typescript-eslint/naming-convention */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock vscode ──────────────────────────────────────────────────────────────
const mockShowWarningMessage = vi.fn()
const mockShowInformationMessage = vi.fn()
const mockOpenExternal = vi.fn()
const mockClipboardWriteText = vi.fn()

vi.mock('vscode', () => ({
  window: {
    showWarningMessage: mockShowWarningMessage,
    showInformationMessage: mockShowInformationMessage,
  },
  env: {
    openExternal: mockOpenExternal,
    clipboard: {
      writeText: mockClipboardWriteText,
    },
  },
  Uri: {
    parse: vi.fn((s: string) => ({ toString: () => s, _parsed: s })),
  },
}))

// ── Mock logger ──────────────────────────────────────────────────────────────
const mockLoggerWarn = vi.fn()
const mockLoggerError = vi.fn()
const mockLoggerInfo = vi.fn()

vi.mock('../../../../src/extension/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}))

// ── Mock permission-checker ──────────────────────────────────────────────────
const mockDetectPlatform = vi.fn()

vi.mock('../../../../src/extension/platform/permission-checker', () => ({
  detectPlatform: mockDetectPlatform,
}))

const {
  showMacOsPermissionGuide,
  showLinuxUdevGuide,
  handleHidPermissionError,
} = await import('../../../../src/extension/platform/platform-guide')

describe('showMacOsPermissionGuide', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockShowWarningMessage.mockResolvedValue(undefined)
    mockOpenExternal.mockResolvedValue(true)
  })

  it('calls showWarningMessage with correct message and Open Settings button', () => {
    showMacOsPermissionGuide()
    expect(mockShowWarningMessage).toHaveBeenCalledWith(
      'Controller input requires Input Monitoring permission. [Open Settings]',
      'Open Settings',
    )
  })

  it('logs a warning', () => {
    showMacOsPermissionGuide()
    expect(mockLoggerWarn).toHaveBeenCalledWith('Platform: macOS Input Monitoring permission missing')
  })

  it('opens System Settings when Open Settings is selected', async () => {
    mockShowWarningMessage.mockResolvedValue('Open Settings')
    showMacOsPermissionGuide()
    // Allow promise chain to resolve
    await Promise.resolve()
    await Promise.resolve()
    expect(mockOpenExternal).toHaveBeenCalledWith(
      expect.objectContaining({ _parsed: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent' }),
    )
  })

  it('does not open external URL when notification is dismissed', async () => {
    mockShowWarningMessage.mockResolvedValue(undefined)
    showMacOsPermissionGuide()
    await Promise.resolve()
    await Promise.resolve()
    expect(mockOpenExternal).not.toHaveBeenCalled()
  })
})

describe('showLinuxUdevGuide', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockShowWarningMessage.mockResolvedValue(undefined)
    mockClipboardWriteText.mockResolvedValue(undefined)
    mockShowInformationMessage.mockResolvedValue(undefined)
  })

  it('calls showWarningMessage with Copy Rule and Reconnect Controller buttons', () => {
    showLinuxUdevGuide()
    expect(mockShowWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('udev rule'),
      'Copy Rule',
      'Reconnect Controller',
    )
  })

  it('logs a warning', () => {
    showLinuxUdevGuide()
    expect(mockLoggerWarn).toHaveBeenCalledWith('Platform: Linux udev rule missing')
  })

  it('writes rule to clipboard when Copy Rule is selected', async () => {
    mockShowWarningMessage.mockResolvedValue('Copy Rule')
    mockClipboardWriteText.mockResolvedValue(undefined)
    mockShowInformationMessage.mockResolvedValue(undefined)
    showLinuxUdevGuide()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(mockClipboardWriteText).toHaveBeenCalledWith(
      expect.stringContaining('SUBSYSTEM=="hidraw"'),
    )
  })
})

describe('handleHidPermissionError', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockShowWarningMessage.mockResolvedValue(undefined)
  })

  it('calls showMacOsPermissionGuide on macOS', () => {
    mockDetectPlatform.mockReturnValue('macos')
    handleHidPermissionError(new Error('cannot open device'))
    expect(mockShowWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('Input Monitoring'),
      'Open Settings',
    )
  })

  it('calls showLinuxUdevGuide on Linux', () => {
    mockDetectPlatform.mockReturnValue('linux')
    handleHidPermissionError(new Error('permission denied'))
    expect(mockShowWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('udev rule'),
      'Copy Rule',
      'Reconnect Controller',
    )
  })

  it('logs a warning on windows platform', () => {
    mockDetectPlatform.mockReturnValue('windows')
    handleHidPermissionError(new Error('access denied'))
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Platform: HID permission error on unexpected platform',
      expect.any(Error),
    )
  })

  it('never throws even if showWarningMessage throws', () => {
    mockDetectPlatform.mockReturnValue('macos')
    mockShowWarningMessage.mockImplementation(() => { throw new Error('vscode API exploded') })
    expect(() => handleHidPermissionError(new Error('cannot open device'))).not.toThrow()
  })

  it('logs error if handler itself throws', () => {
    mockDetectPlatform.mockImplementation(() => { throw new Error('platform detection failed') })
    expect(() => handleHidPermissionError(new Error('some error'))).not.toThrow()
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Platform: failed to show permission guide',
      expect.any(Error),
    )
  })
})
