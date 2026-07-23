#!/usr/bin/env node
// vibesense — wrap an agent CLI in a pty and drive it with a game controller.
// Usage: vibesense [--no-game] [--auto-play] [claude args...]   (Claude is the default)
//        vibesense codex [--no-game] [--auto-play] [codex args...]
//        vibesense codex-app [--no-game] [--auto-play]          (Codex desktop app)
//        vibesense play [game] [--auto-play]                    (game only, no agent)
//        vibesense --version | -v                               (print version, exit)
//
// First instance to bind the singleton port becomes the HOST: it owns the
// controller, the game tab, and agent-state aggregation. Later instances run
// as CLIENTS: their claude session still reports state via global hooks, and
// the host forwards terminal keystrokes to them when they have focus.

import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import type { ControllerEvent, ControllerType } from 'openmicro/controller'
import {
  actionStatus,
  controllerStatus,
  type GuiStatus,
  type GuiStatusTone,
} from 'openmicro/logging'
import { isVibesenseHost, runAsClient } from './client.js'
import { runSubcommand, SUBCOMMANDS } from './commands.js'
import { startController } from './controller.js'
import { actionForButton, GLOBAL_GUI_BUTTONS, launchGuiHarness } from './gui.js'
import { harnessFor } from './harness.js'
import { parseInvocation, USAGE } from './invocation.js'
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
import { AgentPty } from './pty.js'
import { InputRouter } from './router.js'
import { SmoothScroller } from './scroll.js'
import { HostServer, HOST_URL } from './server.js'
import { PauseGate } from './state.js'
import type { Aggregate } from './state.js'

const args = process.argv.slice(2)
const STATUS_TINT: Record<GuiStatusTone, number> = {
  success: 32,
  warning: 33,
  action: 35,
  waiting: 33,
  executing: 32,
  complete: 36,
  error: 31,
  idle: 90,
}

/** Print an OpenMicro GUI status with its canonical tone. */
function reportGuiStatus(status: GuiStatus | null): void {
  if (!status) return
  if (process.stderr.isTTY)
    console.error(`\x1b[${STATUS_TINT[status.tone]}m●\x1b[0m ${status.message}`)
  else console.error(status.message)
}

if (
  args[0] === '--help' ||
  args[0] === '-h' ||
  (args[0] === 'codex-app' && (args[1] === '--help' || args[1] === '-h'))
) {
  console.log(USAGE)
  process.exit(0)
}

// --version/-v must not fall through to claude (which has its own --version).
if (args[0] === '--version' || args[0] === '-v') {
  // createRequire: package.json sits one level above both src/ (tsx) and dist/ (built).
  const pkg = createRequire(import.meta.url)('../package.json') as { version: string }
  console.log(pkg.version)
  process.exit(0)
}

// Marketplace subcommands (vibesense install/uninstall/games/use) never wrap claude.
if ((SUBCOMMANDS as readonly string[]).includes(args[0] ?? '')) {
  await runSubcommand(args[0]!, args.slice(1))
}

const invocation = parseInvocation(args)
const playMode = invocation.mode === 'play'
const playGameArg = invocation.game
const { noGame, autoPlay, agentArgs, agentKind } = invocation

// Play mode preserves the historical Claude hook install. Agent modes select
// all harness-specific policy once, here, while shared runtime code stays generic.
const harness = agentKind ? harnessFor(agentKind) : null
const hookHarness = harness ?? harnessFor('claude')
const hookInstallResult = hookHarness.installHooks()
if (hookInstallResult.changed && hookInstallResult.trustNotice) {
  console.error(hookInstallResult.trustNotice)
}

const wrapperId = randomUUID()

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
// Host wires this to applyMode so a mouse /switch mid-pick also unpauses.
let onPickerClose: () => void = () => {}

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
  onPickerClose()
  return true
}

if (playGameArg && !activateGame(playGameArg)) {
  console.error(
    `vibesense play: game "${playGameArg}" is not installed or not playable (see: vibesense games)`,
  )
  process.exit(1)
}

const server = new HostServer(
  {
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
        .map((g) => ({
          id: g.manifest.id,
          name: g.manifest.name,
          entitlement: g.manifest.entitlement,
          howToPlay: g.manifest.howToPlay,
        })),
    setActive: (id) => {
      // Mouse picker: /switch/<id> → this → 302 back into the chosen game.
      return activateGame(id)
    },
  },
  process.cwd(),
  wrapperId,
  harness?.usesPty === false ? harness : undefined,
)
const isHost = await server.listen()

if ((playMode || harness?.usesPty === false) && !isHost) {
  console.error(`another vibesense is already running — game is at ${HOST_URL}`)
  process.exit(1)
}

// In play mode there is no agent: the listening server keeps the process
// alive and stdin is untouched, so Ctrl+C quits by default.
const agent =
  playMode || harness?.usesPty === false
    ? null
    : new AgentPty(
        harness!.command,
        harness!.buildArgs(agentArgs),
        harness!.childWrapperId(wrapperId),
        (code) => {
          shutdown()
          process.exit(code)
        },
      )
const repeater = new KeyRepeater()
const gui =
  harness?.usesPty === false
    ? launchGuiHarness(harness, agentArgs, undefined, (error) => {
        logger.error('Codex app failed to launch', error)
        shutdown()
        process.exitCode = 1
      })
    : null

let stopController: () => void = () => {}

function shutdown(): void {
  stopController()
  stopController = () => {}
  agent?.dispose()
  gui?.dispose()
  if (isHost) server.close()
}

if (!isHost) {
  // ── Client: someone else owns the controller + game. ──────────────────
  if (await isVibesenseHost()) {
    runAsClient(wrapperId, (bytes) => agent?.write(bytes)).catch((err) =>
      logger.warn('client stream failed', err),
    )
  } else {
    logger.warn(`port in use by a non-vibesense process — running without controller (${HOST_URL})`)
  }
} else {
  // ── Host: controller + game + state aggregation. ──────────────────────
  const router = new InputRouter(
    Date.now,
    () => repeater.releaseAll(),
    gui ? GLOBAL_GUI_BUTTONS : undefined,
  )
  const externalGame =
    activeGame?.manifest.kind === 'external' ? new ExternalGame(activeGame) : null
  const scroller = new SmoothScroller()
  let focusSessionId: string | null = null
  // Play/pause: agent-driven with a Menu-button override (see PauseGate).
  // In play mode there's no agent, so the gate starts (and stays) manual.
  // --auto-play pins the agent signal to "playing" so the game never pauses;
  // Menu can still force a pause (the override sticks — no transitions occur).
  const gate = new PauseGate(playMode || autoPlay)

  /** Reconcile game/terminal mode from the pause gate. */
  function applyMode(): void {
    // Picker focus force-pauses: an agent flipping to 'playing' mid-pick must
    // not resume the game (or steal the d-pad) under the user's fingers.
    const shouldPlay = gate.shouldPlay() && !pickerOpen
    const mode = shouldPlay ? 'game' : 'terminal'
    // Broadcast before the mode guard: opening the picker while already paused
    // doesn't change the mode, but the tab still has to show picker mode.
    server.broadcastGameState(shouldPlay ? 'playing' : pickerOpen ? 'picking' : 'paused')
    if (mode === router.currentMode()) return
    gui?.releasePushToTalk()
    scroller.setValue(0)
    router.setMode(mode)
    externalGame?.setPlaying(shouldPlay)
    logger.info(`mode → ${mode}`)
  }
  onPickerClose = applyMode

  /** Terminal keystrokes go to the focused session's instance, else our own pty. */
  function writeTerminal(bytes: string): void {
    const instanceId = focusSessionId ? server.instanceForSession(focusSessionId) : null
    if (!instanceId || !server.sendKeysToInstance(instanceId, bytes)) {
      agent?.write(bytes)
    }
  }

  /** Commit the highlighted game: activate it and navigate the tab into it. */
  function selectGame(next: GamePlugin): void {
    if (activateGame(next.manifest.id)) {
      // activateGame closed the picker (and re-applied mode via onPickerClose);
      // navigating re-renders the panels in the tab.
      server.broadcastReload(`/games/${next.manifest.id}/${next.manifest.entry}`)
      logger.info(`game → ${next.manifest.name}`)
    }
  }

  /**
   * Pause/resume: force the opposite of the current state — including un-pausing
   * while the agent is idle. The override holds until the agent's playing-state
   * next changes, then auto behavior resumes. Shared by the controller's Menu
   * button and the page's pause control (POST /pause → 'pause' event).
   */
  function togglePause(): void {
    gate.toggle()
    applyMode()
    logger.info(gate.shouldPlay() ? 'game resumed (manual)' : 'game paused (manual)')
  }
  server.on('pause', togglePause)

  /** Cancel the picker: clear the highlight, hand control back by mode. */
  function closePicker(): void {
    pickerOpen = false
    server.broadcastHighlight(-1)
    applyMode()
  }

  if (!playMode) {
    server.on('aggregate', (agg: Aggregate) => {
      // Sticky focus: when nobody is waiting, keep routing to the session that
      // last needed the user instead of falling back to the host's own pty.
      focusSessionId = agg.focusSessionId ?? focusSessionId
      gate.onAgent(autoPlay || agg.playing)
      applyMode()
    })
  }

  process.on('exit', () => {
    stopController()
    externalGame?.stop()
    scroller.stop()
    gui?.dispose()
  })

  let controllerType: ControllerType = 'generic-hid'
  const handleControllerEvent = (e: ControllerEvent): void => {
    try {
      if (gui) reportGuiStatus(controllerStatus(e))

      if (e.kind === 'connected') {
        controllerType = e.controllerType
        logger.info(`Controller connected: ${e.controllerType}`)
        return
      }
      if (e.kind === 'disconnected') {
        gui?.releasePushToTalk()
        scroller.setValue(0)
        return
      }

      // Release is a hardware-lifecycle edge, not a routing decision. Cancel
      // repeat before the mode guard / ignored-held policy can swallow it.
      repeater.releasePhysical(e)

      // ── Game picker ──────────────────────────────────────────────────
      // While the picker is focused it owns all input: d-pad moves the
      // highlight in the persistent games panel (pushed over SSE), A commits,
      // B/View cancels. The tab only navigates on commit — no page swaps, so
      // what's on screen can never disagree with who owns the controller.
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

      // View/Share focuses the picker (only worth it with more than one game).
      if (e.kind === 'button' && e.button === 'view' && e.pressed) {
        const web = webGames()
        if (web.length > 1) {
          pickerIndex = Math.max(
            0,
            web.findIndex((g) => g.manifest.id === activeGame?.manifest.id),
          )
          gui?.releasePushToTalk()
          pickerOpen = true
          repeater.releaseAll() // don't let a held key auto-fire while we're picking
          scroller.setValue(0)
          server.broadcastHighlight(pickerIndex) // light up the panel on the active game
          applyMode() // force-pause while picking (see applyMode)
        }
        return
      }

      // Pause/resume: Menu/Options — same gate as the page's pause control.
      if (e.kind === 'button' && e.button === 'menu' && e.pressed) {
        togglePause()
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
        if (gui) {
          const action = actionForButton(button, pressed)
          if (!action) return
          if (REPEATING_BUTTONS.has(button)) {
            if (pressed) {
              let reported = false
              repeater.press(button, () => {
                const performed = gui.perform(action)
                if (!reported) {
                  reported = true
                  reportGuiStatus(performed ? actionStatus(button, controllerType, action) : null)
                }
              })
            } else repeater.release(button)
          } else {
            const performed = gui.perform(action)
            reportGuiStatus(
              performed && pressed ? actionStatus(button, controllerType, action) : null,
            )
          }
          return
        }
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

      if (!gui && routed.event.kind === 'axis' && routed.event.axis === 'right_y') {
        scroller.setValue(routed.event.value)
      }
    } catch (err) {
      logger.error('controller event handling failed', err)
    }
  }
  stopController = startController(handleControllerEvent, () => repeater.releaseAll())
  if (!gui) scroller.start()
  if (playMode || autoPlay) applyMode() // no agent will kick us — start playing now

  if (autoPlay) {
    if (process.platform === 'darwin') {
      // -d/-i/-s: no display/idle/system sleep; -u: assert "user active" so
      // OS-level idle time (what Teams/Slack read for AFK) keeps resetting.
      // -w ties caffeinate's lifetime to our pid — self-cleans on any exit.
      spawn('caffeinate', ['-disu', '-w', String(process.pid)], { stdio: 'ignore' }).on(
        'error',
        (err) => logger.warn('caffeinate failed to start — machine may still sleep', err),
      )
    } else {
      logger.warn('auto-play keep-awake is macOS-only for now — game still plays')
    }
  }

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

  if (games.size > 1) logger.info('change games from the in-game panel (or press View)')
}

logger.info(
  playMode
    ? 'vibesense started (play mode, no agent)'
    : `vibesense started (${isHost ? 'host' : 'client'}, ${agentKind} args: ${JSON.stringify(agentArgs)})`,
)
