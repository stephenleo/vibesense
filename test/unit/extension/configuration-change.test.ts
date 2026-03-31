// test/unit/extension/configuration-change.test.ts
// Unit tests for the onDidChangeConfiguration handler added in Story 4.2.
// Tests that vibesense config changes trigger binding reloads and non-vibesense
// changes do not.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
const {
  mockLogger,
  mockLoadBindings,
  mockOnDidChangeConfiguration,
  mockExecuteCommand,
  mockGetConfig,
} = vi.hoisted(() => {
  return {
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    mockLoadBindings: vi.fn(),
    mockOnDidChangeConfiguration: vi.fn(),
    mockExecuteCommand: vi.fn(),
    mockGetConfig: vi.fn(() => ({ get: vi.fn() })),
  }
})

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: mockGetConfig,
    onDidChangeConfiguration: mockOnDidChangeConfiguration,
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
  },
  window: {
    createStatusBarItem: vi.fn(() => ({
      text: '',
      tooltip: '',
      backgroundColor: undefined,
      color: undefined,
      show: vi.fn(),
      dispose: vi.fn(),
    })),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
    })),
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showWebviewPanel: vi.fn(),
    createWebviewPanel: vi.fn(() => ({
      webview: {
        html: '',
        onDidReceiveMessage: vi.fn(() => ({ dispose: vi.fn() })),
        asWebviewUri: vi.fn((uri: unknown) => uri),
        postMessage: vi.fn(),
        cspSource: 'vscode-resource:',
      },
      onDidDispose: vi.fn(() => ({ dispose: vi.fn() })),
      reveal: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class {
    constructor(public id: string) {}
  },
  commands: {
    registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
    executeCommand: mockExecuteCommand,
  },
  Uri: {
    joinPath: vi.fn((base: unknown, ...parts: string[]) => ({
      toString: () => [base, ...parts].join('/'),
    })),
    file: vi.fn((p: string) => ({ fsPath: p })),
  },
  ViewColumn: { One: 1 },
  ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
  EventEmitter: class {
    event = vi.fn()
    fire = vi.fn()
    dispose = vi.fn()
  },
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
  disposeLogger: vi.fn(),
}))

// ── Mock binding-loader ────────────────────────────────────────────────────────
vi.mock('../../../src/extension/input/binding-loader', () => ({
  loadBindings: mockLoadBindings,
}))

// ── Mock profile-writer ────────────────────────────────────────────────────────
vi.mock('../../../src/extension/input/profile-writer', () => ({
  ensureWorkspaceProfile: vi.fn(),
}))

// ── Mock HID modules ───────────────────────────────────────────────────────────
vi.mock('../../../src/extension/hid/hid-manager', () => ({
  HidManager: vi.fn(function () {
    return { start: vi.fn().mockReturnValue(null), stop: vi.fn() }
  }),
}))

vi.mock('../../../src/extension/hid/controller-lifecycle-manager', () => ({
  ControllerLifecycleManager: vi.fn(function () {
    return { stop: vi.fn() }
  }),
}))

// ── Mock platform modules ──────────────────────────────────────────────────────
vi.mock('../../../src/extension/platform/permission-checker', () => ({
  checkHidAccess: vi.fn(() => ({ ok: true })),
  isHidPermissionError: vi.fn(() => false),
}))

vi.mock('../../../src/extension/platform/platform-guide', () => ({
  handleHidPermissionError: vi.fn(),
}))

vi.mock('../../../src/extension/platform/device-selector', () => ({
  showDeviceSelector: vi.fn(),
}))

// ── Mock panels and commands ───────────────────────────────────────────────────
vi.mock('../../../src/extension/panels/slide-panel-manager', () => ({
  SlidePanelManager: vi.fn(function () {
    return {
      updateSessions: vi.fn(),
      notifyControllerConnected: vi.fn(),
      dispose: vi.fn(),
    }
  }),
}))

vi.mock('../../../src/extension/commands/register', () => ({
  registerCommands: vi.fn(),
}))

// ── Mock AnalogScrollController (used by InputRouter) ─────────────────────────
vi.mock('../../../src/extension/input/analog-scroll-controller', () => ({
  AnalogScrollController: vi.fn(function () {
    return { update: vi.fn(), dispose: vi.fn() }
  }),
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import type { BindingMap } from '../../../src/extension/input/default-bindings'
import { activate } from '../../../src/extension/extension'

// ── Helpers ────────────────────────────────────────────────────────────────────
const defaultBindings: BindingMap = { cross: 'vibesense.approve', circle: 'vibesense.deny' }
const reloadedBindings: BindingMap = { cross: 'vibesense.approve', circle: 'custom.deny' }

function makeExtensionContext() {
  const subscriptions: { dispose: () => void }[] = []
  return {
    subscriptions,
    extensionUri: { fsPath: '/extension' },
    globalState: { get: vi.fn(), update: vi.fn(), setKeysForSync: vi.fn() },
    workspaceState: { get: vi.fn(), update: vi.fn() },
    asAbsolutePath: vi.fn((p: string) => `/extension/${p}`),
    extension: { packageJSON: { version: '0.1.0' } },
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('onDidChangeConfiguration handler (Story 4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLoadBindings.mockReturnValue(defaultBindings)
    // Capture the handler registered via onDidChangeConfiguration
    mockOnDidChangeConfiguration.mockReturnValue({ dispose: vi.fn() })
  })

  it('registers an onDidChangeConfiguration listener on activation', () => {
    const context = makeExtensionContext()
    activate(context as never)

    expect(mockOnDidChangeConfiguration).toHaveBeenCalledTimes(1)
    expect(typeof mockOnDidChangeConfiguration.mock.calls[0][0]).toBe('function')
  })

  it('reloads bindings when affectsConfiguration("vibesense") returns true', () => {
    const context = makeExtensionContext()
    activate(context as never)

    // Retrieve the registered handler (first argument of first call)
    const handler = mockOnDidChangeConfiguration.mock.calls[0][0] as (
      e: { affectsConfiguration: (section: string) => boolean },
    ) => void

    // Set up a new bindings value for the reload
    mockLoadBindings.mockReturnValue(reloadedBindings)

    // Simulate a vibesense configuration change event
    handler({ affectsConfiguration: (section: string) => section === 'vibesense' })

    // loadBindings should be called twice: once on activate, once on config change
    expect(mockLoadBindings).toHaveBeenCalledTimes(2)
    expect(mockLogger.info).toHaveBeenCalledWith(
      'VibeSense: bindings reloaded after configuration change',
    )
  })

  it('does NOT reload bindings when affectsConfiguration("vibesense") returns false', () => {
    const context = makeExtensionContext()
    activate(context as never)

    const handler = mockOnDidChangeConfiguration.mock.calls[0][0] as (
      e: { affectsConfiguration: (section: string) => boolean },
    ) => void

    // Reset call count after activation
    mockLoadBindings.mockClear()

    // Simulate an unrelated configuration change (e.g., editor font size)
    handler({ affectsConfiguration: (_section: string) => false })

    // loadBindings should NOT have been called again
    expect(mockLoadBindings).not.toHaveBeenCalled()
  })

  it('logs an error but does not throw when loadBindings throws during reload', () => {
    const context = makeExtensionContext()
    activate(context as never)

    const handler = mockOnDidChangeConfiguration.mock.calls[0][0] as (
      e: { affectsConfiguration: (section: string) => boolean },
    ) => void

    // Make loadBindings throw on the second call (config change reload)
    mockLoadBindings.mockImplementationOnce(() => {
      throw new Error('disk read error')
    })

    expect(() =>
      handler({ affectsConfiguration: (section: string) => section === 'vibesense' }),
    ).not.toThrow()

    expect(mockLogger.error).toHaveBeenCalledWith(
      'VibeSense: failed to reload bindings on config change',
      expect.any(Error),
    )
  })
})
