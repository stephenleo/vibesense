// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 2.2

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'
import { HidManager } from './hid/hid-manager'
import { ControllerLifecycleManager } from './hid/controller-lifecycle-manager'

// Module-level lifecycle manager reference — accessible for deactivate()
let lifecycleManager: ControllerLifecycleManager | undefined

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  const hidManager = new HidManager()
  const initialDriver = hidManager.start()

  lifecycleManager = new ControllerLifecycleManager(
    initialDriver,
    (driver) => {
      logger.info('VibeSense: controller connected', driver.controllerType)
    },
    () => {
      logger.info('VibeSense: controller disconnected — keyboard fallback active')
    },
  )

  context.subscriptions.push({
    dispose: () => {
      lifecycleManager?.stop()
      lifecycleManager = undefined
      hidManager.stop()
    },
  })
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  lifecycleManager?.stop()
  lifecycleManager = undefined
  disposeLogger()
}
