// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 2.3

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'
import { HidManager } from './hid/hid-manager'
import { StatusBarController } from './status-bar'
import type { ControllerEvent, ControllerType } from '../shared/types'

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  // Instantiate status bar immediately so it's always visible (FR27)
  const statusBar = new StatusBarController()
  context.subscriptions.push(statusBar)

  // Detect and start the controller driver
  const hidManager = new HidManager()
  const driver = hidManager.start()

  // Track current controller type for battery event correlation.
  let currentControllerType: ControllerType | null = null

  if (driver !== null) {
    // If a controller is already plugged in at startup, reflect that immediately (FR27)
    statusBar.update({ kind: 'connected', controllerType: driver.controllerType })
    currentControllerType = driver.controllerType

    // Subscribe to HAL events and map to status bar states
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

  // Dispose HidManager on extension deactivation
  context.subscriptions.push({ dispose: () => hidManager.stop() })
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  disposeLogger()
}
