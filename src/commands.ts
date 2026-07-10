// Marketplace subcommands: install / uninstall / games / use.
// Marketplace = npm. A game is a package named vibesense-game-<id> with a
// vibesense-game.json manifest at its root; installs land under
// ~/.vibesense/games via `npm install --prefix`.

import { execFile } from 'node:child_process'
import fs from 'node:fs'
import {
  checkEntitlement,
  discoverGames,
  getActiveGame,
  INSTALL_PREFIX,
  NPM_PREFIX,
  setActiveGameId,
} from './plugins.js'

export const SUBCOMMANDS = ['install', 'uninstall', 'games', 'use'] as const

function npm(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('npm', args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr.trim() || err.message))
      else resolve()
    })
  })
}

function packageName(idOrPackage: string): string {
  return idOrPackage.startsWith(NPM_PREFIX) ? idOrPackage : `${NPM_PREFIX}${idOrPackage}`
}

/** Handle a marketplace subcommand. Exits the process when done. */
export async function runSubcommand(command: string, args: string[]): Promise<never> {
  try {
    switch (command) {
      case 'install': {
        const target = args[0]
        if (!target) throw new Error('usage: vibesense install <game-id | npm-package | tarball>')
        fs.mkdirSync(INSTALL_PREFIX, { recursive: true })
        // Tarballs/paths/URLs install as-is (useful for testing unpublished games).
        const spec = /[/.]/.test(target) ? target : packageName(target)
        console.log(`installing ${spec} …`)
        await npm(['install', '--prefix', INSTALL_PREFIX, '--no-fund', '--no-audit', spec])
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
        console.log('\n* = active. discover more: npm search vibesense-game-')
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
      default:
        throw new Error(`unknown command: ${command}`)
    }
    process.exit(0)
  } catch (err) {
    console.error(`vibesense ${command}: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
