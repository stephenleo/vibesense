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

/** The game picker page — one anchor per web game; clicking navigates + switches. */
function renderPicker(games: { id: string; name: string }[], activeId: string | undefined): string {
  const cards = games
    .map((g) => {
      const cur = g.id === activeId
      // id is schema-constrained to /^[a-z0-9][a-z0-9-]*$/; name is free-text → escape it.
      return `<a class="card${cur ? ' active' : ''}" href="/switch/${g.id}">${cur ? '▶ ' : ''}${esc(g.name)}</a>`
    })
    .join('')
  return `<!doctype html><meta charset="utf-8"><title>Change game — VibeSense</title><style>
html,body{margin:0;height:100%;background:#050510;color:#7cff7c;font-family:'Courier New',monospace}
#wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%;gap:16px;padding:24px}
h1{font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#567}
.card{display:block;min-width:240px;text-align:center;padding:16px 24px;border:2px solid #234;border-radius:8px;color:#7cff7c;text-decoration:none;letter-spacing:2px}
.card:hover{border-color:#7cff7c;box-shadow:0 0 24px rgba(124,255,124,.15)}
.card.active{border-color:#7cff7c;background:#02120a}
</style><div id="wrap"><h1>Change game</h1>${cards || '<p>no web games installed</p>'}</div>`
}

function sse(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('\n')
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

  private server: http.Server | null = null
  private gameStreams = new Set<http.ServerResponse>()
  private instances = new Map<string, { res: http.ServerResponse; cwd: string }>()
  private nextInstanceId = 1
  private lastGameState: 'playing' | 'paused' = 'paused'

  constructor(private readonly games: GameProvider) {
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

  /** Tell open game tabs to navigate to a different game (live controller swap). */
  broadcastReload(id: string, entry: string): void {
    for (const res of this.gameStreams) send(res, { type: 'reload', url: `/games/${id}/${entry}` })
  }

  /** Write keystrokes to a registered client instance's pty. Returns false if unknown. */
  sendKeysToInstance(instanceId: string, bytes: string): boolean {
    const instance = this.instances.get(instanceId)
    if (!instance) return false
    send(instance.res, { type: 'keys', data: Buffer.from(bytes, 'utf8').toString('base64') })
    return true
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
      if (this.tracker.apply(sessionId, event)) {
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
