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
} as unknown as import('../../../../src/extension/panels/slide-panel-manager').SlidePanelManager

/**
 * Call registerCommands with a fake context and return a lookup map of
 * commandId → handler so each test can invoke handlers directly.
 */
function captureHandlers(): Record<string, () => void | Promise<void>> {
  const handlers: Record<string, () => void | Promise<void>> = {}
  mockState.registerCommand.mockImplementation((id: string, handler: () => void) => {
    handlers[id] = handler
    return { dispose: vi.fn() }
  })

  const fakeContext = {
    subscriptions: { push: vi.fn() },
  } as unknown as import('vscode').ExtensionContext

  registerCommands(fakeContext, fakeSlidePanelManager)
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
    it('registers vibesense.openTerminal, vibesense.launchClaudeCode, and vibesense.launchCopilotChat', () => {
      captureHandlers()
      const registeredIds = mockState.registerCommand.mock.calls.map(
        (call) => call[0] as string,
      )
      expect(registeredIds).toContain('vibesense.openTerminal')
      expect(registeredIds).toContain('vibesense.launchClaudeCode')
      expect(registeredIds).toContain('vibesense.launchCopilotChat')
    })

    it('pushes all disposables to context.subscriptions (auto-dispose on deactivation)', () => {
      const fakeSubscriptions: unknown[] = []
      mockState.registerCommand.mockReturnValue({ dispose: vi.fn() })
      const fakeContext = {
        subscriptions: { push: (...items: unknown[]) => fakeSubscriptions.push(...items) },
      } as unknown as import('vscode').ExtensionContext

      registerCommands(fakeContext, fakeSlidePanelManager)
      // 5 commands: openTerminal, launchClaudeCode, launchCopilotChat, switchSessionNext, switchSessionPrev
      expect(fakeSubscriptions).toHaveLength(5)
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
  })
})
