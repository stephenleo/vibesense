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

/** globalState key for session quicksave snapshot (Story 9.6) */
export const QUICKSAVE_KEY = 'vibesense.quicksaveState'

/** globalState key for queued telemetry payloads (Story 11.1) */
export const TELEMETRY_QUEUE_KEY = 'vibesense.telemetryQueue'

/** globalState key for telemetry consent prompt shown flag (Story 11.2) */
export const TELEMETRY_CONSENT_SHOWN_KEY = 'vibesense.telemetryConsentShown'

/** globalState key for achievements store (Story 9.5) */
export const ACHIEVEMENT_KEY = 'vibesense.achievements'

// ─── XP System constants (Story 9.3) ─────────────────────────────────────────

/** globalState key for XP record (Story 9.3) */
export const XP_KEY = 'vibesense.xpRecord'

/** XP earned for a controller-only session (zero keyboard touches) */
export const XP_CONTROLLER_ONLY = 100

/** XP earned for a session with ≥80% controller action ratio */
export const XP_HIGH_RATIO = 50

/** XP earned for using 3+ distinct VibeSense features in a session */
export const XP_MULTI_FEATURE = 25

/** XP multiplier per streak day (earned XP = streakDays × XP_STREAK_PER_DAY) */
export const XP_STREAK_PER_DAY = 10

/** Minimum controller action ratio to qualify for the high-ratio XP bonus */
export const HIGH_RATIO_THRESHOLD = 0.8

/** Minimum number of distinct features used to qualify for the multi-feature XP bonus */
export const MULTI_FEATURE_MIN_COUNT = 3

/** XP threshold for Level 2 (each subsequent level doubles the previous threshold increment) */
export const LEVEL_2_XP_THRESHOLD = 500

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
