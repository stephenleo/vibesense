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
    activeTerminal: undefined as typeof terminal | undefined,
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

  registerCommands(fakeContext)
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
    it('registers vibesense.openTerminal, vibesense.launchClaudeCode, vibesense.launchCopilotChat, and vibesense.voicePtt', () => {
      captureHandlers()
      const registeredIds = mockState.registerCommand.mock.calls.map(
        (call) => call[0] as string,
      )
      expect(registeredIds).toContain('vibesense.openTerminal')
      expect(registeredIds).toContain('vibesense.launchClaudeCode')
      expect(registeredIds).toContain('vibesense.launchCopilotChat')
      expect(registeredIds).toContain('vibesense.voicePtt')
    })

    it('pushes all disposables to context.subscriptions (auto-dispose on deactivation)', () => {
      const fakeSubscriptions: unknown[] = []
      mockState.registerCommand.mockReturnValue({ dispose: vi.fn() })
      const fakeContext = {
        subscriptions: { push: (...items: unknown[]) => fakeSubscriptions.push(...items) },
      } as unknown as import('vscode').ExtensionContext

      registerCommands(fakeContext)
      expect(fakeSubscriptions).toHaveLength(4)
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
})
