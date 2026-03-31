// test/unit/input/settings-bridge.test.ts
// Unit tests for SettingsBridge — mocks vscode, node:fs, and logger

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const {
  mockReadFileSync,
  mockWriteFileSync,
  mockRenameSync,
  mockExistsSync,
  mockMkdirSync,
  mockLogger,
  mockGetConfiguration,
  mockOnDidChangeConfiguration,
  mockConfigGet,
  _mockConfigUpdate,
} = vi.hoisted(() => {
  const mockConfigGet = vi.fn()
  const _mockConfigUpdate = vi.fn().mockResolvedValue(undefined)
  const mockGetConfiguration = vi.fn(() => ({
    get: mockConfigGet,
    update: _mockConfigUpdate,
  }))
  const mockOnDidChangeConfiguration = vi.fn(() => ({
    dispose: vi.fn(),
  }))
  return {
    mockReadFileSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockRenameSync: vi.fn(),
    mockExistsSync: vi.fn(() => true),
    mockMkdirSync: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockGetConfiguration,
    mockOnDidChangeConfiguration,
    mockConfigGet,
    _mockConfigUpdate,
  }
})

// ── Mock node:fs ───────────────────────────────────────────────────────────────
vi.mock('node:fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  renameSync: mockRenameSync,
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: mockGetConfiguration,
    onDidChangeConfiguration: mockOnDidChangeConfiguration,
  },
  ConfigurationTarget: {
    Global: 1,
    Workspace: 2,
    WorkspaceFolder: 3,
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { SettingsBridge } from '../../../src/extension/input/settings-bridge'
import { CLAUDE_CODE_DEFAULT_BINDINGS } from '../../../src/extension/input/default-bindings'

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SettingsBridge', () => {
  let bridge: SettingsBridge

  beforeEach(() => {
    vi.clearAllMocks()
    mockExistsSync.mockReturnValue(true)
    bridge = new SettingsBridge('/workspace')
  })

  // ── readBindingsFromSettings ───────────────────────────────────────────────

  describe('readBindingsFromSettings()', () => {
    it('returns BindingMap from mocked VSCode settings', () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === 'binding.cross') return 'custom.approve'
        if (key === 'binding.circle') return 'custom.deny'
        return undefined
      })

      const result = bridge.readBindingsFromSettings()
      expect(result.cross).toBe('custom.approve')
      expect(result.circle).toBe('custom.deny')
      // Unspecified buttons fall back to defaults
      expect(result.l1).toBe(CLAUDE_CODE_DEFAULT_BINDINGS.l1)
    })

    it('falls back to CLAUDE_CODE_DEFAULT_BINDINGS when getConfiguration throws', () => {
      mockGetConfiguration.mockImplementationOnce(() => {
        throw new Error('vscode config error')
      })

      const result = bridge.readBindingsFromSettings()
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to read settings'),
        expect.anything(),
      )
    })

    it('falls back to CLAUDE_CODE_DEFAULT_BINDINGS when config.get throws', () => {
      mockConfigGet.mockImplementation(() => {
        throw new Error('config.get error')
      })

      const result = bridge.readBindingsFromSettings()
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
    })

    it('ignores empty string values in settings', () => {
      mockConfigGet.mockImplementation((key: string) => {
        if (key === 'binding.cross') return ''
        return undefined
      })

      const result = bridge.readBindingsFromSettings()
      // Empty string should be ignored — default used
      expect(result.cross).toBe(CLAUDE_CODE_DEFAULT_BINDINGS.cross)
    })
  })

  // ── watchSettings ──────────────────────────────────────────────────────────

  describe('watchSettings()', () => {
    it('returns a Disposable from onDidChangeConfiguration', () => {
      const mockDisposable = { dispose: vi.fn() }
      mockOnDidChangeConfiguration.mockReturnValueOnce(mockDisposable)

      const disposable = bridge.watchSettings(vi.fn())
      expect(disposable).toBe(mockDisposable)
    })

    it('calls onChange with fresh BindingMap when vibesense config changes', () => {
      let capturedListener: ((event: { affectsConfiguration: (s: string) => boolean }) => void) | undefined
      mockOnDidChangeConfiguration.mockImplementation((listener) => {
        capturedListener = listener
        return { dispose: vi.fn() }
      })
      mockConfigGet.mockReturnValue('custom.command')

      const onChange = vi.fn()
      bridge.watchSettings(onChange)

      // Simulate configuration change event
      capturedListener?.({ affectsConfiguration: (s: string) => s === 'vibesense' })
      expect(onChange).toHaveBeenCalledOnce()
    })

    it('does not call onChange when unrelated configuration changes', () => {
      let capturedListener: ((event: { affectsConfiguration: (s: string) => boolean }) => void) | undefined
      mockOnDidChangeConfiguration.mockImplementation((listener) => {
        capturedListener = listener
        return { dispose: vi.fn() }
      })

      const onChange = vi.fn()
      bridge.watchSettings(onChange)

      // Simulate unrelated configuration change
      capturedListener?.({ affectsConfiguration: (s: string) => s !== 'vibesense' })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  // ── writeBindingToProfile ──────────────────────────────────────────────────

  describe('writeBindingToProfile()', () => {
    it('reads existing vibesense.json, merges change, and writes atomically', () => {
      const existingProfile = {
        profile: 'claude-code-default',
        bindings: { cross: 'vibesense.approve', circle: 'vibesense.deny' },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(existingProfile))

      bridge.writeBindingToProfile('cross', 'custom.newAction')

      expect(mockWriteFileSync).toHaveBeenCalledOnce()
      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string)
      expect(writtenContent.bindings.cross).toBe('custom.newAction')
      expect(writtenContent.bindings.circle).toBe('vibesense.deny') // preserved

      expect(mockRenameSync).toHaveBeenCalledOnce()
      // Rename from .tmp to actual file
      const tmpPath = mockRenameSync.mock.calls[0][0] as string
      const finalPath = mockRenameSync.mock.calls[0][1] as string
      expect(tmpPath).toContain('.tmp')
      expect(finalPath).not.toContain('.tmp')
      expect(finalPath).toContain('vibesense.json')
    })

    it('creates .vscode/ directory if missing', () => {
      mockExistsSync.mockReturnValueOnce(false) // .vscode dir does not exist
      mockReadFileSync.mockImplementation(() => {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      })

      bridge.writeBindingToProfile('cross', 'custom.action')

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.vscode'),
        { recursive: true },
      )
    })

    it('starts with empty profile when vibesense.json does not exist', () => {
      mockReadFileSync.mockImplementation(() => {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      })

      bridge.writeBindingToProfile('circle', 'vibesense.deny')

      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string)
      expect(writtenContent.bindings.circle).toBe('vibesense.deny')
    })

    it('never throws on FS write error (NFR-R1)', () => {
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })

      expect(() => bridge.writeBindingToProfile('cross', 'vibesense.approve')).not.toThrow()
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to write vibesense.json'),
        expect.anything(),
      )
    })

    it('never throws on FS rename error (NFR-R1)', () => {
      mockReadFileSync.mockReturnValue('{}')
      mockRenameSync.mockImplementation(() => {
        throw new Error('rename failed')
      })

      expect(() => bridge.writeBindingToProfile('cross', 'vibesense.approve')).not.toThrow()
    })
  })

  // ── resetSectionToDefaults ─────────────────────────────────────────────────

  describe('resetSectionToDefaults()', () => {
    it('writes default values for specified buttons', () => {
      const existingProfile = {
        profile: 'claude-code-default',
        bindings: { cross: 'custom.action', circle: 'vibesense.deny' },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(existingProfile))

      bridge.resetSectionToDefaults(['cross'])

      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string)
      expect(writtenContent.bindings.cross).toBe(CLAUDE_CODE_DEFAULT_BINDINGS.cross)
    })

    it('preserves bindings for buttons not in the reset list', () => {
      const existingProfile = {
        profile: 'test',
        bindings: { cross: 'custom.action', circle: 'custom.deny' },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(existingProfile))

      bridge.resetSectionToDefaults(['cross'])

      const writtenContent = JSON.parse(mockWriteFileSync.mock.calls[0][1] as string)
      // circle was not in the reset list — preserves its current value
      expect(writtenContent.bindings.circle).toBe('custom.deny')
    })

    it('never throws on FS write error (NFR-R1)', () => {
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })

      expect(() => bridge.resetSectionToDefaults(['cross'])).not.toThrow()
    })
  })
})
