// Host HTTP server on the singleton port. Receives Claude Code hook POSTs,
// streams state + controller input to the game tab over SSE, forwards
// keystrokes to client instances, and serves game plugin static files.

import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

// games/ ships at the package root, one level up from src/ (and from dist/).
export const BUNDLED_GAMES_DIR = fileURLToPath(new URL('../games', import.meta.url))

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

  constructor(private readonly gamesDirs: string[] = [BUNDLED_GAMES_DIR]) {
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
      res.writeHead(302, { Location: '/games/alien-defenders/index.html' })
      res.end()
      return
    }

    if (pathname.startsWith('/games/')) {
      this.serveStatic(pathname.slice('/games/'.length), res)
      return
    }

    res.writeHead(404)
    res.end()
  }

  private pendingCwds = new Map<string, string>()

  private serveStatic(relPath: string, res: http.ServerResponse): void {
    for (const dir of this.gamesDirs) {
      const full = path.normalize(path.join(dir, relPath))
      if (!full.startsWith(path.normalize(dir) + path.sep)) continue // traversal guard
      if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue
      res.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(full)] ?? 'application/octet-stream',
      })
      res.end(fs.readFileSync(full))
      return
    }
    res.writeHead(404)
    res.end()
  }
}
