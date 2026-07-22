// Pure input logic: button → pty byte sequences, key repeat, and stick →
// scroll direction. No I/O here — everything is unit-testable.

import type { ButtonId, ControllerEvent } from 'openmicro/controller'

// Terminal-mode byte sequences. Disjoint from game-mode buttons (left stick +
// r2 fire) so game mashing can never leak an accidental accept into the agent.
export const TERMINAL_KEYS: Partial<Record<ButtonId, string>> = {
  south: '\r', // accept / Enter
  east: '\x1b', // cancel / Esc
  north: ' ', // Claude voice dictation shortcut; a normal space in Codex
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
// Deadman: GUI automation completes asynchronously, so VibeSense cannot observe
// every failure. Three seconds allows ~26 navigation steps but bounds a lost
// release before the 10 Hz producer can grow an unbounded automation queue.
export const MAX_REPEAT_DURATION_MS = 3_000

interface RepeatTimers {
  delay: ReturnType<typeof setTimeout>
  interval: ReturnType<typeof setInterval> | null
  deadman: ReturnType<typeof setTimeout>
}

/**
 * OS-style key repeat: fire immediately on press, again after REPEAT_DELAY_MS,
 * then every REPEAT_INTERVAL_MS until release. One instance handles all keys.
 */
export class KeyRepeater {
  private timers = new Map<string, RepeatTimers>()

  press(key: string, fire: () => void): void {
    this.release(key)
    const fireSafely = (): void => {
      try {
        fire()
      } catch (error) {
        this.release(key)
        throw error
      }
    }
    fireSafely()
    const state: RepeatTimers = {
      delay: setTimeout(() => {
        state.interval = setInterval(fireSafely, REPEAT_INTERVAL_MS)
      }, REPEAT_DELAY_MS),
      interval: null,
      deadman: setTimeout(() => this.release(key), MAX_REPEAT_DURATION_MS),
    }
    this.timers.set(key, state)
  }

  release(key: string): void {
    const timers = this.timers.get(key)
    if (timers) {
      clearTimeout(timers.delay)
      if (timers.interval) clearInterval(timers.interval)
      clearTimeout(timers.deadman)
      this.timers.delete(key)
    }
  }

  /** Stop repeat on the physical release edge before routing can suppress it. */
  releasePhysical(event: ControllerEvent): void {
    if (event.kind === 'button' && !event.pressed) this.release(event.button)
  }

  releaseAll(): void {
    for (const key of [...this.timers.keys()]) this.release(key)
  }
}
