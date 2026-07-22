// Input router: decides whether a controller event drives the terminal or the
// game. Terminal buttons and game buttons are disjoint sets, and every mode
// flip opens a guard window that drops input and ignores buttons that were
// already held — game mashing can never accept a question that just appeared.

import type { ButtonId, ControllerEvent } from 'openmicro/controller'

export type InputMode = 'terminal' | 'game'

export const GUARD_WINDOW_MS = 750

export type RoutedInput =
  { target: 'terminal'; event: ControllerEvent } | { target: 'game'; event: ControllerEvent } | null

// Game-mode controls: left stick moves, R2 fires. Nothing else is forwarded.
const GAME_BUTTONS: ReadonlySet<ButtonId> = new Set(['r2', 'l2'])
const GAME_AXES = new Set(['left_x', 'left_y'])

export class InputRouter {
  private mode: InputMode = 'terminal'
  private guardUntil = 0
  private held = new Set<ButtonId>()
  private ignoredHeld = new Set<ButtonId>()

  constructor(
    private readonly now: () => number = Date.now,
    private readonly releaseInput: () => void = () => {},
  ) {}

  currentMode(): InputMode {
    return this.mode
  }

  /** Flip modes (from agent state or the manual toggle button). Opens the guard window. */
  setMode(mode: InputMode): void {
    if (mode === this.mode) return
    this.releaseInput()
    this.mode = mode
    this.guardUntil = this.now() + GUARD_WINDOW_MS
    // Buttons held across the flip stay dead until a fresh press.
    this.ignoredHeld = new Set(this.held)
  }

  route(event: ControllerEvent): RoutedInput {
    if (event.kind === 'button') {
      if (event.pressed) {
        this.held.add(event.button)
      } else {
        this.held.delete(event.button)
        if (this.ignoredHeld.delete(event.button)) return null // swallow release of a pre-flip press
      }
      if (this.ignoredHeld.has(event.button)) return null
      if (this.now() < this.guardUntil) return null
      if (this.mode === 'game') {
        return GAME_BUTTONS.has(event.button) ? { target: 'game', event } : null
      }
      return { target: 'terminal', event }
    }

    if (event.kind === 'axis') {
      if (this.now() < this.guardUntil) return null
      if (this.mode === 'game') {
        return GAME_AXES.has(event.axis) ? { target: 'game', event } : null
      }
      return event.axis === 'right_y' ? { target: 'terminal', event } : null
    }

    return null
  }
}
