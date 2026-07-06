// Game plugin system. A game is a directory with a vibesense-game.json
// manifest — either kind "web" (static files served to the game tab) or kind
// "external" (shell commands run on state transitions, e.g. a Steam adapter).
// Marketplace = npm: packages named vibesense-game-<id>, installed under
// ~/.vibesense/games with plain `npm install`.

import { exec } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { logger } from './logger.js'

// games/ ships at the package root, one level up from src/ (and from dist/).
export const BUNDLED_GAMES_DIR = fileURLToPath(new URL('../games', import.meta.url))

export const VIBESENSE_DIR = path.join(os.homedir(), '.vibesense')
export const INSTALL_PREFIX = path.join(VIBESENSE_DIR, 'games')
export const INSTALLED_MODULES_DIR = path.join(INSTALL_PREFIX, 'node_modules')
const CONFIG_FILE = path.join(VIBESENSE_DIR, 'config.json')

export const MANIFEST_FILENAME = 'vibesense-game.json'
export const NPM_PREFIX = 'vibesense-game-'

export const manifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    name: z.string().min(1),
    version: z.string().min(1),
    protocolVersion: z.literal(1),
    kind: z.enum(['web', 'external']),
    entry: z.string().optional(),
    commands: z
      .object({
        start: z.string().optional(),
        pause: z.string().optional(),
        resume: z.string().optional(),
        stop: z.string().optional(),
      })
      .optional(),
    entitlement: z.enum(['free', 'paid']).default('free'),
  })
  .refine((m) => m.kind !== 'web' || !!m.entry, {
    message: 'kind "web" requires an "entry" file',
  })
  .refine((m) => m.kind !== 'external' || !!m.commands, {
    message: 'kind "external" requires "commands"',
  })

export type GameManifest = z.infer<typeof manifestSchema>

export interface GamePlugin {
  manifest: GameManifest
  dir: string
}

function loadManifest(dir: string): GamePlugin | null {
  const file = path.join(dir, MANIFEST_FILENAME)
  try {
    if (!fs.existsSync(file)) return null
    const parsed = manifestSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')))
    if (!parsed.success) {
      logger.warn(`invalid game manifest at ${file}`, parsed.error.issues)
      return null
    }
    return { manifest: parsed.data, dir }
  } catch (err) {
    logger.warn(`could not read game manifest at ${file}`, err)
    return null
  }
}

/** All available games: bundled first, then npm-installed (installed wins on id clash). */
export function discoverGames(
  roots: string[] = [BUNDLED_GAMES_DIR, INSTALLED_MODULES_DIR],
): Map<string, GamePlugin> {
  const games = new Map<string, GamePlugin>()
  for (const root of roots) {
    if (!fs.existsSync(root)) continue
    for (const entry of fs.readdirSync(root)) {
      const plugin = loadManifest(path.join(root, entry))
      if (plugin) games.set(plugin.manifest.id, plugin)
    }
  }
  return games
}

/**
 * Entitlement gate, called before a game activates. Paid games are a reserved
 * future: the manifest field and this choke point exist so licensing bolts on
 * without changing the plugin contract.
 */
export function checkEntitlement(manifest: GameManifest): void {
  if (manifest.entitlement === 'paid') {
    throw new Error(
      `"${manifest.name}" is a paid game — licensing is not implemented yet (entitlement: paid)`,
    )
  }
}

function readConfig(): { activeGame?: string } {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) as { activeGame?: string }
  } catch {
    return {}
  }
}

export function setActiveGameId(id: string): void {
  fs.mkdirSync(VIBESENSE_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({ ...readConfig(), activeGame: id }, null, 2))
}

/** The configured active game, falling back to the bundled default. */
export function getActiveGame(games: Map<string, GamePlugin>): GamePlugin | null {
  const configured = readConfig().activeGame
  if (configured) {
    const game = games.get(configured)
    if (game) return game
    logger.warn(`configured game "${configured}" not installed — falling back`)
  }
  return games.get('alien-defenders') ?? games.values().next().value ?? null
}

/**
 * Lifecycle runner for kind:"external" games (Steam/Roblox adapters …).
 * Maps agent state to the manifest's shell commands: first play = start,
 * then pause/resume; stop on shutdown. Command execution is fire-and-forget.
 */
export class ExternalGame {
  private started = false

  constructor(
    private readonly plugin: GamePlugin,
    // exec-with-shell is the contract: manifest commands are author-written
    // shell strings (e.g. `open steam://run/…`). Installing a game grants it
    // command execution — same trust model as npm-installing any package; no
    // user input is ever interpolated here.
    private readonly run: (command: string, cwd: string) => void = (command, cwd) => {
      exec(command, { cwd }, (err) => {
        if (err) logger.warn(`external game command failed: ${command}`, err)
      })
    },
  ) {}

  setPlaying(playing: boolean): void {
    const commands = this.plugin.manifest.commands ?? {}
    if (playing && !this.started) {
      this.started = true
      if (commands.start) this.run(commands.start, this.plugin.dir)
      return
    }
    const command = playing ? commands.resume : commands.pause
    if (this.started && command) this.run(command, this.plugin.dir)
  }

  stop(): void {
    const { stop } = this.plugin.manifest.commands ?? {}
    if (this.started && stop) this.run(stop, this.plugin.dir)
    this.started = false
  }
}
