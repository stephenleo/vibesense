// Integration test: real HostServer on an ephemeral port — hook POSTs drive
// the aggregate, SSE streams deliver game state and forwarded keystrokes.

import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BUNDLED_GAMES_DIR } from '../src/plugins.js'
import { HostServer } from '../src/server.js'
import type { Aggregate } from '../src/state.js'

let server: HostServer
let base: string
let switched: string[]

beforeEach(async () => {
  switched = []
  server = new HostServer({
    resolveDir: (id) => (id === 'snake' ? path.join(BUNDLED_GAMES_DIR, id) : null),
    active: () => ({ id: 'snake', entry: 'index.html' }),
    list: () => [
      {
        id: 'snake',
        name: 'Snake',
        entitlement: 'free' as const,
        howToPlay: ['Left stick steers the snake'],
      },
      { id: 'cascade', name: 'Cascade', entitlement: 'premium' as const },
    ],
    setActive: (id) => {
      switched.push(id)
      return true
    },
  })
  await server.listen(0) // ephemeral port so tests never collide with a running vibesense
  base = `http://127.0.0.1:${server.boundPort}`
})

afterEach(() => server.close())

async function postHook(event: string, sessionId: string, extra: Record<string, unknown> = {}) {
  await fetch(`${base}/hook/${event}`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, ...extra }),
  })
}

async function postOwnedHook(
  event: string,
  sessionId: string,
  wrapperId: string,
  extra: Record<string, unknown> = {},
) {
  await fetch(`${base}/hook/${event}`, {
    method: 'POST',
    headers: { 'X-Vibesense-Instance-Id': wrapperId },
    body: JSON.stringify({ session_id: sessionId, ...extra }),
  })
}

/** Read one SSE data frame from a streaming response (optionally of a given type). */
async function nextFrame(
  body: ReadableStream<Uint8Array>,
  type?: string,
): Promise<Record<string, unknown>> {
  const reader = body.getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) throw new Error('stream ended')
    buffer += new TextDecoder().decode(value)
    for (const match of buffer.matchAll(/data: (.*)\n\n/g)) {
      const frame = JSON.parse(match[1]!) as Record<string, unknown>
      if (!type || frame.type === type) {
        reader.releaseLock()
        return frame
      }
    }
  }
}

describe('HostServer', () => {
  it('takes the host port from VIBESENSE_PORT, defaulting to 48753', async () => {
    const { HOST_PORT, HOST_URL } = await import('../src/server.js')
    expect(HOST_PORT).toBe(48753)
    expect(HOST_URL).toBe('http://127.0.0.1:48753')

    vi.stubEnv('VIBESENSE_PORT', '48754')
    vi.resetModules()
    const overridden = await import('../src/server.js')
    expect(overridden.HOST_PORT).toBe(48754)
    expect(overridden.HOST_URL).toBe('http://127.0.0.1:48754')
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('identifies itself on /health', async () => {
    const res = await fetch(`${base}/health`)
    expect(await res.json()).toEqual({ app: 'vibesense' })
  })

  it('hook POSTs drive the aggregate', async () => {
    const aggregates: Aggregate[] = []
    server.on('aggregate', (a: Aggregate) => aggregates.push(a))

    await postHook('UserPromptSubmit', 's1')
    expect(aggregates.at(-1)).toEqual({ playing: true, focusSessionId: null })

    await postHook('PreToolUse', 's1')
    expect(aggregates.at(-1)).toEqual({ playing: false, focusSessionId: 's1' })
  })

  it('serves the bundled game and redirects / to it', async () => {
    const redirect = await fetch(`${base}/`, { redirect: 'manual' })
    expect(redirect.status).toBe(302)

    const page = await fetch(`${base}/games/snake/index.html`)
    expect(page.status).toBe(200)
    expect(await page.text()).toContain('Snake')
  })

  it('injects the persistent panels into served game HTML only', async () => {
    const page = await (await fetch(`${base}/games/snake/index.html`)).text()
    // Games panel present, grouped, with switch links and controller-highlight
    // indices; spliced inside the body.
    expect(page).toContain('id="vs-sidebar"')
    expect(page).toContain('<h3>Free</h3>')
    expect(page).toContain('<h3>Premium</h3>')
    expect(page).toContain('href="/switch/cascade"')
    expect(page).toContain('data-i="0"')
    // Controller-target badge, updated by {type:'state'} SSE messages.
    expect(page).toContain('id="vs-target"')

    // Non-HTML assets pass through untouched.
    const js = await (await fetch(`${base}/games/snake/game.js`)).text()
    expect(js).not.toContain('vs-sidebar')
  })

  it('shows how-to-play steps for the served game plus the universal system rows', async () => {
    const page = await (await fetch(`${base}/games/snake/index.html`)).text()
    expect(page).toContain('how to play</h2>')
    expect(page).toContain('<li>Left stick steers the snake</li>')
    // Pause / change game are engine behavior — rendered as key/action rows with
    // both the controller and keyboard bindings, for every game.
    expect(page).toContain('<kbd>P</kbd><kbd>Menu</kbd>')
    expect(page).toContain('<kbd>Esc</kbd><kbd>View</kbd>')
    expect(page).toContain('id="vs-pause"')
  })

  it('relays POST /pause as a pause event (the CLI toggles the same PauseGate)', async () => {
    const paused: number[] = []
    server.on('pause', () => paused.push(1))
    const res = await fetch(`${base}/pause`, { method: 'POST' })
    expect(await res.json()).toEqual({ ok: true })
    expect(paused).toHaveLength(1)
  })

  it('redirects the old /games picker URL into the active game and switches via /switch/<id>', async () => {
    const picker = await fetch(`${base}/games`, { redirect: 'manual' })
    expect(picker.status).toBe(302)
    expect(picker.headers.get('location')).toBe('/')

    const res = await fetch(`${base}/switch/snake`, { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(switched).toEqual(['snake'])
  })

  it('blocks path traversal out of the games dir', async () => {
    const res = await fetch(`${base}/games/..%2F..%2Fpackage.json`)
    expect(res.status).toBe(404)
  })

  it('streams game state on /events, starting with the current state', async () => {
    const stream = await fetch(`${base}/events`)
    expect(await nextFrame(stream.body!)).toEqual({ type: 'state', state: 'paused' })
  })

  it('starts with autopilot off, toggles it over POST /autopilot, and replays it on connect', async () => {
    const first = await fetch(`${base}/events`)
    expect(await nextFrame(first.body!, 'autopilot')).toEqual({ type: 'autopilot', enabled: false })

    const res = await fetch(`${base}/autopilot`, {
      method: 'POST',
      body: JSON.stringify({ enabled: true }),
    })
    expect(await res.json()).toEqual({ enabled: true })

    // A page loaded (or reloaded) after the toggle gets the current value.
    const second = await fetch(`${base}/events`)
    expect(await nextFrame(second.body!, 'autopilot')).toEqual({ type: 'autopilot', enabled: true })
    await first.body?.cancel()
    await second.body?.cancel()
  })

  it('injects a favicon and the autopilot toggle into served game HTML', async () => {
    const page = await (await fetch(`${base}/games/snake/index.html`)).text()
    // Browsers ignore favicons declared outside <head>, so position matters.
    const link = page.indexOf('<link rel="icon" href="data:image/svg+xml,')
    expect(link).toBeGreaterThan(-1)
    expect(link).toBeLessThan(page.indexOf('</head>'))
    expect(page).toContain('id="vs-auto"')
  })

  it('forwards keystrokes to a registered instance by session cwd', async () => {
    const reg = await fetch(`${base}/register`, {
      method: 'POST',
      body: JSON.stringify({ cwd: '/tmp/project-a' }),
    })
    const { instanceId } = (await reg.json()) as { instanceId: string }

    const stream = await fetch(`${base}/instance/${instanceId}`)
    await postHook('Notification', 'sess-a', { cwd: '/tmp/project-a' })

    expect(server.instanceForSession('sess-a')).toBe(instanceId)
    expect(server.sendKeysToInstance(instanceId, '\r')).toBe(true)
    expect(await nextFrame(stream.body!)).toEqual({
      type: 'keys',
      data: Buffer.from('\r').toString('base64'),
    })
  })

  it('sendKeysToInstance returns false for unknown instances', () => {
    expect(server.sendKeysToInstance('nope', 'x')).toBe(false)
  })

  it('accepts owned host hooks and ignores unknown wrapper IDs', async () => {
    const owned = new HostServer(
      { resolveDir: () => null, active: () => null, list: () => [], setActive: () => false },
      '/tmp/shared',
      'host-wrapper',
    )
    await owned.listen(0)
    const ownedBase = `http://127.0.0.1:${owned.boundPort}`
    const aggregates: Aggregate[] = []
    owned.on('aggregate', (a: Aggregate) => aggregates.push(a))
    const post = (wrapperId: string) =>
      fetch(`${ownedBase}/hook/UserPromptSubmit`, {
        method: 'POST',
        headers: { 'X-Vibesense-Instance-Id': wrapperId },
        body: JSON.stringify({ session_id: wrapperId, cwd: '/tmp/shared' }),
      })
    try {
      await post('host-wrapper')
      expect(aggregates).toHaveLength(1)
      await fetch(`${ownedBase}/hook/Stop`, {
        method: 'POST',
        headers: { 'X-Vibesense-Instance-Id': 'host-wrapper' },
        body: JSON.stringify({ session_id: 'host-wrapper', cwd: '/tmp/shared' }),
      })
      expect(aggregates.at(-1)).toEqual({ playing: false, focusSessionId: 'host-wrapper' })
      await post('unknown-wrapper')
      expect(aggregates).toHaveLength(2)
      expect(owned.sessionOwners.get('host-wrapper')).toBe('host-wrapper')
      expect(owned.sessionOwners.has('unknown-wrapper')).toBe(false)
    } finally {
      owned.close()
    }
  })

  it('routes same-cwd clients by wrapper ownership', async () => {
    const register = async (wrapperId: string) => {
      const reg = await fetch(`${base}/register`, {
        method: 'POST',
        body: JSON.stringify({ cwd: '/tmp/shared', wrapperId }),
      })
      const { instanceId } = (await reg.json()) as { instanceId: string }
      const stream = await fetch(`${base}/instance/${instanceId}`)
      return { instanceId, stream }
    }
    const a = await register('wrapper-a')
    const b = await register('wrapper-b')
    await postOwnedHook('PermissionRequest', 'session-a', 'wrapper-a', { cwd: '/tmp/shared' })
    await postOwnedHook('PermissionRequest', 'session-b', 'wrapper-b', { cwd: '/tmp/shared' })

    expect(server.instanceForSession('session-a')).toBe(a.instanceId)
    expect(server.instanceForSession('session-b')).toBe(b.instanceId)
    await a.stream.body?.cancel()
    await b.stream.body?.cancel()
  })

  it('removes only a disconnected client wrapper sessions', async () => {
    const register = async (wrapperId: string) => {
      const reg = await fetch(`${base}/register`, {
        method: 'POST',
        body: JSON.stringify({ cwd: '/tmp/shared', wrapperId }),
      })
      const { instanceId } = (await reg.json()) as { instanceId: string }
      const controller = new AbortController()
      await fetch(`${base}/instance/${instanceId}`, { signal: controller.signal })
      return controller
    }
    const controllerA = await register('wrapper-a')
    const controllerB = await register('wrapper-b')
    await postOwnedHook('PermissionRequest', 'session-b', 'wrapper-b', { cwd: '/tmp/shared' })
    await postOwnedHook('PermissionRequest', 'session-a', 'wrapper-a', { cwd: '/tmp/shared' })
    expect(server.tracker.aggregate().focusSessionId).toBe('session-a')

    controllerA.abort()
    await expect.poll(() => server.tracker.aggregate().focusSessionId).toBe('session-b')
    expect(server.sessionOwners.has('session-a')).toBe(false)
    expect(server.sessionCwds.has('session-a')).toBe(false)
    expect(server.sessionOwners.get('session-b')).toBe('wrapper-b')
    controllerB.abort()
  })

  it('ignores hook events from sessions outside the wrapped cwds', async () => {
    // Global hooks fire from every claude session on the machine; a foreign
    // session (e.g. a headless observer) going 'waiting' must not pin the game.
    const scoped = new HostServer(
      { resolveDir: () => null, active: () => null, list: () => [], setActive: () => false },
      '/tmp/host-project',
    )
    await scoped.listen(0)
    const scopedBase = `http://127.0.0.1:${scoped.boundPort}`
    const aggregates: Aggregate[] = []
    scoped.on('aggregate', (a: Aggregate) => aggregates.push(a))
    const post = (event: string, body: Record<string, unknown>) =>
      fetch(`${scopedBase}/hook/${event}`, { method: 'POST', body: JSON.stringify(body) })

    try {
      await post('UserPromptSubmit', { session_id: 'ours', cwd: '/tmp/host-project' })
      expect(aggregates.at(-1)).toEqual({ playing: true, focusSessionId: null })

      // Foreign observer goes 'waiting' — without scoping this pauses forever.
      await post('Notification', { session_id: 'observer', cwd: '/tmp/unrelated' })
      expect(aggregates.at(-1)).toEqual({ playing: true, focusSessionId: null })

      // Missing cwd is also untrusted once scoping is on.
      await post('Notification', { session_id: 'no-cwd' })
      expect(aggregates.at(-1)).toEqual({ playing: true, focusSessionId: null })

      // A registered client instance's cwd is trusted like the host's own.
      await fetch(`${scopedBase}/register`, {
        method: 'POST',
        body: JSON.stringify({ cwd: '/tmp/client-project' }),
      })
      await post('PreToolUse', { session_id: 'client-sess', cwd: '/tmp/client-project' })
      expect(aggregates.at(-1)).toEqual({ playing: false, focusSessionId: 'client-sess' })
    } finally {
      scoped.close()
    }
  })
})
