// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 2.6

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'
import { HidManager } from './hid/hid-manager'
import { ControllerLifecycleManager } from './hid/controller-lifecycle-manager'
import { StatusBarController } from './status-bar'
import { checkHidAccess, isHidPermissionError } from './platform/permission-checker'
import { handleHidPermissionError } from './platform/platform-guide'
import { showDeviceSelector } from './platform/device-selector'
import { InputRouter } from './input/input-router'
import { loadBindings } from './input/binding-loader'
import { ensureWorkspaceProfile } from './input/profile-writer'
import { CLAUDE_CODE_DEFAULT_PROFILE } from './input/profile-schema'
import { SlidePanelManager } from './panels/slide-panel-manager'
import { registerCommands } from './commands/register'
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

  // Instantiate SlidePanel manager (Story 3.4) — must be before registerCommands (Story 3.3)
  const slidePanelManager = new SlidePanelManager(context)
  context.subscriptions.push(slidePanelManager)

  // Story 3.1: Register controller-triggered terminal and agent launch commands (FR10, FR11, FR12)
  // Story 3.3: Pass slidePanelManager so session-switch commands can notify the webview (FR13)
  registerCommands(context, slidePanelManager)

  // Send initial empty session list on startup — panel shows empty state hint
  slidePanelManager.updateSessions([])

  // Load binding profile and create input router (Story 2.5)
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath

  // Story 2.7: Create .vscode/vibesense.json if not present
  ensureWorkspaceProfile(workspaceRoot, CLAUDE_CODE_DEFAULT_PROFILE)

  // Story 2.5: Load binding profile (file may now exist from above)
  const bindings = loadBindings(workspaceRoot)
  const inputRouter = new InputRouter(bindings)
  context.subscriptions.push(inputRouter)

  // Story 4.2: Hot-reload bindings when vibesense.* configuration changes (e.g., via Settings Sync)
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vibesense')) {
        try {
          const newBindings = loadBindings(workspaceRoot)
          inputRouter.updateBindings(newBindings)
          logger.info('VibeSense: bindings reloaded after configuration change')
        } catch (err) {
          logger.error('VibeSense: failed to reload bindings on config change', err)
        }
      }
    }),
  )

  // Check HID access before enumeration — surfaces macOS/Linux permission guides (Story 2.6)
  const accessCheck = checkHidAccess()
  if (!accessCheck.ok && isHidPermissionError(accessCheck.error)) {
    handleHidPermissionError(accessCheck.error)
    return
  }

  // Track current controller type for battery event correlation.
  let currentControllerType: ControllerType | null = null

  hidManager = new HidManager()
  const initialDriver = hidManager.start()

  // If a controller is already plugged in at startup, reflect that immediately (FR27)
  if (initialDriver !== null) {
    statusBar.update({ kind: 'connected', controllerType: initialDriver.controllerType })
    currentControllerType = initialDriver.controllerType
    slidePanelManager.notifyControllerConnected(initialDriver.controllerType)
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

  /**
   * Attach input-router event listener to a HAL driver.
   * Called on initial connect and on every reconnect (Story 2.5).
   */
  function attachInputListeners(driver: {
    on: (event: string | symbol, listener: (...args: unknown[]) => void) => unknown
  }): void {
    driver.on('data', (raw: unknown) => {
      try {
        const event = raw as ControllerEvent
        inputRouter.handleEvent(event)
      } catch (err) {
        logger.error('InputRouter: data handler error', err)
      }
    })
  }

  // Attach status-bar listeners to the initial driver (if any)
  if (initialDriver !== null) {
    attachStatusBarListeners(initialDriver)
    attachInputListeners(initialDriver)
  }

  // Auto-detection failed — offer manual device selection (Story 2.6, FR5)
  if (initialDriver === null) {
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
              currentControllerType = result.controllerType
              statusBar.update({ kind: 'connected', controllerType: result.controllerType })
              attachStatusBarListeners(result.driver)
              attachInputListeners(result.driver)
            }
          } catch (err) {
            logger.error('extension: showDeviceSelector failed', err)
          }
        }
      })
  }

  lifecycleManager = new ControllerLifecycleManager(
    initialDriver,
    (driver) => {
      logger.info('VibeSense: controller connected', driver.controllerType)
      currentControllerType = driver.controllerType
      statusBar.update({ kind: 'connected', controllerType: driver.controllerType })
      slidePanelManager.notifyControllerConnected(driver.controllerType)
      attachStatusBarListeners(driver)
      attachInputListeners(driver)
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
