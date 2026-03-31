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
import { ModeManager } from './input/mode-manager'
import { SlidePanelManager } from './panels/slide-panel-manager'
import { SettingsPanelManager } from './panels/settings-panel'
import { OnboardingPanelManager } from './panels/onboarding-panel'
import { SettingsBridge } from './input/settings-bridge'
import { registerCommands } from './commands/register'
import { SessionManager } from './session/session-manager'
import { registerHooks } from './ipc/hook-writer'
import { PipeServer } from './ipc/pipe-server'
import { TerminalOutputParser } from './session/terminal-parser'
import type { ControllerEvent, ControllerType } from '../shared/types'
import type { AggregateGameState } from './fsm/states'

// Module-level references — accessible for deactivate() and subscription dispose
let lifecycleManager: ControllerLifecycleManager | undefined
let hidManager: HidManager | undefined
// Story 5.1: Module-level sessionManager ref — Stories 5.2/5.3 call handleHookMessage() via this
export let sessionManager: SessionManager | undefined

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  // Instantiate status bar immediately so it's always visible (FR27)
  const statusBar = new StatusBarController()
  context.subscriptions.push(statusBar)

  // Story 5.1: Instantiate SessionManager after statusBar — tracks agent FSM states per session
  sessionManager = new SessionManager()
  context.subscriptions.push({
    dispose: () => {
      sessionManager?.dispose()
      sessionManager = undefined
    },
  })

  // Story 5.3: IPC server — Claude Code hooks and vibeSense.notify() API
  const pipeServer = new PipeServer(sessionManager)
  pipeServer.start()
  context.subscriptions.push({ dispose: () => pipeServer.stop() })

  // Story 5.1: Log aggregateGameStateChanged events (haptic/LED/game integrations come in later epics)
  sessionManager.on('aggregateGameStateChanged', (state: AggregateGameState) => {
    logger.info(`SessionManager: aggregateGameState → ${state}`)
  })

  // Story 5.1: Per-session state transitions are already logged inside SessionManager.getOrCreateFsm()

  // Story 5.2: Register Claude Code hooks — writes Stop + PostToolUse to ~/.claude/settings.json
  // Never throws (NFR-R1) — see hook-writer.ts
  registerHooks(context)

  // Story 5.4: Terminal output fallback parser — active when hooks unavailable.
  // hookActive is wired to () => false here: hook liveness is determined at runtime by whether
  // hook messages arrive via the IPC pipe (PipeServer), not by whether registerHooks() was called.
  // The terminal parser always starts active and defers to the IPC channel once it proves live.
  const terminalParser = new TerminalOutputParser(sessionManager, () => false)
  context.subscriptions.push(terminalParser)

  // Instantiate SlidePanel manager (Story 3.4) — must be before registerCommands (Story 3.3)
  const slidePanelManager = new SlidePanelManager(context)
  context.subscriptions.push(slidePanelManager)

  // Story 4.3: Instantiate ModeManager after context is ready but before InputRouter.
  // ModeManager reads globalState to restore persisted mode (AC 4) and registers
  // a configuration listener for vibesense.fullMode (AC 3).
  const modeManager = new ModeManager(context)
  context.subscriptions.push(modeManager)

  // Story 4.4: Instantiate OnboardingPanelManager before registerCommands
  const onboardingPanelManager = new OnboardingPanelManager(context)
  context.subscriptions.push(onboardingPanelManager)

  // Story 3.1: Register controller-triggered terminal and agent launch commands (FR10, FR11, FR12)
  // Story 3.3: Pass slidePanelManager so session-switch commands can notify the webview (FR13)
  // Story 4.3: Pass modeManager so vibesense.completeTutorial can call setFullMode() (AC 2)
  // Story 4.4: Pass onboardingPanelManager so vibesense.startOnboarding command is registered
  registerCommands(context, slidePanelManager, modeManager, onboardingPanelManager)

  // Send initial empty session list on startup — panel shows empty state hint
  slidePanelManager.updateSessions([])

  // Load binding profile and create input router (Story 2.5)
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath

  // Story 2.7: Create .vscode/vibesense.json if not present
  ensureWorkspaceProfile(workspaceRoot, CLAUDE_CODE_DEFAULT_PROFILE)

  // Story 4.1: Create SettingsBridge (reads VSCode config API + writes profile atomically)
  const settingsBridge = new SettingsBridge(workspaceRoot)

  // Story 2.5: Load binding profile (file may now exist from above)
  const bindings = loadBindings(workspaceRoot)

  // Story 4.3: Filter bindings based on current mode before passing to InputRouter (AC 1, 5).
  // In Guided mode only core button IDs are exposed; in Full mode all bindings pass through.
  const initialBindings = modeManager.getFilteredBindings(bindings)
  const inputRouter = new InputRouter(initialBindings)
  context.subscriptions.push(inputRouter)

  // Story 4.3: Subscribe to mode changes — hot-swap the binding map on mode transitions (AC 2, 3).
  context.subscriptions.push(
    modeManager.onDidChangeMode(() => {
      const filtered = modeManager.getFilteredBindings(bindings)
      inputRouter.updateBindings(filtered)
    }),
  )

  // Story 4.1: Instantiate SettingsPanelManager and register vibesense.openSettings command
  const settingsPanelManager = new SettingsPanelManager(context, settingsBridge, inputRouter)
  context.subscriptions.push(settingsPanelManager)

  context.subscriptions.push(
    vscode.commands.registerCommand('vibesense.openSettings', () => {
      try {
        settingsPanelManager.open()
      } catch (err) {
        logger.error('extension: vibesense.openSettings failed', err)
        // NFR-R1: never rethrow
      }
    }),
  )

  // Story 4.1: Watch VSCode settings for immediate hot-reload (AC 2)
  context.subscriptions.push(
    settingsBridge.watchSettings((newBindings) => {
      inputRouter.reloadBindings(newBindings)
    }),
  )

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
          settingsPanelManager.notifyControllerConnected(event.controllerType)
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

  /**
   * Attach onboarding button-forwarding listener to a HAL driver.
   * Forwards button events to the onboarding panel when it is open (Story 4.4).
   * Called alongside attachStatusBarListeners and attachInputListeners.
   */
  function attachOnboardingListeners(driver: {
    on: (event: string | symbol, listener: (...args: unknown[]) => void) => unknown
  }): void {
    driver.on('data', (raw: unknown) => {
      try {
        const event = raw as ControllerEvent
        if (event.kind === 'button' && event.pressed && onboardingPanelManager.isOpen()) {
          onboardingPanelManager.notifyButtonPressed(event.button)
        }
      } catch (err) {
        logger.error('OnboardingPanel: button forward error', err)
      }
    })
  }

  // Attach status-bar listeners to the initial driver (if any)
  if (initialDriver !== null) {
    attachStatusBarListeners(initialDriver)
    attachInputListeners(initialDriver)
    attachOnboardingListeners(initialDriver)
  }

  // Story 4.4: First-launch detection — auto-open tutorial if onboarding not yet complete (AC 1)
  const onboardingDone = context.globalState.get<boolean>('vibesense.onboardingComplete') === true
  if (!onboardingDone) {
    onboardingPanelManager.open(currentControllerType)
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
              attachOnboardingListeners(result.driver)
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
      settingsPanelManager.notifyControllerConnected(driver.controllerType)
      attachStatusBarListeners(driver)
      attachInputListeners(driver)
      attachOnboardingListeners(driver)
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
  sessionManager?.dispose()
  sessionManager = undefined
  disposeLogger()
}
