import { spawn } from 'node:child_process'
import type { ButtonId } from 'openmicro/controller'
import type { Action, Harness } from 'openmicro/harness'
import { TERMINAL_KEYS } from './keymap.js'

interface LaunchResult {
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'close', listener: (code: number | null) => void): unknown
}

type AppLauncher = (command: string, args: string[]) => LaunchResult

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
