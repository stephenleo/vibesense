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
