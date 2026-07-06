// Terminal scrollback control. Bytes written to the pty reach claude, not the
// terminal emulator — scrollback is the emulator's, so we send Page Up/Down
// key events at the OS level via osascript (macOS; needs Accessibility
// permission for the terminal app the first time).
// ponytail: macOS-only + page granularity; per-line scroll needs a CGEvent helper.

import { execFile } from 'node:child_process'
import { logger } from './logger.js'

const KEY_CODES = { up: 116, down: 121 } // Page Up / Page Down

let warned = false

export function scrollPage(direction: 'up' | 'down'): void {
  if (process.platform !== 'darwin') return
  execFile(
    'osascript',
    ['-e', `tell application "System Events" to key code ${KEY_CODES[direction]}`],
    (err) => {
      if (err && !warned) {
        warned = true
        logger.warn(
          'Scroll failed — grant your terminal app Accessibility permission (System Settings → Privacy & Security → Accessibility)',
          err,
        )
      }
    },
  )
}
