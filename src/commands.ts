// Marketplace subcommands: install / uninstall / games / use.
// Marketplace = npm. A game is a package named @vibesense/game-<id> with a
// vibesense-game.json manifest at its root; installs land under
// ~/.vibesense/games via `npm install --prefix`.

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  API_BASE,
  checkEntitlement,
  discoverGames,
  getActiveGame,
  INSTALL_PREFIX,
  NPM_PREFIX,
  readConfig,
  refreshEntitlements,
  setActiveGameId,
  writeConfig,
} from './plugins.js'

export const SUBCOMMANDS = ['install', 'uninstall', 'games', 'use', 'login', 'logout'] as const

function npm(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('npm', args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message))
      else resolve()
    })
  })
}

// Bare ids get the official prefix; anything with a '/' or '.' (scoped names,
// tarballs, paths, urls) is already a full npm spec and passes through as-is.
function packageName(idOrPackage: string): string {
  return /[/.]/.test(idOrPackage) ? idOrPackage : `${NPM_PREFIX}${idOrPackage}`
}

/**
 * Resolve a bare game id to an installable npm spec. Paid games download from
 * the marketplace (Bearer PAT) to a temp tarball; 404 or network trouble falls
 * through to the public npm package, which npm errors on if it doesn't exist.
 */
async function resolveBareId(id: string): Promise<string> {
  const token = readConfig().token
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api/download/${id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return packageName(id) // marketplace unreachable — free games still install
  }
  if (res.status === 401) {
    throw new Error(
      `"${id}" is a paid game — create a token at https://vibesense.dev/account, then run: vibesense login <token>`,
    )
  }
  if (res.status === 402) {
    throw new Error(`you don't own "${id}" — buy it at https://vibesense.dev/games/${id}`)
  }
  if (!res.ok) return packageName(id)
  const file = path.join(os.tmpdir(), `vibesense-${id}.tgz`)
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  return file
}

/** Handle a marketplace subcommand. Exits the process when done. */
export async function runSubcommand(command: string, args: string[]): Promise<never> {
  try {
    switch (command) {
      case 'install': {
        const target = args[0]
        if (!target) throw new Error('usage: vibesense install <game-id | npm-package | tarball>')
        fs.mkdirSync(INSTALL_PREFIX, { recursive: true })
        const spec = /[/.]/.test(target) ? target : await resolveBareId(target)
        console.log(`installing ${spec} …`)
        await npm(['install', '--prefix', INSTALL_PREFIX, '--no-fund', '--no-audit', spec])
        await refreshEntitlements() // so a just-bought game passes `use` immediately
        const games = discoverGames()
        console.log('installed. available games:')
        for (const { manifest } of games.values()) {
          console.log(`  ${manifest.id}  ${manifest.name} v${manifest.version} (${manifest.kind})`)
        }
        console.log(`\nactivate with: vibesense use <id>`)
        break
      }
      case 'uninstall': {
        const target = args[0]
        if (!target) throw new Error('usage: vibesense uninstall <game-id>')
        await npm(['uninstall', '--prefix', INSTALL_PREFIX, packageName(target)])
        console.log(`uninstalled ${packageName(target)}`)
        break
      }
      case 'games': {
        const games = discoverGames()
        const active = getActiveGame(games)
        if (games.size === 0) {
          console.log('no games found')
          break
        }
        for (const { manifest } of games.values()) {
          const marker = manifest.id === active?.manifest.id ? '*' : ' '
          console.log(
            `${marker} ${manifest.id}  ${manifest.name} v${manifest.version} (${manifest.kind}, ${manifest.entitlement})`,
          )
        }
        console.log('\n* = active. discover more: npm search vibesense-game')
        console.log('browse more games → https://vibesense.dev/games')
        break
      }
      case 'use': {
        const id = args[0]
        if (!id) throw new Error('usage: vibesense use <game-id>')
        const game = discoverGames().get(id)
        if (!game) throw new Error(`game "${id}" is not installed (see: vibesense games)`)
        checkEntitlement(game.manifest)
        setActiveGameId(id)
        console.log(`active game: ${game.manifest.name}`)
        break
      }
      case 'login': {
        const token = args[0]
        if (!token?.startsWith('vs_pat_')) {
          throw new Error(
            'usage: vibesense login <vs_pat_… token>  (create one at https://vibesense.dev/account)',
          )
        }
        writeConfig({ token })
        const games = await refreshEntitlements()
        if (games === 'invalid') {
          writeConfig({ token: undefined, entitlements: undefined })
          throw new Error('token rejected — check https://vibesense.dev/account and try again')
        }
        if (games === null) {
          console.log('logged in (could not reach vibesense.dev — will validate on next start)')
        } else {
          console.log(
            games.length
              ? `logged in — owned games: ${games.join(', ')}`
              : 'logged in — no purchases yet',
          )
        }
        break
      }
      case 'logout': {
        writeConfig({ token: undefined, entitlements: undefined })
        console.log('logged out')
        break
      }
      default:
        throw new Error(`unknown command: ${command}`)
    }
    process.exit(0)
  } catch (err) {
    console.error(`vibesense ${command}: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
