// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 2.3

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'
import { HidManager } from './hid/hid-manager'
import { ControllerLifecycleManager } from './hid/controller-lifecycle-manager'
import { StatusBarController } from './status-bar'
import type { ControllerEvent, ControllerType } from '../shared/types'

// Module-level references — accessible for deactivate() and subscription dispose
let lifecycleManager: ControllerLifecycleManager | undefined
let hidManager: HidManager | undefined

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  // Instantiate status bar immediately so it's always visible (FR27)
  const statusBar = new StatusBarController()
  context.subscriptions.push(statusBar)

  // Track current controller type for battery event correlation.
  let currentControllerType: ControllerType | null = null

  hidManager = new HidManager()
  const initialDriver = hidManager.start()

  // If a controller is already plugged in at startup, reflect that immediately (FR27)
  if (initialDriver !== null) {
    statusBar.update({ kind: 'connected', controllerType: initialDriver.controllerType })
    currentControllerType = initialDriver.controllerType
  }

  /**
   * Attach status-bar event listeners to a HAL driver.
   * Called on initial connect and on every reconnect.
   */
  function attachStatusBarListeners(driver: { on: (event: string | symbol, listener: (...args: unknown[]) => void) => unknown; controllerType: ControllerType }): void {
    driver.on('data', (raw: unknown) => {
      try {
        const event = raw as ControllerEvent
        if (event.kind === 'connected') {
          currentControllerType = event.controllerType
          statusBar.update({ kind: 'connected', controllerType: event.controllerType })
        } else if (event.kind === 'disconnected') {
          currentControllerType = null
          statusBar.update({ kind: 'disconnected' })
        } else if (event.kind === 'battery' && currentControllerType !== null) {
          // FR4: non-blocking battery warning when level < 20%
          if (event.level < 20) {
            statusBar.update({
              kind: 'low-battery',
              controllerType: currentControllerType,
              level: event.level,
            })
          } else {
            // Battery back above threshold — revert to connected state
            statusBar.update({ kind: 'connected', controllerType: currentControllerType })
          }
        }
      } catch (err) {
        logger.error('StatusBar: error handling controller event', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    })
  }

  // Attach status-bar listeners to the initial driver (if any)
  if (initialDriver !== null) {
    attachStatusBarListeners(initialDriver)
  }

  lifecycleManager = new ControllerLifecycleManager(
    initialDriver,
    (driver) => {
      logger.info('VibeSense: controller connected', driver.controllerType)
      currentControllerType = driver.controllerType
      statusBar.update({ kind: 'connected', controllerType: driver.controllerType })
      attachStatusBarListeners(driver)
    },
    () => {
      logger.info('VibeSense: controller disconnected — keyboard fallback active')
      currentControllerType = null
      statusBar.update({ kind: 'disconnected' })
    },
  )

  context.subscriptions.push({
    dispose: () => {
      lifecycleManager?.stop()
      lifecycleManager = undefined
      hidManager?.stop()
      hidManager = undefined
    },
  })
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  lifecycleManager?.stop()
  lifecycleManager = undefined
  hidManager?.stop()
  hidManager = undefined
  disposeLogger()
}
