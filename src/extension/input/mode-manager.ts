// src/extension/input/mode-manager.ts
// Owns mode state (Guided vs Full), binding filtering, and persistence across restarts.
// Story 4.3: Guided Mode / Full Mode Progressive Unlock

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { ButtonId } from '../../shared/types'
import type { BindingMap, BindingMode } from './default-bindings'
import { GUIDED_MODE_BUTTON_IDS } from './default-bindings'

/** globalState key used to persist the active mode across restarts */
const GLOBAL_STATE_KEY = 'vibesense.mode'

/** VSCode workspace setting key for toggling Full mode */
const SETTING_KEY = 'vibesense.fullMode'

export class ModeManager implements vscode.Disposable {
  private currentMode: BindingMode
  private readonly modeEmitter = new vscode.EventEmitter<BindingMode>()
  readonly onDidChangeMode: vscode.Event<BindingMode> = this.modeEmitter.event
  private readonly configListener: vscode.Disposable

  constructor(private readonly context: vscode.ExtensionContext) {
    // globalState wins — tutorial completion is persisted there and must survive
    // settings changes (AC 4: mode persists across restarts).
    const stored = context.globalState.get<BindingMode>(GLOBAL_STATE_KEY)
    if (stored === 'guided' || stored === 'full') {
      this.currentMode = stored
    } else {
      // Fall back to VSCode setting when no persisted state exists (first install).
      const setting = vscode.workspace.getConfiguration('vibesense').get<boolean>(SETTING_KEY, false)
      this.currentMode = setting ? 'full' : 'guided'
    }
    logger.info(`ModeManager: initial mode = ${this.currentMode}`)

    // React to manual settings toggle in real time (AC 3).
    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SETTING_KEY)) {
        const enabled = vscode.workspace
          .getConfiguration('vibesense')
          .get<boolean>(SETTING_KEY, false)
        if (enabled) {
          this.setFullMode()
        } else {
          this.setGuidedMode()
        }
      }
    })
  }

  /** Current active mode. */
  get mode(): BindingMode {
    return this.currentMode
  }

  /**
   * Returns a filtered copy of `fullBindings` based on the current mode.
   * - Full mode: returns `fullBindings` unchanged.
   * - Guided mode: returns only entries whose ButtonId is in `GUIDED_MODE_BUTTON_IDS`.
   */
  getFilteredBindings(fullBindings: BindingMap): BindingMap {
    if (this.currentMode === 'full') return fullBindings
    const filtered: BindingMap = {}
    for (const [key, value] of Object.entries(fullBindings)) {
      if (GUIDED_MODE_BUTTON_IDS.has(key as ButtonId)) {
        filtered[key as ButtonId] = value
      }
    }
    return filtered
  }

  /**
   * Switch to Full mode, persist to globalState, and notify subscribers.
   * Errors are caught and logged — never rethrown (NFR-R1).
   */
  setFullMode(): void {
    try {
      this.currentMode = 'full'
      void this.context.globalState.update(GLOBAL_STATE_KEY, 'full')
      this.modeEmitter.fire('full')
      logger.info('ModeManager: switched to Full mode')
    } catch (err) {
      logger.error('ModeManager: setFullMode failed', err)
    }
  }

  /**
   * Switch to Guided mode, persist to globalState, and notify subscribers.
   * Errors are caught and logged — never rethrown (NFR-R1).
   */
  setGuidedMode(): void {
    try {
      this.currentMode = 'guided'
      void this.context.globalState.update(GLOBAL_STATE_KEY, 'guided')
      this.modeEmitter.fire('guided')
      logger.info('ModeManager: switched to Guided mode')
    } catch (err) {
      logger.error('ModeManager: setGuidedMode failed', err)
    }
  }

  dispose(): void {
    this.configListener.dispose()
    this.modeEmitter.dispose()
  }
}
