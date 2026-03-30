// src/extension/platform/device-selector.ts
// Manual HID device selection via VSCode QuickPick.
// Used when auto-detection fails (FR5).

import { devices as hidDevices } from 'node-hid'
import type { Device } from 'node-hid'
import * as vscode from 'vscode'
import { logger } from '../logger'
import { DUALSENSE_VID, DUALSENSE_PIDS } from '../hid/hid-manager'
import { XBOX_VID, XBOX_PIDS, XboxDriver } from '../hid/xbox-driver'
import { DualSenseDriver } from '../hid/dualsense-driver'
import { GenericHidDriver } from '../hid/generic-driver'
import type { ControllerHAL } from '../hid/hal'
import type { ControllerType } from '../../shared/types'

/** A QuickPick item that carries its source HID Device reference */
export interface HidDeviceItem extends vscode.QuickPickItem {
  device: Device
}

/** Result returned by showDeviceSelector on successful selection */
export interface DeviceSelectorResult {
  driver: ControllerHAL
  controllerType: ControllerType
}

/**
 * Returns all currently enumerated HID devices.
 * On error, logs and returns an empty array (never throws).
 */
export function listHidDevices(): Device[] {
  try {
    return hidDevices()
  } catch (err) {
    logger.warn('DeviceSelector: failed to enumerate HID devices', err)
    return []
  }
}

/**
 * Formats a Device into a human-readable label for the QuickPick.
 * Example: "DualSense Wireless Controller (VID: 0x054c, PID: 0x0ce6)"
 */
export function formatDeviceLabel(d: Device): string {
  const vid = d.vendorId.toString(16).padStart(4, '0')
  const pid = d.productId.toString(16).padStart(4, '0')
  return `${d.product ?? 'Unknown Device'} (VID: 0x${vid}, PID: 0x${pid})`
}

/**
 * Resolves the ControllerType for a given HID Device based on VID/PID matching.
 * Priority: DualSense > Xbox > Generic HID.
 */
function resolveControllerType(d: Device): ControllerType {
  if (d.vendorId === DUALSENSE_VID && DUALSENSE_PIDS.includes(d.productId)) {
    return 'dualsense'
  }
  if (d.vendorId === XBOX_VID && XBOX_PIDS.includes(d.productId)) {
    return 'xbox'
  }
  return 'generic-hid'
}

/**
 * Returns the appropriate ControllerHAL driver for the given Device
 * by matching against known VID/PID constants.
 * Priority: DualSense > Xbox > Generic HID.
 */
function createDriverForDevice(d: Device): ControllerHAL {
  if (d.vendorId === DUALSENSE_VID && DUALSENSE_PIDS.includes(d.productId)) {
    return new DualSenseDriver()
  }
  if (d.vendorId === XBOX_VID && XBOX_PIDS.includes(d.productId)) {
    return new XboxDriver(d.vendorId, d.productId)
  }
  return new GenericHidDriver(d.vendorId, d.productId)
}

/**
 * Opens a QuickPick listing all detected HID devices and lets the user
 * manually select their controller when auto-detection fails.
 *
 * - Returns { driver, controllerType } on successful selection.
 * - Returns null if the device list is empty or the user dismisses the picker.
 * - Wrapped in try/catch — never throws (NFR-R1).
 * - If driver.start() succeeds but setHaptic fails, the driver is stopped
 *   before returning null to prevent HID connection leaks.
 */
export async function showDeviceSelector(): Promise<DeviceSelectorResult | null> {
  try {
    const devices = listHidDevices()

    if (devices.length === 0) {
      await vscode.window.showInformationMessage('No HID devices found.')
      return null
    }

    const items: HidDeviceItem[] = devices.map((d) => ({
      label: formatDeviceLabel(d),
      description: d.path ?? '',
      device: d,
    }))

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select your controller',
    })

    if (!selected) {
      return null
    }

    logger.info('DeviceSelector: user selected device', formatDeviceLabel(selected.device))

    const controllerType = resolveControllerType(selected.device)
    const driver = createDriverForDevice(selected.device)
    driver.start()

    // Fire confirmation haptic for DualSense only; stop driver on failure to avoid leaks
    if (controllerType === 'dualsense') {
      try {
        driver.setHaptic('single_pulse')
      } catch (hapticErr) {
        logger.warn('DeviceSelector: haptic failed after start, stopping driver', hapticErr)
        driver.stop()
        return null
      }
    }

    return { driver, controllerType }
  } catch (err) {
    logger.error('DeviceSelector: showDeviceSelector failed', err)
    return null
  }
}
