// test/unit/input/profile-manager.test.ts
// Unit tests for ProfileManager — vscode module mocked via vi.mock

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const { mockGetConfig, mockLogger } = vi.hoisted(() => {
  const mockGetConfig = vi.fn()
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
  return { mockGetConfig, mockLogger }
})

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: mockGetConfig,
    onDidChangeConfiguration: vi.fn(),
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

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { ProfileManager } from '../../../src/extension/input/profile-manager'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeConfigSection(values: Record<string, unknown>) {
  const mockUpdate = vi.fn().mockResolvedValue(undefined)
  const config = {
    get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      if (key in values) return values[key] as T
      return defaultValue
    }),
    update: mockUpdate,
  }
  mockGetConfig.mockReturnValue(config)
  return { config, mockUpdate }
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('ProfileManager', () => {
  let manager: ProfileManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new ProfileManager()
  })

  // ── getActiveProfileName() ─────────────────────────────────────────────────
  describe('getActiveProfileName()', () => {
    it('returns the configured activeProfile value when set', () => {
      makeConfigSection({ activeProfile: 'copilot-default' })

      const result = manager.getActiveProfileName()

      expect(result).toBe('copilot-default')
      expect(mockGetConfig).toHaveBeenCalledWith('vibesense')
    })

    it('returns "claude-code-default" when activeProfile is undefined', () => {
      makeConfigSection({})

      const result = manager.getActiveProfileName()

      expect(result).toBe('claude-code-default')
    })

    it('returns "claude-code-default" when get() returns undefined explicitly', () => {
      const config = { get: vi.fn().mockReturnValue(undefined) }
      mockGetConfig.mockReturnValue(config)

      const result = manager.getActiveProfileName()

      expect(result).toBe('claude-code-default')
    })
  })

  // ── setActiveProfileName() ─────────────────────────────────────────────────
  describe('setActiveProfileName()', () => {
    it('calls update with the correct key, value, and Global target', async () => {
      const { mockUpdate } = makeConfigSection({})

      await manager.setActiveProfileName('my-custom-profile')

      expect(mockUpdate).toHaveBeenCalledWith('activeProfile', 'my-custom-profile', 1) // 1 = ConfigurationTarget.Global
    })

    it('calls getConfiguration with "vibesense" section', async () => {
      makeConfigSection({})

      await manager.setActiveProfileName('some-profile')

      expect(mockGetConfig).toHaveBeenCalledWith('vibesense')
    })

    it('does not throw when update() rejects (NFR-R1)', async () => {
      const config = {
        get: vi.fn(),
        update: vi.fn().mockRejectedValue(new Error('Settings sync unavailable')),
      }
      mockGetConfig.mockReturnValue(config)

      await expect(manager.setActiveProfileName('bad-profile')).resolves.toBeUndefined()
    })

    it('logs an error when update() rejects without throwing', async () => {
      const config = {
        get: vi.fn(),
        update: vi.fn().mockRejectedValue(new Error('disk full')),
      }
      mockGetConfig.mockReturnValue(config)

      await manager.setActiveProfileName('failing-profile')

      expect(mockLogger.error).toHaveBeenCalledWith(
        'ProfileManager: failed to update activeProfile setting',
        expect.any(Error),
      )
    })
  })

  // ── getFullMode() ─────────────────────────────────────────────────────────
  describe('getFullMode()', () => {
    it('returns the configured fullMode value when set to true', () => {
      makeConfigSection({ fullMode: true })

      expect(manager.getFullMode()).toBe(true)
    })

    it('returns false when fullMode is undefined', () => {
      makeConfigSection({})

      expect(manager.getFullMode()).toBe(false)
    })

    it('returns false when get() returns undefined explicitly', () => {
      const config = { get: vi.fn().mockReturnValue(undefined) }
      mockGetConfig.mockReturnValue(config)

      expect(manager.getFullMode()).toBe(false)
    })

    it('returns false when fullMode is explicitly false', () => {
      makeConfigSection({ fullMode: false })

      expect(manager.getFullMode()).toBe(false)
    })
  })

  // ── getBatteryWarningEnabled() ─────────────────────────────────────────────
  describe('getBatteryWarningEnabled()', () => {
    it('returns the configured enableBatteryWarning value when set to false', () => {
      makeConfigSection({ enableBatteryWarning: false })

      expect(manager.getBatteryWarningEnabled()).toBe(false)
    })

    it('returns true when enableBatteryWarning is undefined', () => {
      makeConfigSection({})

      expect(manager.getBatteryWarningEnabled()).toBe(true)
    })

    it('returns true when get() returns undefined explicitly', () => {
      const config = { get: vi.fn().mockReturnValue(undefined) }
      mockGetConfig.mockReturnValue(config)

      expect(manager.getBatteryWarningEnabled()).toBe(true)
    })

    it('returns true when enableBatteryWarning is explicitly true', () => {
      makeConfigSection({ enableBatteryWarning: true })

      expect(manager.getBatteryWarningEnabled()).toBe(true)
    })
  })
})
