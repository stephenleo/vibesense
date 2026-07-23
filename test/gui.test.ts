import { describe, expect, it, vi } from 'vitest'
import type { ButtonId, ControllerEvent } from 'openmicro/controller'
import type { Action, Harness } from 'openmicro/harness'
import {
  actionForButton,
  guiActionStatus,
  guiControllerStatus,
  launchGuiHarness,
} from '../src/gui.js'
import { GUARD_WINDOW_MS, InputRouter } from '../src/router.js'

function harness(overrides: Partial<Harness> = {}): Harness {
  return {
    kind: 'codex-app',
    command: 'open',
    usesPty: false,
    buildArgs: () => ['-a', 'Codex'],
    installHooks: () => ({ changed: false, trustNotice: null }),
    stateForHookEvent: () => null,
    resolveAction: () => null,
    ...overrides,
  }
}

describe('Codex app runtime', () => {
  it('launches without a pty and disposes the OpenMicro harness on shutdown', () => {
    const dispose = vi.fn()
    const launch = vi.fn(() => ({ on: vi.fn() }))
    const runtime = launchGuiHarness(harness({ dispose }), [], launch)

    expect(launch).toHaveBeenCalledWith('open', ['-a', 'Codex'])
    runtime.dispose()
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('reports a nonzero app launcher exit and cleans up', () => {
    const listeners = new Map<string, (value: never) => void>()
    const launch = vi.fn(() => ({
      on: vi.fn((event: string, listener: (value: never) => void) => {
        listeners.set(event, listener)
      }),
    }))
    const dispose = vi.fn()
    const onFailure = vi.fn()
    launchGuiHarness(harness({ dispose }), [], launch, onFailure)

    listeners.get('close')!(1 as never)
    expect(dispose).toHaveBeenCalledOnce()
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'open exited with code 1' }),
    )
  })

  it('delegates actions through resolveAction and execute', () => {
    const execute = vi.fn()
    const resolveAction = vi.fn((action: Action) => ({ bytes: `resolved:${action.type}` }))
    const runtime = launchGuiHarness(harness({ execute, resolveAction }), [], () => ({
      on: vi.fn(),
    }))

    expect(runtime.perform({ type: 'accept' })).toBe(true)
    expect(resolveAction).toHaveBeenCalledWith({ type: 'accept' }, { thinkingLevel: 0 })
    expect(execute).toHaveBeenCalledWith('resolved:accept')
  })

  it('disposes the harness when automation throws', () => {
    const dispose = vi.fn()
    const runtime = launchGuiHarness(
      harness({
        dispose,
        execute: () => {
          throw new Error('automation failed')
        },
        resolveAction: () => ({ bytes: 'osascript:test' }),
      }),
      [],
      () => ({ on: vi.fn() }),
    )

    expect(() => runtime.perform({ type: 'accept' })).toThrow('automation failed')
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('releases held push-to-talk when another VibeSense control takes focus', () => {
    const execute = vi.fn()
    const runtime = launchGuiHarness(
      harness({
        execute,
        resolveAction: (action) => ({
          bytes: action.type === 'push_to_talk' && action.pressed === false ? 'release' : 'press',
        }),
      }),
      [],
      () => ({ on: vi.fn() }),
    )

    runtime.perform({ type: 'push_to_talk', pressed: true })
    runtime.releasePushToTalk()
    runtime.releasePushToTalk()
    expect(execute.mock.calls).toEqual([['press'], ['release']])
  })
})

describe('Codex app controller actions', () => {
  it('formats safe VibeSense status only for controller lifecycle and successful presses', () => {
    expect(guiControllerStatus({ kind: 'connected', controllerType: 'dualsense' })).toBe(
      'vibesense: controller connected (dualsense)',
    )
    expect(guiControllerStatus({ kind: 'disconnected' })).toBe(
      'vibesense: controller disconnected — waiting',
    )
    expect(guiActionStatus({ type: 'accept' }, true)).toBe('vibesense: controller → accept')
    expect(guiActionStatus({ type: 'reject' }, true)).toBe('vibesense: controller → reject')
    expect(guiActionStatus({ type: 'push_to_talk', pressed: true }, true)).toBe(
      'vibesense: controller → push-to-talk',
    )
    expect(guiActionStatus({ type: 'focus_session', index: -1 }, true)).toBe(
      'vibesense: controller → next chat',
    )
    expect(guiActionStatus({ type: 'herdr_space' }, true)).toBe(
      'vibesense: controller → next project',
    )
    expect(guiActionStatus({ type: 'keys', bytes: 'sensitive-or-high-rate' }, true)).toBe(
      'vibesense: controller → navigate',
    )
    expect(guiActionStatus({ type: 'keys', bytes: 'secret' }, false)).toBeNull()
    expect(guiActionStatus({ type: 'push_to_talk', pressed: false }, true)).toBeNull()
    expect(guiActionStatus({ type: 'prompt', text: 'secret prompt' }, true)).toBeNull()
    expect(guiControllerStatus({ kind: 'button', button: 'south', pressed: true })).toBeNull()
  })

  it('keeps chat and project navigation global without weakening the mode guard', () => {
    let now = GUARD_WINDOW_MS + 1
    const router = new InputRouter(
      () => now,
      () => {},
      new Set<ButtonId>(['touchpad', 'l2']),
    )
    const executed: string[] = []
    const runtime = launchGuiHarness(
      harness({
        resolveAction: (action) => ({ bytes: `resolved:${action.type}` }),
        execute: (bytes) => executed.push(bytes),
      }),
      [],
      () => ({ on: vi.fn() }),
    )
    const route = (button: ButtonId, pressed: boolean): void => {
      const event: ControllerEvent = { kind: 'button', button, pressed }
      const routed = router.route(event)
      if (routed?.target !== 'terminal' || routed.event.kind !== 'button') return
      const action = actionForButton(routed.event.button, routed.event.pressed)
      if (action) runtime.perform(action)
    }

    router.setMode('game')
    now += GUARD_WINDOW_MS + 1
    for (const button of ['touchpad', 'l2'] as const) {
      route(button, true)
      route(button, false)
      route(button, true)
      route(button, false)
    }

    expect(executed).toEqual([
      'resolved:focus_session',
      'resolved:focus_session',
      'resolved:herdr_space',
      'resolved:herdr_space',
    ])
    expect(router.route({ kind: 'button', button: 'south', pressed: true })).toBeNull()
    expect(router.route({ kind: 'button', button: 'east', pressed: true })).toBeNull()
    expect(router.route({ kind: 'button', button: 'dpad_up', pressed: true })).toBeNull()
    expect(router.route({ kind: 'button', button: 'r2', pressed: true })?.target).toBe('game')

    router.setMode('terminal')
    expect(router.route({ kind: 'button', button: 'south', pressed: true })).toBeNull()
    now += GUARD_WINDOW_MS + 1
    expect(router.route({ kind: 'button', button: 'south', pressed: false })).toBeNull()
    expect(router.route({ kind: 'button', button: 'south', pressed: true })?.target).toBe(
      'terminal',
    )
  })

  it('maps only the verified buttons and preserves push-to-talk edges', () => {
    expect(actionForButton('south', true)).toEqual({ type: 'accept' })
    expect(actionForButton('east', true)).toEqual({ type: 'reject' })
    expect(actionForButton('north', true)).toEqual({ type: 'push_to_talk', pressed: true })
    expect(actionForButton('north', false)).toEqual({ type: 'push_to_talk', pressed: false })
    expect(actionForButton('dpad_up', true)).toEqual({ type: 'keys', bytes: '\x1b[A' })
    expect(actionForButton('touchpad', true)).toEqual({ type: 'focus_session', index: -1 })
    expect(actionForButton('l2', true)).toEqual({ type: 'herdr_space' })
    expect(actionForButton('south', false)).toBeNull()
    expect(actionForButton('menu', true)).toBeNull()
  })
})
