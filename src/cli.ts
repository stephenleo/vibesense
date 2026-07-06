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
import { runSubcommand, SUBCOMMANDS } from './commands.js'
import { HidManager } from './controller/hid-manager.js'
import { installHooks } from './hooks-install.js'
import { KeyRepeater, REPEATING_BUTTONS, TERMINAL_KEYS } from './keymap.js'
import { logger } from './logger.js'
import {
  checkEntitlement,
  discoverGames,
  ExternalGame,
  getActiveGame,
  setActiveGameId,
} from './plugins.js'
import { ClaudePty } from './pty.js'
import { InputRouter } from './router.js'
import { SmoothScroller } from './scroll.js'
import { HostServer, HOST_URL } from './server.js'
import type { Aggregate } from './state.js'
import type { ControllerEvent } from './types.js'

const args = process.argv.slice(2)

// Marketplace subcommands (vibesense install/uninstall/games/use) never wrap claude.
if ((SUBCOMMANDS as readonly string[]).includes(args[0] ?? '')) {
  await runSubcommand(args[0]!, args.slice(1))
}

const noGame = args.includes('--no-game')
const claudeArgs = args.filter((a) => a !== '--no-game')

installHooks()

const games = discoverGames()
let activeGame = getActiveGame(games)
if (activeGame) {
  try {
    checkEntitlement(activeGame.manifest)
  } catch (err) {
    logger.warn('active game not playable — falling back to bundled default', err)
    activeGame = games.get('alien-defenders') ?? null
  }
}

const server = new HostServer({
  resolveDir: (id) => games.get(id)?.dir ?? null,
  active: () =>
    activeGame && activeGame.manifest.kind === 'web'
      ? { id: activeGame.manifest.id, entry: activeGame.manifest.entry! }
      : null,
  // ponytail: picker lists web games only; external (Steam-style) games stay
  // CLI-restart-only since switching one live means starting/stopping its shell
  // lifecycle — add that when an external game actually ships.
  list: () =>
    [...games.values()]
      .filter((g) => g.manifest.kind === 'web')
      .map((g) => ({ id: g.manifest.id, name: g.manifest.name })),
  setActive: (id) => {
    const game = games.get(id)
    if (!game || game.manifest.kind !== 'web') return false
    try {
      checkEntitlement(game.manifest)
    } catch {
      return false
    }
    activeGame = game // reassigns the var active() reads → takes effect with no restart
    setActiveGameId(id) // persists so a later CLI restart keeps the choice
    return true
  },
})
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
  const externalGame =
    activeGame?.manifest.kind === 'external' ? new ExternalGame(activeGame) : null
  const scroller = new SmoothScroller()
  let focusSessionId: string | null = null

  /** Terminal keystrokes go to the focused session's instance, else our own pty. */
  function writeTerminal(bytes: string): void {
    const instanceId = focusSessionId ? server.instanceForSession(focusSessionId) : null
    if (!instanceId || !server.sendKeysToInstance(instanceId, bytes)) {
      claude.write(bytes)
    }
  }

  server.on('aggregate', (agg: Aggregate) => {
    // Sticky focus: when nobody is waiting, keep routing to the session that
    // last needed the user instead of falling back to the host's own pty.
    focusSessionId = agg.focusSessionId ?? focusSessionId
    const mode = agg.playing ? 'game' : 'terminal'
    if (mode !== router.currentMode()) {
      repeater.releaseAll()
      scroller.setValue(0)
      router.setMode(mode)
      server.broadcastGameState(agg.playing ? 'playing' : 'paused')
      externalGame?.setPlaying(agg.playing)
      logger.info(`mode → ${mode}`, agg)
    }
  })

  process.on('exit', () => {
    externalGame?.stop()
    scroller.stop()
  })

  hid.on('data', (e: ControllerEvent) => {
    try {
      if (e.kind === 'connected') {
        logger.info(`Controller connected: ${e.controllerType}`)
        return
      }
      if (e.kind === 'disconnected') {
        repeater.releaseAll()
        scroller.setValue(0)
        return
      }

      // View/Share button cycles to the next web game — swap games controller-only.
      if (e.kind === 'button' && e.button === 'view' && e.pressed) {
        const webGames = [...games.values()].filter((g) => g.manifest.kind === 'web')
        if (webGames.length > 1) {
          const i = webGames.findIndex((g) => g.manifest.id === activeGame?.manifest.id)
          const next = webGames[(i + 1) % webGames.length]!
          activeGame = next // active() reads this → also updates / and a later restart
          setActiveGameId(next.manifest.id)
          server.broadcastReload(next.manifest.id, next.manifest.entry!)
          logger.info(`game → ${next.manifest.name}`)
        }
        return
      }

      // Manual override: Menu/Options flips modes regardless of agent state.
      if (e.kind === 'button' && e.button === 'menu' && e.pressed) {
        const mode = router.currentMode() === 'game' ? 'terminal' : 'game'
        repeater.releaseAll()
        scroller.setValue(0)
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
        scroller.setValue(routed.event.value)
      }
    } catch (err) {
      logger.error('controller event handling failed', err)
    }
  })

  hid.start()
  scroller.start()

  if (!noGame && process.platform === 'darwin' && activeGame?.manifest.kind === 'web') {
    execFile('open', ['-g', HOST_URL], (err) => {
      if (err) logger.warn('could not open game tab', err)
    })
  }

  if (games.size > 1) logger.info(`change games at ${HOST_URL}/games`)
}

logger.info(
  `vibesense started (${isHost ? 'host' : 'client'}, claude args: ${JSON.stringify(claudeArgs)})`,
)
