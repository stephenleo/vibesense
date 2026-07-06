#!/usr/bin/env node
// vibesense — wrap `claude` in a pty and drive it with a game controller.
// Usage: vibesense [claude args...]   (all args pass through to claude)

import { HidManager } from './controller/hid-manager.js'
import { KeyRepeater, REPEATING_BUTTONS, TERMINAL_KEYS, stickDirection } from './keymap.js'
import { logger } from './logger.js'
import { ClaudePty } from './pty.js'
import { scrollPage } from './scroll.js'
import type { ControllerEvent } from './types.js'

const claudeArgs = process.argv.slice(2)

const hid = new HidManager()

const claude = new ClaudePty(claudeArgs, (code) => {
  hid.stop()
  claude.dispose()
  process.exit(code)
})

const repeater = new KeyRepeater()
let scrolling: 'up' | 'down' | null = null

hid.on('data', (e: ControllerEvent) => {
  try {
    if (e.kind === 'connected') {
      logger.info(`Controller connected: ${e.controllerType}`)
      return
    }
    if (e.kind === 'disconnected') {
      repeater.releaseAll()
      return
    }

    if (e.kind === 'button') {
      const bytes = TERMINAL_KEYS[e.button]
      if (!bytes) return
      if (REPEATING_BUTTONS.has(e.button)) {
        if (e.pressed) repeater.press(e.button, () => claude.write(bytes))
        else repeater.release(e.button)
      } else if (e.pressed) {
        claude.write(bytes)
      }
      return
    }

    // Right stick Y = terminal scrollback, page-at-a-time with key repeat.
    if (e.axis === 'right_y') {
      const direction = stickDirection(e.value)
      if (direction === scrolling) return
      if (scrolling) repeater.release(`scroll:${scrolling}`)
      scrolling = direction
      if (direction) repeater.press(`scroll:${direction}`, () => scrollPage(direction))
    }
  } catch (err) {
    logger.error('controller event handling failed', err)
  }
})

hid.start()
logger.info(`vibesense started (claude args: ${JSON.stringify(claudeArgs)})`)
