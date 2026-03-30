// src/extension/hid/hal.ts
// ControllerHAL interface — Facade pattern for unified controller access
// All upper-layer code depends on this interface, never on a specific driver

import type { ControllerEvent, ControllerType, HapticPattern } from '../../shared/types'

export type { ControllerEvent, ControllerType, HapticPattern }

/**
 * Hardware Abstraction Layer interface for controller input.
 *
 * Implemented by DualSenseDriver, XboxDriver, and GenericHidDriver.
 * Upper-layer code (input-router, haptic-controller, led-controller) depends
 * only on this interface — never on a specific driver implementation.
 *
 * The `on` method signature is intentionally broad (string | symbol) to be compatible
 * with Node.js EventEmitter. Upper-layer code uses the 'data' event string literal.
 */
export interface ControllerHAL {
  /** The type of controller this driver manages */
  readonly controllerType: ControllerType

  /** Register a listener for normalized controller events */
  on(event: string | symbol, listener: (...args: unknown[]) => void): unknown

  /** Start listening to HID input from the controller */
  start(): void

  /** Stop listening and release the HID device */
  stop(): void

  /** Send a haptic feedback pattern to the controller (no-op for unsupported devices) */
  setHaptic(pattern: HapticPattern): void

  /** Set the controller LED/lightbar color (no-op for unsupported devices) */
  setLED(color: string): void
}
