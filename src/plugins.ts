// Game plugin system. A game is a directory with a vibesense-game.json
// manifest — either kind "web" (static files served to the game tab) or kind
// "external" (shell commands run on state transitions, e.g. a Steam adapter).
// Marketplace = npm: packages named @vibesense/game-<id>, installed under
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
// Override for tests so they don't read/write the dev's real ~/.vibesense config.
const configFile = (): string =>
  process.env.VIBESENSE_CONFIG ?? path.join(VIBESENSE_DIR, 'config.json')

export const MANIFEST_FILENAME = 'vibesense-game.json'
export const NPM_PREFIX = '@vibesense/game-'

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
    entitlement: z.enum(['free', 'premium']).default('free'),
    /** Short how-to-play steps shown in the in-game sidebar. */
    howToPlay: z.array(z.string()).optional(),
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
      // npm scopes (@vibesense/game-x) nest packages one level down.
      const dirs = entry.startsWith('@')
        ? fs.readdirSync(path.join(root, entry)).map((sub) => path.join(root, entry, sub))
        : [path.join(root, entry)]
      for (const dir of dirs) {
        const plugin = loadManifest(dir)
        if (plugin) games.set(plugin.manifest.id, plugin)
      }
    }
  }
  return games
}

/**
 * Entitlement gate, called before a game activates (startup restore, `use`,
 * and the in-app picker all route through here). Premium games pass when the
 * id is in the locally cached entitlement list, which `refreshEntitlements()`
 * keeps in sync with the marketplace — the cache doubles as offline grace.
 */
export function checkEntitlement(manifest: GameManifest): void {
  if (manifest.entitlement !== 'premium') return
  if (readConfig().entitlements?.includes(manifest.id)) return
  throw new Error(
    `"${manifest.name}" is a premium game — buy it at https://vibesense.dev/games/${manifest.id}, then run: vibesense login <token>`,
  )
}

interface Config {
  activeGame?: string
  token?: string
  entitlements?: string[]
}

export function readConfig(): Config {
  try {
    return JSON.parse(fs.readFileSync(configFile(), 'utf8')) as Config
  } catch {
    return {}
  }
}

/**
 * Merge a patch into config.json; keys set to undefined are dropped.
 * The config holds the marketplace token, so the dir is 0700 and the file is
 * written 0600 via a temp file + rename (never world-readable, even briefly).
 */
export function writeConfig(patch: Partial<Config>): void {
  fs.mkdirSync(VIBESENSE_DIR, { recursive: true, mode: 0o700 })
  const file = configFile()
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify({ ...readConfig(), ...patch }, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, file)
}

export function setActiveGameId(id: string): void {
  writeConfig({ activeGame: id })
}

export const API_BASE = process.env.VIBESENSE_API ?? 'https://vibesense.dev'

/**
 * Validate the stored token against the marketplace and cache the owned game
 * ids in config.json. Returns the fresh list, 'invalid' when the marketplace
 * rejected the token (cache is cleared), or null when there is no token or the
 * API was unreachable (cache kept — that is the offline grace). Never throws;
 * wrapper-path callers must stay silent on stdout, so diagnostics go to the
 * file logger only. The token itself is never logged.
 */
export async function refreshEntitlements(): Promise<string[] | 'invalid' | null> {
  const token = readConfig().token
  if (!token) return null
  try {
    const res = await fetch(`${API_BASE}/api/entitlements`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    })
    if (res.status === 401) {
      logger.warn('marketplace token rejected — run `vibesense login <token>` with a fresh one')
      writeConfig({ entitlements: [] })
      return 'invalid'
    }
    if (!res.ok) {
      logger.warn(`entitlement refresh failed (HTTP ${res.status}) — using cached entitlements`)
      return null
    }
    const { games } = (await res.json()) as { games: string[] }
    writeConfig({ entitlements: games })
    return games
  } catch (err) {
    logger.warn('entitlement refresh failed — using cached entitlements', err)
    return null
  }
}

/** The configured active game, falling back to the bundled default. */
export function getActiveGame(games: Map<string, GamePlugin>): GamePlugin | null {
  const configured = readConfig().activeGame
  if (configured) {
    const game = games.get(configured)
    if (game) return game
    logger.warn(`configured game "${configured}" not installed — falling back`)
  }
  return games.get('snake') ?? games.values().next().value ?? null
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
