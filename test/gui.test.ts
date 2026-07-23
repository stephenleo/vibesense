import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import type { ButtonId, ControllerEvent } from 'openmicro/controller'
import type { Action, Harness } from 'openmicro/harness'
import { actionStatus, controllerStatus } from 'openmicro/logging'
import { actionForButton, launchGuiHarness } from '../src/gui.js'
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
  it('uses canonical OpenMicro statuses without exposing action payloads', () => {
    expect(controllerStatus({ kind: 'connected', controllerType: 'dualsense' })).toEqual({
      message: 'controller connected (dualsense) — buttons now drive the app',
      tone: 'success',
    })
    expect(controllerStatus({ kind: 'disconnected' })).toEqual({
      message: 'controller disconnected — waiting…',
      tone: 'warning',
    })
    expect(actionStatus('north', 'dualsense', { type: 'push_to_talk', pressed: true })).toEqual({
      message: '△ → push-to-talk',
      tone: 'action',
    })
    const keys = actionStatus('dpad_up', 'dualsense', {
      type: 'keys',
      bytes: 'sensitive-or-high-rate',
    })
    expect(keys).toEqual({ message: 'd-pad up → send keys', tone: 'action' })
    expect(keys?.message).not.toContain('sensitive-or-high-rate')
  })

  it('consumes OpenMicro logging at the existing CLI routing seam', () => {
    const cli = fs.readFileSync(fileURLToPath(new URL('../src/cli.ts', import.meta.url)), 'utf8')
    const gui = fs.readFileSync(fileURLToPath(new URL('../src/gui.ts', import.meta.url)), 'utf8')

    expect(cli).toContain("from 'openmicro/logging'")
    expect(cli).toContain('controllerStatus(e)')
    expect(cli).toContain('actionStatus(button, controllerType, action)')
    expect(cli).toContain('STATUS_TINT[status.tone]')
    expect(gui).not.toContain('guiControllerStatus')
    expect(gui).not.toContain('guiActionStatus')
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
