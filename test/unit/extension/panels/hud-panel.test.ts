// test/unit/extension/panels/hud-panel.test.ts
// Unit tests for HudPanelManager streaming methods — Story 10.1
// All VSCode APIs and logger mocked; no real VSCode process spawned.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mock state ────────────────────────────────────────────────────────
const mockState = vi.hoisted(() => {
  const postedMessages: unknown[] = []
  let disposeListener: (() => void) | undefined

  return {
    postedMessages,
    setDisposeListener: (l: () => void) => { disposeListener = l },
    getDisposeListener: () => disposeListener,
    panelDispose: vi.fn(),
    postMessage: vi.fn((msg: unknown) => {
      postedMessages.push(msg)
      return Promise.resolve(true)
    }),
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
            postMessage: mockState.postMessage,
            asWebviewUri: vi.fn((uri: unknown) => uri),
          },
          onDidDispose: vi.fn((l: () => void) => {
            mockState.setDisposeListener(l)
            return { dispose: vi.fn() }
          }),
          dispose: mockState.panelDispose,
        }
        return panel
      }),
    },
    Uri: {
      joinPath: vi.fn((...args: string[]) => args.join('/')),
    },
    ViewColumn: { Beside: 2 },
  }
})

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../../src/extension/logger', () => ({
  logger: {
    info: mockState.loggerInfo,
    warn: mockState.loggerWarn,
    error: mockState.loggerError,
    debug: mockState.loggerDebug,
  },
}))

import { HudPanelManager } from '../../../../src/extension/panels/hud-panel'

function makeContext(): { extensionUri: string; globalState: unknown; subscriptions: unknown[] } {
  return {
    extensionUri: '/fake/extension',
    globalState: {},
    subscriptions: [],
  }
}

describe('HudPanelManager — toggleStreamingMode (Story 10.1)', () => {
  beforeEach(() => {
    mockState.postedMessages.length = 0
    mockState.postMessage.mockClear()
    mockState.loggerInfo.mockClear()
    mockState.loggerError.mockClear()
  })

  it('creates panel and sends STREAMING_MODE_TOGGLED when enabled=true', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    // Wait for microtask queue to flush
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_MODE_TOGGLED',
    ) as { type: string; payload: { enabled: boolean } } | undefined
    expect(msg).toBeDefined()
    expect(msg?.payload.enabled).toBe(true)
  })

  it('returns true when streaming is enabled', () => {
    const manager = new HudPanelManager(makeContext() as never)
    const result = manager.toggleStreamingMode(true)
    expect(result).toBe(true)
  })

  it('returns false when streaming is disabled', () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    const result = manager.toggleStreamingMode(false)
    expect(result).toBe(false)
  })

  it('sends STREAMING_MODE_TOGGLED with enabled=false when disabling', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    mockState.postedMessages.length = 0
    manager.toggleStreamingMode(false)
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_MODE_TOGGLED',
    ) as { type: string; payload: { enabled: boolean } } | undefined
    expect(msg).toBeDefined()
    expect(msg?.payload.enabled).toBe(false)
  })

  it('sends STREAMING_BINDINGS_UPDATED when enabling with bindings', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    const bindings = { cross: 'vibesense.approve' }
    manager.toggleStreamingMode(true, bindings, 'dualsense', 'guided')
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_BINDINGS_UPDATED',
    ) as { type: string; payload: { bindings: Record<string, string> } } | undefined
    expect(msg).toBeDefined()
    expect(msg?.payload.bindings).toEqual(bindings)
  })

  it('isStreamingMode() returns false by default', () => {
    const manager = new HudPanelManager(makeContext() as never)
    expect(manager.isStreamingMode()).toBe(false)
  })

  it('isStreamingMode() returns true after enabling', () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    expect(manager.isStreamingMode()).toBe(true)
  })
})

describe('HudPanelManager — updateSessionState (Story 10.1)', () => {
  beforeEach(() => {
    mockState.postedMessages.length = 0
    mockState.postMessage.mockClear()
  })

  it('no-ops when streaming is disabled', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    // Create panel but don't enable streaming
    manager.toggle()
    mockState.postedMessages.length = 0
    manager.updateSessionState([{ sessionId: 's1', agentState: 'idle' }])
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_SESSION_STATE_CHANGED',
    )
    expect(msg).toBeUndefined()
  })

  it('sends STREAMING_SESSION_STATE_CHANGED when streaming is active', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    mockState.postedMessages.length = 0
    const sessions = [{ sessionId: 's1', agentState: 'processing' as const }]
    manager.updateSessionState(sessions)
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_SESSION_STATE_CHANGED',
    ) as { type: string; payload: { sessions: unknown[] } } | undefined
    expect(msg).toBeDefined()
    expect(msg?.payload.sessions).toEqual(sessions)
  })
})

describe('HudPanelManager — notifyButtonPressed (Story 10.2, AC3)', () => {
  beforeEach(() => {
    mockState.postedMessages.length = 0
    mockState.postMessage.mockClear()
    mockState.loggerError.mockClear()
  })

  it('sends STREAMING_BUTTON_PRESSED postMessage when streaming is active', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    mockState.postedMessages.length = 0
    manager.notifyButtonPressed('cross')
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_BUTTON_PRESSED',
    ) as { type: string; payload: { button: string } } | undefined
    expect(msg).toBeDefined()
    expect(msg?.payload.button).toBe('cross')
  })

  it('no-ops when streaming is disabled', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    // Create panel but do not enable streaming
    manager.toggle()
    mockState.postedMessages.length = 0
    manager.notifyButtonPressed('cross')
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_BUTTON_PRESSED',
    )
    expect(msg).toBeUndefined()
  })

  it('no-ops when panel is not created', async () => {
    const manager = new HudPanelManager(makeContext() as never)
    // Enable streaming flag but panel not created (simulate direct state without panel)
    // toggleStreamingMode(false) keeps streamingMode=false so we can't create without a panel
    // Instead verify that calling on a brand-new manager (no panel, no streaming) is a no-op
    manager.notifyButtonPressed('cross')
    await Promise.resolve()
    const msg = mockState.postedMessages.find(
      (m) => (m as { type: string }).type === 'STREAMING_BUTTON_PRESSED',
    )
    expect(msg).toBeUndefined()
  })
})

describe('HudPanelManager — dispose resets streaming state (Story 10.1)', () => {
  it('resets streamingMode to false on dispose', () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    expect(manager.isStreamingMode()).toBe(true)
    manager.dispose()
    expect(manager.isStreamingMode()).toBe(false)
  })

  it('resets streamingMode to false on external panel dispose (onDidDispose)', () => {
    const manager = new HudPanelManager(makeContext() as never)
    manager.toggleStreamingMode(true)
    expect(manager.isStreamingMode()).toBe(true)
    // Simulate external panel close (user closes the tab)
    const disposeListener = mockState.getDisposeListener()
    expect(disposeListener).toBeDefined()
    disposeListener!()
    expect(manager.isStreamingMode()).toBe(false)
  })
})
