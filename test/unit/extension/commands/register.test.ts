// test/unit/extension/commands/register.test.ts
// Unit tests for registerCommands() — AC: 1, 2, 3, 4, 5
// All VSCode APIs mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock state (vi.hoisted ensures these are available before vi.mock hoisting) ──
const mockState = vi.hoisted(() => {
  const terminal = {
    show: vi.fn(),
    sendText: vi.fn(),
  }
  return {
    terminal,
    terminals: [] as { name: string; show: ReturnType<typeof vi.fn> }[],
    activeTerminal: undefined as { name: string; show: ReturnType<typeof vi.fn> } | undefined,
    createTerminal: vi.fn(() => terminal),
    setStatusBarMessage: vi.fn(),
    executeCommand: vi.fn(),
    registerCommand: vi.fn(),
    loggerError: vi.fn(),
    loggerWarn: vi.fn(),
    loggerInfo: vi.fn(),
    loggerDebug: vi.fn(),
  }
})

// ── Mock vscode ──────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  window: {
    createTerminal: (...args: Parameters<typeof mockState.createTerminal>) =>
      mockState.createTerminal(...args),
    get terminals() {
      return mockState.terminals
    },
    get activeTerminal() {
      return mockState.activeTerminal
    },
    setStatusBarMessage: (...args: Parameters<typeof mockState.setStatusBarMessage>) =>
      mockState.setStatusBarMessage(...args),
  },
  commands: {
    registerCommand: (...args: Parameters<typeof mockState.registerCommand>) =>
      mockState.registerCommand(...args),
    executeCommand: (...args: Parameters<typeof mockState.executeCommand>) =>
      mockState.executeCommand(...args),
  },
}))

// ── Mock logger ──────────────────────────────────────────────────────────────
vi.mock('../../../../src/extension/logger', () => ({
  logger: {
    debug: (...args: unknown[]) => mockState.loggerDebug(...args),
    info: (...args: unknown[]) => mockState.loggerInfo(...args),
    warn: (...args: unknown[]) => mockState.loggerWarn(...args),
    error: (...args: unknown[]) => mockState.loggerError(...args),
  },
}))

// ── Import after mocks ───────────────────────────────────────────────────────
import { registerCommands } from '../../../../src/extension/commands/register'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Minimal SlidePanelManager stub (Story 3.3 added slidePanelManager param)
const fakeSlidePanelManager = {
  notifySessionSwitched: vi.fn(),
  notifyQuickPanelOpen: vi.fn(),
  notifyQuickPanelClose: vi.fn(),
  notifyQuickPanelNavigate: vi.fn(),
  quickPanelNext: vi.fn(),
  quickPanelPrev: vi.fn(),
  notifyErrorMenuOpen: vi.fn(),
  notifyErrorMenuClose: vi.fn(),
} as unknown as import('../../../../src/extension/panels/slide-panel-manager').SlidePanelManager

// Minimal ModeManager stub (Story 4.3 added modeManager param)
const fakeModeManager = {
  setFullMode: vi.fn(),
  setGuidedMode: vi.fn(),
} as unknown as import('../../../../src/extension/input/mode-manager').ModeManager

// Minimal OnboardingPanelManager stub (Story 4.4 added onboardingPanelManager param)
const fakeOnboardingPanelManager = {
  open: vi.fn(),
  isOpen: vi.fn(() => false),
  notifyButtonPressed: vi.fn(),
  dispose: vi.fn(),
} as unknown as import('../../../../src/extension/panels/onboarding-panel').OnboardingPanelManager

// Minimal SessionManager stub (Story 5.5 added sessionManager param)
const fakeErrorFsm = { state: 'error' as const }
const fakeIdleFsm = { state: 'idle' as const, dispatch: vi.fn() }
const fakeSessionManager = {
  getSessions: vi.fn(() => new Map<string, { state: string }>()),
  getOrCreateFsm: vi.fn(() => fakeIdleFsm),
} as unknown as import('../../../../src/extension/session/session-manager').SessionManager

// Minimal LastCommandTracker stub (Story 5.5)
const fakeLastCommandTracker = {
  getLastCommand: vi.fn(() => undefined as string | undefined),
  setLastCommand: vi.fn(),
  clearSession: vi.fn(),
  dispose: vi.fn(),
} as unknown as import('../../../../src/extension/session/last-command-tracker').LastCommandTracker

/**
 * Call registerCommands with a fake context and return a lookup map of
 * commandId → handler so each test can invoke handlers directly.
 */
function captureHandlers(): Record<string, (...args: unknown[]) => void | Promise<void>> {
  const handlers: Record<string, (...args: unknown[]) => void | Promise<void>> = {}
  mockState.registerCommand.mockImplementation((id: string, handler: (...args: unknown[]) => void) => {
    handlers[id] = handler
    return { dispose: vi.fn() }
  })

  const fakeContext = {
    subscriptions: { push: vi.fn() },
  } as unknown as import('vscode').ExtensionContext

  registerCommands(fakeContext, fakeSlidePanelManager, fakeModeManager, fakeOnboardingPanelManager, fakeSessionManager, fakeLastCommandTracker)
  return handlers
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registerCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.activeTerminal = undefined
    mockState.terminal.show.mockReset()
    mockState.terminal.sendText.mockReset()
    // Default: createTerminal returns the mock terminal
    mockState.createTerminal.mockReturnValue(mockState.terminal)
    // Default: executeCommand resolves (Copilot installed)
    mockState.executeCommand.mockResolvedValue(undefined)
  })

  describe('registration', () => {
    it('registers all commands: openTerminal, launchClaudeCode, launchCopilotChat, voicePtt, switchSessionNext, switchSessionPrev, openQuickPanel, switchToSession, quickPanelNext, quickPanelPrev, completeTutorial, startOnboarding, openErrorMenu, errorRetryLastCommand, errorClearTerminal, errorViewLog', () => {
      captureHandlers()
      const registeredIds = mockState.registerCommand.mock.calls.map(
        (call) => call[0] as string,
      )
      expect(registeredIds).toContain('vibesense.openTerminal')
      expect(registeredIds).toContain('vibesense.launchClaudeCode')
      expect(registeredIds).toContain('vibesense.launchCopilotChat')
      expect(registeredIds).toContain('vibesense.voicePtt')
      expect(registeredIds).toContain('vibesense.switchSessionNext')
      expect(registeredIds).toContain('vibesense.switchSessionPrev')
      expect(registeredIds).toContain('vibesense.openQuickPanel')
      expect(registeredIds).toContain('vibesense.switchToSession')
      expect(registeredIds).toContain('vibesense.quickPanelNext')
      expect(registeredIds).toContain('vibesense.quickPanelPrev')
      expect(registeredIds).toContain('vibesense.completeTutorial')
      expect(registeredIds).toContain('vibesense.startOnboarding')
      expect(registeredIds).toContain('vibesense.openErrorMenu')
      expect(registeredIds).toContain('vibesense.errorRetryLastCommand')
      expect(registeredIds).toContain('vibesense.errorClearTerminal')
      expect(registeredIds).toContain('vibesense.errorViewLog')
    })

    it('pushes all disposables to context.subscriptions (auto-dispose on deactivation)', () => {
      const fakeSubscriptions: unknown[] = []
      mockState.registerCommand.mockReturnValue({ dispose: vi.fn() })
      const fakeContext = {
        subscriptions: { push: (...items: unknown[]) => fakeSubscriptions.push(...items) },
      } as unknown as import('vscode').ExtensionContext

      registerCommands(fakeContext, fakeSlidePanelManager, fakeModeManager, fakeOnboardingPanelManager, fakeSessionManager, fakeLastCommandTracker)
      // 18 commands: openTerminal, launchClaudeCode, launchCopilotChat, voicePtt,
      // switchSessionNext, switchSessionPrev, openQuickPanel, switchToSession,
      // quickPanelNext, quickPanelPrev, completeTutorial, startOnboarding,
      // openErrorMenu, errorRetryLastCommand, errorClearTerminal, errorViewLog,
      // dispatchPrompt, openRadialWheel (Story 7.1)
      expect(fakeSubscriptions).toHaveLength(18)
    })
  })

  describe('vibesense.openTerminal (AC: 1, 5)', () => {
    it('calls createTerminal({ name: "VibeSense" }) and show(false) to focus terminal', () => {
      const handlers = captureHandlers()
      handlers['vibesense.openTerminal']()

      expect(mockState.createTerminal).toHaveBeenCalledWith({ name: 'VibeSense' })
      expect(mockState.terminal.show).toHaveBeenCalledWith(false)
    })

    it('always creates a NEW terminal regardless of activeTerminal state (AC: 5)', () => {
      mockState.activeTerminal = mockState.terminal // a terminal already exists
      const handlers = captureHandlers()
      handlers['vibesense.openTerminal']()

      // Must still call createTerminal — never reuse the existing one
      expect(mockState.createTerminal).toHaveBeenCalledOnce()
      expect(mockState.createTerminal).toHaveBeenCalledWith({ name: 'VibeSense' })
    })

    it('catches errors and logs via logger.error — never re-throws (NFR-R1)', () => {
      const error = new Error('terminal API unavailable')
      mockState.createTerminal.mockImplementationOnce(() => {
        throw error
      })
      const handlers = captureHandlers()

      // Must not throw
      expect(() => handlers['vibesense.openTerminal']()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith('vibesense.openTerminal: failed', error)
    })
  })

  describe('vibesense.launchClaudeCode (AC: 2)', () => {
    it('sends "claude" with newline to activeTerminal when one exists', () => {
      mockState.activeTerminal = mockState.terminal
      const handlers = captureHandlers()
      handlers['vibesense.launchClaudeCode']()

      // Should NOT create a new terminal — reuse activeTerminal
      expect(mockState.createTerminal).not.toHaveBeenCalled()
      expect(mockState.terminal.show).toHaveBeenCalledWith(false)
      expect(mockState.terminal.sendText).toHaveBeenCalledWith('claude', true)
    })

    it('creates a terminal first when activeTerminal is undefined, then sends text', () => {
      mockState.activeTerminal = undefined
      const handlers = captureHandlers()
      handlers['vibesense.launchClaudeCode']()

      expect(mockState.createTerminal).toHaveBeenCalledWith({ name: 'VibeSense' })
      expect(mockState.terminal.show).toHaveBeenCalledWith(false)
      expect(mockState.terminal.sendText).toHaveBeenCalledWith('claude', true)
    })

    it('catches errors and logs via logger.error — never re-throws (NFR-R1)', () => {
      const error = new Error('sendText failed')
      const errorTerminal = {
        show: vi.fn(),
        sendText: vi.fn().mockImplementation(() => {
          throw error
        }),
      }
      mockState.activeTerminal = errorTerminal
      const handlers = captureHandlers()

      expect(() => handlers['vibesense.launchClaudeCode']()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith('vibesense.launchClaudeCode: failed', error)
    })
  })

  describe('vibesense.voicePtt (AC: 1, 2, 3)', () => {
    it('calls executeCommand("workbench.action.voiceChat.start") on invocation', async () => {
      mockState.executeCommand.mockResolvedValueOnce(undefined)
      const handlers = captureHandlers()
      handlers['vibesense.voicePtt']()

      await Promise.resolve()

      expect(mockState.executeCommand).toHaveBeenCalledWith('workbench.action.voiceChat.start')
    })

    it('shows mic-active status bar message when voice is available (AC: 1)', async () => {
      mockState.executeCommand.mockResolvedValueOnce(undefined)
      const handlers = captureHandlers()
      handlers['vibesense.voicePtt']()

      await Promise.resolve()

      expect(mockState.setStatusBarMessage).toHaveBeenCalledWith('$(mic) Voice input active', 5000)
      expect(mockState.loggerInfo).toHaveBeenCalledWith('vibesense.voicePtt: voice PTT activated')
    })

    it('shows non-blocking fallback message when voice is unavailable (AC: 2, NFR-I2, NFR-A3, NFR-R4)', async () => {
      mockState.executeCommand.mockRejectedValueOnce(new Error('command not found'))
      const handlers = captureHandlers()
      handlers['vibesense.voicePtt']()

      await Promise.resolve()

      expect(mockState.setStatusBarMessage).toHaveBeenCalledWith(
        'Voice input unavailable — use radial wheel or keyboard',
        5000,
      )
      expect(mockState.loggerWarn).toHaveBeenCalledWith(
        'vibesense.voicePtt: voice unavailable — VS Code Speech not installed or voice mode inactive',
      )
    })

    it('does NOT throw when executeCommand rejects — NFR-R1 zero-crash guarantee (AC: 3)', async () => {
      mockState.executeCommand.mockRejectedValueOnce(new Error('VS Code Speech not installed'))
      const handlers = captureHandlers()

      // Synchronous call must not throw
      expect(() => handlers['vibesense.voicePtt']()).not.toThrow()
      // Async rejection handler must also not propagate
      await Promise.resolve()
    })

    it('catches synchronous executeCommand throw and logs via logger.error — NFR-R1 (AC: 3)', () => {
      const error = new Error('executeCommand exploded synchronously')
      mockState.executeCommand.mockImplementationOnce(() => {
        throw error
      })
      const handlers = captureHandlers()

      expect(() => handlers['vibesense.voicePtt']()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith('vibesense.voicePtt: failed', error)
    })
  })

  describe('vibesense.launchCopilotChat (AC: 3, 4)', () => {
    it('calls executeCommand("workbench.action.chat.open") when Copilot is installed', async () => {
      mockState.executeCommand.mockResolvedValueOnce(undefined)
      const handlers = captureHandlers()
      handlers['vibesense.launchCopilotChat']()

      // Flush microtask queue so the .then() runs
      await Promise.resolve()

      expect(mockState.executeCommand).toHaveBeenCalledWith('workbench.action.chat.open')
      expect(mockState.setStatusBarMessage).not.toHaveBeenCalled()
    })

    it('shows non-blocking status bar message when executeCommand rejects (Copilot not installed) (AC: 4, NFR-A3, NFR-R4)', async () => {
      mockState.executeCommand.mockRejectedValueOnce(new Error('command not found'))
      const handlers = captureHandlers()
      handlers['vibesense.launchCopilotChat']()

      // Flush microtask queue so the rejection handler runs
      await Promise.resolve()

      expect(mockState.setStatusBarMessage).toHaveBeenCalledWith(
        'GitHub Copilot Chat not installed',
        5000,
      )
      expect(mockState.loggerWarn).toHaveBeenCalledWith(
        'vibesense.launchCopilotChat: Copilot Chat not installed',
      )
    })

    it('does NOT throw when executeCommand rejects — NFR-R1 zero-crash guarantee', async () => {
      mockState.executeCommand.mockRejectedValueOnce(new Error('not installed'))
      const handlers = captureHandlers()

      // The synchronous call must not throw
      expect(() => handlers['vibesense.launchCopilotChat']()).not.toThrow()
      // And the async rejection handler must also not propagate
      await Promise.resolve()
    })
  })

  // ── Session switching (Story 3.3) ─────────────────────────────────────────

  describe('vibesense.switchSessionNext (AC 1, 3, 4)', () => {
    // Convenience: 3-terminal array with fresh mocks
    function threeTerminals() {
      return [
        { name: 'VibeSense', show: vi.fn() },
        { name: 'Agent', show: vi.fn() },
        { name: 'Copilot', show: vi.fn() },
      ]
    }

    it('focuses the next terminal when 2+ terminals open', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[0]
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionNext']()
      expect(terms[1].show).toHaveBeenCalledWith(false)
    })

    it('wraps from last terminal to first (index wrap)', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[2]
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionNext']()
      expect(terms[0].show).toHaveBeenCalledWith(false)
    })

    it('calls notifySessionSwitched with correct args', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[0]
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionNext']()
      expect(fakeSlidePanelManager.notifySessionSwitched).toHaveBeenCalledWith(1, 'Agent', 3)
    })

    it('no-ops with only 1 terminal (AC 3)', () => {
      const solo = [{ name: 'Solo', show: vi.fn() }]
      mockState.terminals = solo
      mockState.activeTerminal = solo[0]
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionNext']()
      expect(solo[0].show).not.toHaveBeenCalled()
      expect(fakeSlidePanelManager.notifySessionSwitched).not.toHaveBeenCalled()
    })

    it('no-ops with 0 terminals (AC 4)', () => {
      mockState.terminals = []
      mockState.activeTerminal = undefined
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.switchSessionNext']()).not.toThrow()
      expect(fakeSlidePanelManager.notifySessionSwitched).not.toHaveBeenCalled()
    })

    it('starts from index 0 when no active terminal', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = undefined
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionNext']()
      expect(terms[0].show).toHaveBeenCalledWith(false)
      expect(fakeSlidePanelManager.notifySessionSwitched).toHaveBeenCalledWith(0, 'VibeSense', 3)
    })
  })

  describe('vibesense.switchSessionPrev (AC 2, 3, 4)', () => {
    function threeTerminals() {
      return [
        { name: 'VibeSense', show: vi.fn() },
        { name: 'Agent', show: vi.fn() },
        { name: 'Copilot', show: vi.fn() },
      ]
    }

    it('focuses the previous terminal when 2+ terminals open', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[1]
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionPrev']()
      expect(terms[0].show).toHaveBeenCalledWith(false)
    })

    it('wraps from first terminal to last (index wrap)', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[0]
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionPrev']()
      expect(terms[2].show).toHaveBeenCalledWith(false)
    })

    it('calls notifySessionSwitched with correct args', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = terms[2]
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionPrev']()
      expect(fakeSlidePanelManager.notifySessionSwitched).toHaveBeenCalledWith(1, 'Agent', 3)
    })

    it('no-ops with only 1 terminal (AC 3)', () => {
      const solo = [{ name: 'Solo', show: vi.fn() }]
      mockState.terminals = solo
      mockState.activeTerminal = solo[0]
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionPrev']()
      expect(solo[0].show).not.toHaveBeenCalled()
      expect(fakeSlidePanelManager.notifySessionSwitched).not.toHaveBeenCalled()
    })

    it('no-ops with 0 terminals (AC 4)', () => {
      mockState.terminals = []
      mockState.activeTerminal = undefined
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.switchSessionPrev']()).not.toThrow()
      expect(fakeSlidePanelManager.notifySessionSwitched).not.toHaveBeenCalled()
    })

    it('wraps to last terminal when no active terminal (treats as index 0)', () => {
      const terms = threeTerminals()
      mockState.terminals = terms
      mockState.activeTerminal = undefined
      fakeSlidePanelManager.notifySessionSwitched = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchSessionPrev']()
      expect(terms[2].show).toHaveBeenCalledWith(false)
      expect(fakeSlidePanelManager.notifySessionSwitched).toHaveBeenCalledWith(2, 'Copilot', 3)
    })
  })

  // ── Quick panel (Story 3.5 / FR14) ───────────────────────────────────────

  describe('vibesense.openQuickPanel (AC 1, 3)', () => {
    it('calls notifyQuickPanelOpen with empty sessions array when 0 terminals (AC 3 / empty state)', () => {
      mockState.terminals = []
      fakeSlidePanelManager.notifyQuickPanelOpen = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.openQuickPanel']()
      expect(fakeSlidePanelManager.notifyQuickPanelOpen).toHaveBeenCalledWith([], 0)
    })

    it('calls notifyQuickPanelOpen with sessions array of length 2 and selectedIndex=0 when 2 terminals (AC 1)', () => {
      const terms = [
        { name: 'VibeSense', show: vi.fn() },
        { name: 'Agent', show: vi.fn() },
      ]
      mockState.terminals = terms
      fakeSlidePanelManager.notifyQuickPanelOpen = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.openQuickPanel']()
      expect(fakeSlidePanelManager.notifyQuickPanelOpen).toHaveBeenCalledWith(
        [
          { sessionId: 'VibeSense', agentState: 'idle', label: 'VibeSense' },
          { sessionId: 'Agent', agentState: 'idle', label: 'Agent' },
        ],
        0,
      )
    })

    it('catches errors and does not propagate — NFR-R1', () => {
      fakeSlidePanelManager.notifyQuickPanelOpen = vi.fn().mockImplementation(() => {
        throw new Error('notifyQuickPanelOpen failed')
      })
      mockState.terminals = []
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.openQuickPanel']()).not.toThrow()
    })
  })

  describe('vibesense.switchToSession (AC 1, 2)', () => {
    it('focuses terminal at given index and calls notifyQuickPanelClose', () => {
      const terms = [
        { name: 'VibeSense', show: vi.fn() },
        { name: 'Agent', show: vi.fn() },
      ]
      mockState.terminals = terms
      fakeSlidePanelManager.notifyQuickPanelClose = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.switchToSession'](1)
      expect(terms[1].show).toHaveBeenCalledWith(false)
      expect(fakeSlidePanelManager.notifyQuickPanelClose).toHaveBeenCalledOnce()
    })

    it('does not call show when index is out of bounds — no error propagated (NFR-R1)', () => {
      const terms = [{ name: 'VibeSense', show: vi.fn() }]
      mockState.terminals = terms
      fakeSlidePanelManager.notifyQuickPanelClose = vi.fn()
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.switchToSession'](99)).not.toThrow()
      expect(terms[0].show).not.toHaveBeenCalled()
      // Panel close is still called even when terminal not found
      expect(fakeSlidePanelManager.notifyQuickPanelClose).toHaveBeenCalledOnce()
    })

    it('catches errors and does not propagate — NFR-R1', () => {
      mockState.terminals = []
      fakeSlidePanelManager.notifyQuickPanelClose = vi.fn().mockImplementation(() => {
        throw new Error('notifyQuickPanelClose failed')
      })
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.switchToSession'](0)).not.toThrow()
    })
  })

  // ── vibesense.completeTutorial (Story 4.3, AC 2) ─────────────────────────

  describe('vibesense.completeTutorial (AC 2)', () => {
    it('calls modeManager.setFullMode() once when invoked', () => {
      fakeModeManager.setFullMode = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.completeTutorial']()
      expect(fakeModeManager.setFullMode).toHaveBeenCalledOnce()
    })

    it('logs "vibesense.completeTutorial: Full mode unlocked" via logger.info', () => {
      fakeModeManager.setFullMode = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.completeTutorial']()
      expect(mockState.loggerInfo).toHaveBeenCalledWith(
        'vibesense.completeTutorial: Full mode unlocked',
      )
    })

    it('catches error if setFullMode throws and does not rethrow (NFR-R1)', () => {
      const error = new Error('setFullMode exploded')
      fakeModeManager.setFullMode = vi.fn().mockImplementation(() => {
        throw error
      })
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.completeTutorial']()).not.toThrow()
      expect(mockState.loggerError).toHaveBeenCalledWith(
        'vibesense.completeTutorial: failed',
        error,
      )
    })
  })

  // ── vibesense.openErrorMenu (Story 5.5 / FR56) ────────────────────────────

  describe('vibesense.openErrorMenu (AC 1)', () => {
    it('does NOT call notifyErrorMenuOpen when no sessions are in error state', () => {
      fakeSessionManager.getSessions = vi.fn(() => new Map())
      fakeSlidePanelManager.notifyErrorMenuOpen = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.openErrorMenu']()
      expect(fakeSlidePanelManager.notifyErrorMenuOpen).not.toHaveBeenCalled()
    })

    it('calls notifyErrorMenuOpen with the error session ID when one session is in error state', () => {
      fakeSessionManager.getSessions = vi.fn(() =>
        new Map([['error-session-1', fakeErrorFsm]]),
      )
      fakeLastCommandTracker.getLastCommand = vi.fn(() => undefined)
      fakeSlidePanelManager.notifyErrorMenuOpen = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.openErrorMenu']()
      expect(fakeSlidePanelManager.notifyErrorMenuOpen).toHaveBeenCalledWith('error-session-1', false)
    })

    it('sets hasLastCommand=true when lastCommandTracker has a command for the session', () => {
      fakeSessionManager.getSessions = vi.fn(() =>
        new Map([['error-session-2', fakeErrorFsm]]),
      )
      fakeLastCommandTracker.getLastCommand = vi.fn(() => 'claude')
      fakeSlidePanelManager.notifyErrorMenuOpen = vi.fn()
      const handlers = captureHandlers()
      handlers['vibesense.openErrorMenu']()
      expect(fakeSlidePanelManager.notifyErrorMenuOpen).toHaveBeenCalledWith('error-session-2', true)
    })

    it('does not propagate errors — NFR-R1', () => {
      fakeSessionManager.getSessions = vi.fn(() => {
        throw new Error('getSessions exploded')
      })
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.openErrorMenu']()).not.toThrow()
    })
  })

  // ── vibesense.errorClearTerminal (Story 5.5) ──────────────────────────────

  describe('vibesense.errorClearTerminal (AC 2)', () => {
    it('executes workbench.action.terminal.clear command', () => {
      mockState.executeCommand.mockResolvedValueOnce(undefined)
      const handlers = captureHandlers()
      handlers['vibesense.errorClearTerminal']()
      expect(mockState.executeCommand).toHaveBeenCalledWith('workbench.action.terminal.clear')
    })

    it('does not propagate errors — NFR-R1', () => {
      mockState.executeCommand.mockImplementationOnce(() => {
        throw new Error('executeCommand failed')
      })
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.errorClearTerminal']()).not.toThrow()
    })
  })

  // ── vibesense.errorViewLog (Story 5.5) ────────────────────────────────────

  describe('vibesense.errorViewLog (AC 2)', () => {
    it('sets a status bar message pointing to the error log', () => {
      const handlers = captureHandlers()
      handlers['vibesense.errorViewLog']()
      expect(mockState.setStatusBarMessage).toHaveBeenCalledWith(
        expect.stringContaining('error log'),
        5000,
      )
    })

    it('does not propagate errors — NFR-R1', () => {
      mockState.setStatusBarMessage.mockImplementationOnce(() => {
        throw new Error('setStatusBarMessage failed')
      })
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.errorViewLog']()).not.toThrow()
    })
  })

  // ── vibesense.errorRetryLastCommand (Story 5.5) ───────────────────────────

  describe('vibesense.errorRetryLastCommand (AC 2)', () => {
    it('calls terminal.sendText with the last command when active terminal and lastCommand exist', () => {
      mockState.activeTerminal = mockState.terminal
      fakeLastCommandTracker.getLastCommand = vi.fn(() => 'claude')
      fakeSessionManager.getOrCreateFsm = vi.fn(() => fakeIdleFsm)
      const handlers = captureHandlers()
      handlers['vibesense.errorRetryLastCommand']('session-1')
      expect(mockState.terminal.sendText).toHaveBeenCalledWith('claude', true)
    })

    it('falls back to runRecentCommand when no lastCommand is tracked', async () => {
      mockState.activeTerminal = mockState.terminal
      fakeLastCommandTracker.getLastCommand = vi.fn(() => undefined)
      mockState.executeCommand.mockResolvedValueOnce(undefined)
      fakeSessionManager.getOrCreateFsm = vi.fn(() => fakeIdleFsm)
      const handlers = captureHandlers()
      handlers['vibesense.errorRetryLastCommand']('session-1')
      await Promise.resolve()
      expect(mockState.executeCommand).toHaveBeenCalledWith('workbench.action.terminal.runRecentCommand')
    })

    it('does not throw when no active terminal — NFR-R1', () => {
      mockState.activeTerminal = undefined
      fakeLastCommandTracker.getLastCommand = vi.fn(() => undefined)
      fakeSessionManager.getOrCreateFsm = vi.fn(() => fakeIdleFsm)
      const handlers = captureHandlers()
      expect(() => handlers['vibesense.errorRetryLastCommand']('session-1')).not.toThrow()
    })

    it('does NOT dispatch AGENT_PROCESSING when no active terminal (no retry occurred)', () => {
      mockState.activeTerminal = undefined
      fakeLastCommandTracker.getLastCommand = vi.fn(() => 'claude')
      const mockFsm = { state: 'error' as const, dispatch: vi.fn() }
      fakeSessionManager.getOrCreateFsm = vi.fn(() => mockFsm)
      const handlers = captureHandlers()
      handlers['vibesense.errorRetryLastCommand']('session-no-terminal')
      expect(fakeSessionManager.getOrCreateFsm).not.toHaveBeenCalled()
    })

    it('dispatches AGENT_PROCESSING on the session FSM (AC 2)', () => {
      mockState.activeTerminal = mockState.terminal
      fakeLastCommandTracker.getLastCommand = vi.fn(() => 'claude')
      const mockFsm = { state: 'error' as const, dispatch: vi.fn() }
      fakeSessionManager.getOrCreateFsm = vi.fn(() => mockFsm)
      const handlers = captureHandlers()
      handlers['vibesense.errorRetryLastCommand']('session-err')
      expect(mockFsm.dispatch).toHaveBeenCalledWith('AGENT_PROCESSING')
    })
  })
})

