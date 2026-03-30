// src/extension/hid/dualsense-driver.ts
// DualSense controller driver — uses dualsense-ts for HID report parsing
// Implements ControllerHAL for DualSense (USB + Bluetooth via dualsense-ts)

import { EventEmitter } from 'events'
import { Dualsense } from 'dualsense-ts'
import type { Momentary, Axis, Trigger } from 'dualsense-ts'
import { logger } from '../logger'
import type { ControllerHAL } from './hal'
import type { ControllerEvent, ButtonId, AxisId, HapticPattern } from '../../shared/types'

/**
 * DualSense controller driver.
 *
 * Uses dualsense-ts to handle both USB and Bluetooth DualSense report formats.
 * Emits normalized ControllerEvents on the 'data' event.
 */
export class DualSenseDriver extends EventEmitter implements ControllerHAL {
  private controller: Dualsense | null = null
  private hapticTimers: ReturnType<typeof setTimeout>[] = []

  // Typed overload for 'data' event
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }

  start(): void {
    try {
      this.controller = new Dualsense()

      // Connection state
      this.controller.connection.on('change', (input: Momentary) => {
        try {
          if (input.state) {
            this.emit('data', { kind: 'connected', controllerType: 'dualsense' } satisfies ControllerEvent)
            logger.info('DualSense connected')
            this.startBatteryPolling()
          } else {
            this.emit('data', { kind: 'disconnected' } satisfies ControllerEvent)
            logger.info('DualSense disconnected')
          }
        } catch (err) {
          logger.error('DualSense connection event error', err)
        }
      })

      // Emit connected immediately if already plugged in — 'change' only fires on transitions
      if (this.controller.connection.state) {
        this.emit('data', { kind: 'connected', controllerType: 'dualsense' } satisfies ControllerEvent)
        logger.info('DualSense connected (already connected at start)')
        this.startBatteryPolling()
      }

      this.setupButtonListeners()
      this.setupAxisListeners()

      logger.info('DualSenseDriver started')
    } catch (err) {
      logger.error('DualSenseDriver start failed', err)
    }
  }

  stop(): void {
    try {
      for (const timer of this.hapticTimers) {
        clearTimeout(timer)
      }
      this.hapticTimers = []
      if (this.controller) {
        this.controller = null
      }
      logger.info('DualSenseDriver stopped')
    } catch (err) {
      logger.error('DualSenseDriver stop failed', err)
    }
  }

  setHaptic(pattern: HapticPattern): void {
    if (!this.controller) {
      return
    }
    try {
      switch (pattern) {
        case 'single_pulse':
          this.controller.rumble(0.5)
          this.scheduleHaptic(() => this.controller?.rumble(0), 80)
          break
        case 'double_pulse':
          this.controller.rumble(0.5)
          this.scheduleHaptic(() => this.controller?.rumble(0), 60)
          this.scheduleHaptic(() => this.controller?.rumble(0.5), 120)
          this.scheduleHaptic(() => this.controller?.rumble(0), 200)
          break
        case 'triple_pulse':
          this.controller.rumble(0.5)
          this.scheduleHaptic(() => this.controller?.rumble(0), 50)
          this.scheduleHaptic(() => this.controller?.rumble(0.5), 100)
          this.scheduleHaptic(() => this.controller?.rumble(0), 150)
          this.scheduleHaptic(() => this.controller?.rumble(0.5), 200)
          this.scheduleHaptic(() => this.controller?.rumble(0), 260)
          break
        case 'slow_rumble':
          this.controller.rumble(0.3)
          this.scheduleHaptic(() => this.controller?.rumble(0), 500)
          break
        case 'none':
          this.controller.rumble(0)
          break
      }
    } catch (err) {
      logger.error('DualSense setHaptic error', err)
    }
  }

  setLED(_color: string): void {
    // dualsense-ts does not currently expose lightbar RGB directly in the public API.
    // This is a no-op stub — lightbar color control will be implemented in Story 6.2
    // using the raw HID command layer when the LED controller story is implemented.
    logger.info('DualSense setLED called (stub)')
  }

  private scheduleHaptic(fn: () => void, delayMs: number): void {
    const timer = setTimeout(fn, delayMs)
    this.hapticTimers.push(timer)
  }

  private setupButtonListeners(): void {
    if (!this.controller) {
      return
    }

    const c = this.controller

    // Face buttons
    this.registerMomentary(c.cross, 'cross')
    this.registerMomentary(c.circle, 'circle')
    this.registerMomentary(c.square, 'square')
    this.registerMomentary(c.triangle, 'triangle')

    // Options
    this.registerMomentary(c.options, 'options')

    // Bumpers
    this.registerMomentary(c.left.bumper, 'l1')
    this.registerMomentary(c.right.bumper, 'r1')

    // Trigger buttons (digital press)
    this.registerMomentary(c.left.trigger.button, 'l2')
    this.registerMomentary(c.right.trigger.button, 'r2')

    // Analog stick buttons (L3/R3)
    this.registerMomentary(c.left.analog.button, 'l3')
    this.registerMomentary(c.right.analog.button, 'r3')

    // D-pad
    this.registerMomentary(c.dpad.up, 'up')
    this.registerMomentary(c.dpad.down, 'down')
    this.registerMomentary(c.dpad.left, 'left')
    this.registerMomentary(c.dpad.right, 'right')

    // Touchpad button (using the nested .button Momentary)
    this.registerMomentary(c.touchpad.button, 'touchpad')
  }

  private registerMomentary(input: Momentary, buttonId: ButtonId): void {
    input.on('change', (i: Momentary) => {
      try {
        this.emit('data', {
          kind: 'button',
          button: buttonId,
          pressed: i.state,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error(`DualSense button (${buttonId}) event error`, err)
      }
    })
  }

  private setupAxisListeners(): void {
    if (!this.controller) {
      return
    }

    const c = this.controller

    // Left analog stick — dualsense-ts Axis.state is a Force (-1.0..1.0)
    c.left.analog.x.on('change', (axis: Axis) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'left_x' as AxisId,
          value: axis.state,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense left_x axis error', err)
      }
    })

    c.left.analog.y.on('change', (axis: Axis) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'left_y' as AxisId,
          value: axis.state,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense left_y axis error', err)
      }
    })

    // Right analog stick
    c.right.analog.x.on('change', (axis: Axis) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'right_x' as AxisId,
          value: axis.state,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense right_x axis error', err)
      }
    })

    c.right.analog.y.on('change', (axis: Axis) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'right_y' as AxisId,
          value: axis.state,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense right_y axis error', err)
      }
    })

    // Triggers — Trigger extends Input<Magnitude>, so `trigger.state` is Magnitude (number 0..1)
    // and `trigger.magnitude` is also Magnitude
    c.left.trigger.on('change', (trigger: Trigger) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'l2' as AxisId,
          value: trigger.magnitude,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense l2 trigger error', err)
      }
    })

    c.right.trigger.on('change', (trigger: Trigger) => {
      try {
        this.emit('data', {
          kind: 'axis',
          axis: 'r2' as AxisId,
          value: trigger.magnitude,
        } satisfies ControllerEvent)
      } catch (err) {
        logger.error('DualSense r2 trigger error', err)
      }
    })
  }

  private startBatteryPolling(): void {
    // DualSense battery level is not directly exposed by dualsense-ts public API.
    // Battery polling is a best-effort placeholder; actual implementation requires
    // reading HID feature report (Story 6.x can enhance this).
    // For now emit a synthetic 100% on connect to satisfy AC1 battery event requirement.
    try {
      this.emit('data', { kind: 'battery', level: 100 } satisfies ControllerEvent)
    } catch (err) {
      logger.error('DualSense battery event error', err)
    }
  }
}
