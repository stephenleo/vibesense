import { spawn } from 'node:child_process'
import type { ButtonId, ControllerEvent } from 'openmicro/controller'
import type { Action, Harness } from 'openmicro/harness'
import { TERMINAL_KEYS } from './keymap.js'

interface LaunchResult {
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'close', listener: (code: number | null) => void): unknown
}

type AppLauncher = (command: string, args: string[]) => LaunchResult

/** GUI navigation controls that stay available while the game owns normal input. */
export const GLOBAL_GUI_BUTTONS: ReadonlySet<ButtonId> = new Set(['touchpad', 'l2'])

/** Format VibeSense-owned controller lifecycle status for GUI mode. */
export function guiControllerStatus(event: ControllerEvent): string | null {
  if (event.kind === 'connected') {
    return `vibesense: controller connected (${event.controllerType})`
  }
  if (event.kind === 'disconnected') return 'vibesense: controller disconnected — waiting'
  return null
}

/** Format a safe status line after a GUI action was successfully delegated. */
export function guiActionStatus(action: Action, performed: boolean): string | null {
  if (!performed) return null
  switch (action.type) {
    case 'accept':
      return 'vibesense: controller → accept'
    case 'reject':
      return 'vibesense: controller → reject'
    case 'push_to_talk':
      return action.pressed === false ? null : 'vibesense: controller → push-to-talk'
    case 'focus_session':
      return 'vibesense: controller → next chat'
    case 'herdr_space':
      return 'vibesense: controller → next project'
    case 'keys':
      return 'vibesense: controller → navigate'
    default:
      return null
  }
}

/** Convert verified Codex app buttons to OpenMicro actions. */
export function actionForButton(button: ButtonId, pressed: boolean): Action | null {
  if (button === 'north') return { type: 'push_to_talk', pressed }
  if (!pressed) return null
  if (button === 'south') return { type: 'accept' }
  if (button === 'east') return { type: 'reject' }
  if (button === 'touchpad') return { type: 'focus_session', index: -1 }
  if (button === 'l2') return { type: 'herdr_space' }
  const bytes = TERMINAL_KEYS[button]
  return bytes ? { type: 'keys', bytes } : null
}

export interface GuiRuntime {
  perform(action: Action): boolean
  releasePushToTalk(): void
  dispose(): void
}

/** Launch and drive a no-PTY harness through OpenMicro's lifecycle. */
export function launchGuiHarness(
  harness: Harness,
  userArgs: string[],
  launch: AppLauncher = (command, args) => spawn(command, args, { stdio: 'ignore' }),
  onFailure: (error: Error) => void = () => {},
): GuiRuntime {
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    disposed = true
    harness.dispose?.()
  }
  let failed = false
  const fail = (error: Error): void => {
    if (failed) return
    failed = true
    dispose()
    onFailure(error)
  }
  const child = launch(harness.command, harness.buildArgs(userArgs))
  child.on('error', fail)
  child.on('close', (code) => {
    if (code !== 0) fail(new Error(`${harness.command} exited with code ${code ?? 'unknown'}`))
  })
  let pushToTalkHeld = false
  const perform = (action: Action): boolean => {
    const resolved = harness.resolveAction(action, { thinkingLevel: 0 })
    if (!resolved || !harness.execute) return false
    try {
      harness.execute(resolved.bytes)
      if (action.type === 'push_to_talk') pushToTalkHeld = action.pressed !== false
      return true
    } catch (error) {
      dispose()
      throw error
    }
  }
  return {
    perform,
    releasePushToTalk(): void {
      if (pushToTalkHeld) perform({ type: 'push_to_talk', pressed: false })
    },
    dispose,
  }
}
