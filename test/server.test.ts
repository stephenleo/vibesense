// Integration test: real HostServer on an ephemeral port — hook POSTs drive
// the aggregate, SSE streams deliver game state and forwarded keystrokes.

import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
      { id: 'snake', name: 'Snake', entitlement: 'free' as const },
      { id: 'cascade', name: 'Cascade', entitlement: 'paid' as const },
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

/** Read one SSE data frame from a streaming response. */
async function nextFrame(body: ReadableStream<Uint8Array>): Promise<Record<string, unknown>> {
  const reader = body.getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) throw new Error('stream ended')
    buffer += new TextDecoder().decode(value)
    const match = buffer.match(/data: (.*)\n\n/)
    if (match) {
      reader.releaseLock()
      return JSON.parse(match[1]!)
    }
  }
}

describe('HostServer', () => {
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

  it('injects the Free/Paid sidebar into served game HTML only', async () => {
    const page = await (await fetch(`${base}/games/snake/index.html`)).text()
    // Sidebar present, grouped, with switch links; spliced inside the body.
    expect(page).toContain('id="vs-sidebar"')
    expect(page).toContain('<summary>Free</summary>')
    expect(page).toContain('<summary>Paid</summary>')
    expect(page).toContain('href="/switch/cascade"')

    // Non-HTML assets pass through untouched.
    const js = await (await fetch(`${base}/games/snake/game.js`)).text()
    expect(js).not.toContain('vs-sidebar')
  })

  it('lists games on /games and switches via /switch/<id>', async () => {
    const picker = await fetch(`${base}/games`)
    expect(await picker.text()).toContain('Snake')

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
