// src/extension/input/radial-wheel-controller.ts
// Handles L2 hold/release and right-stick navigation for the radial wheel
// Follows same pattern as AnalogScrollController

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { ControllerEvent } from '../../shared/types'
import type { RadialWheelPanelManager } from '../panels/radial-wheel-panel'
import { L2_SMART_WHEEL_SEGMENTS } from './radial-wheel-segments'
import { computeWheelSegmentIndex } from '../../shared/constants'

/**
 * Intercepts L2/LT button events and right-stick axis events to drive the radial wheel.
 * All other events are ignored.
 *
 * Design:
 * - L2/LT hold → open wheel
 * - Right stick → update segment selection
 * - L2/LT release → dispatch selected segment command (or cancel if in dead zone)
 *
 * Follows same pattern as AnalogScrollController (single listener, no EventEmitter inheritance).
 */
export class RadialWheelController {
  private l2Held = false
  private selectedIndex = -1
  private stickX = 0
  private stickY = 0

  constructor(private readonly panelManager: RadialWheelPanelManager) {}

  handleEvent(event: ControllerEvent): void {
    try {
      if (event.kind === 'button') {
        if (event.button === 'l2' || event.button === 'lt') {
          if (event.pressed) {
            this.onL2Press()
          } else {
            this.onL2Release()
          }
        }
      } else if (event.kind === 'axis') {
        if (event.axis === 'right_x') {
          this.stickX = event.value
          this.onStickUpdate()
        } else if (event.axis === 'right_y') {
          this.stickY = event.value
          this.onStickUpdate()
        }
      }
    } catch (err) {
      logger.error('RadialWheelController: handleEvent error', err)
    }
  }

  private onL2Press(): void {
    this.l2Held = true
    this.selectedIndex = -1
    this.stickX = 0
    this.stickY = 0
    this.panelManager.open('l2', L2_SMART_WHEEL_SEGMENTS, [])
    logger.debug('RadialWheelController: L2 pressed — wheel opened')
  }

  private onL2Release(): void {
    if (!this.l2Held) return
    this.l2Held = false

    if (this.selectedIndex >= 0) {
      const seg = L2_SMART_WHEEL_SEGMENTS[this.selectedIndex]
      if (seg) {
        this.panelManager.close(false)
        try {
          if (seg.promptText) {
            void vscode.commands.executeCommand('vibesense.dispatchPrompt', seg.promptText)
          } else {
            void vscode.commands.executeCommand(seg.commandId)
          }
          logger.info(`RadialWheelController: dispatched segment ${this.selectedIndex} → ${seg.commandId}`)
        } catch (err) {
          logger.error('RadialWheelController: dispatch error', err)
        }
      } else {
        this.panelManager.close(true)
        logger.debug('RadialWheelController: L2 released — segment not found, cancelled')
      }
    } else {
      this.panelManager.close(true) // cancel — stick was in dead zone
      logger.debug('RadialWheelController: L2 released — dead zone, cancelled')
    }
  }

  private onStickUpdate(): void {
    if (!this.l2Held) return
    const newIndex = computeWheelSegmentIndex(this.stickX, this.stickY)
    if (newIndex !== this.selectedIndex) {
      this.selectedIndex = newIndex
    }
    this.panelManager.updateStick(this.stickX, this.stickY)
  }

  dispose(): void {
    logger.debug('RadialWheelController: disposed')
  }
}
