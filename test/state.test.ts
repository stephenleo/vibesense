import { describe, expect, it } from 'vitest'
import { SessionTracker, stateForHookEvent } from '../src/state.js'

describe('stateForHookEvent', () => {
  it('maps hook events to agent states', () => {
    expect(stateForHookEvent('UserPromptSubmit')).toBe('executing')
    expect(stateForHookEvent('PostToolUse')).toBe('executing')
    expect(stateForHookEvent('Stop')).toBe('idle')
    expect(stateForHookEvent('Notification')).toBe('waiting')
    expect(stateForHookEvent('PermissionRequest')).toBe('waiting')
    expect(stateForHookEvent('PreToolUse')).toBe('waiting')
  })

  it('ignores unknown/future events instead of breaking', () => {
    expect(stateForHookEvent('SomeFutureEvent')).toBeNull()
  })
})

describe('SessionTracker.aggregate', () => {
  it('plays only when someone is executing and nobody waits', () => {
    const t = new SessionTracker()
    expect(t.aggregate().playing).toBe(false) // no sessions at all

    t.apply('s1', 'UserPromptSubmit')
    expect(t.aggregate()).toEqual({ playing: true, focusSessionId: null })

    t.apply('s1', 'Stop')
    expect(t.aggregate().playing).toBe(false)
  })

  it('any waiting session pauses the game even if another is executing', () => {
    const t = new SessionTracker()
    t.apply('s1', 'UserPromptSubmit')
    t.apply('s2', 'UserPromptSubmit')
    t.apply('s2', 'PreToolUse') // s2 shows AskUserQuestion
    expect(t.aggregate()).toEqual({ playing: false, focusSessionId: 's2' })
  })

  it('focus goes to the most recently waiting session', () => {
    const t = new SessionTracker()
    t.apply('s1', 'Notification')
    t.apply('s2', 'Notification')
    expect(t.aggregate().focusSessionId).toBe('s2')
    t.apply('s1', 'Notification')
    expect(t.aggregate().focusSessionId).toBe('s1')
  })

  it('question answered (PostToolUse) resumes the game', () => {
    const t = new SessionTracker()
    t.apply('s1', 'UserPromptSubmit')
    t.apply('s1', 'PreToolUse')
    expect(t.aggregate().playing).toBe(false)
    t.apply('s1', 'PostToolUse')
    expect(t.aggregate()).toEqual({ playing: true, focusSessionId: null })
  })

  it('SessionEnd removes the session so a dead waiter cannot pause forever', () => {
    const t = new SessionTracker()
    t.apply('s1', 'UserPromptSubmit')
    t.apply('s2', 'Notification')
    expect(t.aggregate().playing).toBe(false)
    t.apply('s2', 'SessionEnd')
    expect(t.aggregate()).toEqual({ playing: true, focusSessionId: null })
  })

  it('unknown events do not disturb existing state', () => {
    const t = new SessionTracker()
    t.apply('s1', 'UserPromptSubmit')
    expect(t.apply('s1', 'WeirdNewEvent')).toBe(false)
    expect(t.aggregate().playing).toBe(true)
  })
})
