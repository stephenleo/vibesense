// Pure input logic: button → pty byte sequences, key repeat, and stick →
// scroll direction. No I/O here — everything is unit-testable.

import type { ButtonId } from './types.js'

// Terminal-mode byte sequences. Disjoint from game-mode buttons (left stick +
// r2 fire) so game mashing can never leak an accidental accept into claude.
export const TERMINAL_KEYS: Partial<Record<ButtonId, string>> = {
  south: '\r', // accept / Enter
  east: '\x1b', // cancel / Esc
  north: ' ', // Claude Code native voice dictation (tap mode)
  dpad_up: '\x1b[A',
  dpad_down: '\x1b[B',
  dpad_left: '\x1b[D',
  dpad_right: '\x1b[C',
}

/** Buttons that auto-repeat while held (option navigation). */
export const REPEATING_BUTTONS: ReadonlySet<ButtonId> = new Set([
  'dpad_up',
  'dpad_down',
  'dpad_left',
  'dpad_right',
])

export const REPEAT_DELAY_MS = 400
export const REPEAT_INTERVAL_MS = 100

/**
 * OS-style key repeat: fire immediately on press, again after REPEAT_DELAY_MS,
 * then every REPEAT_INTERVAL_MS until release. One instance handles all keys.
 */
export class KeyRepeater {
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  press(key: string, fire: () => void): void {
    this.release(key)
    fire()
    const delay = setTimeout(() => {
      const interval = setInterval(fire, REPEAT_INTERVAL_MS)
      this.timers.set(key, interval as unknown as ReturnType<typeof setTimeout>)
    }, REPEAT_DELAY_MS)
    this.timers.set(key, delay)
  }

  release(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      clearInterval(timer as unknown as ReturnType<typeof setInterval>)
      this.timers.delete(key)
    }
  }

  releaseAll(): void {
    for (const key of [...this.timers.keys()]) this.release(key)
  }
}
