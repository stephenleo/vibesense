import { describe, expect, it } from 'vitest'
import { PauseGate, SessionTracker, stateForHookEvent } from '../src/state.js'

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

describe('PauseGate', () => {
  it('menu force-play overrides an idle agent; the next transition restores auto', () => {
    const gate = new PauseGate()
    expect(gate.shouldPlay()).toBe(false) // agent idle, no override
    gate.toggle() // force play while claude is idle
    expect(gate.shouldPlay()).toBe(true)
    gate.onAgent(true) // claude starts executing — transition clears the override
    expect(gate.shouldPlay()).toBe(true)
    gate.onAgent(false) // claude waits on the user — auto pause wins, prompt not eaten
    expect(gate.shouldPlay()).toBe(false)
  })

  it('manual pause holds while the agent state is unchanged, then auto resumes', () => {
    const gate = new PauseGate()
    gate.onAgent(true)
    gate.toggle() // pause while claude executes
    expect(gate.shouldPlay()).toBe(false)
    gate.onAgent(true) // same state — override sticks
    expect(gate.shouldPlay()).toBe(false)
    gate.onAgent(false) // claude finishes — override cleared, still paused
    expect(gate.shouldPlay()).toBe(false)
    gate.onAgent(true) // next run — auto play resumes
    expect(gate.shouldPlay()).toBe(true)
  })

  it('forcePlay starts playing and menu toggles it (play mode, no agent)', () => {
    const gate = new PauseGate(true)
    expect(gate.shouldPlay()).toBe(true)
    gate.toggle()
    expect(gate.shouldPlay()).toBe(false)
    gate.toggle()
    expect(gate.shouldPlay()).toBe(true)
  })

  it('auto-play (pinned-true feed) keeps playing, and a menu pause sticks', () => {
    // --auto-play feeds onAgent(true) forever: play from the first aggregate on.
    const gate = new PauseGate(true)
    gate.onAgent(true) // first aggregate — transition clears the ctor override
    expect(gate.shouldPlay()).toBe(true)
    gate.onAgent(true) // agent waits/idles — the pinned feed masks it
    expect(gate.shouldPlay()).toBe(true)
    gate.toggle() // manual pause must win over the pin...
    expect(gate.shouldPlay()).toBe(false)
    gate.onAgent(true) // ...and stick: no transition ever clears it
    expect(gate.shouldPlay()).toBe(false)
    gate.toggle() // until the user resumes
    expect(gate.shouldPlay()).toBe(true)
  })
})
