// test/unit/commands/register.test.ts
// Unit tests for session-switching commands — Story 3.3 (AC 1, 2, 3, 4)
// Uses vi.hoisted pattern (consistent with input-router.test.ts)

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks (must be declared before vi.mock calls) ──────────────────────
const { mockState, mockLogger, mockNotifySessionSwitched } = vi.hoisted(() => {
  const terminalA = { name: 'VibeSense', show: vi.fn() }
  const terminalB = { name: 'Agent', show: vi.fn() }
  const terminalC = { name: 'Copilot', show: vi.fn() }

  return {
    mockState: {
      // Mutable terminals array — tests swap this to control terminal count
      terminals: [terminalA, terminalB, terminalC] as { name: string; show: ReturnType<typeof vi.fn> }[],
      activeTerminal: terminalA as { name: string; show: ReturnType<typeof vi.fn> } | undefined,
      registerCommand: vi.fn((id: string, cb: () => void) => ({ dispose: vi.fn(), id, cb })),
    },
    mockLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    mockNotifySessionSwitched: vi.fn(),
  }
})

// Mutable record for registered command callbacks (filled by mockRegisterCommand)
let registeredCommands: Record<string, () => void> = {}

// ── Mock vscode ────────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  window: {
    get terminals() {
      return mockState.terminals
    },
    get activeTerminal() {
      return mockState.activeTerminal
    },
    createTerminal: vi.fn(() => ({ name: 'VibeSense', show: vi.fn(), sendText: vi.fn() })),
    setStatusBarMessage: vi.fn(),
  },
  commands: {
    registerCommand: (id: string, cb: () => void) => {
      registeredCommands[id] = cb
      return { dispose: vi.fn() }
    },
    executeCommand: vi.fn().mockResolvedValue(undefined),
  },
}))

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { registerCommands } from '../../../src/extension/commands/register'
import type { SlidePanelManager } from '../../../src/extension/panels/slide-panel-manager'

// ── Helpers ────────────────────────────────────────────────────────────────────
const mockSlidePanelManager = {
  notifySessionSwitched: mockNotifySessionSwitched,
} as unknown as SlidePanelManager

function setup() {
  const context = {
    subscriptions: { push: vi.fn() },
  } as unknown as import('vscode').ExtensionContext
  registerCommands(context, mockSlidePanelManager)
}

// Convenience: default 3-terminal array
const threeTerminals = [
  { name: 'VibeSense', show: vi.fn() },
  { name: 'Agent', show: vi.fn() },
  { name: 'Copilot', show: vi.fn() },
]

describe('registerCommands — session switching (Story 3.3)', () => {
  beforeEach(() => {
    registeredCommands = {}
    mockLogger.error.mockClear()
    mockNotifySessionSwitched.mockClear()
    // Reset to 3-terminal scenario with fresh mocks
    threeTerminals.forEach((t) => t.show.mockClear())
    mockState.terminals = threeTerminals
    mockState.activeTerminal = threeTerminals[0]
    setup()
  })

  // ── switchSessionNext ──────────────────────────────────────────────────────

  describe('vibesense.switchSessionNext', () => {
    it('focuses the next terminal when 2+ terminals open (wraps around)', () => {
      mockState.activeTerminal = threeTerminals[0] // index 0
      registeredCommands['vibesense.switchSessionNext']()
      expect(threeTerminals[1].show).toHaveBeenCalledWith(false) // next = index 1
    })

    it('wraps from last terminal to first (index wrap)', () => {
      mockState.activeTerminal = threeTerminals[2] // last index (2)
      registeredCommands['vibesense.switchSessionNext']()
      expect(threeTerminals[0].show).toHaveBeenCalledWith(false) // wraps to index 0
    })

    it('calls notifySessionSwitched with correct sessionIndex, sessionName, totalSessions', () => {
      mockState.activeTerminal = threeTerminals[0] // index 0
      registeredCommands['vibesense.switchSessionNext']()
      expect(mockNotifySessionSwitched).toHaveBeenCalledWith(1, 'Agent', 3)
    })

    it('does NOT focus any terminal when only 1 terminal open (AC 3)', () => {
      const singleTerminal = [{ name: 'Solo', show: vi.fn() }]
      mockState.terminals = singleTerminal
      mockState.activeTerminal = singleTerminal[0]
      registeredCommands['vibesense.switchSessionNext']()
      expect(singleTerminal[0].show).not.toHaveBeenCalled()
      expect(mockNotifySessionSwitched).not.toHaveBeenCalled()
    })

    it('does NOT focus any terminal when 0 terminals open (AC 4)', () => {
      mockState.terminals = []
      mockState.activeTerminal = undefined
      expect(() => registeredCommands['vibesense.switchSessionNext']()).not.toThrow()
      expect(mockNotifySessionSwitched).not.toHaveBeenCalled()
    })

    it('starts from index 0 when no active terminal', () => {
      mockState.activeTerminal = undefined
      registeredCommands['vibesense.switchSessionNext']()
      // currentIndex = -1, nextIndex = (-1 + 1) % 3 = 0
      expect(threeTerminals[0].show).toHaveBeenCalledWith(false)
      expect(mockNotifySessionSwitched).toHaveBeenCalledWith(0, 'VibeSense', 3)
    })
  })

  // ── switchSessionPrev ──────────────────────────────────────────────────────

  describe('vibesense.switchSessionPrev', () => {
    it('focuses the previous terminal when 2+ terminals open', () => {
      mockState.activeTerminal = threeTerminals[1] // index 1
      registeredCommands['vibesense.switchSessionPrev']()
      expect(threeTerminals[0].show).toHaveBeenCalledWith(false) // prev = index 0
    })

    it('wraps from first terminal to last (index wrap)', () => {
      mockState.activeTerminal = threeTerminals[0] // index 0
      registeredCommands['vibesense.switchSessionPrev']()
      // prevIndex = (0 - 1 + 3) % 3 = 2
      expect(threeTerminals[2].show).toHaveBeenCalledWith(false)
    })

    it('calls notifySessionSwitched with correct sessionIndex, sessionName, totalSessions', () => {
      mockState.activeTerminal = threeTerminals[2] // index 2
      registeredCommands['vibesense.switchSessionPrev']()
      expect(mockNotifySessionSwitched).toHaveBeenCalledWith(1, 'Agent', 3)
    })

    it('does NOT focus any terminal when only 1 terminal open (AC 3)', () => {
      const singleTerminal = [{ name: 'Solo', show: vi.fn() }]
      mockState.terminals = singleTerminal
      mockState.activeTerminal = singleTerminal[0]
      registeredCommands['vibesense.switchSessionPrev']()
      expect(singleTerminal[0].show).not.toHaveBeenCalled()
      expect(mockNotifySessionSwitched).not.toHaveBeenCalled()
    })

    it('does NOT throw when 0 terminals open (AC 4)', () => {
      mockState.terminals = []
      mockState.activeTerminal = undefined
      expect(() => registeredCommands['vibesense.switchSessionPrev']()).not.toThrow()
      expect(mockNotifySessionSwitched).not.toHaveBeenCalled()
    })
  })
})
