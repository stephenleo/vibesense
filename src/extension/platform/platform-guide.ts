// src/extension/platform/platform-guide.ts
// Surfaces inline remediation prompts for platform HID permission issues.
// macOS: Input Monitoring permission; Linux: udev rules

import * as vscode from 'vscode'
import { logger } from '../logger'
import { detectPlatform } from './permission-checker'

/** udev rules content for copy-paste remediation on Linux */
const LINUX_UDEV_RULE = [
  'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="054c", MODE="0666"',
  'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="045e", MODE="0666"',
].join('\n')

const LINUX_UDEV_INSTRUCTIONS =
  'Save as /etc/udev/rules.d/99-vibesense.rules, then run: ' +
  'sudo udevadm control --reload-rules && sudo udevadm trigger. ' +
  'Reconnect your controller.'

/**
 * Shows a non-blocking warning message guiding the user to grant
 * macOS Input Monitoring permission. Clicking "Open Settings" opens
 * the macOS System Settings Privacy pane directly.
 */
export function showMacOsPermissionGuide(): void {
  logger.warn('Platform: macOS Input Monitoring permission missing')
  void vscode.window
    .showWarningMessage(
      'Controller input requires Input Monitoring permission. [Open Settings]',
      'Open Settings',
    )
    .then((selection) => {
      if (selection === 'Open Settings') {
        void vscode.env.openExternal(
          vscode.Uri.parse(
            'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
          ),
        )
      }
    })
}

/**
 * Shows a non-blocking warning message with copy-paste udev rule remediation
 * for Linux users missing the required hidraw udev rule.
 */
export function showLinuxUdevGuide(): void {
  logger.warn('Platform: Linux udev rule missing')
  void vscode.window
    .showWarningMessage(
      `Controller requires a udev rule. ${LINUX_UDEV_INSTRUCTIONS}`,
      'Copy Rule',
      'Reconnect Controller',
    )
    .then((selection) => {
      if (selection === 'Copy Rule') {
        void vscode.env.clipboard.writeText(LINUX_UDEV_RULE).then(() => {
          void vscode.window.showInformationMessage('udev rule copied to clipboard.')
        })
      }
    })
}

/**
 * Dispatches to the correct platform-specific permission guide based on the
 * current platform. Wrapped in try/catch — never throws (NFR-R1).
 */
export function handleHidPermissionError(err: unknown): void {
  try {
    const platform = detectPlatform()
    switch (platform) {
      case 'macos':
        showMacOsPermissionGuide()
        break
      case 'linux':
        showLinuxUdevGuide()
        break
      default:
        logger.warn('Platform: HID permission error on unexpected platform', err)
        break
    }
  } catch (handlerErr) {
    logger.error('Platform: failed to show permission guide', handlerErr)
  }
}
