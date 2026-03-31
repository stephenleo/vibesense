// test/unit/input/mode-manager.test.ts
// Unit tests for ModeManager — AC: 1, 2, 3, 4, 5
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  // Configuration-change listener captured at construction time
  let configChangeListener: ((e: { affectsConfiguration: (key: string) => boolean }) => void) | undefined

  // Simulated vscode configuration values — mutated per test.
  // Key is the bare config key passed to getConfiguration('vibesense').get('fullMode', false)
  const configValues: Record<string, unknown> = { fullMode: false }

  return {
    // Configuration values container — tests mutate this directly
    configValues,

    // onDidChangeConfiguration mock — captures the registered listener
    onDidChangeConfiguration: vi.fn((listener: (e: { affectsConfiguration: (key: string) => boolean }) => void) => {
      configChangeListener = listener
      return { dispose: vi.fn() }
    }),
    getConfigChangeListener: () => configChangeListener,

    // EventEmitter fire tracker
    eventEmitterFire: vi.fn(),
    eventEmitterDispose: vi.fn(),

    // logger mocks
    loggerInfo: vi.fn(),
    loggerWarn: vi.fn(),
    loggerError: vi.fn(),
    loggerDebug: vi.fn(),
  }
})

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => {
  return {
    EventEmitter: vi.fn(function () {
      // Per-instance listener list so each ModeManager gets its own emitter
      const instanceListeners: Array<(mode: string) => void> = []
      return {
        event: (listener: (mode: string) => void) => {
          instanceListeners.push(listener)
          return { dispose: vi.fn() }
        },
        fire: (value: string) => {
          mockState.eventEmitterFire(value)
          for (const l of instanceListeners) {
            l(value)
          }
        },
        dispose: () => {
          mockState.eventEmitterDispose()
        },
      }
    }),
    workspace: {
      // getConfiguration returns a live proxy that reads mockState.configValues at call time
      getConfiguration: () => ({
        get: (key: string, defaultValue?: unknown) =>
          key in mockState.configValues ? mockState.configValues[key] : defaultValue,
      }),
      onDidChangeConfiguration: (...args: Parameters<typeof mockState.onDidChangeConfiguration>) =>
        mockState.onDidChangeConfiguration(...args),
    },
  }
})

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: {
    info: (...args: unknown[]) => mockState.loggerInfo(...args),
    warn: (...args: unknown[]) => mockState.loggerWarn(...args),
    error: (...args: unknown[]) => mockState.loggerError(...args),
    debug: (...args: unknown[]) => mockState.loggerDebug(...args),
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { ModeManager } from '../../../src/extension/input/mode-manager'
import { GUIDED_MODE_BUTTON_IDS } from '../../../src/extension/input/default-bindings'
import type { BindingMap } from '../../../src/extension/input/default-bindings'
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal ExtensionContext stub with controllable globalState.
 */
function makeContext(storedMode?: string): vscode.ExtensionContext {
  return {
    globalState: {
      get: vi.fn((key: string) => (key === 'vibesense.mode' ? storedMode : undefined)),
      update: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as vscode.ExtensionContext
}

/** Full binding map that includes both core and non-core buttons */
const fullBindings: BindingMap = {
  // Guided core — DualSense
  cross: 'vibesense.approve',
  circle: 'vibesense.deny',
  l1: 'vibesense.switchSessionPrev',
  r1: 'vibesense.switchSessionNext',
  // Guided core — Xbox
  a: 'vibesense.approve',
  b: 'vibesense.deny',
  lb: 'vibesense.switchSessionPrev',
  rb: 'vibesense.switchSessionNext',
  // Non-core buttons (suppressed in Guided mode)
  square: 'vibesense.openTerminal',
  triangle: 'workbench.action.terminal.focus',
  l2: 'vibesense.openRadialWheel',
  r2: 'vibesense.openQuickPanel',
  options: 'vibesense.openSettings',
  x: 'vibesense.openTerminal',
  lt: 'vibesense.openRadialWheel',
  rt: 'vibesense.openQuickPanel',
  menu: 'vibesense.openSettings',
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ModeManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset config values to first-install defaults
    mockState.configValues['fullMode'] = false
  })

  // ── AC 1: First install defaults to Guided mode ───────────────────────────

  describe('initial mode — first install (AC 1)', () => {
    it('starts in Guided mode when no globalState and fullMode setting = false', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('guided')
    })

    it('starts in Full mode when no globalState but fullMode setting = true', () => {
      mockState.configValues['fullMode'] = true
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('full')
    })
  })

  // ── AC 4: Returning user — globalState wins ───────────────────────────────

  describe('initial mode — returning user (AC 4)', () => {
    it('starts in Full mode when globalState has mode = "full", even if setting = false', () => {
      mockState.configValues['fullMode'] = false
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('full')
    })

    it('starts in Guided mode when globalState has mode = "guided"', () => {
      mockState.configValues['fullMode'] = true // setting says Full, but globalState wins
      const ctx = makeContext('guided')
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('guided')
    })

    it('ignores unknown globalState values and falls back to setting', () => {
      mockState.configValues['fullMode'] = true
      const ctx = makeContext('unknown-value' as never)
      const manager = new ModeManager(ctx)
      // Falls back to setting which is true → Full
      expect(manager.mode).toBe('full')
    })
  })

  // ── AC 5: getFilteredBindings in Guided mode ──────────────────────────────

  describe('getFilteredBindings — Guided mode (AC 1, 5)', () => {
    it('returns only GUIDED_MODE_BUTTON_IDS keys in Guided mode', () => {
      const ctx = makeContext(undefined) // first install → guided
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('guided')

      const filtered = manager.getFilteredBindings(fullBindings)
      const filteredKeys = Object.keys(filtered)

      // All returned keys must be in the allowed set
      for (const key of filteredKeys) {
        expect(GUIDED_MODE_BUTTON_IDS.has(key as never)).toBe(true)
      }
    })

    it('includes all core DualSense buttons in Guided mode', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      const filtered = manager.getFilteredBindings(fullBindings)

      expect(filtered['cross']).toBe('vibesense.approve')
      expect(filtered['circle']).toBe('vibesense.deny')
      expect(filtered['l1']).toBe('vibesense.switchSessionPrev')
      expect(filtered['r1']).toBe('vibesense.switchSessionNext')
    })

    it('includes all core Xbox buttons in Guided mode', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      const filtered = manager.getFilteredBindings(fullBindings)

      expect(filtered['a']).toBe('vibesense.approve')
      expect(filtered['b']).toBe('vibesense.deny')
      expect(filtered['lb']).toBe('vibesense.switchSessionPrev')
      expect(filtered['rb']).toBe('vibesense.switchSessionNext')
    })

    it('suppresses non-core buttons in Guided mode (AC 5)', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      const filtered = manager.getFilteredBindings(fullBindings)

      // Non-core buttons must NOT appear in filtered map
      expect(filtered['square']).toBeUndefined()
      expect(filtered['triangle']).toBeUndefined()
      expect(filtered['l2']).toBeUndefined()
      expect(filtered['r2']).toBeUndefined()
      expect(filtered['options']).toBeUndefined()
      expect(filtered['x']).toBeUndefined()
      expect(filtered['lt']).toBeUndefined()
      expect(filtered['rt']).toBeUndefined()
      expect(filtered['menu']).toBeUndefined()
    })

    it('returns an empty object when fullBindings is empty', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      expect(manager.getFilteredBindings({})).toEqual({})
    })
  })

  // ── getFilteredBindings in Full mode ─────────────────────────────────────

  describe('getFilteredBindings — Full mode (AC 2, 3)', () => {
    it('returns all bindings unchanged in Full mode', () => {
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('full')

      const filtered = manager.getFilteredBindings(fullBindings)
      expect(filtered).toBe(fullBindings) // exact same reference — no copy
    })
  })

  // ── setFullMode (AC 2) ────────────────────────────────────────────────────

  describe('setFullMode() (AC 2)', () => {
    it('sets mode to "full"', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('guided')

      manager.setFullMode()

      expect(manager.mode).toBe('full')
    })

    it('calls globalState.update with ("vibesense.mode", "full")', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      manager.setFullMode()

      expect(ctx.globalState.update).toHaveBeenCalledWith('vibesense.mode', 'full')
    })

    it('fires onDidChangeMode event with "full"', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      const listener = vi.fn()
      manager.onDidChangeMode(listener)

      manager.setFullMode()

      expect(listener).toHaveBeenCalledWith('full')
    })

    it('catches errors and logs via logger.error — never rethrows (NFR-R1)', () => {
      const ctx = makeContext(undefined)
      ;(ctx.globalState.update as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('globalState write failed')
      })
      const manager = new ModeManager(ctx)

      expect(() => manager.setFullMode()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith(
        'ModeManager: setFullMode failed',
        expect.any(Error),
      )
    })

    it('is a no-op when already in Full mode — does not fire event or write globalState', () => {
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      const listener = vi.fn()
      manager.onDidChangeMode(listener)
      vi.clearAllMocks()

      manager.setFullMode()

      expect(listener).not.toHaveBeenCalled()
      expect(ctx.globalState.update).not.toHaveBeenCalled()
    })
  })

  // ── setGuidedMode (AC 3) ──────────────────────────────────────────────────

  describe('setGuidedMode()', () => {
    it('sets mode to "guided"', () => {
      const ctx = makeContext('full') // start in Full
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('full')

      manager.setGuidedMode()

      expect(manager.mode).toBe('guided')
    })

    it('calls globalState.update with ("vibesense.mode", "guided")', () => {
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      manager.setGuidedMode()

      expect(ctx.globalState.update).toHaveBeenCalledWith('vibesense.mode', 'guided')
    })

    it('fires onDidChangeMode event with "guided"', () => {
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      const listener = vi.fn()
      manager.onDidChangeMode(listener)

      manager.setGuidedMode()

      expect(listener).toHaveBeenCalledWith('guided')
    })

    it('catches errors and logs via logger.error — never rethrows (NFR-R1)', () => {
      const ctx = makeContext('full')
      ;(ctx.globalState.update as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
        throw new Error('globalState write failed')
      })
      const manager = new ModeManager(ctx)

      expect(() => manager.setGuidedMode()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith(
        'ModeManager: setGuidedMode failed',
        expect.any(Error),
      )
    })

    it('is a no-op when already in Guided mode — does not fire event or write globalState', () => {
      const ctx = makeContext(undefined) // starts guided
      const manager = new ModeManager(ctx)
      const listener = vi.fn()
      manager.onDidChangeMode(listener)
      vi.clearAllMocks()

      manager.setGuidedMode()

      expect(listener).not.toHaveBeenCalled()
      expect(ctx.globalState.update).not.toHaveBeenCalled()
    })
  })

  // ── onDidChangeConfiguration listener (AC 3) ──────────────────────────────

  describe('onDidChangeConfiguration — vibesense.fullMode (AC 3)', () => {
    it('calls setFullMode when fullMode setting changes to true', () => {
      const ctx = makeContext(undefined) // start guided
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('guided')

      // Simulate setting toggled to true
      mockState.configValues['fullMode'] = true
      const listener = mockState.getConfigChangeListener()
      listener?.({ affectsConfiguration: (key: string) => key === 'vibesense.fullMode' })

      expect(manager.mode).toBe('full')
    })

    it('calls setGuidedMode when fullMode setting changes to false', () => {
      const ctx = makeContext('full') // start full
      const manager = new ModeManager(ctx)
      expect(manager.mode).toBe('full')

      // Simulate setting toggled to false
      mockState.configValues['fullMode'] = false
      const listener = mockState.getConfigChangeListener()
      listener?.({ affectsConfiguration: (key: string) => key === 'vibesense.fullMode' })

      expect(manager.mode).toBe('guided')
    })

    it('does NOT react to configuration changes for other keys', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      const initialMode = manager.mode

      const listener = mockState.getConfigChangeListener()
      listener?.({ affectsConfiguration: (key: string) => key === 'editor.fontSize' })

      expect(manager.mode).toBe(initialMode)
    })
  })

  // ── dispose() ─────────────────────────────────────────────────────────────

  describe('dispose()', () => {
    it('does not throw when called', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      expect(() => manager.dispose()).not.toThrow()
    })
  })

  // ── logger usage ──────────────────────────────────────────────────────────

  describe('logger usage', () => {
    it('logs initial mode at info level', () => {
      const ctx = makeContext(undefined)
      new ModeManager(ctx)
      expect(mockState.loggerInfo).toHaveBeenCalledWith('ModeManager: initial mode = guided')
    })

    it('logs mode switch to Full at info level', () => {
      const ctx = makeContext(undefined)
      const manager = new ModeManager(ctx)
      vi.clearAllMocks()

      manager.setFullMode()

      expect(mockState.loggerInfo).toHaveBeenCalledWith('ModeManager: switched to Full mode')
    })

    it('logs mode switch to Guided at info level', () => {
      const ctx = makeContext('full')
      const manager = new ModeManager(ctx)
      vi.clearAllMocks()

      manager.setGuidedMode()

      expect(mockState.loggerInfo).toHaveBeenCalledWith('ModeManager: switched to Guided mode')
    })
  })
})
