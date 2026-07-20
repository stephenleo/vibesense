// Pac-Man — bundled VibeSense game. Runs while the Claude agent executes;
// freezes when it needs you. Input over SSE from the vibesense host: left
// stick steers with buffered turns (the queued direction applies at the next
// legal junction), R2/L2 restarts after game over. Four ghosts with distinct
// classic-style targeting, scatter↔chase cycles, and frightened mode with
// 200/400/800/1600 chain scoring. When the controller sits untouched, a
// BFS autopilot chases pellets while giving un-frightened ghosts a wide
// berth, so the demo survives long agent runs.
// Keyboard fallback (arrows) for development. `?play` forces the playing
// state so the game is testable without a host.
//
// ponytail: no ghost-house door — ghosts spawn on a home tile with staggered
// release timers and eaten eyes fly back to it. Door choreography is pure
// fidelity; this keeps the maze graph trivially connected.

;(() => {
  'use strict'

  // ── Pure logic (unit-testable, no I/O) ────────────────────────────────
  // 19×21 maze. '#' wall, '.' pellet, 'o' power pellet, ' ' bare path,
  // 'G' ghost home, 'P' pac spawn. Row 9 is the wrap tunnel.
  const MAZE = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.###.#.###.####',
    '####.#...G...#.####',
    '####.###.#.###.####',
    ' ................. ',
    '#.##.###.#.###.##.#',
    '#....#...#...#....#',
    '####.#.#####.#.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ]
  const COLS = 19
  const ROWS = 21
  const TUNNEL_ROW = 9

  const isWall = (grid, x, y) => {
    if (y < 0 || y >= ROWS) return true
    if (x < 0 || x >= COLS) return y !== TUNNEL_ROW // only the tunnel wraps
    return grid[y][x] === '#'
  }
  const walkable = (grid, x, y) => !isWall(grid, wrapX(x), y)
  const wrapX = (x) => ((x % COLS) + COLS) % COLS

  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' }

  // BFS over the maze from (sx, sy); returns dist grid and first-step dirs.
  // `blocked` (optional Set of "x,y") masks extra tiles, e.g. near ghosts.
  function bfs(grid, sx, sy, blocked) {
    const dist = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1))
    const step = Array.from({ length: ROWS }, () => new Array(COLS).fill(null))
    const q = [[sx, sy]]
    dist[sy][sx] = 0
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h]
      for (const name of ['up', 'down', 'left', 'right']) {
        const d = DIRS[name]
        const nx = wrapX(x + d.x)
        const ny = y + d.y
        if (!walkable(grid, nx, ny) || dist[ny][nx] !== -1) continue
        if (blocked && blocked.has(`${nx},${ny}`) && !(nx === sx && ny === sy)) continue
        dist[ny][nx] = dist[y][x] + 1
        step[ny][nx] = dist[y][x] === 0 ? name : step[y][x]
        q.push([nx, ny])
      }
    }
    return { dist, step }
  }

  // Frightened-ghost chain: 200, 400, 800, 1600.
  const chainScore = (eaten) => 200 * Math.pow(2, eaten)

  // Ghost targeting, classic-flavored. All take/return tile coords.
  function ghostTarget(name, g, pac, pacDir, blinky, scatter) {
    if (scatter) return g.corner
    const pd = DIRS[pacDir]
    switch (name) {
      case 'blinky':
        return { x: pac.x, y: pac.y }
      case 'pinky':
        return { x: pac.x + pd.x * 4, y: pac.y + pd.y * 4 }
      case 'inky': {
        const ax = pac.x + pd.x * 2
        const ay = pac.y + pd.y * 2
        return { x: ax * 2 - blinky.x, y: ay * 2 - blinky.y }
      }
      case 'clyde': {
        const d = Math.hypot(g.x - pac.x, g.y - pac.y)
        return d > 8 ? { x: pac.x, y: pac.y } : g.corner
      }
    }
  }

  if (location.search.includes('selftest')) return selftest()

  // ── Setup ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('status')

  const W = 800
  const H = 600
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  const CELL = 26
  const OX = (W - COLS * CELL) / 2
  const OY = (H - ROWS * CELL) / 2
  const ACCENT = '#ffe14d'
  const AUTOPILOT_IDLE_MS = 2500

  const HOME = { x: 9, y: 7 } // 'G' tile
  const PAC_SPAWN = { x: 9, y: 15 } // 'P' tile
  const GHOSTS = [
    { name: 'blinky', color: '#ff4d6d', corner: { x: COLS - 2, y: 1 }, release: 0 },
    { name: 'pinky', color: '#ff9ecf', corner: { x: 1, y: 1 }, release: 1.5 },
    { name: 'inky', color: '#7dd3fc', corner: { x: COLS - 2, y: ROWS - 2 }, release: 3.5 },
    { name: 'clyde', color: '#ffb347', corner: { x: 1, y: ROWS - 2 }, release: 5.5 },
  ]

  let playing = false
  let pellets = new Set() // "x,y"
  let powers = new Set()
  let pac = null // {x, y (px), dir, want, tileX, tileY, mouth, moved}
  let ghosts = [] // {name, color, corner, x, y, dir, state, releaseIn, ...}
  let score = 0
  let lives = 3
  let level = 1
  let gameOver = false
  let gameOverAt = 0
  let frightened = 0 // seconds remaining
  let chainEaten = 0
  let modeTimer = 0
  let scatter = true
  let ready = 0 // freeze countdown after (re)spawn
  let dying = 0 // pac death animation countdown
  let clearFlash = 0 // level-clear maze pulse
  let banner = { text: '', t: 0 }
  let floats = [] // {x, y, text, life, max}
  let lastHumanInput = 0
  let autopilotEnabled = false // opt-in: toggled from the sidebar via {type:"autopilot"}

  const px = (tx) => OX + tx * CELL + CELL / 2
  const py = (ty) => OY + ty * CELL + CELL / 2
  const pacSpeed = () => (104 + level * 5) * (frightened > 0 ? 1.06 : 1)
  const ghostSpeed = (g) =>
    g.state === 'eyes' ? 210 : g.state === 'fright' ? 68 : 96 + level * 5

  function seedPellets() {
    pellets = new Set()
    powers = new Set()
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAZE[y][x] === '.') pellets.add(`${x},${y}`)
        else if (MAZE[y][x] === 'o') powers.add(`${x},${y}`)
      }
    }
  }

  function spawnActors() {
    pac = { x: px(PAC_SPAWN.x), y: py(PAC_SPAWN.y), dir: 'left', want: 'left', mouth: 0, moved: 0 }
    ghosts = GHOSTS.map((g) => ({
      ...g,
      x: px(HOME.x),
      y: py(HOME.y),
      dir: 'left',
      state: 'normal',
      releaseIn: g.release,
    }))
    frightened = 0
    chainEaten = 0
    modeTimer = 0
    scatter = true
    ready = 1.6
  }

  function reset() {
    score = 0
    lives = 3
    level = 1
    gameOver = false
    dying = 0
    floats = []
    seedPellets()
    spawnActors()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
  function steer(name) {
    pac.want = name
    lastHumanInput = performance.now()
  }

  const events = new EventSource('/events')
  events.onmessage = (e) => {
    let msg
    try {
      msg = JSON.parse(e.data)
    } catch {
      return
    }
    if (msg.type === 'state') {
      setPlaying(msg.state === 'playing')
    } else if (msg.type === 'autopilot') {
      autopilotEnabled = msg.enabled
    } else if (msg.type === 'input') {
      if (msg.kind === 'axis') {
        if (msg.axis === 'left_x' && Math.abs(msg.value) > 0.45) {
          steer(msg.value > 0 ? 'right' : 'left')
        } else if (msg.axis === 'left_y' && Math.abs(msg.value) > 0.45) {
          steer(msg.value > 0 ? 'down' : 'up')
        }
      } else if (msg.kind === 'button' && msg.pressed && (msg.button === 'r2' || msg.button === 'l2')) {
        lastHumanInput = performance.now()
        if (gameOver) reset()
      }
    } else if (msg.type === 'reload') {
      location.href = msg.url // controller swapped games — load the new one
    }
  }
  events.onerror = () => setStatus('host disconnected — is vibesense running?', false)

  // Keyboard fallback for development.
  addEventListener('keydown', (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }
    if (map[e.key]) steer(map[e.key])
    if (e.key === ' ' && gameOver) reset()
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? 'agent executing — waka waka!' : 'claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // Dev affordance: `?play` runs the game without a host.
  if (location.search.includes('play')) setPlaying(true)

  // ── Movement helpers (pixel actors on the tile grid) ──────────────────
  const tileOf = (a) => ({ x: wrapX(Math.round((a.x - OX - CELL / 2) / CELL)), y: Math.round((a.y - OY - CELL / 2) / CELL) })
  const atCenter = (a, t) => Math.abs(a.x - px(t.x)) < 2.2 && Math.abs(a.y - py(t.y)) < 2.2

  function advance(a, speed, dt) {
    const d = DIRS[a.dir]
    a.x += d.x * speed * dt
    a.y += d.y * speed * dt
    // Tunnel wrap: slide off one edge, appear on the other.
    if (a.x < OX - CELL / 2) a.x += COLS * CELL
    if (a.x > OX + COLS * CELL + CELL / 2 - CELL) a.x -= COLS * CELL
  }

  // Snap to the rail: moving horizontally locks y to the row center, etc.
  function railSnap(a, t) {
    if (DIRS[a.dir].x !== 0) a.y = py(t.y)
    else a.x = px(t.x)
  }

  // ── Autopilot ─────────────────────────────────────────────────────────
  function autopilotSteer(t) {
    // Tiles near live ghosts are lava; frightened ghosts are lunch.
    const blocked = new Set()
    let prey = null
    for (const g of ghosts) {
      const gt = tileOf(g)
      if (g.state === 'fright') {
        if (!prey) prey = gt
        continue
      }
      if (g.state === 'eyes' || g.releaseIn > 0) continue
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= 2) blocked.add(`${wrapX(gt.x + dx)},${gt.y + dy}`)
        }
      }
    }
    const { dist, step } = bfs(MAZE, t.x, t.y, blocked)
    let target = null
    let best = Infinity
    const goals = prey ? [`${prey.x},${prey.y}`] : [...powers, ...pellets]
    for (const key of goals) {
      const [x, y] = key.split(',').map(Number)
      if (dist[y]?.[x] >= 0 && dist[y][x] < best) {
        best = dist[y][x]
        target = { x, y }
      }
    }
    if (target && step[target.y][target.x]) {
      pac.want = step[target.y][target.x]
      return
    }
    // No safe route — fall back to the unmasked graph and outrun them.
    const open = bfs(MAZE, t.x, t.y)
    for (const key of pellets) {
      const [x, y] = key.split(',').map(Number)
      if (open.dist[y]?.[x] >= 0 && open.dist[y][x] < best) {
        best = open.dist[y][x]
        target = { x, y }
      }
    }
    if (target && open.step[target.y][target.x]) pac.want = open.step[target.y][target.x]
  }

  // ── Simulation ────────────────────────────────────────────────────────
  function eatAt(t) {
    const key = `${t.x},${t.y}`
    if (pellets.delete(key)) score += 10
    if (powers.delete(key)) {
      score += 50
      frightened = Math.max(2.5, 7 - level * 0.5)
      chainEaten = 0
      for (const g of ghosts) {
        if (g.state === 'normal' && g.releaseIn <= 0) {
          g.state = 'fright'
          g.dir = OPP[g.dir] // the classic about-face
        }
      }
    }
    if (!pellets.size && !powers.size) {
      level++
      clearFlash = 1.6
      banner = { text: `LEVEL ${level}`, t: 1.6 }
      seedPellets()
      spawnActors()
    }
  }

  function killPac() {
    dying = 1.5
    lives--
  }

  function afterDeath() {
    if (lives <= 0) {
      gameOver = true
      gameOverAt = performance.now()
    } else {
      spawnActors()
    }
  }

  function movePac(dt, now) {
    const t = tileOf(pac)
    if (autopilotEnabled && now - lastHumanInput > AUTOPILOT_IDLE_MS && atCenter(pac, t)) autopilotSteer(t)

    if (atCenter(pac, t)) {
      const w = DIRS[pac.want]
      if (walkable(MAZE, t.x + w.x, t.y + w.y)) pac.dir = pac.want
      const d = DIRS[pac.dir]
      if (!walkable(MAZE, t.x + d.x, t.y + d.y)) {
        pac.x = px(t.x)
        pac.y = py(t.y)
        return // parked against a wall
      }
    } else {
      // Allow instant 180s mid-corridor.
      if (pac.want === OPP[pac.dir]) pac.dir = pac.want
    }
    railSnap(pac, t)
    advance(pac, pacSpeed(), dt)
    pac.moved += pacSpeed() * dt
    eatAt(tileOf(pac))
  }

  function moveGhost(g, dt, now) {
    if (g.releaseIn > 0) {
      g.releaseIn -= dt
      return
    }
    const t = tileOf(g)
    if (atCenter(g, t)) {
      if (g.state === 'eyes' && t.x === HOME.x && t.y === HOME.y) {
        g.state = 'normal'
        g.dir = 'left'
      }
      // Choose at junctions: legal moves, no reversing.
      const options = []
      for (const name of ['up', 'left', 'down', 'right']) {
        if (name === OPP[g.dir]) continue
        const d = DIRS[name]
        if (walkable(MAZE, t.x + d.x, t.y + d.y)) options.push(name)
      }
      if (!options.length) {
        g.dir = OPP[g.dir] // dead end
      } else if (g.state === 'fright') {
        g.dir = options[Math.floor(Math.random() * options.length)]
      } else {
        const pt = tileOf(pac)
        const bt = tileOf(ghosts[0])
        const target =
          g.state === 'eyes' ? HOME : ghostTarget(g.name, { ...t, corner: g.corner }, pt, pac.dir, bt, scatter)
        let bestD = Infinity
        for (const name of options) {
          const d = DIRS[name]
          const dist = Math.hypot(wrapX(t.x + d.x) - target.x, t.y + d.y - target.y)
          if (dist < bestD) {
            bestD = dist
            g.dir = name
          }
        }
      }
    }
    railSnap(g, t)
    advance(g, ghostSpeed(g), dt)
  }

  function collide(now) {
    const pt = tileOf(pac)
    for (const g of ghosts) {
      if (g.releaseIn > 0 || g.state === 'eyes') continue
      const gt = tileOf(g)
      if (gt.x !== pt.x || gt.y !== pt.y) continue
      if (g.state === 'fright') {
        const pts = chainScore(chainEaten++)
        score += pts
        floats.push({ x: g.x, y: g.y, text: String(pts), life: 0.9, max: 0.9 })
        g.state = 'eyes'
      } else {
        killPac()
        return
      }
    }
  }

  function tick(dt, now) {
    banner.t = Math.max(0, banner.t - dt)
    clearFlash = Math.max(0, clearFlash - dt)
    for (const f of floats) {
      f.y -= 24 * dt
      f.life -= dt
    }
    floats = floats.filter((f) => f.life > 0)

    if (gameOver) return
    if (dying > 0) {
      dying -= dt
      if (dying <= 0) afterDeath()
      return
    }
    if (ready > 0) {
      ready -= dt
      return
    }

    if (frightened > 0) {
      frightened = Math.max(0, frightened - dt)
      if (frightened === 0) {
        for (const g of ghosts) if (g.state === 'fright') g.state = 'normal'
      }
    } else {
      // Scatter ↔ chase cycle.
      modeTimer += dt
      if (scatter && modeTimer > 6) {
        scatter = false
        modeTimer = 0
      } else if (!scatter && modeTimer > 18) {
        scatter = true
        modeTimer = 0
        for (const g of ghosts) if (g.state === 'normal' && g.releaseIn <= 0) g.dir = OPP[g.dir]
      }
    }

    movePac(dt, now)
    for (const g of ghosts) moveGhost(g, dt, now)
    collide(now)
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

  function drawMaze(now) {
    const pulse = clearFlash > 0 && Math.floor(now / 130) % 2 === 0
    ctx.save()
    ctx.shadowColor = pulse ? '#ffffff' : '#2e4bff'
    ctx.shadowBlur = 6
    ctx.strokeStyle = pulse ? '#eaf2ff' : '#3450d4'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    // Pipe-maze look: connect each wall tile to its wall neighbors.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (MAZE[y][x] !== '#') continue
        const cx = px(x)
        const cy = py(y)
        let linked = false
        for (const d of [DIRS.right, DIRS.down]) {
          const nx = x + d.x
          const ny = y + d.y
          if (nx < COLS && ny < ROWS && MAZE[ny][nx] === '#') {
            ctx.beginPath()
            ctx.moveTo(cx, cy)
            ctx.lineTo(px(nx), py(ny))
            ctx.stroke()
            linked = true
          }
        }
        if (!linked && !(x > 0 && MAZE[y][x - 1] === '#') && !(y > 0 && MAZE[y - 1][x] === '#')) {
          ctx.beginPath()
          ctx.arc(cx, cy, 1.6, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }

  function drawPellets(now) {
    ctx.fillStyle = '#ffd9a8'
    for (const key of pellets) {
      const [x, y] = key.split(',').map(Number)
      ctx.beginPath()
      ctx.arc(px(x), py(y), 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    const pulse = 0.6 + 0.4 * Math.sin(now / 180)
    ctx.save()
    ctx.shadowColor = '#ffd9a8'
    ctx.shadowBlur = 12 * pulse
    for (const key of powers) {
      const [x, y] = key.split(',').map(Number)
      ctx.beginPath()
      ctx.arc(px(x), py(y), 5.5 + pulse * 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  const DIR_ANGLE = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }

  function drawPac(now) {
    if (gameOver) return
    const r = CELL / 2 - 2
    // Death animation: the mouth swallows the whole body.
    const deathT = dying > 0 ? 1 - dying / 1.5 : 0
    const chomp = dying > 0 ? deathT * Math.PI : 0.28 + 0.55 * Math.abs(Math.sin(pac.moved / 22))
    const a = DIR_ANGLE[pac.dir]
    ctx.save()
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 16
    const g = ctx.createRadialGradient(pac.x - 3, pac.y - 4, 2, pac.x, pac.y, r)
    g.addColorStop(0, '#fff6b0')
    g.addColorStop(1, '#f5c518')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(pac.x, pac.y)
    ctx.arc(pac.x, pac.y, r * (dying > 0 ? 1 - deathT * 0.35 : 1), a + chomp, a - chomp + Math.PI * 2)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    if (dying <= 0) {
      const ea = a - Math.PI / 2.6
      ctx.fillStyle = '#221a02'
      ctx.beginPath()
      ctx.arc(pac.x + Math.cos(ea) * r * 0.45, pac.y + Math.sin(ea) * r * 0.45, 2.1, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawGhost(g, now) {
    if (g.releaseIn > 0 && Math.floor(now / 160) % 2 === 0) return // waiting in the wings
    const r = CELL / 2 - 3
    const flashing = g.state === 'fright' && frightened < 2 && Math.floor(now / 140) % 2 === 0
    const body = g.state === 'fright' ? (flashing ? '#eaf2ff' : '#3450d4') : g.color
    if (g.state !== 'eyes') {
      ctx.save()
      ctx.shadowColor = body
      ctx.shadowBlur = 12
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.arc(g.x, g.y - 1, r, Math.PI, 0)
      // Wavy skirt, animated.
      const hem = g.y - 1 + r
      const waves = 4
      ctx.lineTo(g.x + r, hem)
      const ph = now / 90
      for (let i = waves; i > 0; i--) {
        const x0 = g.x - r + ((i - 0.5) / waves) * r * 2
        const x1 = g.x - r + ((i - 1) / waves) * r * 2
        ctx.quadraticCurveTo(x0, hem - 5 - 2 * Math.sin(ph + i), x1, hem)
      }
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    // Eyes (always drawn; they're all that's left in the 'eyes' state).
    const d = DIRS[g.dir]
    for (const s of [-1, 1]) {
      const ex = g.x + s * 5
      const ey = g.y - 3
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, 3.6, 4.4, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = g.state === 'fright' ? '#3450d4' : '#1c2a6e'
      ctx.beginPath()
      ctx.arc(ex + d.x * 1.8, ey + d.y * 1.8, 1.9, 0, Math.PI * 2)
      ctx.fill()
    }
    if (g.state === 'fright' && !flashing) {
      // Jagged little mouth.
      ctx.strokeStyle = '#eaf2ff'
      ctx.lineWidth = 1.4
      ctx.beginPath()
      for (let i = 0; i <= 6; i++) {
        const x = g.x - 7 + i * 2.33
        const y = g.y + 6 + (i % 2 === 0 ? 0 : -2.5)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  function drawHud() {
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `600 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('SCORE', 16, 18)
    ctx.textAlign = 'center'
    ctx.fillText(`LEVEL ${level}`, W / 2, 18)
    ctx.textAlign = 'right'
    ctx.fillText('LIVES', W - 16, 18)
    ctx.fillStyle = '#eaf2ff'
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(String(score).padStart(6, '0'), 16, 33)
    for (let i = 0; i < lives; i++) {
      const x = W - 26 - i * 24
      ctx.fillStyle = '#f5c518'
      ctx.beginPath()
      ctx.moveTo(x, 30)
      ctx.arc(x, 30, 8, 0.5, -0.5 + Math.PI * 2)
      ctx.closePath()
      ctx.fill()
    }
  }

  function overlay(title, sub, color, showScore) {
    ctx.fillStyle = 'rgba(3, 5, 14, 0.78)'
    ctx.fillRect(0, 0, W, H)
    const cw = 460
    const ch = showScore ? 190 : 160
    const cx = (W - cw) / 2
    const cy = (H - ch) / 2
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = 30
    ctx.fillStyle = 'rgba(9, 13, 28, 0.95)'
    ctx.beginPath()
    ctx.roundRect(cx, cy, cw, ch, 14)
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.5
    ctx.stroke()
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillStyle = color
    ctx.font = `700 34px ${FONT}`
    ctx.fillText(title, W / 2, cy + 62)
    if (showScore) {
      ctx.fillStyle = '#eaf2ff'
      ctx.font = `700 18px ${FONT}`
      ctx.fillText(`SCORE ${score} · LEVEL ${level}`, W / 2, cy + 100)
    }
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(sub, W / 2, cy + ch - 38)
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H)
    drawMaze(now)
    drawPellets(now)
    for (const g of ghosts) drawGhost(g, now)
    drawPac(now)

    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.max)
      ctx.fillStyle = '#7dd3fc'
      ctx.font = `700 13px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
    drawHud()

    if (ready > 0 && !gameOver && dying <= 0) {
      ctx.fillStyle = ACCENT
      ctx.font = `700 22px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('READY!', W / 2, py(12) + 6)
    }
    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 0.4)
      ctx.fillStyle = '#fff6d6'
      ctx.font = `700 40px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(banner.text, W / 2, 60)
      ctx.globalAlpha = 1
    }

    if (gameOver) {
      overlay('GAME OVER', 'R2 / SPACE to play again — restarting…', '#ff4d6d', true)
    } else if (!playing) {
      overlay('PAUSED', 'claude needs you — answer in the terminal', ACCENT, false)
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (gameOver && now - gameOverAt > 4000) reset()
    if (playing) tick(dt, now)
    render(now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // ── Self-test: `?selftest` runs the pure logic and asserts. ────────────
  function selftest() {
    const ok = (cond, msg) => {
      if (!cond) throw new Error('selftest failed: ' + msg)
    }

    ok(MAZE.length === ROWS, 'maze has 21 rows')
    ok(
      MAZE.every((row) => row.length === COLS),
      'every row is 19 wide',
    )
    let pac0 = null
    let home = null
    let powerCount = 0
    let pelletCount = 0
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y][x]
        if (ch === 'P') pac0 = { x, y }
        if (ch === 'G') home = { x, y }
        if (ch === 'o') powerCount++
        if (ch === '.') pelletCount++
      }
    }
    ok(pac0 && home, 'pac spawn and ghost home exist')
    ok(powerCount === 4, 'exactly four power pellets')
    ok(pelletCount > 100, 'a proper pellet field')
    ok(walkable(MAZE, 0, TUNNEL_ROW) && walkable(MAZE, COLS - 1, TUNNEL_ROW), 'tunnel mouths open')
    ok(walkable(MAZE, -1, TUNNEL_ROW) && !walkable(MAZE, -1, 5), 'only the tunnel row wraps')

    // Every pellet, power pellet, and the ghost home is reachable from P.
    const { dist } = bfs(MAZE, pac0.x, pac0.y)
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if ('.oG'.includes(MAZE[y][x])) ok(dist[y][x] >= 0, `(${x},${y}) reachable`)
      }
    }
    // BFS takes the tunnel when it's shorter: from (1,9), (17,9) is 3 through the wrap.
    const t = bfs(MAZE, 1, TUNNEL_ROW)
    ok(t.dist[TUNNEL_ROW][COLS - 2] === 3, 'tunnel wrap is the short way across')

    ok(chainScore(0) === 200 && chainScore(3) === 1600, 'frightened chain doubles to 1600')

    const pacT = { x: 9, y: 15 }
    const g = { x: 1, y: 1, corner: { x: 17, y: 1 } }
    ok(ghostTarget('blinky', g, pacT, 'left', g, false).x === 9, 'blinky chases pac')
    ok(ghostTarget('pinky', g, pacT, 'left', g, false).x === 5, 'pinky ambushes 4 ahead')
    ok(ghostTarget('clyde', g, pacT, 'left', g, false).x === 9, 'distant clyde chases')
    ok(ghostTarget('clyde', { ...g, x: 9, y: 14 }, pacT, 'left', g, false).x === 17, 'close clyde shies away')
    ok(ghostTarget('blinky', g, pacT, 'left', g, true).x === 17, 'scatter sends ghosts home')

    console.log('[pacman] selftest passed')
    document.getElementById('status').textContent = 'selftest passed ✓'
  }
})()
