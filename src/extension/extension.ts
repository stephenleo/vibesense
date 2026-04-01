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
import { LedController } from './output/led-controller'
import { registerHooks } from './ipc/hook-writer'
import { PipeServer } from './ipc/pipe-server'
import { TerminalOutputParser } from './session/terminal-parser'
import { LastCommandTracker } from './session/last-command-tracker'
import { HapticController } from './output/haptic-controller'
import { NotifyDispatcher } from './ipc/notify-dispatcher'
import { DndController } from './output/dnd-controller'
import { RadialWheelPanelManager } from './panels/radial-wheel-panel'
import { RadialWheelController } from './input/radial-wheel-controller'
import { RadialWheelDispatchTracker } from './input/radial-wheel-dispatch-tracker'
import { loadR2PersonalSegments } from './input/radial-wheel-segments'
import { HudPanelManager } from './panels/hud-panel'
import { MiniGamePanelManager } from './panels/mini-game-panel'
import { GameHighScoreStore } from './panels/game-high-score-store'
import type { ControllerEvent, ControllerType, Session } from '../shared/types'
import type { ControllerHAL } from './hid/hal'
import type { AggregateGameState } from './fsm/states'
import type { AgentState } from '../shared/types'

// Module-level references — accessible for deactivate() and subscription dispose
let lifecycleManager: ControllerLifecycleManager | undefined
let hidManager: HidManager | undefined
// Story 5.1: Module-level sessionManager ref — Stories 5.2/5.3 call handleHookMessage() via this
export let sessionManager: SessionManager | undefined
// Story 5.5: Module-level lastCommandTracker ref — tracks last command per session for retry
export let lastCommandTracker: LastCommandTracker | undefined
// Story 6.2: Module-level ledController ref — drives DualSense lightbar color from FSM state
let ledController: LedController | undefined

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

  // Story 5.5: Instantiate LastCommandTracker — tracks last VibeSense-sent command per session
  lastCommandTracker = new LastCommandTracker()
  context.subscriptions.push({
    dispose: () => {
      lastCommandTracker?.dispose()
      lastCommandTracker = undefined
    },
  })

  // Story 6.1: Track the currently active HAL driver for haptic routing
  // Set/cleared in ControllerLifecycleManager connect/disconnect callbacks below
  let currentDriver: ControllerHAL | null = null

  // Story 6.4: NotifyDispatcher — routes vibeSense.notify() payloads to hardware controllers
  // Uses getter closure so it always sees the latest currentDriver value
  const notifyDispatcher = new NotifyDispatcher(() => currentDriver)

  // Story 5.3: IPC server — Claude Code hooks and vibeSense.notify() API
  // Story 6.4: Pass notifyDispatcher so notify payloads are routed to hardware controllers
  const pipeServer = new PipeServer(sessionManager, notifyDispatcher)
  pipeServer.start()
  context.subscriptions.push({ dispose: () => pipeServer.stop() })

  // Story 6.5: DND controller — reads vibesense.dndEnabled / vibesense.dndThreshold live on each call
  // Stateless — no listeners, no dispose needed.
  const dndController = new DndController()

  // Story 6.1: Instantiate HapticController BEFORE visual panel managers (UX-DR14 haptic-first)
  // EventEmitter fires listeners in registration order — haptic must subscribe first.
  // Story 6.5: Wire real DND suppression callback (replaces () => false stub)
  const hapticController = new HapticController(
    sessionManager,
    () => currentDriver,
    (priority) => dndController.isDndSuppressed(priority),
  )
  context.subscriptions.push({ dispose: () => hapticController.dispose() })

  // Story 6.2: LED color state controller — drives DualSense lightbar from FSM state (FR25, UX-DR4)
  // Constructed with null HAL initially; updateHal() is called when controller connects/disconnects
  // Story 6.5: Wire real DND suppression callback
  ledController = new LedController(
    sessionManager,
    null,
    (priority) => dndController.isDndSuppressed(priority),
  )
  // TODO(6.5): Wire dndController.forPriority() into AudioController when Story 6.3 merges
  context.subscriptions.push({ dispose: () => { ledController?.dispose(); ledController = undefined } })

  // Story 5.1: Log aggregateGameStateChanged events
  // Story 8.1: Wire MiniGamePanelManager countdown on PLAY/PAUSE transitions (AC1, FR30)
  // Story 8.2: Wire pauseGame()/resumeGame() for auto-pause/resume (FR31, FR32)
  sessionManager.on('aggregateGameStateChanged', (state: AggregateGameState) => {
    logger.info(`SessionManager: aggregateGameState → ${state}`)
    if (state === 'PLAY') {
      miniGamePanelManager.resumeGame()   // Story 8.2: resume before countdown (AC2)
      miniGamePanelManager.startCountdown()
    } else {
      miniGamePanelManager.cancelCountdown()
      miniGamePanelManager.pauseGame()    // Story 8.2: pause running game (AC1, AC4)
    }
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

  // Story 7.1: Instantiate RadialWheelPanelManager (lazy panel creation)
  const radialWheelPanelManager = new RadialWheelPanelManager(context)
  context.subscriptions.push(radialWheelPanelManager)

  // Story 7.3: Instantiate HudPanelManager — floating button map overlay (FR29)
  const hudPanelManager = new HudPanelManager(context)
  context.subscriptions.push(hudPanelManager)

  // Story 8.4: Instantiate GameHighScoreStore — persists mini-game high scores across restarts (FR33)
  const highScoreStore = new GameHighScoreStore(context.globalState)

  // Story 8.1: Instantiate MiniGamePanelManager — Snake game WebviewPanel (FR30, FR34)
  // Story 8.4: Pass highScoreStore for persistence (AC1, AC2, AC5, AC6)
  const miniGamePanelManager = new MiniGamePanelManager(context, highScoreStore)
  context.subscriptions.push(miniGamePanelManager)

  // Story 5.5: Subscribe to per-session state changes — auto-open error menu on error transition (AC 1)
  // Story 8.2: Also update SlidePanel session list so SessionCard shows current agent states (UX-DR4)
  sessionManager.on('sessionStateChanged', (sid: string, _prev: AgentState, next: AgentState) => {
    if (next === 'error') {
      const lastCommand = lastCommandTracker?.getLastCommand(sid)
      slidePanelManager.notifyErrorMenuOpen(sid, lastCommand !== undefined)
    }
    // Update SlidePanel session list so SessionCard shows current agent states (UX-DR4)
    const allSessions = sessionManager?.getSessions()
    if (allSessions) {
      const sessions: Session[] = [...allSessions.entries()].map(([sessionId, fsm]) => ({
        sessionId,
        agentState: fsm.state,
      }))
      slidePanelManager.updateSessions(sessions)
    }
  })

  // Story 3.1: Register controller-triggered terminal and agent launch commands (FR10, FR11, FR12)
  // Story 3.3: Pass slidePanelManager so session-switch commands can notify the webview (FR13)
  // Story 4.3: Pass modeManager so vibesense.completeTutorial can call setFullMode() (AC 2)
  // Story 4.4: Pass onboardingPanelManager so vibesense.startOnboarding command is registered
  // Story 5.5: Pass sessionManager + lastCommandTracker for error recovery commands (FR56)
  // Story 7.3: Pass hudPanelManager so vibesense.toggleHud command can toggle the HUD overlay
  // Story 8.1: Pass miniGamePanelManager so vibesense.toggleGame command is registered (FR34)
  registerCommands(context, slidePanelManager, modeManager, onboardingPanelManager, sessionManager, lastCommandTracker, hudPanelManager, miniGamePanelManager)

  // Send initial empty session list on startup — panel shows empty state hint
  slidePanelManager.updateSessions([])

  // Load binding profile and create input router (Story 2.5)
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? context.extensionUri.fsPath

  // Story 2.7: Create .vscode/vibesense.json if not present
  ensureWorkspaceProfile(workspaceRoot, CLAUDE_CODE_DEFAULT_PROFILE)

  // Story 7.4: Instantiate DispatchTracker + getR2Segments closure for live label fading
  // Must be after workspaceRoot is defined so the closure can read .vscode/vibesense.json
  const dispatchTracker = new RadialWheelDispatchTracker(context.globalState)

  const getR2Segments = () => {
    const forceIconOnly =
      vscode.workspace.getConfiguration('vibesense').get<boolean>('radialWheel.forceIconOnly') ?? false
    return loadR2PersonalSegments(workspaceRoot, dispatchTracker, forceIconOnly)
  }

  const radialWheelController = new RadialWheelController(radialWheelPanelManager, dispatchTracker, getR2Segments)
  context.subscriptions.push({ dispose: () => radialWheelController.dispose() })

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
  // Story 7.3: Also notify HudPanelManager on mode change (AC3 — filter guided/full bindings in HUD).
  context.subscriptions.push(
    modeManager.onDidChangeMode(() => {
      const filtered = modeManager.getFilteredBindings(bindings)
      inputRouter.updateBindings(filtered)
      hudPanelManager.updateMode(modeManager.mode, filtered)
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
    currentDriver = initialDriver  // Story 6.1: make HAL available to HapticController
    slidePanelManager.notifyControllerConnected(initialDriver.controllerType)
    // Story 6.2: Provide initial HAL to LED controller
    ledController?.updateHal(initialDriver)
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
        // Story 7.1: RadialWheelController intercepts L2/LT + right-stick events
        radialWheelController.handleEvent(event)
        // Story 8.1: Route right-stick axis events to game panel when open (AC2)
        if (event.kind === 'axis' && (event.axis === 'right_x' || event.axis === 'right_y')) {
          if (miniGamePanelManager.isOpen()) {
            miniGamePanelManager.updateAxis(event.axis, event.value)
          }
        }
        // Story 8.3: Route left-stick and D-pad inputs to Tetris when game panel is open
        if (event.kind === 'axis' && (event.axis === 'left_x' || event.axis === 'left_y')) {
          if (miniGamePanelManager.isOpen()) {
            miniGamePanelManager.updateLeftAxis(event.axis, event.value)
          }
        }
        if (event.kind === 'button') {
          if (miniGamePanelManager.isOpen()) {
            miniGamePanelManager.notifyButton(event.button, event.pressed)
          }
        }
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
              currentDriver = result.driver  // Story 6.1: make manually-selected HAL available to HapticController
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
      currentDriver = driver  // Story 6.1: make new HAL available to HapticController
      statusBar.update({ kind: 'connected', controllerType: driver.controllerType })
      slidePanelManager.notifyControllerConnected(driver.controllerType)
      settingsPanelManager.notifyControllerConnected(driver.controllerType)
      attachStatusBarListeners(driver)
      attachInputListeners(driver)
      attachOnboardingListeners(driver)
      // Story 6.2: Provide HAL to LED controller on reconnect
      ledController?.updateHal(driver)
      // Story 7.3: Update HUD bindings when controller (re)connects (AC2)
      hudPanelManager.updateBindings(modeManager.getFilteredBindings(bindings), driver.controllerType, modeManager.mode)
    },
    () => {
      logger.info('VibeSense: controller disconnected — keyboard fallback active')
      currentControllerType = null
      currentDriver = null  // Story 6.1: clear HAL ref on disconnect
      statusBar.update({ kind: 'disconnected' })
      // Story 6.2: Clear HAL from LED controller on disconnect
      ledController?.updateHal(null)
      // Story 7.3: Update HUD bindings on disconnect so stale controller icons are replaced with generic-hid fallback (AC2)
      hudPanelManager.updateBindings(modeManager.getFilteredBindings(bindings), null, modeManager.mode)
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
  ledController?.dispose()
  ledController = undefined
  sessionManager?.dispose()
  sessionManager = undefined
  lastCommandTracker?.dispose()
  lastCommandTracker = undefined
  disposeLogger()
}
