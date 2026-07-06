import { describe, expect, it } from 'vitest'
import { GUARD_WINDOW_MS, InputRouter } from '../src/router.js'
import type { ControllerEvent } from '../src/types.js'

import type { ButtonId } from '../src/types.js'

function press(button: ButtonId): ControllerEvent {
  return { kind: 'button', button, pressed: true }
}
function release(button: ButtonId): ControllerEvent {
  return { kind: 'button', button, pressed: false }
}

function makeRouter(): { router: InputRouter; tick: (ms: number) => void } {
  let now = 0
  const router = new InputRouter(() => now)
  return { router, tick: (ms) => (now += ms) }
}

describe('InputRouter', () => {
  it('terminal mode routes buttons to the terminal, game mode routes only game controls', () => {
    const { router, tick } = makeRouter()
    tick(GUARD_WINDOW_MS + 1)
    expect(router.route(press('south'))?.target).toBe('terminal')

    router.setMode('game')
    tick(GUARD_WINDOW_MS + 1)
    expect(router.route(press('south'))).toBeNull() // accept button never reaches the game
    expect(router.route(press('r2'))?.target).toBe('game')
    expect(router.route({ kind: 'axis', axis: 'left_x', value: 0.8 })?.target).toBe('game')
    expect(router.route({ kind: 'axis', axis: 'right_y', value: 0.8 })).toBeNull()
  })

  it('drops all input during the guard window after a mode flip', () => {
    const { router, tick } = makeRouter()
    tick(GUARD_WINDOW_MS + 1)
    router.setMode('game')
    expect(router.route(press('r2'))).toBeNull() // inside guard window
    tick(GUARD_WINDOW_MS + 1)
    expect(router.route(press('r2'))?.target).toBe('game')
  })

  it('a button held across the flip stays dead until a fresh press', () => {
    const { router, tick } = makeRouter()
    tick(GUARD_WINDOW_MS + 1)

    // Player is holding fire (r2) in game mode…
    router.setMode('game')
    tick(GUARD_WINDOW_MS + 1)
    expect(router.route(press('r2'))?.target).toBe('game')

    // …when claude asks a question and the mode flips to terminal.
    router.setMode('terminal')
    tick(GUARD_WINDOW_MS + 1)

    // Still-held r2 must not do anything, and its release is swallowed too.
    expect(router.route(press('r2'))).toBeNull()
    expect(router.route(release('r2'))).toBeNull()

    // A fresh press after release works (r2 has no terminal binding, so use south:
    // held-south scenario is the dangerous accidental-accept one).
    expect(router.route(press('south'))?.target).toBe('terminal')
  })

  it('held accept button cannot fire when flipping game→terminal (the mash-accept race)', () => {
    const { router, tick } = makeRouter()
    tick(GUARD_WINDOW_MS + 1)
    router.setMode('game')
    tick(GUARD_WINDOW_MS + 1)

    router.route(press('south')) // mashing A in game mode (does nothing)
    router.setMode('terminal') // question appears mid-press
    tick(GUARD_WINDOW_MS + 1)

    expect(router.route(release('south'))).toBeNull()
    expect(router.route(press('south'))?.target).toBe('terminal') // fresh press is intentional
  })
})
