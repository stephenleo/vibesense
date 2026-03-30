// src/extension/status-bar.ts
// StatusBarController — persistent VSCode status bar indicator for controller connection state
// Three states: connected (⊙ + type), disconnected (○ + keyboard), low-battery (⚠ + label)
// UX-DR5: always visible, never modal; NFR-A2: color + text, never color alone

import * as vscode from 'vscode'
import type { ControllerType } from '../shared/types'

/**
 * Discriminated union representing the three StatusBarController display states.
 * Maps directly to UX-DR5 states: connected, disconnected, low-battery.
 */
export type StatusBarState =
  | { kind: 'connected'; controllerType: ControllerType }
  | { kind: 'disconnected' }
  | { kind: 'low-battery'; controllerType: ControllerType; level: number }

/** Human-readable labels for each controller type */
const CONTROLLER_LABELS: Record<ControllerType, string> = Object.freeze({
  dualsense: 'DualSense',
  xbox: 'Xbox',
  'generic-hid': 'Controller',
})

/**
 * StatusBarController — wraps a VSCode StatusBarItem and exposes a typed
 * `update(state)` method for controller connection state display.
 *
 * Implements vscode.Disposable for use in context.subscriptions.
 *
 * NFR-A2: All states combine a visual indicator (icon/color) with a text label.
 * NFR-A3: All states set a tooltip for screen reader context.
 * NFR-P4: Single StatusBarItem — negligible memory footprint, no polling, no timers.
 * UX-DR14: No modal dialogs, no toasts. Status bar is the only notification surface.
 */
export class StatusBarController implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
    this.item.show()
    this.update({ kind: 'disconnected' }) // safe default before any HAL event arrives
  }

  /**
   * Update the status bar to reflect the given controller state.
   * All transitions are synchronous and non-blocking (NFR-R1: never throws).
   */
  update(state: StatusBarState): void {
    switch (state.kind) {
      case 'connected': {
        const label = CONTROLLER_LABELS[state.controllerType]
        this.item.text = `⊙ ${label}`
        this.item.tooltip = `VibeSense: ${label} connected`
        this.item.backgroundColor = undefined
        break
      }
      case 'disconnected': {
        this.item.text = '○ No controller — keyboard active'
        this.item.tooltip = 'VibeSense: No controller — keyboard active'
        this.item.backgroundColor = undefined
        break
      }
      case 'low-battery': {
        const label = CONTROLLER_LABELS[state.controllerType]
        const level = Math.max(0, Math.min(100, state.level))
        this.item.text = `⚠ ${label}: low battery`
        this.item.tooltip = `VibeSense: ${label} battery at ${level}% — connect charger`
        this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground')
        break
      }
    }
  }

  /** Dispose the underlying StatusBarItem and remove it from the status bar. */
  dispose(): void {
    this.item.dispose()
  }
}
