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
  refreshEntitlements,
  setActiveGameId,
} from './plugins.js'
import type { GamePlugin } from './plugins.js'
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
// Fire-and-forget: today's gate uses the cached entitlements (offline grace);
// a revocation observed here takes effect on the next start.
void refreshEntitlements()
let activeGame = getActiveGame(games)
if (activeGame) {
  try {
    checkEntitlement(activeGame.manifest)
  } catch (err) {
    logger.warn('active game not playable — falling back to bundled default', err)
    activeGame = games.get('snake') ?? null
  }
}

// Game-picker state, shared between the mouse route (/switch) and the controller.
let pickerOpen = false
let pickerIndex = 0

/** Web games in a stable order — what the picker lists and cycles through. */
function webGames(): GamePlugin[] {
  return [...games.values()].filter((g) => g.manifest.kind === 'web')
}

/**
 * Make `id` the active game: persist it, point `active()` at it, and close the
 * picker. Returns false if it isn't a playable web game. One path for both the
 * mouse picker (/switch) and the controller so their state can't diverge.
 */
function activateGame(id: string): boolean {
  const game = games.get(id)
  if (!game || game.manifest.kind !== 'web') return false
  try {
    checkEntitlement(game.manifest)
  } catch {
    return false
  }
  activeGame = game
  setActiveGameId(id)
  pickerOpen = false
  return true
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
    // Mouse picker: /switch/<id> → this → 302 back into the chosen game.
    return activateGame(id)
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
  // Manual pause (Menu button): while true the game stays frozen regardless of
  // agent state; controller drives the terminal. lastPlaying remembers the
  // agent's real state so "resume" hands back to it instead of guessing.
  let userPaused = false
  let lastPlaying = false

  /** Reconcile game/terminal mode from agent state + the manual pause flag. */
  function applyMode(): void {
    const shouldPlay = lastPlaying && !userPaused
    const mode = shouldPlay ? 'game' : 'terminal'
    if (mode === router.currentMode()) return
    repeater.releaseAll()
    scroller.setValue(0)
    router.setMode(mode)
    server.broadcastGameState(shouldPlay ? 'playing' : 'paused')
    externalGame?.setPlaying(shouldPlay)
    logger.info(`mode → ${mode}`, { userPaused, lastPlaying })
  }

  /** Terminal keystrokes go to the focused session's instance, else our own pty. */
  function writeTerminal(bytes: string): void {
    const instanceId = focusSessionId ? server.instanceForSession(focusSessionId) : null
    if (!instanceId || !server.sendKeysToInstance(instanceId, bytes)) {
      claude.write(bytes)
    }
  }

  /** Commit the highlighted game: activate it and navigate the tab into it. */
  function selectGame(next: GamePlugin): void {
    if (activateGame(next.manifest.id)) {
      server.broadcastReload(`/games/${next.manifest.id}/${next.manifest.entry}`)
      logger.info(`game → ${next.manifest.name}`)
    }
  }

  /** Cancel the picker: drop back into the current game unchanged. */
  function closePicker(): void {
    pickerOpen = false
    if (activeGame?.manifest.kind === 'web') {
      server.broadcastReload(`/games/${activeGame.manifest.id}/${activeGame.manifest.entry}`)
    }
  }

  server.on('aggregate', (agg: Aggregate) => {
    // Sticky focus: when nobody is waiting, keep routing to the session that
    // last needed the user instead of falling back to the host's own pty.
    focusSessionId = agg.focusSessionId ?? focusSessionId
    lastPlaying = agg.playing
    applyMode() // a manual pause overrides this until the user resumes
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

      // ── Game picker ──────────────────────────────────────────────────
      // While the picker is open it owns all input: d-pad/stick moves the
      // highlight (host-tracked, pushed over SSE), A commits, B/View cancels.
      // We navigate the tab only once, on commit — no reload-per-press.
      if (pickerOpen) {
        if (e.kind === 'button' && e.pressed) {
          const web = webGames()
          if (e.button === 'dpad_down' || e.button === 'dpad_right') {
            pickerIndex = (pickerIndex + 1) % web.length
            server.broadcastHighlight(pickerIndex)
          } else if (e.button === 'dpad_up' || e.button === 'dpad_left') {
            pickerIndex = (pickerIndex - 1 + web.length) % web.length
            server.broadcastHighlight(pickerIndex)
          } else if (e.button === 'south') {
            selectGame(web[pickerIndex]!)
          } else if (e.button === 'view' || e.button === 'east') {
            closePicker()
          }
        }
        return
      }

      // View/Share opens the picker (only worth it with more than one game).
      if (e.kind === 'button' && e.button === 'view' && e.pressed) {
        const web = webGames()
        if (web.length > 1) {
          pickerIndex = Math.max(
            0,
            web.findIndex((g) => g.manifest.id === activeGame?.manifest.id),
          )
          pickerOpen = true
          repeater.releaseAll() // don't let a held key auto-fire while we're picking
          scroller.setValue(0)
          server.broadcastReload('/games') // tab loads the picker, highlighting the active game
        }
        return
      }

      // Pause/resume: Menu/Options toggles a sticky manual pause. Paused freezes
      // the game and puts the controller on the terminal until you resume, no
      // matter what the agent does in between.
      if (e.kind === 'button' && e.button === 'menu' && e.pressed) {
        userPaused = !userPaused
        applyMode()
        logger.info(userPaused ? 'game paused (manual)' : 'game resumed (manual)')
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
    // Give a tab left over from a previous session ~1.5s to reconnect (SSE
    // retry) and reuse it, instead of opening a fresh window every restart.
    setTimeout(() => {
      if (server.gameStreamCount() > 0) return
      execFile('open', ['-g', HOST_URL], (err) => {
        if (err) logger.warn('could not open game tab', err)
      })
    }, 1500)
  }

  if (games.size > 1) logger.info(`change games at ${HOST_URL}/games`)
}

logger.info(
  `vibesense started (${isHost ? 'host' : 'client'}, claude args: ${JSON.stringify(claudeArgs)})`,
)
