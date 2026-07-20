// Host HTTP server on the singleton port. Receives agent lifecycle hook POSTs,
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
  /** All switchable web games, for the picker and the in-game sidebar. */
  list(): { id: string; name: string; entitlement: 'free' | 'paid'; howToPlay?: string[] }[]
  /** Make `id` the active game (persisted). Returns false if not a switchable web game. */
  setActive(id: string): boolean
}

// Injected into every served game page (bundled or npm marketplace) so tabs get
// an icon without shipping an asset file or adding a route.
const FAVICON = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text y="14" font-size="14">🕹️</text></svg>`,
)}">`

const esc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

/**
 * Panels spliced into every served game page: a persistent games list on the
 * left (mouse: /switch links; controller: View focuses it, the host pushes
 * {type:'highlight'} over SSE and A commits via {type:'reload'}) and a
 * persistent how-to-play panel on the right. The badge above the games list
 * shows where controller input currently goes (game vs terminal), driven by
 * the same {type:'state'} messages that pause/resume the game.
 */
function renderSidebar(
  games: { id: string; name: string; entitlement: 'free' | 'paid' }[],
  activeId: string | undefined,
  howToPlay?: string[],
): string {
  const group = (label: string, items: typeof games): string =>
    items.length
      ? `<div class="vs-group"><h2>${label}</h2>${items
          .map(
            // data-i indexes the full list — the same order the controller's
            // picker cycles through — so SSE highlight lands on the right card.
            // id is schema-constrained, but esc() costs nothing — belt and braces.
            (g) =>
              `<a class="vs-game${g.id === activeId ? ' vs-active' : ''}" data-i="${games.indexOf(g)}" href="/switch/${esc(g.id)}">${esc(g.name)}</a>`,
          )
          .join('')}</div>`
      : ''
  // Menu pause/resume is engine behavior (PauseGate), true for every game —
  // rendered once here instead of repeated in each game's manifest.
  const howTo = `<div class="vs-panel" id="vs-help"><h2>? how to play</h2><ol>${(howToPlay ?? [])
    .map((s) => `<li>${esc(s)}</li>`)
    .join('')}<li>Menu — pause / resume</li><li>View — change game</li></ol></div>`
  return `<aside id="vs-sidebar"><style>
#vs-sidebar{font-family:'Courier New',monospace;font-size:13px}
#vs-sidebar .vs-panel{position:fixed;top:8px;z-index:9999;border:1px solid #234;border-radius:6px;background:rgba(5,5,16,.92);color:#7cff7c;min-width:150px;max-width:220px;padding-bottom:6px}
#vs-games{left:8px}
#vs-help{right:8px}
#vs-sidebar h2{font-size:13px;font-weight:normal;letter-spacing:2px;color:#567;margin:0;padding:6px 10px}
#vs-sidebar ol{margin:0;padding:0 12px 2px 28px}
#vs-sidebar li{padding:2px 0}
#vs-target{padding:6px 10px;border-bottom:1px solid #234;letter-spacing:1px;color:#7cff7c}
#vs-sidebar .vs-group h2{padding:4px 10px 2px}
#vs-sidebar .vs-game{display:block;padding:3px 18px;color:#7cff7c;text-decoration:none;letter-spacing:1px;border:1px solid transparent;border-radius:4px}
#vs-sidebar .vs-game:hover{color:#fff}
#vs-sidebar .vs-active::after{content:' ◂'}
#vs-sidebar .vs-sel{border-color:#7cff7c;background:#02120a}
#vs-games.vs-picking{border-color:#7cff7c;box-shadow:0 0 0 2px #7cff7c,0 0 26px rgba(124,255,124,.45)}
#vs-auto{display:flex;align-items:center;gap:6px;padding:5px 10px;border-top:1px solid #234;color:#567;letter-spacing:1px;cursor:pointer}
#vs-auto input{accent-color:#7cff7c;margin:0}
</style><div class="vs-panel" id="vs-games"><div id="vs-target">⌨ → terminal</div><h2>☰ games</h2>${
    group(
      'Free',
      games.filter((g) => g.entitlement === 'free'),
    ) +
    group(
      'Paid',
      games.filter((g) => g.entitlement === 'paid'),
    )
  }<label id="vs-auto"><input type="checkbox"> autopilot</label></div>${howTo}<script>
(() => {
  const cards = [...document.querySelectorAll('#vs-games .vs-game')]
  const target = document.getElementById('vs-target')
  const panel = document.getElementById('vs-games')
  const auto = document.querySelector('#vs-auto input')
  auto.onchange = () => fetch('/autopilot', { method: 'POST', body: JSON.stringify({ enabled: auto.checked }) })
  const es = new EventSource('/events')
  es.onmessage = (e) => {
    let m; try { m = JSON.parse(e.data) } catch { return }
    if (m.type === 'state') {
      const picking = m.state === 'picking'
      panel.classList.toggle('vs-picking', picking)
      target.textContent = picking
        ? '🕹 pick — d-pad · A ok · B back'
        : m.state === 'playing' ? '🎮 → game' : '⌨ → terminal'
    } else if (m.type === 'autopilot') {
      auto.checked = m.enabled
    } else if (m.type === 'highlight') {
      cards.forEach((c) => c.classList.toggle('vs-sel', Number(c.dataset.i) === m.index))
    } else if (m.type === 'reload') {
      // Fallback for games that don't handle reload themselves — switching now
      // happens from inside a game page, not a dedicated picker page.
      location.href = m.url
    }
  }
})()
</script></aside>`
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
  /** session_id → opaque wrapper id for harnesses that provide exact ownership. */
  readonly sessionOwners = new Map<string, string>()
  /** Cwds of every client instance that ever registered. Append-only: a live
   * session must keep driving the FSM (and deliver its SessionEnd) even if its
   * instance's SSE connection drops. */
  private knownCwds = new Set<string>()

  private server: http.Server | null = null
  private gameStreams = new Set<http.ServerResponse>()
  private instances = new Map<
    string,
    { res: http.ServerResponse; cwd: string; wrapperId: string | null }
  >()
  private nextInstanceId = 1
  private lastGameState: 'playing' | 'paused' | 'picking' = 'paused'
  /** Off by default: the demo autopilot only runs when the user opts in. */
  private autopilot = false

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
    private readonly hostWrapperId?: string,
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

  /**
   * Push a game-state change to all connected game tabs. 'picking' is a paused
   * variant: games see anything != 'playing' as paused, while the sidebar shows
   * picker instructions instead of the generic pause hint.
   */
  broadcastGameState(state: 'playing' | 'paused' | 'picking'): void {
    if (state === this.lastGameState) return
    this.lastGameState = state
    for (const res of this.gameStreams) send(res, { type: 'state', state })
  }

  /** Enable/disable the games' idle autopilot everywhere. */
  setAutopilot(enabled: boolean): void {
    this.autopilot = enabled
    for (const res of this.gameStreams) send(res, { type: 'autopilot', enabled })
  }

  /** Forward a controller input event to the game. */
  broadcastGameInput(input: Record<string, unknown>): void {
    for (const res of this.gameStreams) send(res, { type: 'input', ...input })
  }

  /** Tell open game tabs to navigate somewhere (a newly chosen game). */
  broadcastReload(url: string): void {
    for (const res of this.gameStreams) send(res, { type: 'reload', url })
  }

  /** Move the picker highlight in the games panel; -1 clears it. */
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

  private isActiveOwner(wrapperId: string): boolean {
    if (wrapperId === this.hostWrapperId) return true
    for (const instance of this.instances.values()) {
      if (instance.wrapperId === wrapperId) return true
    }
    return false
  }

  /** Find the client instance whose cwd matches the given session's cwd. */
  instanceForSession(sessionId: string): string | null {
    const owner = this.sessionOwners.get(sessionId)
    if (owner) {
      for (const [id, instance] of this.instances) {
        if (instance.wrapperId === owner) return id
      }
      return null
    }
    const cwd = this.sessionCwds.get(sessionId)
    if (!cwd) return null
    for (const [id, instance] of this.instances) {
      if (instance.cwd === cwd) return id
    }
    return null
  }

  removeSessionsForOwner(wrapperId: string): boolean {
    let removed = false
    for (const [sessionId, owner] of this.sessionOwners) {
      if (owner !== wrapperId) continue
      removed = this.tracker.remove(sessionId) || removed
      this.sessionOwners.delete(sessionId)
      this.sessionCwds.delete(sessionId)
    }
    return removed
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
      let cwd: string | undefined
      try {
        const payload = JSON.parse(body) as { session_id?: string; cwd?: string }
        sessionId = payload.session_id ?? 'unknown'
        cwd = payload.cwd
      } catch {
        // Payload shape is claude's internal contract — event name alone still works.
      }

      const header = req.headers['x-vibesense-instance-id']
      const wrapperId = Array.isArray(header) ? header[0] : header
      let trusted = false
      if (wrapperId) {
        trusted = this.isActiveOwner(wrapperId)
        if (trusted) {
          this.sessionOwners.set(sessionId, wrapperId)
          if (cwd) this.sessionCwds.set(sessionId, cwd)
        }
      } else {
        // Claude's established hook command has no ownership header. Preserve
        // its cwd trust/routing behavior as the compatibility fallback.
        if (cwd) this.sessionCwds.set(sessionId, cwd)
        trusted = this.isTrustedSession(sessionId)
      }

      if (trusted && this.tracker.apply(sessionId, event, { focusOnStop: Boolean(wrapperId) })) {
        this.emit('aggregate', this.tracker.aggregate())
      }
      res.writeHead(200)
      res.end()
      return
    }

    if (req.method === 'POST' && pathname === '/autopilot') {
      const body = await readBody(req)
      let enabled = !this.autopilot // no/!bad body → plain toggle
      try {
        enabled = Boolean((JSON.parse(body) as { enabled?: boolean }).enabled)
      } catch {
        // toggle
      }
      this.setAutopilot(enabled)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ enabled }))
      return
    }

    if (req.method === 'POST' && pathname === '/register') {
      const body = await readBody(req)
      let cwd = ''
      let wrapperId: string | null = null
      try {
        const registration = JSON.parse(body) as { cwd?: string; wrapperId?: string }
        cwd = registration.cwd ?? ''
        wrapperId = registration.wrapperId ?? null
      } catch {
        // cwd stays unmatched; keystrokes just won't route to this instance
      }
      if (cwd) this.knownCwds.add(cwd)
      const id = String(this.nextInstanceId++)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ instanceId: id, cwd, wrapperId }))
      logger.info('client instance registered', { id, cwd, wrapperId })
      // The SSE connection on /instance/<id> completes registration.
      this.pendingInstances.set(id, { cwd, wrapperId })
      return
    }

    if (pathname.startsWith('/instance/')) {
      const id = pathname.slice('/instance/'.length)
      sse(res)
      const pending = this.pendingInstances.get(id) ?? { cwd: '', wrapperId: null }
      this.instances.set(id, { res, ...pending })
      this.pendingInstances.delete(id)
      req.on('close', () => {
        const instance = this.instances.get(id)
        if (!instance) return
        this.instances.delete(id)
        if (instance.wrapperId && this.removeSessionsForOwner(instance.wrapperId)) {
          this.emit('aggregate', this.tracker.aggregate())
        }
      })
      return
    }

    if (pathname === '/events') {
      sse(res)
      this.gameStreams.add(res)
      send(res, { type: 'state', state: this.lastGameState })
      send(res, { type: 'autopilot', enabled: this.autopilot })
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
      // The popup picker page is gone — games are switched from the persistent
      // panel on every game page. Old bookmarks land in the active game.
      res.writeHead(302, { Location: '/' })
      res.end()
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

  private pendingInstances = new Map<string, { cwd: string; wrapperId: string | null }>()

  private serveStatic(gameId: string, relPath: string, res: http.ServerResponse): void {
    const dir = this.games.resolveDir(gameId)
    if (dir) {
      const full = path.normalize(path.join(dir, relPath))
      if (
        full.startsWith(path.normalize(dir) + path.sep) &&
        fs.existsSync(full) &&
        fs.statSync(full).isFile()
      ) {
        const type = CONTENT_TYPES[path.extname(full)] ?? 'application/octet-stream'
        res.writeHead(200, { 'Content-Type': type })
        if (type === 'text/html') {
          // Game pages are standalone files (incl. third-party marketplace
          // games), so the sidebar is spliced in at serve time, not on disk.
          const html = fs.readFileSync(full, 'utf8')
          const games = this.games.list()
          // Steps come from the page actually served, not active() — a stale
          // tab showing a non-active game still gets its own instructions.
          const sidebar = renderSidebar(
            games,
            this.games.active()?.id,
            games.find((g) => g.id === gameId)?.howToPlay,
          )
          // Don't clobber a game that declares its own icon.
          const extra = (/rel=["']?(shortcut )?icon/i.test(html) ? '' : FAVICON) + sidebar
          res.end(
            html.includes('</body>') ? html.replace('</body>', `${extra}</body>`) : html + extra,
          )
        } else {
          res.end(fs.readFileSync(full))
        }
        return
      }
    }
    res.writeHead(404)
    res.end()
  }
}
