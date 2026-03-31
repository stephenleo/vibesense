// test/unit/session/last-command-tracker.test.ts
// Unit tests for LastCommandTracker — Story 5.5 (AC 2)

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock vscode (required by logger via transitive imports) ───────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))

// ── Import after mock ─────────────────────────────────────────────────────────
import { LastCommandTracker } from '../../../src/extension/session/last-command-tracker'

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LastCommandTracker', () => {
  let tracker: LastCommandTracker

  beforeEach(() => {
    tracker = new LastCommandTracker()
  })

  it('setLastCommand + getLastCommand — returns stored command for sessionId', () => {
    tracker.setLastCommand('session-1', 'claude')
    expect(tracker.getLastCommand('session-1')).toBe('claude')
  })

  it('getLastCommand for unknown sessionId — returns undefined', () => {
    expect(tracker.getLastCommand('unknown-session')).toBeUndefined()
  })

  it('setLastCommand overwrites the previous value for the same session', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.setLastCommand('session-1', 'npm run dev')
    expect(tracker.getLastCommand('session-1')).toBe('npm run dev')
  })

  it('stores independent commands per session', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.setLastCommand('session-2', 'npm test')
    expect(tracker.getLastCommand('session-1')).toBe('claude')
    expect(tracker.getLastCommand('session-2')).toBe('npm test')
  })

  it('clearSession — removes the stored command for the given session', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.clearSession('session-1')
    expect(tracker.getLastCommand('session-1')).toBeUndefined()
  })

  it('clearSession — does not affect other sessions', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.setLastCommand('session-2', 'npm test')
    tracker.clearSession('session-1')
    expect(tracker.getLastCommand('session-2')).toBe('npm test')
  })

  it('clearSession on unknown sessionId — does not throw', () => {
    expect(() => tracker.clearSession('nonexistent')).not.toThrow()
  })

  it('dispose — clears all entries; subsequent gets return undefined', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.setLastCommand('session-2', 'npm test')
    tracker.dispose()
    expect(tracker.getLastCommand('session-1')).toBeUndefined()
    expect(tracker.getLastCommand('session-2')).toBeUndefined()
  })

  it('dispose — can be called multiple times without error', () => {
    tracker.setLastCommand('session-1', 'claude')
    tracker.dispose()
    expect(() => tracker.dispose()).not.toThrow()
  })
})
