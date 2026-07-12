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
  refreshEntitlements,
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

  it('howToPlay is optional and round-trips as a string array', () => {
    const web = { ...base, kind: 'web', entry: 'index.html' }
    expect(manifestSchema.parse(web).howToPlay).toBeUndefined()
    expect(manifestSchema.parse({ ...web, howToPlay: ['step one'] }).howToPlay).toEqual([
      'step one',
    ])
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

  it('finds packages nested under an npm scope directory', () => {
    writeGame('@vibesense/game-scoped', {
      id: 'scoped',
      name: 'Scoped',
      version: '1.0.0',
      protocolVersion: 1,
      kind: 'web',
      entry: 'index.html',
    })
    expect(discoverGames([dir]).has('scoped')).toBe(true)
  })

  it('finds the bundled snake by default', () => {
    expect(discoverGames().has('snake')).toBe(true)
  })

  it('getActiveGame falls back to snake', () => {
    // Point at a nonexistent config so the fallback path is what we actually test,
    // not whatever game the dev last selected in ~/.vibesense/config.json.
    process.env.VIBESENSE_CONFIG = path.join(os.tmpdir(), 'vibesense-no-such-config.json')
    try {
      const games = discoverGames()
      expect(getActiveGame(games)?.manifest.id).toBe('snake')
    } finally {
      delete process.env.VIBESENSE_CONFIG
    }
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

  let configPath: string

  beforeEach(() => {
    configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vibesense-cfg-')), 'config.json')
    process.env.VIBESENSE_CONFIG = configPath
  })
  afterEach(() => {
    delete process.env.VIBESENSE_CONFIG
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
  })

  it('allows free games always', () => {
    expect(() => checkEntitlement({ ...manifest, entitlement: 'free' })).not.toThrow()
  })

  it('blocks paid games without a cached entitlement', () => {
    expect(() => checkEntitlement({ ...manifest, entitlement: 'paid' })).toThrow(/paid/)
  })

  it('allows paid games listed in the cached entitlements', () => {
    fs.writeFileSync(configPath, JSON.stringify({ entitlements: ['g'] }))
    expect(() => checkEntitlement({ ...manifest, entitlement: 'paid' })).not.toThrow()
  })
})

describe('refreshEntitlements', () => {
  let configPath: string

  beforeEach(() => {
    configPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vibesense-cfg-')), 'config.json')
    process.env.VIBESENSE_CONFIG = configPath
  })
  afterEach(() => {
    delete process.env.VIBESENSE_CONFIG
    fs.rmSync(path.dirname(configPath), { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  const config = (): Record<string, unknown> => JSON.parse(fs.readFileSync(configPath, 'utf8'))

  it('does nothing without a token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await refreshEntitlements()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('caches the owned games on success', async () => {
    fs.writeFileSync(configPath, JSON.stringify({ token: 'vs_pat_x' }))
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ games: ['depths'] }))),
    )
    expect(await refreshEntitlements()).toEqual(['depths'])
    expect(config().entitlements).toEqual(['depths'])
  })

  it('clears the cache when the token is rejected', async () => {
    fs.writeFileSync(configPath, JSON.stringify({ token: 'vs_pat_x', entitlements: ['depths'] }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })))
    expect(await refreshEntitlements()).toBe('invalid')
    expect(config().entitlements).toEqual([])
  })

  it('keeps the cache when the API is unreachable (offline grace)', async () => {
    fs.writeFileSync(configPath, JSON.stringify({ token: 'vs_pat_x', entitlements: ['depths'] }))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await refreshEntitlements()).toBeNull()
    expect(config().entitlements).toEqual(['depths'])
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
