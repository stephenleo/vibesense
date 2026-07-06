import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkEntitlement,
  discoverGames,
  ExternalGame,
  getActiveGame,
  manifestSchema,
} from '../src/plugins.js'
import type { GamePlugin } from '../src/plugins.js'

describe('manifestSchema', () => {
  const base = {
    id: 'my-game',
    name: 'My Game',
    version: '1.0.0',
    protocolVersion: 1,
  }

  it('accepts a web game with an entry', () => {
    const parsed = manifestSchema.parse({ ...base, kind: 'web', entry: 'index.html' })
    expect(parsed.entitlement).toBe('free') // defaulted
  })

  it('accepts an external game with commands', () => {
    expect(() =>
      manifestSchema.parse({ ...base, kind: 'external', commands: { pause: 'true' } }),
    ).not.toThrow()
  })

  it('rejects a web game without entry and an external game without commands', () => {
    expect(manifestSchema.safeParse({ ...base, kind: 'web' }).success).toBe(false)
    expect(manifestSchema.safeParse({ ...base, kind: 'external' }).success).toBe(false)
  })

  it('rejects bad ids and unknown kinds', () => {
    expect(
      manifestSchema.safeParse({ ...base, id: '../evil', kind: 'web', entry: 'i.html' }).success,
    ).toBe(false)
    expect(manifestSchema.safeParse({ ...base, kind: 'native' }).success).toBe(false)
  })
})

describe('discoverGames', () => {
  let dir: string

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibesense-games-'))
  })
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

  function writeGame(sub: string, manifest: Record<string, unknown>): void {
    fs.mkdirSync(path.join(dir, sub), { recursive: true })
    fs.writeFileSync(path.join(dir, sub, 'vibesense-game.json'), JSON.stringify(manifest))
  }

  it('finds valid manifests and skips invalid ones', () => {
    writeGame('good', {
      id: 'good',
      name: 'Good',
      version: '1.0.0',
      protocolVersion: 1,
      kind: 'web',
      entry: 'index.html',
    })
    writeGame('bad', { id: 'bad', kind: 'web' })
    fs.mkdirSync(path.join(dir, 'not-a-game'))

    const games = discoverGames([dir])
    expect([...games.keys()]).toEqual(['good'])
  })

  it('finds the bundled alien-defenders by default', () => {
    expect(discoverGames().has('alien-defenders')).toBe(true)
  })

  it('getActiveGame falls back to alien-defenders', () => {
    const games = discoverGames()
    expect(getActiveGame(games)?.manifest.id).toBe('alien-defenders')
  })
})

describe('checkEntitlement', () => {
  const manifest = {
    id: 'g',
    name: 'G',
    version: '1',
    protocolVersion: 1,
    kind: 'web',
    entry: 'i.html',
  } as const

  it('allows free games and blocks paid ones (stub)', () => {
    expect(() => checkEntitlement({ ...manifest, entitlement: 'free' })).not.toThrow()
    expect(() => checkEntitlement({ ...manifest, entitlement: 'paid' })).toThrow(/paid/)
  })
})

describe('ExternalGame', () => {
  function makeGame(): { game: ExternalGame; run: ReturnType<typeof vi.fn> } {
    const run = vi.fn()
    const plugin: GamePlugin = {
      dir: '/tmp/steam-adapter',
      manifest: {
        id: 'steam-adapter',
        name: 'Steam Adapter',
        version: '1.0.0',
        protocolVersion: 1,
        kind: 'external',
        commands: { start: 'launch.sh', pause: 'pause.sh', resume: 'resume.sh', stop: 'quit.sh' },
        entitlement: 'free',
      },
    }
    return { game: new ExternalGame(plugin, run), run }
  }

  it('first play runs start, then pause/resume alternate, stop on shutdown', () => {
    const { game, run } = makeGame()
    game.setPlaying(true)
    game.setPlaying(false)
    game.setPlaying(true)
    game.stop()
    expect(run.mock.calls.map((c) => c[0])).toEqual([
      'launch.sh',
      'pause.sh',
      'resume.sh',
      'quit.sh',
    ])
    expect(run.mock.calls[0]![1]).toBe('/tmp/steam-adapter')
  })

  it('never runs pause/stop before the game has started', () => {
    const { game, run } = makeGame()
    game.setPlaying(false)
    game.stop()
    expect(run).not.toHaveBeenCalled()
  })
})
