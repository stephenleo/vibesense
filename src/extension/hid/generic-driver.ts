// src/extension/hid/generic-driver.ts
// Generic HID controller driver — uses node-hid directly for raw HID report reading
// Implements ControllerHAL with best-effort mapping for non-DualSense, non-Xbox devices

import { EventEmitter } from 'events'
import { HID } from 'node-hid'
import { logger } from '../logger'
import type { ControllerHAL } from './hal'
import type { ControllerEvent, ControllerType, ButtonId, AxisId, HapticPattern } from '../../shared/types'

/**
 * Parse a generic HID gamepad report using best-effort standard USB gamepad layout.
 *
 * Standard USB HID gamepad report (varies by device, common layout):
 * Byte 0: Buttons 1-8 (bit mask)
 * Byte 1: Buttons 9-16 (bit mask)
 * Byte 2: Left stick X (0–255, center=128)
 * Byte 3: Left stick Y (0–255, center=128)
 * Byte 4: Right stick X (0–255, center=128)
 * Byte 5: Right stick Y (0–255, center=128)
 *
 * Axis normalization: (rawByte - 128) / 128 → -1.0..1.0
 * This is best-effort; specific device layouts may differ.
 */
function normalizeGenericAxis(raw: number): number {
  return Math.max(-1.0, Math.min(1.0, (raw - 128) / 128))
}

// Map first 8 generic button bits to ButtonIds (best-effort)
const GENERIC_BUTTON_MAP: ButtonId[] = ['a', 'b', 'x', 'y', 'lb', 'rb', 'menu', 'view']

function parseGenericReport(data: Buffer): ControllerEvent[] {
  const events: ControllerEvent[] = []

  if (data.length < 2) {
    return events
  }

  // Buttons (byte 0, up to 8 buttons)
  const buttons0 = data[0]
  for (let i = 0; i < 8 && i < GENERIC_BUTTON_MAP.length; i++) {
    events.push({
      kind: 'button',
      button: GENERIC_BUTTON_MAP[i],
      pressed: (buttons0 & (1 << i)) !== 0,
    })
  }

  // Analog axes (bytes 2-5 if present)
  if (data.length >= 4) {
    events.push({
      kind: 'axis',
      axis: 'left_x' as AxisId,
      value: normalizeGenericAxis(data[2]),
    })
    events.push({
      kind: 'axis',
      axis: 'left_y' as AxisId,
      value: normalizeGenericAxis(data[3]),
    })
  }

  if (data.length >= 6) {
    events.push({
      kind: 'axis',
      axis: 'right_x' as AxisId,
      value: normalizeGenericAxis(data[4]),
    })
    events.push({
      kind: 'axis',
      axis: 'right_y' as AxisId,
      value: normalizeGenericAxis(data[5]),
    })
  }

  return events
}

/**
 * Generic HID controller driver.
 *
 * Provides best-effort button and axis mapping for any USB HID gamepad.
 * No haptic or LED output (NFR-C2).
 */
export class GenericHidDriver extends EventEmitter implements ControllerHAL {
  readonly controllerType: ControllerType = 'generic-hid'

  private device: HID | null = null
  private previousButtonState = new Map<ButtonId, boolean>()
  private previousAxisState = new Map<AxisId, number>()

  constructor(
    private readonly vendorId: number,
    private readonly productId: number,
  ) {
    super()
  }

  override on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener)
  }

  start(): void {
    try {
      this.device = new HID(this.vendorId, this.productId)

      this.emit('data', { kind: 'connected', controllerType: 'generic-hid' } satisfies ControllerEvent)
      logger.info(
        'Generic HID controller connected',
        `VID=${this.vendorId.toString(16)} PID=${this.productId.toString(16)}`,
      )

      this.device.on('data', (data: Buffer) => {
        try {
          const events = parseGenericReport(data)
          for (const event of events) {
            if (event.kind === 'button') {
              const prev = this.previousButtonState.get(event.button)
              if (prev !== event.pressed) {
                this.previousButtonState.set(event.button, event.pressed)
                this.emit('data', event)
              }
            } else if (event.kind === 'axis') {
              const prev = this.previousAxisState.get(event.axis)
              if (prev !== event.value) {
                this.previousAxisState.set(event.axis, event.value)
                this.emit('data', event)
              }
            } else {
              this.emit('data', event)
            }
          }
        } catch (err) {
          logger.error('Generic HID data parse error', err)
          // continue — do NOT re-throw (NFR-R1)
        }
      })

      this.device.on('error', (err: Error) => {
        try {
          logger.error('Generic HID device error', err)
          this.emit('data', { kind: 'disconnected' } satisfies ControllerEvent)
        } catch (innerErr) {
          logger.error('Generic HID error handler error', innerErr)
        }
      })
    } catch (err) {
      logger.error('GenericHidDriver start failed', err)
    }
  }

  stop(): void {
    try {
      if (this.device) {
        this.device.close()
        this.device = null
      }
      this.previousButtonState.clear()
      this.previousAxisState.clear()
      logger.info('GenericHidDriver stopped')
    } catch (err) {
      logger.error('GenericHidDriver stop failed', err)
    }
  }

  /** No-op: generic HID devices do not support haptics (NFR-C2) */
  setHaptic(_pattern: HapticPattern): void {
    // Intentional no-op
  }

  /** No-op: generic HID devices do not support LED control (NFR-C2) */
  setLED(_color: string): void {
    // Intentional no-op
  }
}

// Export helpers for testing
export { normalizeGenericAxis, parseGenericReport }
