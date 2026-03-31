// src/extension/platform/permission-checker.ts
// Detects platform type and HID permission state — pure Node.js, no VSCode API
// Used by platform-guide.ts to surface inline remediation prompts

import { devices as hidDevices } from 'node-hid'

/** Platform identifier derived from process.platform */
export type PlatformType = 'macos' | 'linux' | 'windows' | 'other'

/**
 * Returns the current platform type based on process.platform.
 */
export function detectPlatform(): PlatformType {
  switch (process.platform) {
    case 'darwin':
      return 'macos'
    case 'linux':
      return 'linux'
    case 'win32':
      return 'windows'
    default:
      return 'other'
  }
}

/**
 * Returns true if the given error looks like a HID permission error.
 * macOS: "cannot open device" when Input Monitoring permission is missing.
 * Linux: "Access denied" or "Permission denied" when udev rule is missing.
 */
export function isHidPermissionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('cannot open device') ||
    msg.includes('access denied') ||
    msg.includes('permission denied')
  )
}

/**
 * Attempts to enumerate HID devices to verify access.
 * Returns { ok: true } if enumeration succeeds.
 * Returns { ok: false, error } if enumeration throws (e.g. permission denied).
 */
export function checkHidAccess(): { ok: boolean; error?: unknown } {
  try {
    hidDevices()
    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}
