// src/extension/hid/hid-manager.ts
// HidManager — device detection and driver factory
// Detects connected HID devices, instantiates the correct driver, exposes a single ControllerHAL

import { devices as hidDevices } from 'node-hid'
import type { Device } from 'node-hid'
import { logger } from '../logger'
import { DualSenseDriver } from './dualsense-driver'
import { XboxDriver, XBOX_VID, XBOX_PIDS } from './xbox-driver'
import { GenericHidDriver } from './generic-driver'
import type { ControllerHAL } from './hal'

// DualSense VID/PIDs
export const DUALSENSE_VID = 0x054c
export const DUALSENSE_PIDS = [
  0x0ce6, // DualSense Wireless Controller
  0x0df2, // DualSense Edge
]

/**
 * Detects the best matching HID device and returns the appropriate driver.
 *
 * Priority: DualSense > Xbox > Generic HID
 *
 * NOTE: Auto-reconnect lifecycle is Story 2.2 — this method handles initial
 * detection and driver factory creation only.
 *
 * @returns The ControllerHAL instance for the detected device, or null if no
 *          gamepad-class HID device is found.
 */
export function createDriver(): ControllerHAL | null {
  let devices: Device[]

  try {
    devices = hidDevices()
  } catch (err) {
    logger.error('HidManager: failed to enumerate HID devices', err)
    return null
  }

  // Check for DualSense
  const dualsenseDevice = devices.find(
    (d) => d.vendorId === DUALSENSE_VID && DUALSENSE_PIDS.includes(d.productId),
  )
  if (dualsenseDevice) {
    logger.info(
      'HidManager: DualSense detected',
      `VID=${dualsenseDevice.vendorId.toString(16)} PID=${dualsenseDevice.productId.toString(16)}`,
    )
    return new DualSenseDriver()
  }

  // Check for Xbox Series
  const xboxDevice = devices.find(
    (d) => d.vendorId === XBOX_VID && XBOX_PIDS.includes(d.productId),
  )
  if (xboxDevice) {
    logger.info(
      'HidManager: Xbox controller detected',
      `VID=${xboxDevice.vendorId.toString(16)} PID=${xboxDevice.productId.toString(16)}`,
    )
    return new XboxDriver(xboxDevice.vendorId, xboxDevice.productId)
  }

  // Fall back to generic HID — look for any device in the gamepad usage page (0x05)
  const genericDevice = devices.find(
    (d) => d.usagePage === 0x01 && (d.usage === 0x04 || d.usage === 0x05),
  )
  if (genericDevice) {
    logger.warn(
      'HidManager: Unknown controller, using generic HID driver',
      `VID=${genericDevice.vendorId.toString(16)} PID=${genericDevice.productId.toString(16)}`,
    )
    return new GenericHidDriver(genericDevice.vendorId, genericDevice.productId)
  }

  logger.warn('HidManager: No compatible HID gamepad device found')
  return null
}

/**
 * HidManager class — encapsulates device detection and driver lifecycle.
 *
 * Exposes a single ControllerHAL to consumers. Auto-reconnect wiring is Story 2.2.
 */
export class HidManager {
  private driver: ControllerHAL | null = null

  /**
   * Detect connected HID devices and start the appropriate driver.
   * Returns the ControllerHAL instance, or null if no device found.
   */
  start(): ControllerHAL | null {
    try {
      this.driver = createDriver()
      if (this.driver) {
        this.driver.start()
        logger.info('HidManager started')
      } else {
        logger.warn('HidManager: no driver created — no compatible controller found')
      }
      return this.driver
    } catch (err) {
      logger.error('HidManager start failed', err)
      return null
    }
  }

  /**
   * Stop the active driver and release the HID device.
   */
  stop(): void {
    try {
      if (this.driver) {
        this.driver.stop()
        this.driver = null
        logger.info('HidManager stopped')
      }
    } catch (err) {
      logger.error('HidManager stop failed', err)
    }
  }

  /**
   * Returns the current ControllerHAL instance, or null if no driver active.
   */
  getDriver(): ControllerHAL | null {
    return this.driver
  }
}
