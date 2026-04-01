// src/shared/constants.ts
// Pure constants — importable from both extension host and Webview contexts
// DO NOT add Node.js or browser-specific APIs here

export const VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'

// Timing constants (ms)
export const INPUT_BUFFER_WINDOW_MS = 250
export const CONTROLLER_RECONNECT_TIMEOUT_MS = 3000
export const GAME_LAUNCH_COUNTDOWN_MS = 5000
export const SESSION_SWITCHER_DISPLAY_MS = 800

// Analog stick terminal scroll constants (Story 3.2)
// Fixed tick rate of 20 ticks/sec. At full displacement: 20 lines * 20 ticks/sec = 400 lines/sec
// → 1000 lines in 2.5 seconds (AC 2 requires < 5 seconds) ✓
export const SCROLL_TICK_MS = 50
export const MAX_LINES_PER_TICK = 20
export const SCROLL_DEAD_ZONE = 0.15

// Radial wheel constants (Story 7.1)
export const WHEEL_SEGMENT_COUNT = 8
export const WHEEL_DEAD_ZONE = 0.25

/**
 * Converts right-stick (x, y) to a segment index (0–7) or -1 for dead zone.
 * Segment 0 = top (stick up), increasing clockwise.
 * Shared between extension host (RadialWheelController) and webview (RadialWheel).
 */
export function computeWheelSegmentIndex(x: number, y: number, deadZone = WHEEL_DEAD_ZONE): number {
  const magnitude = Math.sqrt(x * x + y * y)
  if (magnitude < deadZone) return -1
  // atan2(y, x): 0 = right, positive = clockwise in screen coords
  // Add PI/2 to rotate so 0 = top (up), normalize to [0, 2*PI]
  const angle = (Math.atan2(y, x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI)
  return Math.floor(angle / (Math.PI / 4)) % WHEEL_SEGMENT_COUNT
}
