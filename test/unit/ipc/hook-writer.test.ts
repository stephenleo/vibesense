// test/unit/ipc/hook-writer.test.ts
// Unit tests for registerHooks() — mocks node:fs, node:os, node:path, vscode, and logger

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockRenameSync,
  mockUnlinkSync,
  mockLogger,
  mockHomedir,
  mockJoinPath,
  mockFsPathGetter,
  mockExtensionUri,
} = vi.hoisted(() => {
  const mockFsPathGetter = vi.fn((segments: string[]) =>
    ['/ext', ...segments].join('/'),
  )

  const mockExtensionUri = {
    fsPath: '/ext',
  }

  return {
    mockExistsSync: vi.fn(() => true),
    mockReadFileSync: vi.fn(() => '{}'),
    mockWriteFileSync: vi.fn(),
    mockRenameSync: vi.fn(),
    mockUnlinkSync: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockHomedir: vi.fn(() => '/home/user'),
    mockJoinPath: vi.fn((...args: string[]) => args.join('/')),
    mockFsPathGetter,
    mockExtensionUri,
  }
})

// ── Mock node:fs ───────────────────────────────────────────────────────────────
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  renameSync: mockRenameSync,
  unlinkSync: mockUnlinkSync,
}))

// ── Mock node:os ───────────────────────────────────────────────────────────────
vi.mock('node:os', () => ({
  homedir: mockHomedir,
}))

// ── Mock node:path ─────────────────────────────────────────────────────────────
vi.mock('node:path', () => ({
  join: mockJoinPath,
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  Uri: {
    joinPath: vi.fn((_uri: unknown, ...segments: string[]) => ({
      fsPath: mockFsPathGetter(segments),
    })),
  },
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { registerHooks } from '../../../src/extension/ipc/hook-writer'

// ── Helper ─────────────────────────────────────────────────────────────────────
function makeContext(): { extensionUri: { fsPath: string } } {
  return { extensionUri: mockExtensionUri }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('registerHooks()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHomedir.mockReturnValue('/home/user')
    mockJoinPath.mockImplementation((...args: string[]) => args.join('/'))
    mockFsPathGetter.mockImplementation((segments: string[]) =>
      ['/ext', ...segments].join('/'),
    )
    // By default: Claude Code is detected (settings.json exists)
    mockExistsSync.mockReturnValue(true)
    // By default: empty existing settings
    mockReadFileSync.mockReturnValue('{}')
  })

  // ── AC 3: Claude Code not detected ──────────────────────────────────────────

  describe('Claude Code not detected', () => {
    it('skips hook registration when settings.json does not exist', () => {
      mockExistsSync.mockReturnValue(false)

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockReadFileSync).not.toHaveBeenCalled()
      expect(mockWriteFileSync).not.toHaveBeenCalled()
      expect(mockRenameSync).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Claude Code not detected'),
      )
    })

    it('does not throw when settings.json does not exist (NFR-R1)', () => {
      mockExistsSync.mockReturnValue(false)

      expect(() =>
        registerHooks(makeContext() as Parameters<typeof registerHooks>[0]),
      ).not.toThrow()
    })

    it('does not log error or warning when Claude Code is not installed (NFR-I1)', () => {
      mockExistsSync.mockReturnValue(false)

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockLogger.error).not.toHaveBeenCalled()
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })

  // ── AC 1: settings.json does not exist yet (file just detected as directory) ──

  describe('settings.json exists but is empty / new file', () => {
    it('creates settings with only VibeSense hooks when settings.json is empty object', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockWriteFileSync).toHaveBeenCalledOnce()
      const writtenContent = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string,
      ) as { hooks: { Stop: unknown[]; PostToolUse: unknown[] } }

      expect(writtenContent.hooks.Stop).toHaveLength(1)
      expect(writtenContent.hooks.PostToolUse).toHaveLength(1)
    })

    it('uses atomic write pattern — writes to .tmp then renames (NFR-R5)', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockWriteFileSync).toHaveBeenCalledOnce()
      expect(mockRenameSync).toHaveBeenCalledOnce()

      const tmpPath = mockWriteFileSync.mock.calls[0][0] as string
      const renameFrom = mockRenameSync.mock.calls[0][0] as string
      const renameTo = mockRenameSync.mock.calls[0][1] as string

      expect(tmpPath).toContain('.tmp')
      expect(renameFrom).toBe(tmpPath)
      expect(renameTo).not.toContain('.tmp')
      expect(renameTo).toContain('settings.json')
    })

    it('includes correct hook schema structure for Stop', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockFsPathGetter.mockImplementation((segments: string[]) =>
        '/ext/' + segments.join('/'),
      )

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      const writtenContent = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string,
      ) as {
        hooks: {
          Stop: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
          PostToolUse: Array<{ matcher: string; hooks: Array<{ type: string; command: string }> }>
        }
      }

      expect(writtenContent.hooks.Stop[0].matcher).toBe('')
      expect(writtenContent.hooks.Stop[0].hooks[0].type).toBe('command')
      expect(writtenContent.hooks.Stop[0].hooks[0].command).toContain('stop.sh')

      expect(writtenContent.hooks.PostToolUse[0].matcher).toBe('')
      expect(writtenContent.hooks.PostToolUse[0].hooks[0].type).toBe('command')
      expect(writtenContent.hooks.PostToolUse[0].hooks[0].command).toContain('post-tool-use.sh')
    })
  })

  // ── AC 1: Merge with existing hooks ─────────────────────────────────────────

  describe('settings.json exists with other hooks', () => {
    it('preserves existing Stop and PostToolUse entries from other tools', () => {
      const existingSettings = {
        hooks: {
          Stop: [
            {
              matcher: 'some-pattern',
              hooks: [{ type: 'command', command: '/other/tool/stop.sh' }],
            },
          ],
          PostToolUse: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: '/other/tool/post.sh' }],
            },
          ],
        },
      }
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings))

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      const writtenContent = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string,
      ) as {
        hooks: {
          Stop: Array<{ hooks: Array<{ command: string }> }>
          PostToolUse: Array<{ hooks: Array<{ command: string }> }>
        }
      }

      // VibeSense entry added
      expect(writtenContent.hooks.Stop).toHaveLength(2)
      expect(writtenContent.hooks.PostToolUse).toHaveLength(2)

      // Existing entries preserved
      expect(writtenContent.hooks.Stop[0].hooks[0].command).toBe('/other/tool/stop.sh')
      expect(writtenContent.hooks.PostToolUse[0].hooks[0].command).toBe('/other/tool/post.sh')
    })

    it('preserves top-level non-hook settings fields', () => {
      const existingSettings = {
        theme: 'dark',
        someOtherKey: 42,
        hooks: {},
      }
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings))

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      const writtenContent = JSON.parse(
        mockWriteFileSync.mock.calls[0][1] as string,
      ) as { theme: string; someOtherKey: number }

      expect(writtenContent.theme).toBe('dark')
      expect(writtenContent.someOtherKey).toBe(42)
    })
  })

  // ── AC 1: Idempotency ────────────────────────────────────────────────────────

  describe('idempotency — VibeSense hooks already present', () => {
    it('skips write when both Stop and PostToolUse hooks are already registered', () => {
      const existingSettings = {
        hooks: {
          Stop: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: '/ext/scripts/hooks/stop.sh' }],
            },
          ],
          PostToolUse: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: '/ext/scripts/hooks/post-tool-use.sh' }],
            },
          ],
        },
      }
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings))

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockWriteFileSync).not.toHaveBeenCalled()
      expect(mockRenameSync).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('already present'),
      )
    })

    it('still writes if only Stop hook is already registered (PostToolUse missing)', () => {
      const existingSettings = {
        hooks: {
          Stop: [
            {
              matcher: '',
              hooks: [{ type: 'command', command: '/ext/scripts/hooks/stop.sh' }],
            },
          ],
        },
      }
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue(JSON.stringify(existingSettings))

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockWriteFileSync).toHaveBeenCalledOnce()
    })
  })

  // ── JSON parse failure ────────────────────────────────────────────────────────

  describe('JSON parse failure of existing settings.json', () => {
    it('falls back to empty object on invalid JSON and still writes hooks', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('NOT VALID JSON {{{')

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      // Should log a warning but not throw
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to parse'),
        expect.anything(),
      )

      // Should still attempt to write with fresh hooks
      expect(mockWriteFileSync).toHaveBeenCalledOnce()
    })

    it('does not throw on JSON parse failure (NFR-R1)', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{invalid json}')

      expect(() =>
        registerHooks(makeContext() as Parameters<typeof registerHooks>[0]),
      ).not.toThrow()
    })
  })

  // ── writeFileSync throws ──────────────────────────────────────────────────────

  describe('writeFileSync throws', () => {
    it('does not throw when writeFileSync fails (NFR-R1)', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })

      expect(() =>
        registerHooks(makeContext() as Parameters<typeof registerHooks>[0]),
      ).not.toThrow()
    })

    it('attempts to clean up .tmp file on writeFileSync failure', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockUnlinkSync).toHaveBeenCalledOnce()
      const unlinkedPath = mockUnlinkSync.mock.calls[0][0] as string
      expect(unlinkedPath).toContain('.tmp')
    })

    it('logs a warning on writeFileSync failure', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })

      registerHooks(makeContext() as Parameters<typeof registerHooks>[0])

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to write ~/.claude/settings.json'),
        expect.anything(),
      )
    })

    it('does not throw even when tmp cleanup (unlinkSync) also fails (NFR-R1)', () => {
      mockExistsSync.mockReturnValue(true)
      mockReadFileSync.mockReturnValue('{}')
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('disk full')
      })
      mockUnlinkSync.mockImplementation(() => {
        throw new Error('unlink failed')
      })

      expect(() =>
        registerHooks(makeContext() as Parameters<typeof registerHooks>[0]),
      ).not.toThrow()
    })
  })
})
