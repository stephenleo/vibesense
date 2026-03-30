// src/extension/extension.ts
// VibeSense extension entry point
// Stories 1.2–2.6: HID detection, permission handling, manual device selection

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'
import { HidManager } from './hid/hid-manager'
import { checkHidAccess, isHidPermissionError } from './platform/permission-checker'
import { handleHidPermissionError } from './platform/platform-guide'
import { showDeviceSelector } from './platform/device-selector'
import type { ControllerEvent, ControllerType } from '../shared/types'

function controllerLabel(type: ControllerType): string {
  if (type === 'dualsense') return 'DualSense'
  if (type === 'xbox') return 'Xbox'
  return 'Controller'
}

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  // Minimal inline status bar — full StatusBarController is Story 2.3 (parallel branch)
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.text = '○ No controller — keyboard active'
  statusBarItem.tooltip = 'VibeSense: No controller — keyboard active'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  // Check HID access before enumeration — surfaces macOS/Linux permission guides
  const accessCheck = checkHidAccess()
  if (!accessCheck.ok && isHidPermissionError(accessCheck.error)) {
    handleHidPermissionError(accessCheck.error)
    return
  }

  const hidManager = new HidManager()
  const driver = hidManager.start()

  if (driver !== null) {
    statusBarItem.text = '⊙ Controller'
    statusBarItem.tooltip = 'VibeSense: Controller connected'

    driver.on('data', (raw: unknown) => {
      try {
        const event = raw as ControllerEvent
        if (event.kind === 'connected') {
          const label = controllerLabel(event.controllerType)
          statusBarItem.text = `⊙ ${label}`
          statusBarItem.tooltip = `VibeSense: ${label} connected`
        } else if (event.kind === 'disconnected') {
          statusBarItem.text = '○ No controller — keyboard active'
          statusBarItem.tooltip = 'VibeSense: No controller — keyboard active'
        }
      } catch (err) {
        logger.error('extension: error handling controller event', err)
      }
    })
  } else {
    // Auto-detection failed — offer manual device selection
    void vscode.window
      .showInformationMessage(
        'Controller not found. Check connection or select device manually.',
        'Select Device',
      )
      .then(async (selection) => {
        if (selection === 'Select Device') {
          try {
            const result = await showDeviceSelector()
            if (result) {
              const label = controllerLabel(result.controllerType)
              statusBarItem.text = `⊙ ${label}`
              statusBarItem.tooltip = `VibeSense: ${label} connected`
            }
          } catch (err) {
            logger.error('extension: showDeviceSelector failed', err)
          }
        }
      })
  }

  context.subscriptions.push({ dispose: () => hidManager.stop() })
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  disposeLogger()
}
