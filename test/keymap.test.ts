import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  KeyRepeater,
  MAX_REPEAT_DURATION_MS,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  REPEATING_BUTTONS,
  TERMINAL_KEYS,
} from '../src/keymap.js'
import { GUARD_WINDOW_MS, InputRouter } from '../src/router.js'

describe('TERMINAL_KEYS', () => {
  it('maps accept/cancel/voice/dpad to the right byte sequences', () => {
    expect(TERMINAL_KEYS.south).toBe('\r')
    expect(TERMINAL_KEYS.east).toBe('\x1b')
    expect(TERMINAL_KEYS.north).toBe(' ')
    expect(TERMINAL_KEYS.dpad_up).toBe('\x1b[A')
    expect(TERMINAL_KEYS.dpad_down).toBe('\x1b[B')
    expect(TERMINAL_KEYS.dpad_left).toBe('\x1b[D')
    expect(TERMINAL_KEYS.dpad_right).toBe('\x1b[C')
  })

  it('never maps game-mode buttons (left stick / r2 are game-only)', () => {
    expect(TERMINAL_KEYS.r2).toBeUndefined()
    expect(TERMINAL_KEYS.l2).toBeUndefined()
  })

  it('only d-pad buttons repeat', () => {
    expect([...REPEATING_BUTTONS].sort()).toEqual([
      'dpad_down',
      'dpad_left',
      'dpad_right',
      'dpad_up',
    ])
  })
})

describe('KeyRepeater', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires immediately, then after the delay, then at the interval', () => {
    const repeater = new KeyRepeater()
    const fire = vi.fn()
    repeater.press('dpad_down', fire)
    expect(fire).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(REPEAT_DELAY_MS - 1)
    expect(fire).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1 + REPEAT_INTERVAL_MS)
    expect(fire).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 3)
    expect(fire).toHaveBeenCalledTimes(5)
  })

  it('stops firing on release', () => {
    const repeater = new KeyRepeater()
    const fire = vi.fn()
    repeater.press('dpad_down', fire)
    repeater.release('dpad_down')
    vi.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 10)
    expect(fire).toHaveBeenCalledTimes(1)
  })

  it('re-press resets the delay', () => {
    const repeater = new KeyRepeater()
    const fire = vi.fn()
    repeater.press('k', fire)
    vi.advanceTimersByTime(REPEAT_DELAY_MS - 10)
    repeater.press('k', fire)
    expect(fire).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(REPEAT_DELAY_MS - 10)
    expect(fire).toHaveBeenCalledTimes(2)
  })

  it('releaseAll stops every key without orphan timers', () => {
    const repeater = new KeyRepeater()
    const a = vi.fn()
    const b = vi.fn()
    repeater.press('a', a)
    repeater.press('b', b)
    repeater.releaseAll()
    vi.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 5)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops repeating when the action fails', () => {
    const repeater = new KeyRepeater()
    const fire = vi.fn(() => {
      if (fire.mock.calls.length === 2) throw new Error('automation failed')
    })
    repeater.press('dpad_down', fire)

    expect(() => vi.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS)).toThrow(
      'automation failed',
    )
    vi.advanceTimersByTime(REPEAT_INTERVAL_MS * 5)
    expect(fire).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds unobservable asynchronous automation failure with a deadman', () => {
    const repeater = new KeyRepeater()
    const fire = vi.fn()
    repeater.press('dpad_down', fire)

    vi.advanceTimersByTime(MAX_REPEAT_DURATION_MS)
    const callsAtDeadline = fire.mock.calls.length
    expect(callsAtDeadline).toBeGreaterThan(1)
    vi.advanceTimersByTime(MAX_REPEAT_DURATION_MS)
    expect(fire).toHaveBeenCalledTimes(callsAtDeadline)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not strand repeat when a physical release is swallowed across a mode guard', () => {
    let now = GUARD_WINDOW_MS + 1
    const router = new InputRouter(() => now)
    const repeater = new KeyRepeater()
    const fire = vi.fn()

    const physicalPress = { kind: 'button', button: 'dpad_right', pressed: true } as const
    repeater.releasePhysical(physicalPress)
    const press = router.route(physicalPress)
    expect(press?.target).toBe('terminal')
    repeater.press('dpad_right', fire)

    router.setMode('game')
    now += 1
    const physicalRelease = { kind: 'button', button: 'dpad_right', pressed: false } as const
    repeater.releasePhysical(physicalRelease)
    const release = router.route(physicalRelease)
    expect(release).toBeNull()

    vi.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 3)
    expect(fire).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
