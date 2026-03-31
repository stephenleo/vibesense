// test/unit/extension/onboarding-panel.test.ts
// Unit tests for OnboardingPanelManager — AC: 1, 2, 3, 4, 5
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  // Captured message listener from webview.onDidReceiveMessage
  let messageListener: ((raw: unknown) => void) | undefined
  // Captured dispose listener from panel.onDidDispose
  let disposeListener: (() => void) | undefined
  // Track postMessage calls
  const postedMessages: unknown[] = []
  // Track executeCommand calls
  const executedCommands: string[] = []
  // Track globalState updates
  const globalStateUpdates: Array<[string, unknown]> = []

  return {
    // Webview mock
    webviewHtml: { value: '' },
    postedMessages,
    setMessageListener: (l: (raw: unknown) => void) => {
      messageListener = l
    },
    getMessageListener: () => messageListener,
    setDisposeListener: (l: () => void) => {
      disposeListener = l
    },
    getDisposeListener: () => disposeListener,

    // Commands mock
    executedCommands,

    // GlobalState mock
    globalStateUpdates,

    // Panel dispose mock
    panelDispose: vi.fn(),

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
    window: {
      createWebviewPanel: vi.fn(() => {
        const panel = {
          webview: {
            html: '',
            postMessage: vi.fn((msg: unknown) => {
              mockState.postedMessages.push(msg)
              return Promise.resolve()
            }),
            onDidReceiveMessage: vi.fn((listener: (raw: unknown) => void) => {
              mockState.setMessageListener(listener)
              return { dispose: vi.fn() }
            }),
            asWebviewUri: vi.fn((uri: unknown) => uri),
          },
          onDidDispose: vi.fn((listener: () => void) => {
            mockState.setDisposeListener(listener)
            return { dispose: vi.fn() }
          }),
          dispose: mockState.panelDispose,
          reveal: vi.fn(),
        }
        return panel
      }),
    },
    ViewColumn: {
      One: 1,
      Beside: 2,
    },
    Uri: {
      joinPath: vi.fn((..._args: unknown[]) => 'mock-uri'),
    },
    commands: {
      executeCommand: vi.fn((cmd: string) => {
        mockState.executedCommands.push(cmd)
        return Promise.resolve()
      }),
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
import { OnboardingPanelManager } from '../../../src/extension/panels/onboarding-panel'
import type * as vscode from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContext(): vscode.ExtensionContext {
  return {
    extensionUri: 'mock-extension-uri' as unknown as vscode.Uri,
    globalState: {
      get: vi.fn(() => undefined),
      update: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as vscode.ExtensionContext
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingPanelManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.postedMessages.length = 0
    mockState.executedCommands.length = 0
    mockState.globalStateUpdates.length = 0
  })

  // ── open() creates panel and sends ONBOARDING_INIT ───────────────────────

  describe('open() — creates panel (AC 1)', () => {
    it('creates a WebviewPanel with correct viewType and title', async () => {
      const vscode = await import('vscode')
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)

      manager.open('dualsense')

      expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
        'vibesense.onboarding',
        'VibeSense Onboarding',
        expect.objectContaining({ viewColumn: 1 }),
        expect.objectContaining({ enableScripts: true }),
      )
    })

    it('sends ONBOARDING_INIT HostMessage on open', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)

      manager.open('dualsense')

      const initMsg = mockState.postedMessages.find(
        (m) => (m as { type: string }).type === 'ONBOARDING_INIT',
      )
      expect(initMsg).toBeDefined()
      expect((initMsg as { type: string; payload: { controllerType: string } }).payload.controllerType).toBe('dualsense')
    })

    it('sends ONBOARDING_INIT with null controllerType when null passed', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)

      manager.open(null)

      const initMsg = mockState.postedMessages.find(
        (m) => (m as { type: string }).type === 'ONBOARDING_INIT',
      )
      expect(initMsg).toBeDefined()
      expect((initMsg as { type: string; payload: { controllerType: unknown } }).payload.controllerType).toBeNull()
    })
  })

  // ── open() called twice disposes first panel (AC 4) ─────────────────────

  describe('open() called twice — always starts fresh (AC 4)', () => {
    it('disposes the first panel before creating a second', async () => {
      const vscode = await import('vscode')
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)

      manager.open('dualsense')
      manager.open('xbox')

      // createWebviewPanel should have been called twice
      expect(vscode.window.createWebviewPanel).toHaveBeenCalledTimes(2)
      // First panel's dispose should have been called
      expect(mockState.panelDispose).toHaveBeenCalled()
    })
  })

  // ── ONBOARDING_COMPLETE message handling (AC 3) ──────────────────────────

  describe('ONBOARDING_COMPLETE message (AC 3)', () => {
    it('executes vibesense.completeTutorial command', async () => {
      const vscode = await import('vscode')
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      const listener = mockState.getMessageListener()
      expect(listener).toBeDefined()

      listener?.({ type: 'ONBOARDING_COMPLETE', payload: {} })

      // Wait for async operations to settle
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vibesense.completeTutorial')
    })

    it('sets globalState.onboardingComplete to true', async () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      const listener = mockState.getMessageListener()
      listener?.({ type: 'ONBOARDING_COMPLETE', payload: {} })

      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(ctx.globalState.update).toHaveBeenCalledWith('vibesense.onboardingComplete', true)
    })
  })

  // ── ONBOARDING_DISMISSED message handling ────────────────────────────────

  describe('ONBOARDING_DISMISSED message', () => {
    it('disposes the panel without calling completeTutorial', async () => {
      const vscode = await import('vscode')
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      const listener = mockState.getMessageListener()
      listener?.({ type: 'ONBOARDING_DISMISSED', payload: {} })

      await new Promise((resolve) => setTimeout(resolve, 10))

      // completeTutorial should NOT be called
      expect(vscode.commands.executeCommand).not.toHaveBeenCalledWith('vibesense.completeTutorial')
      // Panel should be disposed
      expect(mockState.panelDispose).toHaveBeenCalled()
    })
  })

  // ── notifyButtonPressed() ────────────────────────────────────────────────

  describe('notifyButtonPressed()', () => {
    it('posts ONBOARDING_BUTTON_PRESSED when panel is open', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      mockState.postedMessages.length = 0 // clear ONBOARDING_INIT

      manager.notifyButtonPressed('cross')

      const msg = mockState.postedMessages.find(
        (m) => (m as { type: string }).type === 'ONBOARDING_BUTTON_PRESSED',
      )
      expect(msg).toBeDefined()
      expect((msg as { type: string; payload: { button: string } }).payload.button).toBe('cross')
    })

    it('is a no-op when panel is closed', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      // Panel not opened

      manager.notifyButtonPressed('cross')

      const msg = mockState.postedMessages.find(
        (m) => (m as { type: string }).type === 'ONBOARDING_BUTTON_PRESSED',
      )
      expect(msg).toBeUndefined()
    })
  })

  // ── isOpen() ─────────────────────────────────────────────────────────────

  describe('isOpen()', () => {
    it('returns true when panel is open', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      expect(manager.isOpen()).toBe(true)
    })

    it('returns false before any panel is opened', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)

      expect(manager.isOpen()).toBe(false)
    })

    it('returns false after dispose()', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      manager.dispose()

      expect(manager.isOpen()).toBe(false)
    })

    it('returns false when panel fires onDidDispose', () => {
      const ctx = makeContext()
      const manager = new OnboardingPanelManager(ctx)
      manager.open('dualsense')

      // Simulate the panel being disposed externally (user closes the panel)
      const disposeListener = mockState.getDisposeListener()
      disposeListener?.()

      expect(manager.isOpen()).toBe(false)
    })
  })
})
