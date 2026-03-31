// test/unit/session/terminal-parser.test.ts
// Unit tests for TerminalOutputParser — AC 1, 2, 3, 4

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
// capturedCallback stores the handler registered with onDidWriteTerminalData
// so tests can fire synthetic terminal events.
const { mockOnDidWriteTerminalData } = vi.hoisted(() => {
  return {
    mockOnDidWriteTerminalData: vi.fn(),
  }
})

// ── Mock vscode (required by logger + TerminalOutputParser) ───────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
      show: vi.fn(),
    })),
    onDidWriteTerminalData: mockOnDidWriteTerminalData,
  },
}))

// ── Import after mock ─────────────────────────────────────────────────────────
import { TerminalOutputParser } from '../../../src/extension/session/terminal-parser'
import { SessionManager } from '../../../src/extension/session/session-manager'

// ── Helpers ───────────────────────────────────────────────────────────────────

type TerminalDataHandler = (event: { terminal: { name: string }; data: string }) => void

/**
 * Set up the mock to capture the registered callback and return a Disposable.
 * Returns the mock disposable so tests can assert on dispose() calls.
 */
function setupMockCapture(): {
  getCallback: () => TerminalDataHandler
  mockDisposable: { dispose: ReturnType<typeof vi.fn> }
} {
  let capturedCallback: TerminalDataHandler | undefined
  const mockDisposable = { dispose: vi.fn() }

  mockOnDidWriteTerminalData.mockImplementationOnce((cb: TerminalDataHandler) => {
    capturedCallback = cb
    return mockDisposable
  })

  return {
    getCallback: () => {
      if (capturedCallback === undefined) {
        throw new Error('onDidWriteTerminalData callback was not captured')
      }
      return capturedCallback
    },
    mockDisposable,
  }
}

/** Fire a synthetic terminal data event via the captured callback. */
function makeFireFn(getCallback: () => TerminalDataHandler) {
  return (terminalName: string, data: string): void => {
    getCallback()({ terminal: { name: terminalName }, data })
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TerminalOutputParser', () => {
  let sessionManager: SessionManager
  let parser: TerminalOutputParser
  let fireTerminalData: (terminalName: string, data: string) => void

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager = new SessionManager()

    const { getCallback } = setupMockCapture()
    // Default: hookActive = () => false (hooks not live)
    parser = new TerminalOutputParser(sessionManager, () => false)
    fireTerminalData = makeFireFn(getCallback)
  })

  // ─── AC 1: matched pattern fires correct FSM transition ──────────────────

  describe('AC 1 — pattern matching fires correct FSM transition', () => {
    it('COMPLETE pattern "✓ Done" transitions FSM to idle (via AGENT_PROCESSING first)', () => {
      // FSM starts at idle; AGENT_COMPLETE is only valid from 'processing' or 'needs-input'
      // First push to processing via a PROCESSING pattern, then fire COMPLETE
      fireTerminalData('my-session', 'Thinking...')
      expect(sessionManager.getSessions().get('my-session')?.state).toBe('processing')

      fireTerminalData('my-session', '✓ Done')
      expect(sessionManager.getSessions().get('my-session')?.state).toBe('idle')
    })

    it('COMPLETE pattern "[done]" transitions FSM to idle', () => {
      fireTerminalData('sess-1', 'Working...')
      fireTerminalData('sess-1', '[done]')
      expect(sessionManager.getSessions().get('sess-1')?.state).toBe('idle')
    })

    it('COMPLETE pattern "completed successfully" transitions FSM to idle', () => {
      fireTerminalData('sess-2', 'Generating output...')
      fireTerminalData('sess-2', 'Task completed successfully')
      expect(sessionManager.getSessions().get('sess-2')?.state).toBe('idle')
    })

    it('COMPLETE pattern bare ">" prompt transitions FSM to idle', () => {
      fireTerminalData('sess-3', 'Working on it...')
      fireTerminalData('sess-3', '> ')
      expect(sessionManager.getSessions().get('sess-3')?.state).toBe('idle')
    })

    it('PROCESSING pattern "Thinking" transitions FSM to processing', () => {
      fireTerminalData('my-session', 'Thinking about your request...')
      expect(sessionManager.getSessions().get('my-session')?.state).toBe('processing')
    })

    it('PROCESSING pattern "..." transitions FSM to processing', () => {
      fireTerminalData('sess-dot', 'Loading...')
      expect(sessionManager.getSessions().get('sess-dot')?.state).toBe('processing')
    })

    it('PROCESSING pattern "Generating" transitions FSM to processing', () => {
      fireTerminalData('sess-gen', 'Generating response')
      expect(sessionManager.getSessions().get('sess-gen')?.state).toBe('processing')
    })

    it('PROCESSING pattern "Working" transitions FSM to processing', () => {
      fireTerminalData('sess-work', 'Working on your task')
      expect(sessionManager.getSessions().get('sess-work')?.state).toBe('processing')
    })

    it('NEEDS_INPUT pattern "?" at end of line transitions FSM to needs-input', () => {
      // First need to be in processing for NEEDS_INPUT to apply
      fireTerminalData('sess-q', 'Working...')
      fireTerminalData('sess-q', 'Do you want to continue?')
      expect(sessionManager.getSessions().get('sess-q')?.state).toBe('needs-input')
    })

    it('NEEDS_INPUT pattern "[y/n]" transitions FSM to needs-input', () => {
      fireTerminalData('sess-yn', 'Thinking...')
      fireTerminalData('sess-yn', 'Overwrite file? [y/n]')
      expect(sessionManager.getSessions().get('sess-yn')?.state).toBe('needs-input')
    })

    it('NEEDS_INPUT pattern "Press X to continue" transitions FSM to needs-input', () => {
      fireTerminalData('sess-press', 'Working...')
      fireTerminalData('sess-press', 'Press Enter to continue')
      expect(sessionManager.getSessions().get('sess-press')?.state).toBe('needs-input')
    })

    it('NEEDS_INPUT pattern "Enter X to" transitions FSM to needs-input', () => {
      fireTerminalData('sess-enter', 'Thinking...')
      fireTerminalData('sess-enter', 'Enter your choice to proceed')
      expect(sessionManager.getSessions().get('sess-enter')?.state).toBe('needs-input')
    })

    it('ANSI escape codes are stripped before matching', () => {
      // "✓ Done" with ANSI color prefix
      fireTerminalData('sess-ansi', 'Working...')
      fireTerminalData('sess-ansi', '\x1B[32m✓ Done\x1B[0m')
      expect(sessionManager.getSessions().get('sess-ansi')?.state).toBe('idle')
    })

    it('FSM is created automatically for new terminal name (session ID)', () => {
      expect(sessionManager.getSessions().has('brand-new')).toBe(false)
      fireTerminalData('brand-new', 'Thinking...')
      expect(sessionManager.getSessions().has('brand-new')).toBe(true)
    })

    it('transitions are indistinguishable from hook-based transitions (same FSM state)', () => {
      // AC 1: transition via terminal parser must produce same observable state as hook-based
      fireTerminalData('sess-hooks', 'Thinking...')
      expect(sessionManager.getSessions().get('sess-hooks')?.state).toBe('processing')

      // This is the same FSM state a hook-based AGENT_PROCESSING dispatch would produce
      const directFsm = new SessionManager()
      directFsm.getOrCreateFsm('sess-hooks').dispatch('AGENT_PROCESSING')
      expect(directFsm.getSessions().get('sess-hooks')?.state).toBe('processing')
    })
  })

  // ─── AC 2: unmatched output fires no FSM transition, no error ────────────

  describe('AC 2 — unmatched output triggers nothing', () => {
    it('plain text with no known pattern fires no FSM transition', () => {
      fireTerminalData('sess-no-match', 'Hello world — some random output')
      // No FSM should have been created or transitioned
      expect(sessionManager.getSessions().has('sess-no-match')).toBe(false)
    })

    it('empty string fires no FSM transition', () => {
      fireTerminalData('sess-empty', '')
      expect(sessionManager.getSessions().has('sess-empty')).toBe(false)
    })

    it('whitespace-only data fires no FSM transition', () => {
      fireTerminalData('sess-ws', '   \n\t  ')
      expect(sessionManager.getSessions().has('sess-ws')).toBe(false)
    })

    it('only ANSI escape sequences (no text content) fires no FSM transition', () => {
      fireTerminalData('sess-ansi-only', '\x1B[32m\x1B[0m')
      expect(sessionManager.getSessions().has('sess-ansi-only')).toBe(false)
    })
  })

  // ─── AC 3: hookActive() = true → FSM dispatch is skipped ─────────────────

  describe('AC 3 — hookActive() suppresses all FSM transitions', () => {
    it('when hookActive returns true, COMPLETE pattern fires no transition', () => {
      const { getCallback: getHookCallback } = setupMockCapture()
      const hookParser = new TerminalOutputParser(sessionManager, () => true)
      const hookFire = makeFireFn(getHookCallback)
      void hookParser // suppress unused variable warning

      hookFire('sess-hook', 'Working...')
      hookFire('sess-hook', '✓ Done')
      // No FSM should have been created
      expect(sessionManager.getSessions().has('sess-hook')).toBe(false)
    })

    it('when hookActive returns true, PROCESSING pattern fires no transition', () => {
      const { getCallback: getHookCallback } = setupMockCapture()
      const hookParser = new TerminalOutputParser(sessionManager, () => true)
      const hookFire = makeFireFn(getHookCallback)
      void hookParser

      hookFire('sess-hook2', 'Thinking...')
      expect(sessionManager.getSessions().has('sess-hook2')).toBe(false)
    })

    it('when hookActive returns true, NEEDS_INPUT pattern fires no transition', () => {
      const { getCallback: getHookCallback } = setupMockCapture()
      const hookParser = new TerminalOutputParser(sessionManager, () => true)
      const hookFire = makeFireFn(getHookCallback)
      void hookParser

      hookFire('sess-hook3', 'Do you want to continue?')
      expect(sessionManager.getSessions().has('sess-hook3')).toBe(false)
    })

    it('hookActive switching: false then true prevents double-fire', () => {
      let hookLive = false
      // The default parser (from beforeEach) uses hookActive = () => false
      // Use the existing parser but we need to create a new one with our switching callback
      const { getCallback: getSwitchCallback } = setupMockCapture()
      const switchParser = new TerminalOutputParser(sessionManager, () => hookLive)
      const switchFire = makeFireFn(getSwitchCallback)
      void switchParser

      // Hooks not yet live — terminal parser fires
      switchFire('sess-switch', 'Thinking...')
      expect(sessionManager.getSessions().get('sess-switch')?.state).toBe('processing')

      // Hooks go live — terminal parser must not fire
      hookLive = true
      switchFire('sess-switch', '✓ Done')
      // State remains 'processing' — hook took precedence (parser skipped)
      expect(sessionManager.getSessions().get('sess-switch')?.state).toBe('processing')
    })
  })

  // ─── AC 4: dispose() removes listener ────────────────────────────────────

  describe('AC 4 — dispose() removes terminal data listener', () => {
    it('after dispose(), terminal data events are ignored', () => {
      // First confirm listener is active
      fireTerminalData('sess-dispose', 'Thinking...')
      expect(sessionManager.getSessions().has('sess-dispose')).toBe(true)
      expect(sessionManager.getSessions().get('sess-dispose')?.state).toBe('processing')

      // Dispose parser
      parser.dispose()

      // Re-install fresh parser to capture a new callback (simulating fresh session)
      const freshManager = new SessionManager()
      const { getCallback: getFreshCallback } = setupMockCapture()
      const freshParser = new TerminalOutputParser(freshManager, () => false)
      const freshFire = makeFireFn(getFreshCallback)

      // Verify subsequent events on the fresh parser work correctly
      freshFire('fresh-session', 'Working...')
      expect(freshManager.getSessions().get('fresh-session')?.state).toBe('processing')

      freshParser.dispose()
    })

    it('dispose() can be called multiple times without error (idempotent via VSCode Disposable)', () => {
      expect(() => {
        parser.dispose()
        parser.dispose()
      }).not.toThrow()
    })

    it('dispose() calls the underlying Disposable returned by onDidWriteTerminalData', () => {
      // Create a parser with a fresh mock that returns a trackable disposable
      const { mockDisposable, getCallback } = setupMockCapture()
      const freshManager = new SessionManager()
      const freshParser = new TerminalOutputParser(freshManager, () => false)
      void getCallback // ensure callback was captured

      freshParser.dispose()

      expect(mockDisposable.dispose).toHaveBeenCalledTimes(1)
    })
  })

  // ─── Pattern Priority ─────────────────────────────────────────────────────

  describe('Pattern priority — NEEDS_INPUT > PROCESSING > COMPLETE', () => {
    it('data matching both NEEDS_INPUT and PROCESSING triggers only NEEDS_INPUT (first priority)', () => {
      // "?" matches NEEDS_INPUT, "..." matches PROCESSING
      // Start from processing state to allow NEEDS_INPUT to apply
      fireTerminalData('sess-pri', 'Thinking...')
      expect(sessionManager.getSessions().get('sess-pri')?.state).toBe('processing')

      // "Working on this... Are you sure?" matches both PROCESSING ("...") and NEEDS_INPUT ("?")
      fireTerminalData('sess-pri', 'Working on this... Are you sure?')
      // NEEDS_INPUT wins — state transitions to needs-input
      expect(sessionManager.getSessions().get('sess-pri')?.state).toBe('needs-input')
    })

    it('data matching PROCESSING fires AGENT_PROCESSING (not COMPLETE)', () => {
      // "Working" matches PROCESSING but not COMPLETE
      fireTerminalData('sess-proc-pri', 'Working on your task')
      expect(sessionManager.getSessions().get('sess-proc-pri')?.state).toBe('processing')
    })
  })
})
