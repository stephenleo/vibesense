// Host HTTP server on the singleton port. Receives Claude Code hook POSTs,
// streams state + controller input to the game tab over SSE, forwards
// keystrokes to client instances, and serves game plugin static files.

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { logger } from './logger.js'
import { SessionTracker } from './state.js'

export const HOST_PORT = 48753
export const HOST_URL = `http://127.0.0.1:${HOST_PORT}`

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

/** How the server finds game files — wired up from the plugin system by the CLI. */
export interface GameProvider {
  /** Directory for a game id, or null if unknown. */
  resolveDir(id: string): string | null
  /** The active web game (id + entry file), or null if none. */
  active(): { id: string; entry: string } | null
  /** All switchable web games, for the picker. */
  list(): { id: string; name: string }[]
  /** Make `id` the active game (persisted). Returns false if not a switchable web game. */
  setActive(id: string): boolean
}

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/**
 * The game picker page. Cards are clickable (mouse) and controller-navigable:
 * the host tracks the highlighted index and pushes {type:'highlight'} over SSE;
 * pressing A makes the host push {type:'reload'} to the chosen game.
 */
function renderPicker(games: { id: string; name: string }[], activeId: string | undefined): string {
  const cards = games
    .map((g, i) => {
      const cur = g.id === activeId
      // id is schema-constrained to /^[a-z0-9][a-z0-9-]*$/; name is free-text → escape it.
      return `<a class="card${cur ? ' sel' : ''}" data-i="${i}" href="/switch/${g.id}">${esc(g.name)}</a>`
    })
    .join('')
  return `<!doctype html><meta charset="utf-8"><title>Change game — VibeSense</title><style>
html,body{margin:0;height:100%;background:#050510;color:#7cff7c;font-family:'Courier New',monospace}
#wrap{display:flex;flex-direction:column;align-items:center;min-height:100%;gap:14px;padding:32px 24px;box-sizing:border-box}
h1{font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#567;margin:0 0 8px}
.card{display:block;min-width:260px;text-align:center;padding:16px 24px;border:2px solid #234;border-radius:8px;color:#7cff7c;text-decoration:none;letter-spacing:2px}
.card:hover{border-color:#567}
.card.sel{border-color:#7cff7c;background:#02120a;box-shadow:0 0 24px rgba(124,255,124,.15)}
#hint{margin-top:8px;font-size:13px;letter-spacing:2px;color:#567}
</style><div id="wrap"><h1>Change game</h1>${cards || '<p>no web games installed</p>'}
<div id="hint">↕ move &nbsp;·&nbsp; Ⓐ select</div></div>
<script>
const cards = [...document.querySelectorAll('.card')]
const es = new EventSource('/events')
es.onmessage = (e) => {
  let m; try { m = JSON.parse(e.data) } catch { return }
  if (m.type === 'highlight') {
    cards.forEach((c, i) => c.classList.toggle('sel', i === m.index))
    cards[m.index]?.scrollIntoView({ block: 'nearest' })
  } else if (m.type === 'reload') {
    location.href = m.url
  }
}
</script>`
}

function sse(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  // retry: reconnect in 1s so a tab left over from a previous CLI session
  // re-attaches to the new host fast (the host reuses it instead of opening one).
  res.write('retry: 1000\n\n')
}

function send(res: http.ServerResponse, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')))
    req.on('end', () => resolve(body))
    req.on('error', () => resolve(body))
  })
}

/**
 * Emits 'aggregate' (Aggregate) whenever hook events may have changed the
 * combined agent state across sessions.
 */
export class HostServer extends EventEmitter {
  readonly tracker = new SessionTracker()
  /** session_id → cwd, learned from hook payloads, used to route keystrokes to instances. */
  readonly sessionCwds = new Map<string, string>()
  /** Cwds of every client instance that ever registered. Append-only: a live
   * session must keep driving the FSM (and deliver its SessionEnd) even if its
   * instance's SSE connection drops. */
  private knownCwds = new Set<string>()

  private server: http.Server | null = null
  private gameStreams = new Set<http.ServerResponse>()
  private instances = new Map<string, { res: http.ServerResponse; cwd: string }>()
  private nextInstanceId = 1
  private lastGameState: 'playing' | 'paused' = 'paused'

  /**
   * hostCwd is the directory of the claude session this host wraps. When set,
   * hook events only reach the tracker from sessions whose cwd is ours or a
   * registered instance's — globally-installed hooks fire from every claude
   * session on the machine (e.g. headless observers), and a foreign session
   * stuck 'waiting' would otherwise pin the game paused forever. Unset (tests):
   * no filtering.
   */
  constructor(
    private readonly games: GameProvider,
    private readonly hostCwd?: string,
  ) {
    super()
  }

  /** Port actually bound (differs from HOST_PORT only in tests using port 0). */
  boundPort = 0

  /** Bind the singleton port. Resolves true = we are the host, false = port taken. */
  listen(port: number = HOST_PORT): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          logger.error('server request failed', err)
          if (!res.headersSent) res.writeHead(500)
          res.end()
        })
      })
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') resolve(false)
        else reject(err)
      })
      server.listen(port, '127.0.0.1', () => {
        this.server = server
        const address = server.address()
        this.boundPort = typeof address === 'object' && address ? address.port : port
        resolve(true)
      })
    })
  }

  close(): void {
    for (const res of this.gameStreams) res.end()
    for (const { res } of this.instances.values()) res.end()
    this.server?.close()
  }

  /** Push a game-state change to all connected game tabs. */
  broadcastGameState(state: 'playing' | 'paused'): void {
    this.lastGameState = state
    for (const res of this.gameStreams) send(res, { type: 'state', state })
  }

  /** Forward a controller input event to the game. */
  broadcastGameInput(input: Record<string, unknown>): void {
    for (const res of this.gameStreams) send(res, { type: 'input', ...input })
  }

  /** Tell open game tabs to navigate somewhere (the picker, or a chosen game). */
  broadcastReload(url: string): void {
    for (const res of this.gameStreams) send(res, { type: 'reload', url })
  }

  /** Move the highlighted card in the open picker page. */
  broadcastHighlight(index: number): void {
    for (const res of this.gameStreams) send(res, { type: 'highlight', index })
  }

  /** How many game tabs are currently connected (used to decide whether to open one). */
  gameStreamCount(): number {
    return this.gameStreams.size
  }

  /** Write keystrokes to a registered client instance's pty. Returns false if unknown. */
  sendKeysToInstance(instanceId: string, bytes: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) return false
    send(instance.res, { type: 'keys', data: Buffer.from(bytes, 'utf8').toString('base64') })
    return true
  }

  /** Should this session drive the FSM? Ours = host cwd or a registered instance's. */
  private isTrustedSession(sessionId: string): boolean {
    if (!this.hostCwd) return true // filtering off (bare server in tests)
    const cwd = this.sessionCwds.get(sessionId)
    if (!cwd) return false
    return cwd === this.hostCwd || this.knownCwds.has(cwd)
  }

  /** Find the client instance whose cwd matches the given session's cwd. */
  instanceForSession(sessionId: string): string | null {
    const cwd = this.sessionCwds.get(sessionId)
    if (!cwd) return null
    for (const [id, instance] of this.instances) {
      if (instance.cwd === cwd) return id
    }
    return null
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', HOST_URL)
    const { pathname } = url

    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ app: 'vibesense' }))
      return
    }

    if (req.method === 'POST' && pathname.startsWith('/hook/')) {
      const event = pathname.slice('/hook/'.length)
      const body = await readBody(req)
      let sessionId = 'unknown'
      try {
        const payload = JSON.parse(body) as { session_id?: string; cwd?: string }
        sessionId = payload.session_id ?? 'unknown'
        if (payload.cwd) this.sessionCwds.set(sessionId, payload.cwd)
      } catch {
        // Payload shape is claude's internal contract — event name alone still works.
      }
      if (this.isTrustedSession(sessionId) && this.tracker.apply(sessionId, event)) {
        this.emit('aggregate', this.tracker.aggregate())
      }
      res.writeHead(200)
      res.end()
      return
    }

    if (req.method === 'POST' && pathname === '/register') {
      const body = await readBody(req)
      let cwd = ''
      try {
        cwd = (JSON.parse(body) as { cwd?: string }).cwd ?? ''
      } catch {
        // cwd stays unmatched; keystrokes just won't route to this instance
      }
      if (cwd) this.knownCwds.add(cwd)
      const id = String(this.nextInstanceId++)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ instanceId: id, cwd }))
      logger.info('client instance registered', { id, cwd })
      // The SSE connection on /instance/<id> completes registration.
      this.pendingCwds.set(id, cwd)
      return
    }

    if (pathname.startsWith('/instance/')) {
      const id = pathname.slice('/instance/'.length)
      sse(res)
      this.instances.set(id, { res, cwd: this.pendingCwds.get(id) ?? '' })
      this.pendingCwds.delete(id)
      req.on('close', () => this.instances.delete(id))
      return
    }

    if (pathname === '/events') {
      sse(res)
      this.gameStreams.add(res)
      send(res, { type: 'state', state: this.lastGameState })
      req.on('close', () => this.gameStreams.delete(res))
      return
    }

    if (pathname === '/') {
      const active = this.games.active()
      if (!active) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('no web game installed')
        return
      }
      res.writeHead(302, { Location: `/games/${active.id}/${active.entry}` })
      res.end()
      return
    }

    if (pathname === '/games') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(renderPicker(this.games.list(), this.games.active()?.id))
      return
    }

    const switchMatch = pathname.match(/^\/switch\/([^/]+)$/)
    if (switchMatch) {
      this.games.setActive(decodeURIComponent(switchMatch[1]!))
      res.writeHead(302, { Location: '/' }) // → redirect chain lands in the new active game
      res.end()
      return
    }

    const gameMatch = pathname.match(/^\/games\/([^/]+)\/(.+)$/)
    if (gameMatch) {
      this.serveStatic(decodeURIComponent(gameMatch[1]!), decodeURIComponent(gameMatch[2]!), res)
      return
    }

    res.writeHead(404)
    res.end()
  }

  private pendingCwds = new Map<string, string>()

  private serveStatic(gameId: string, relPath: string, res: http.ServerResponse): void {
    const dir = this.games.resolveDir(gameId)
    if (dir) {
      const full = path.normalize(path.join(dir, relPath))
      if (
        full.startsWith(path.normalize(dir) + path.sep) &&
        fs.existsSync(full) &&
        fs.statSync(full).isFile()
      ) {
        res.writeHead(200, {
          'Content-Type': CONTENT_TYPES[path.extname(full)] ?? 'application/octet-stream',
        })
        res.end(fs.readFileSync(full))
        return
      }
    }
    res.writeHead(404)
    res.end()
  }
}
