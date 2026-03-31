// test/unit/input/profile-writer.test.ts
// Unit tests for ensureWorkspaceProfile() — fs module and logger mocked

import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as path from 'node:path'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockExistsSync, mockMkdirSync, mockWriteFileSync, mockLogger } = vi.hoisted(() => {
  return {
    mockExistsSync: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

// ── Mock node:fs ───────────────────────────────────────────────────────────────
vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Mock vscode (transitive dependency) ──────────────────────────────────────
vi.mock('vscode', () => ({
  window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn(), dispose: vi.fn() })) },
}))

import { ensureWorkspaceProfile } from '../../../src/extension/input/profile-writer'
import { CLAUDE_CODE_DEFAULT_PROFILE } from '../../../src/extension/input/profile-schema'

const WORKSPACE_ROOT = '/workspace'
const VSCODE_PATH = path.join(WORKSPACE_ROOT, '.vscode')
const PROFILE_PATH = path.join(VSCODE_PATH, 'vibesense.json')

describe('ensureWorkspaceProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does NOT write file when .vscode/vibesense.json already exists', () => {
    // existsSync returns true for profilePath on first call
    mockExistsSync.mockReturnValue(true)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockWriteFileSync).not.toHaveBeenCalled()
  })

  it('creates .vscode/ directory with { recursive: true } when it does not exist', () => {
    // profilePath does not exist, vscodePath does not exist
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(false)
    mockWriteFileSync.mockReturnValue(undefined)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockMkdirSync).toHaveBeenCalledWith(VSCODE_PATH, { recursive: true })
  })

  it('does not create .vscode/ directory when it already exists', () => {
    // profilePath does not exist, vscodePath exists
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockReturnValue(undefined)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockMkdirSync).not.toHaveBeenCalled()
  })

  it('writes JSON.stringify(profile, null, 2) to profilePath when file does not exist', () => {
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockReturnValue(undefined)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockWriteFileSync).toHaveBeenCalledWith(
      PROFILE_PATH,
      JSON.stringify(CLAUDE_CODE_DEFAULT_PROFILE, null, 2),
      'utf-8',
    )
  })

  it('logs info message after successful write', () => {
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockReturnValue(undefined)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockLogger.info).toHaveBeenCalledWith(
      'ProfileWriter: created .vscode/vibesense.json with default profile',
    )
  })

  it('does not throw when writeFileSync throws (NFR-R1)', () => {
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    expect(() => ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)).not.toThrow()
  })

  it('logs warn when write fails', () => {
    const error = new Error('EACCES: permission denied')
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockImplementation(() => {
      throw error
    })

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'ProfileWriter: failed to write .vscode/vibesense.json',
      error,
    )
  })

  it('written content is valid JSON matching the default profile', () => {
    mockExistsSync.mockReturnValueOnce(false).mockReturnValueOnce(true)
    mockWriteFileSync.mockReturnValue(undefined)

    ensureWorkspaceProfile(WORKSPACE_ROOT, CLAUDE_CODE_DEFAULT_PROFILE)

    const writtenContent = mockWriteFileSync.mock.calls[0][1] as string
    const parsed = JSON.parse(writtenContent)
    expect(parsed).toEqual(CLAUDE_CODE_DEFAULT_PROFILE)
  })
})
