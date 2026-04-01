// src/extension/input/radial-wheel-controller.ts
// Handles L2/R2 hold/release, trigger swap, and right-stick navigation for the radial wheel
// Follows same pattern as AnalogScrollController

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { ControllerEvent, WheelSegmentDef } from '../../shared/types'
import type { RadialWheelPanelManager } from '../panels/radial-wheel-panel'
import type { RadialWheelDispatchTracker } from './radial-wheel-dispatch-tracker'
import { L2_SMART_WHEEL_SEGMENTS } from './radial-wheel-segments'
import { computeWheelSegmentIndex } from '../../shared/constants'

/**
 * Intercepts L2/LT/R2/RT button events and right-stick axis events to drive the dual-layer radial wheel.
 * All other events are ignored.
 *
 * Design (Story 7.2 — Dual Layered Wheel):
 * - L2/LT hold → open wheel with L2 active
 * - R2/RT hold → open wheel with R2 active
 * - Opposite trigger pressed while wheel is open → trigger swap (swap active wheel)
 * - Releasing the receded (non-active) trigger → no-op (AC3)
 * - Active trigger release → dispatch selected segment command (or cancel if in dead zone)
 * - Right stick → update segment selection for the active wheel
 *
 * Follows same pattern as AnalogScrollController (single listener, no EventEmitter inheritance).
 */
export class RadialWheelController {
  private l2Held = false
  private r2Held = false
  private activeWheel: 'l2' | 'r2' = 'l2'
  private selectedIndex = -1
  private stickX = 0
  private stickY = 0

  constructor(
    private readonly panelManager: RadialWheelPanelManager,
    private readonly dispatchTracker?: RadialWheelDispatchTracker,
    private readonly getR2Segments?: () => WheelSegmentDef[],
  ) {}

  private resetStickState(): void {
    this.selectedIndex = -1
    this.stickX = 0
    this.stickY = 0
  }

  handleEvent(event: ControllerEvent): void {
    try {
      if (event.kind === 'button') {
        if (event.button === 'l2' || event.button === 'lt') {
          event.pressed ? this.onL2Press() : this.onL2Release()
        } else if (event.button === 'r2' || event.button === 'rt') {
          event.pressed ? this.onR2Press() : this.onR2Release()
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
    this.activeWheel = 'l2'
    this.resetStickState()

    const r2Segments = this.getR2Segments ? this.getR2Segments() : []
    if (this.r2Held) {
      // Wheel already open (R2 active) — perform trigger swap to L2
      this.panelManager.swap('l2', L2_SMART_WHEEL_SEGMENTS, r2Segments)
      logger.debug('RadialWheelController: trigger swap L2 → active')
    } else {
      // Wheel not open — open with L2 active
      this.panelManager.open('l2', L2_SMART_WHEEL_SEGMENTS, r2Segments)
      logger.debug('RadialWheelController: L2 pressed — wheel opened')
    }
  }

  private onR2Press(): void {
    this.r2Held = true
    this.activeWheel = 'r2'
    this.resetStickState()

    const r2Segments = this.getR2Segments ? this.getR2Segments() : []
    if (this.l2Held) {
      // Wheel already open (L2 active) — perform trigger swap to R2
      this.panelManager.swap('r2', L2_SMART_WHEEL_SEGMENTS, r2Segments)
      logger.debug('RadialWheelController: trigger swap R2 → active')
    } else {
      // Wheel not open — open with R2 active
      this.panelManager.open('r2', L2_SMART_WHEEL_SEGMENTS, r2Segments)
      logger.debug('RadialWheelController: R2 pressed — wheel opened')
    }
  }

  private onL2Release(): void {
    if (!this.l2Held) return

    if (this.activeWheel === 'r2') {
      // L2 is the receded trigger — AC3: no action, just clear held state
      this.l2Held = false
      logger.debug('RadialWheelController: L2 released (receded) — no action (AC3)')
      return
    }

    // activeWheel === 'l2' — L2 is the active trigger, dispatch and close
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
          logger.info(`RadialWheelController: dispatched L2 segment ${this.selectedIndex} → ${seg.commandId}`)
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

    this.r2Held = false
  }

  private onR2Release(): void {
    if (!this.r2Held) return

    if (this.activeWheel === 'l2') {
      // R2 is the receded trigger — AC3: no action, just clear held state
      this.r2Held = false
      logger.debug('RadialWheelController: R2 released (receded) — no action (AC3)')
      return
    }

    // activeWheel === 'r2' — R2 is the active trigger, dispatch and close
    this.r2Held = false
    this.dispatchFromR2()
    this.l2Held = false
  }

  private dispatchFromR2(): void {
    if (this.selectedIndex >= 0) {
      // Use live segments from getR2Segments callback for dispatch (Story 7.4)
      const r2Segments = this.getR2Segments ? this.getR2Segments() : []
      const seg = r2Segments[this.selectedIndex]
      if (seg) {
        this.panelManager.close(false)
        // Story 7.4: Increment dispatch count after successful dispatch
        void this.dispatchTracker?.increment(this.selectedIndex)
        try {
          if (seg.promptText) {
            void vscode.commands.executeCommand('vibesense.dispatchPrompt', seg.promptText)
          } else {
            void vscode.commands.executeCommand(seg.commandId)
          }
          logger.info(`RadialWheelController: R2 dispatched segment ${this.selectedIndex} → ${seg.commandId}`)
        } catch (err) {
          logger.error('RadialWheelController: R2 dispatch error', err)
        }
      } else {
        this.panelManager.close(true)
        logger.debug('RadialWheelController: R2 released — segment not found, cancelled')
      }
    } else {
      this.panelManager.close(true) // cancel — stick was in dead zone
      logger.debug('RadialWheelController: R2 released — dead zone, cancelled')
    }
  }

  private onStickUpdate(): void {
    if (!this.l2Held && !this.r2Held) return
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
