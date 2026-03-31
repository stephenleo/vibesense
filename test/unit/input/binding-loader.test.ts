// test/unit/input/binding-loader.test.ts
// Unit tests for loadBindings() — fs module and logger mocked

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockReadFileSync, mockLogger } = vi.hoisted(() => {
  return {
    mockReadFileSync: vi.fn(),
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
  readFileSync: mockReadFileSync,
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Mock vscode (needed transitively by logger at module level) ────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
  },
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { loadBindings } from '../../../src/extension/input/binding-loader'
import { CLAUDE_CODE_DEFAULT_BINDINGS } from '../../../src/extension/input/default-bindings'

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('loadBindings()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── File not found → defaults ──────────────────────────────────────────────
  describe('no vibesense.json present', () => {
    it('returns CLAUDE_CODE_DEFAULT_BINDINGS when file does not exist', () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockReadFileSync.mockImplementation(() => {
        throw enoentError
      })

      const result = loadBindings('/workspace')
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
    })

    it('logs at info level (no warning) for missing file', () => {
      const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      mockReadFileSync.mockImplementation(() => {
        throw enoentError
      })

      loadBindings('/workspace')
      expect(mockLogger.warn).not.toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        'BindingLoader: no vibesense.json found — using claude-code defaults',
      )
    })
  })

  // ── Valid JSON with valid bindings ─────────────────────────────────────────
  describe('valid vibesense.json', () => {
    it('returns bindings merged with defaults when file has valid bindings', () => {
      const profile = {
        profile: 'my-profile',
        bindings: {
          cross: 'custom.approve',
          square: 'custom.squareAction',
        },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      const result = loadBindings('/workspace')
      // Custom overrides defaults for cross
      expect(result.cross).toBe('custom.approve')
      // New binding added
      expect(result.square).toBe('custom.squareAction')
      // Defaults still present for unoverridden keys
      expect(result.circle).toBe('vibesense.deny')
    })

    it('logs info with profile name on successful load', () => {
      const profile = { profile: 'test-profile', bindings: {} }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      loadBindings('/workspace')
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("loaded profile 'test-profile'"),
      )
    })

    it("uses 'unnamed' when no profile name is provided", () => {
      const profile = { bindings: { cross: 'custom.approve' } }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      loadBindings('/workspace')
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("'unnamed'"))
    })

    it('returns CLAUDE_CODE_DEFAULT_BINDINGS when bindings key is absent', () => {
      const profile = { profile: 'no-bindings' }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      const result = loadBindings('/workspace')
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
    })
  })

  // ── Invalid JSON ───────────────────────────────────────────────────────────
  describe('invalid JSON', () => {
    it('returns CLAUDE_CODE_DEFAULT_BINDINGS when file contains invalid JSON', () => {
      mockReadFileSync.mockReturnValue('{ not valid json !!!')

      const result = loadBindings('/workspace')
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
    })

    it('logs a warning for invalid JSON', () => {
      mockReadFileSync.mockReturnValue('{ not valid json !!!')

      loadBindings('/workspace')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('error reading vibesense.json'),
        expect.anything(),
      )
    })

    it('does not throw for invalid JSON (NFR-R1)', () => {
      mockReadFileSync.mockReturnValue('{ not valid json !!!')
      expect(() => loadBindings('/workspace')).not.toThrow()
    })
  })

  // ── Zod validation failure ─────────────────────────────────────────────────
  describe('zod schema validation failure', () => {
    it('returns CLAUDE_CODE_DEFAULT_BINDINGS when bindings values are not strings', () => {
      // bindings values must be strings — provide a number to force schema failure
      const invalid = { bindings: { cross: 123 } }
      mockReadFileSync.mockReturnValue(JSON.stringify(invalid))

      const result = loadBindings('/workspace')
      expect(result).toEqual(CLAUDE_CODE_DEFAULT_BINDINGS)
    })

    it('logs a warning on zod validation failure', () => {
      const invalid = { bindings: { cross: 123 } }
      mockReadFileSync.mockReturnValue(JSON.stringify(invalid))

      loadBindings('/workspace')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'BindingLoader: invalid vibesense.json schema — using defaults',
      )
    })

    it('does not throw on zod validation failure (NFR-R1)', () => {
      const invalid = { bindings: { cross: 123 } }
      mockReadFileSync.mockReturnValue(JSON.stringify(invalid))
      expect(() => loadBindings('/workspace')).not.toThrow()
    })
  })

  // ── Unknown binding keys filtered ───────────────────────────────────────────
  describe('unknown binding key validation', () => {
    it('skips binding keys that are not valid ButtonId values', () => {
      const profile = {
        bindings: {
          cross: 'custom.approve',
          foobar: 'custom.unknown',
        },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      const result = loadBindings('/workspace')
      expect(result.cross).toBe('custom.approve')
      // foobar is not a valid ButtonId — should not appear in result
      expect((result as Record<string, string>)['foobar']).toBeUndefined()
    })

    it('logs a warning for each unknown binding key', () => {
      const profile = {
        bindings: {
          cross: 'custom.approve',
          foobar: 'custom.unknown',
          baz: 'custom.another',
        },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      loadBindings('/workspace')
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "BindingLoader: unknown button id 'foobar' in vibesense.json — skipped",
      )
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "BindingLoader: unknown button id 'baz' in vibesense.json — skipped",
      )
    })

    it('still includes valid keys alongside unknown ones', () => {
      const profile = {
        bindings: {
          circle: 'custom.deny',
          invalid_key: 'custom.nope',
        },
      }
      mockReadFileSync.mockReturnValue(JSON.stringify(profile))

      const result = loadBindings('/workspace')
      expect(result.circle).toBe('custom.deny')
      expect(result.cross).toBe('vibesense.approve') // default preserved
    })
  })
})
