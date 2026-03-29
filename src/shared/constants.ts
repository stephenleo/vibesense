// src/shared/constants.ts
// Pure constants — importable from both extension host and Webview contexts
// DO NOT add Node.js or browser-specific APIs here

export const VIBESENSE_SOCKET_PATH = '/tmp/vibesense.sock'

// Timing constants (ms)
export const INPUT_BUFFER_WINDOW_MS = 250
export const CONTROLLER_RECONNECT_TIMEOUT_MS = 3000
export const GAME_LAUNCH_COUNTDOWN_MS = 5000
export const SESSION_SWITCHER_DISPLAY_MS = 800
