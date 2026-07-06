import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  KeyRepeater,
  REPEAT_DELAY_MS,
  REPEAT_INTERVAL_MS,
  REPEATING_BUTTONS,
  TERMINAL_KEYS,
} from '../src/keymap.js'

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

  it('releaseAll stops every key', () => {
    const repeater = new KeyRepeater()
    const a = vi.fn()
    const b = vi.fn()
    repeater.press('a', a)
    repeater.press('b', b)
    repeater.releaseAll()
    vi.advanceTimersByTime(REPEAT_DELAY_MS + REPEAT_INTERVAL_MS * 5)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
