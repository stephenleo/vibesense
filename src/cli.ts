#!/usr/bin/env node
// vibesense — wrap `claude` in a pty and drive it with a game controller.
// Usage: vibesense [--no-game] [claude args...]   (unknown args pass through)
//
// First instance to bind the singleton port becomes the HOST: it owns the
// controller, the game tab, and agent-state aggregation. Later instances run
// as CLIENTS: their claude session still reports state via global hooks, and
// the host forwards terminal keystrokes to them when they have focus.

import { execFile } from 'node:child_process'
import { isVibesenseHost, runAsClient } from './client.js'
import { HidManager } from './controller/hid-manager.js'
import { installHooks } from './hooks-install.js'
import { KeyRepeater, REPEATING_BUTTONS, TERMINAL_KEYS, stickDirection } from './keymap.js'
import { logger } from './logger.js'
import { ClaudePty } from './pty.js'
import { InputRouter } from './router.js'
import { scrollPage } from './scroll.js'
import { HostServer, HOST_URL } from './server.js'
import type { Aggregate } from './state.js'
import type { ControllerEvent } from './types.js'

const args = process.argv.slice(2)
const noGame = args.includes('--no-game')
const claudeArgs = args.filter((a) => a !== '--no-game')

installHooks()

const server = new HostServer()
const isHost = await server.listen()

const claude = new ClaudePty(claudeArgs, (code) => {
  shutdown()
  process.exit(code)
})

function shutdown(): void {
  claude.dispose()
  if (isHost) server.close()
}

if (!isHost) {
  // ── Client: someone else owns the controller + game. ──────────────────
  if (await isVibesenseHost()) {
    runAsClient((bytes) => claude.write(bytes)).catch((err) =>
      logger.warn('client stream failed', err),
    )
  } else {
    logger.warn(`port in use by a non-vibesense process — running without controller (${HOST_URL})`)
  }
} else {
  // ── Host: controller + game + state aggregation. ──────────────────────
  const hid = new HidManager()
  const router = new InputRouter()
  const repeater = new KeyRepeater()
  let scrolling: 'up' | 'down' | null = null
  let focusSessionId: string | null = null

  /** Terminal keystrokes go to the focused session's instance, else our own pty. */
  function writeTerminal(bytes: string): void {
    const instanceId = focusSessionId ? server.instanceForSession(focusSessionId) : null
    if (!instanceId || !server.sendKeysToInstance(instanceId, bytes)) {
      claude.write(bytes)
    }
  }

  server.on('aggregate', (agg: Aggregate) => {
    focusSessionId = agg.focusSessionId
    const mode = agg.playing ? 'game' : 'terminal'
    if (mode !== router.currentMode()) {
      repeater.releaseAll()
      scrolling = null
      router.setMode(mode)
      server.broadcastGameState(agg.playing ? 'playing' : 'paused')
      logger.info(`mode → ${mode}`, agg)
    }
  })

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

      // Manual override: Menu/Options flips modes regardless of agent state.
      if (e.kind === 'button' && e.button === 'menu' && e.pressed) {
        const mode = router.currentMode() === 'game' ? 'terminal' : 'game'
        repeater.releaseAll()
        scrolling = null
        router.setMode(mode)
        server.broadcastGameState(mode === 'game' ? 'playing' : 'paused')
        return
      }

      const routed = router.route(e)
      if (!routed) return

      if (routed.target === 'game') {
        const ev = routed.event
        if (ev.kind === 'button') {
          server.broadcastGameInput({ kind: 'button', button: ev.button, pressed: ev.pressed })
        } else if (ev.kind === 'axis') {
          server.broadcastGameInput({ kind: 'axis', axis: ev.axis, value: ev.value })
        }
        return
      }

      // Terminal target — same handling as M1, but writes go to the focused session.
      if (routed.event.kind === 'button') {
        const { button, pressed } = routed.event
        const bytes = TERMINAL_KEYS[button]
        if (!bytes) return
        if (REPEATING_BUTTONS.has(button)) {
          if (pressed) repeater.press(button, () => writeTerminal(bytes))
          else repeater.release(button)
        } else if (pressed) {
          writeTerminal(bytes)
        }
        return
      }

      if (routed.event.kind === 'axis' && routed.event.axis === 'right_y') {
        const direction = stickDirection(routed.event.value)
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

  if (!noGame && process.platform === 'darwin') {
    execFile('open', ['-g', HOST_URL], (err) => {
      if (err) logger.warn('could not open game tab', err)
    })
  }
}

logger.info(
  `vibesense started (${isHost ? 'host' : 'client'}, claude args: ${JSON.stringify(claudeArgs)})`,
)
