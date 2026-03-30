// src/extension/hid/xbox-driver.ts
// Xbox Series controller driver — uses node-hid directly for HID report parsing
// Implements ControllerHAL for Xbox controllers

import { EventEmitter } from 'events'
import { HID } from 'node-hid'
import { logger } from '../logger'
import type { ControllerHAL } from './hal'
import type { ControllerEvent, ButtonId, AxisId, HapticPattern } from '../../shared/types'

// Xbox Series controller VID/PIDs
export const XBOX_VID = 0x045e
export const XBOX_PIDS = [0x0b12, 0x0b13, 0x02fd, 0x02e0]

/**
 * Normalize a signed 16-bit integer value to -1.0..1.0
 * Xbox analog sticks send 16-bit signed values (-32768 to 32767)
 */
function normalizeAxis(raw: number): number {
  const clamped = Math.max(-32768, Math.min(32767, raw))
  return clamped < 0 ? clamped / 32768 : clamped / 32767
}

/**
 * Normalize a trigger byte (0–255) to 0.0..1.0
 */
function normalizeTrigger(raw: number): number {
  return Math.max(0, Math.min(255, raw)) / 255
}

/**
 * Parse an Xbox Series HID report buffer into ControllerEvents.
 *
 * Xbox Series X|S USB HID report layout (64 bytes):
 * Byte 0: report ID
 * Byte 1: bumpers + triggers digital (bits 0=LB, 1=RB, 2=menu, 3=view, 4=LS, 5=RS)
 * Byte 2: face buttons (bits 0=A, 1=B, 2=X, 3=Y)
 * Byte 3: dpad
 * Bytes 4-5: left trigger (16-bit LE, 0–1023)
 * Bytes 6-7: right trigger (16-bit LE, 0–1023)
 * Bytes 8-9:  left stick X (16-bit signed LE)
 * Bytes 10-11: left stick Y (16-bit signed LE)
 * Bytes 12-13: right stick X (16-bit signed LE)
 * Bytes 14-15: right stick Y (16-bit signed LE)
 *
 * Note: Exact byte layout varies by firmware; this matches common USB wired layout.
 */
function parseXboxReport(data: Buffer): ControllerEvent[] {
  const events: ControllerEvent[] = []

  if (data.length < 16) {
    return events
  }

  // Face buttons (byte 2)
  const faceButtons = data[2]
  const faceMap: Array<[number, ButtonId]> = [
    [0x01, 'a'],
    [0x02, 'b'],
    [0x04, 'x'],
    [0x08, 'y'],
  ]
  for (const [bit, id] of faceMap) {
    events.push({ kind: 'button', button: id, pressed: (faceButtons & bit) !== 0 })
  }

  // Bumpers + other buttons (byte 1)
  const sysButtons = data[1]
  const sysMap: Array<[number, ButtonId]> = [
    [0x01, 'lb'],
    [0x02, 'rb'],
    [0x04, 'menu'],
    [0x08, 'view'],
    [0x10, 'ls'],
    [0x20, 'rs'],
  ]
  for (const [bit, id] of sysMap) {
    events.push({ kind: 'button', button: id, pressed: (sysButtons & bit) !== 0 })
  }

  // D-pad (byte 3)
  const dpad = data[3]
  events.push({ kind: 'button', button: 'up', pressed: dpad === 1 || dpad === 2 || dpad === 8 })
  events.push({ kind: 'button', button: 'right', pressed: dpad === 2 || dpad === 3 || dpad === 4 })
  events.push({ kind: 'button', button: 'down', pressed: dpad === 4 || dpad === 5 || dpad === 6 })
  events.push({ kind: 'button', button: 'left', pressed: dpad === 6 || dpad === 7 || dpad === 8 })

  // Triggers (bytes 4-5, 6-7): 16-bit LE, 0–1023; normalize to 0.0..1.0
  const lt = ((data[5] << 8) | data[4]) / 1023
  const rt = ((data[7] << 8) | data[6]) / 1023
  events.push({ kind: 'axis', axis: 'l2' as AxisId, value: Math.max(0, Math.min(1, lt)) })
  events.push({ kind: 'axis', axis: 'r2' as AxisId, value: Math.max(0, Math.min(1, rt)) })

  // Digital trigger buttons (LT/RT pressed)
  events.push({ kind: 'button', button: 'lt', pressed: lt > 0.5 })
  events.push({ kind: 'button', button: 'rt', pressed: rt > 0.5 })

  // Analog sticks — 16-bit signed LE
  const lx = data.readInt16LE(8)
  const ly = data.readInt16LE(10)
  const rx = data.readInt16LE(12)
  const ry = data.readInt16LE(14)

  events.push({ kind: 'axis', axis: 'left_x' as AxisId, value: normalizeAxis(lx) })
  events.push({ kind: 'axis', axis: 'left_y' as AxisId, value: normalizeAxis(ly) })
  events.push({ kind: 'axis', axis: 'right_x' as AxisId, value: normalizeAxis(rx) })
  events.push({ kind: 'axis', axis: 'right_y' as AxisId, value: normalizeAxis(ry) })

  return events
}

/**
 * Xbox Series controller driver.
 *
 * Uses node-hid directly for raw HID report reading.
 * setHaptic and setLED are no-ops (Xbox haptics deferred to Story 6.X).
 */
export class XboxDriver extends EventEmitter implements ControllerHAL {
  private device: HID | null = null

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

      this.emit('data', { kind: 'connected', controllerType: 'xbox' } satisfies ControllerEvent)
      logger.info('Xbox controller connected', `VID=${this.vendorId.toString(16)} PID=${this.productId.toString(16)}`)

      this.device.on('data', (data: Buffer) => {
        try {
          const events = parseXboxReport(data)
          for (const event of events) {
            this.emit('data', event)
          }
        } catch (err) {
          logger.error('Xbox HID data parse error', err)
          // continue — do NOT re-throw (NFR-R1)
        }
      })

      this.device.on('error', (err: Error) => {
        try {
          logger.error('Xbox HID device error', err)
          this.emit('data', { kind: 'disconnected' } satisfies ControllerEvent)
        } catch (innerErr) {
          logger.error('Xbox HID error handler error', innerErr)
        }
      })
    } catch (err) {
      logger.error('XboxDriver start failed', err)
    }
  }

  stop(): void {
    try {
      if (this.device) {
        this.device.close()
        this.device = null
      }
      logger.info('XboxDriver stopped')
    } catch (err) {
      logger.error('XboxDriver stop failed', err)
    }
  }

  /** No-op: Xbox haptics deferred to Story 6.X (Xbox Haptics via Rumble Motors) */
  setHaptic(_pattern: HapticPattern): void {
    // Intentional no-op for Xbox in this story
  }

  /** No-op: Xbox LED control not implemented in this story */
  setLED(_color: string): void {
    // Intentional no-op for Xbox in this story
  }
}

// Export for use by HidManager and tests
export { normalizeTrigger, normalizeAxis, parseXboxReport }
