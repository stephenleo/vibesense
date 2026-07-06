// Generic HID gamepad driver — best-effort parsing of the common USB gamepad
// report layout. Ported from the v1 extension.

import { EventEmitter } from 'node:events'
import { HID } from 'node-hid'
import { logger } from '../logger.js'
import type { ControllerHAL } from './hal.js'
import type { ButtonId, ControllerEvent } from '../types.js'

/** Normalize a 0-255 centered-at-128 axis byte to -1.0..1.0. */
export function normalizeGenericAxis(raw: number): number {
  return Math.max(-1.0, Math.min(1.0, (raw - 128) / 128))
}

// First 8 button bits, best-effort standard order.
const GENERIC_BUTTON_MAP: ButtonId[] = [
  'south',
  'east',
  'west',
  'north',
  'l1',
  'r1',
  'menu',
  'view',
]

/**
 * Parse a generic HID gamepad report: byte 0 = buttons 1-8 bitmask,
 * bytes 2-5 = left/right stick X/Y (0-255, center 128). Layouts vary
 * by device; this is a best-effort fallback.
 */
export function parseGenericReport(data: Buffer): ControllerEvent[] {
  const events: ControllerEvent[] = []
  if (data.length < 2) return events

  const buttons = data[0]!
  for (let i = 0; i < GENERIC_BUTTON_MAP.length; i++) {
    events.push({
      kind: 'button',
      button: GENERIC_BUTTON_MAP[i]!,
      pressed: (buttons & (1 << i)) !== 0,
    })
  }
  if (data.length >= 4) {
    events.push({ kind: 'axis', axis: 'left_x', value: normalizeGenericAxis(data[2]!) })
    events.push({ kind: 'axis', axis: 'left_y', value: normalizeGenericAxis(data[3]!) })
  }
  if (data.length >= 6) {
    events.push({ kind: 'axis', axis: 'right_x', value: normalizeGenericAxis(data[4]!) })
    events.push({ kind: 'axis', axis: 'right_y', value: normalizeGenericAxis(data[5]!) })
  }
  return events
}

export class GenericHidDriver extends EventEmitter implements ControllerHAL {
  readonly controllerType = 'generic-hid' as const

  private device: HID | null = null

  constructor(
    private readonly vendorId: number,
    private readonly productId: number,
  ) {
    super()
  }

  start(): void {
    try {
      this.device = new HID(this.vendorId, this.productId)
      this.emit('data', {
        kind: 'connected',
        controllerType: 'generic-hid',
      } satisfies ControllerEvent)
      logger.info(
        `Generic HID connected VID=${this.vendorId.toString(16)} PID=${this.productId.toString(16)}`,
      )

      this.device.on('data', (data: Buffer) => {
        try {
          for (const event of parseGenericReport(data)) this.emit('data', event)
        } catch (err) {
          logger.error('Generic HID parse error', err)
        }
      })
      this.device.on('error', (err: Error) => {
        logger.error('Generic HID device error', err)
        this.emit('data', { kind: 'disconnected' } satisfies ControllerEvent)
      })
    } catch (err) {
      logger.error('GenericHidDriver start failed', err)
    }
  }

  stop(): void {
    try {
      this.device?.close()
    } catch (err) {
      logger.error('GenericHidDriver stop failed', err)
    }
    this.device = null
  }
}
