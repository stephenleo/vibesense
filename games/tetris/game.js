// Tetris — bundled VibeSense game. Runs while the Claude agent executes;
// freezes when it needs you. Input over SSE from the vibesense host: left
// stick X shifts the piece (with DAS-style repeat), stick Y (down) soft
// drops, R2 rotates clockwise (with simple wall kicks), L2 hard drops. When
// the controller sits untouched, a heuristic placement AI (aggregate height /
// holes / bumpiness / lines, classic weights) plays on so the demo survives
// long agent runs. Keyboard fallback (arrows + space + shift) for
// development. `?play` forces the playing state so the game is testable
// without a host.

;(() => {
  'use strict'

  // ── Pure logic (unit-testable, no I/O) ────────────────────────────────
  const COLS = 10
  const ROWS = 20

  // Shapes in row-major bounding boxes (I in 4×4, O in 2×2, rest in 3×3).
  const SHAPES = {
    I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]], color: '#7dd3fc' },
    O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffe14d' },
    T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]], color: '#c084fc' },
    S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#4dff88' },
    Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ff4d6d' },
    J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: '#6d9eff' },
    L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]], color: '#ffb347' },
  }
  const NAMES = Object.keys(SHAPES)

  // Rotate a cell 90° clockwise `rot` times within the piece's n×n box.
  function cellsFor(name, rot) {
    const { n, cells } = SHAPES[name]
    return cells.map(([x, y]) => {
      for (let r = 0; r < ((rot % 4) + 4) % 4; r++) {
        const t = x
        x = n - 1 - y
        y = t
      }
      return [x, y]
    })
  }

  const emptyBoard = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0))

  function collides(board, name, rot, px, py) {
    for (const [cx, cy] of cellsFor(name, rot)) {
      const x = px + cx
      const y = py + cy
      if (x < 0 || x >= COLS || y >= ROWS) return true
      if (y >= 0 && board[y][x]) return true
    }
    return false
  }

  function lock(board, name, rot, px, py, value) {
    for (const [cx, cy] of cellsFor(name, rot)) {
      const y = py + cy
      if (y >= 0) board[y][px + cx] = value
    }
  }

  // Remove full rows in place; returns the cleared row indices (pre-shift).
  function clearLines(board) {
    const cleared = []
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((v) => v)) cleared.push(y)
    }
    for (const y of cleared.slice().reverse()) {
      board.splice(y, 1)
    }
    while (board.length < ROWS) board.unshift(new Array(COLS).fill(0))
    return cleared
  }

  function dropY(board, name, rot, px, py) {
    let y = py
    while (!collides(board, name, rot, px, y + 1)) y++
    return y
  }

  // Classic placement heuristic (Dellacherie-style weights).
  function evaluateBoard(board, linesCleared) {
    const heights = new Array(COLS).fill(0)
    let holes = 0
    for (let x = 0; x < COLS; x++) {
      let seen = false
      for (let y = 0; y < ROWS; y++) {
        if (board[y][x]) {
          if (!seen) {
            heights[x] = ROWS - y
            seen = true
          }
        } else if (seen) holes++
      }
    }
    let agg = 0
    let bump = 0
    for (let x = 0; x < COLS; x++) {
      agg += heights[x]
      if (x) bump += Math.abs(heights[x] - heights[x - 1])
    }
    return -0.51 * agg + 0.76 * linesCleared - 0.36 * holes - 0.18 * bump
  }

  // Best (rot, x) for the piece on this board, by simulated lock + evaluate.
  function bestMove(board, name) {
    let best = null
    for (let rot = 0; rot < 4; rot++) {
      for (let x = -2; x < COLS; x++) {
        if (collides(board, name, rot, x, 0)) continue
        const y = dropY(board, name, rot, x, 0)
        const sim = board.map((row) => row.slice())
        lock(sim, name, rot, x, y, 1)
        const score = evaluateBoard(sim, clearLines(sim).length)
        if (!best || score > best.score) best = { rot, x, score }
      }
    }
    return best
  }

  function shuffledBag() {
    const bag = NAMES.slice()
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    return bag
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

  const CELL = 27
  const BX = (W - COLS * CELL) / 2 // board top-left
  const BY = (H - ROWS * CELL) / 2
  const ACCENT = '#c084fc'
  const LINE_SCORES = [0, 100, 300, 500, 800]
  const AUTOPILOT_IDLE_MS = 2500

  let playing = false
  let board = emptyBoard()
  let bag = []
  let cur = null // {name, rot, x, y}
  let nextName = null
  let score = 0
  let lines = 0
  let level = 1
  let gameOver = false
  let gameOverAt = 0
  let gravAcc = 0
  let lockDelay = 0 // grace period once the piece is grounded
  let clearing = null // {rows: [y...], t} — flash animation, sim pauses
  let banner = { text: '', t: 0 }
  let particles = []
  let lastHumanInput = 0
  let autopilotEnabled = false // opt-in: toggled from the sidebar via {type:"autopilot"}
  let softDrop = false
  let moveDir = 0 // -1/0/1 from stick or keys
  let moveHeld = 0 // seconds current direction has been held
  let moveRepeat = 0
  let plan = null // autopilot: {rot, x} target for the current piece
  let planTimer = 0

  const gravityInterval = () => Math.max(0.07, 0.8 * Math.pow(0.85, level - 1))

  function draw7(name) {
    if (!bag.length) bag = shuffledBag()
    return bag.pop()
  }

  function spawn() {
    const name = nextName ?? draw7()
    nextName = draw7()
    const n = SHAPES[name].n
    cur = { name, rot: 0, x: Math.floor((COLS - n) / 2), y: name === 'I' ? -1 : 0 }
    gravAcc = 0
    lockDelay = 0
    plan = null
    if (collides(board, cur.name, cur.rot, cur.x, cur.y)) {
      gameOver = true
      gameOverAt = performance.now()
      cur = null
    }
  }

  function reset() {
    board = emptyBoard()
    bag = []
    nextName = null
    score = 0
    lines = 0
    level = 1
    gameOver = false
    clearing = null
    particles = []
    spawn()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
  function tryMove(dx) {
    if (!cur || clearing) return
    if (!collides(board, cur.name, cur.rot, cur.x + dx, cur.y)) cur.x += dx
  }

  function tryRotate() {
    if (!cur || clearing) return
    const rot = (cur.rot + 1) % 4
    for (const kick of [0, -1, 1, -2, 2]) {
      if (!collides(board, cur.name, rot, cur.x + kick, cur.y)) {
        cur.rot = rot
        cur.x += kick
        return
      }
    }
  }

  function hardDrop() {
    if (!cur || clearing) return
    const y = dropY(board, cur.name, cur.rot, cur.x, cur.y)
    score += (y - cur.y) * 2
    // Streak effect down the drop path.
    for (const [cx] of cellsFor(cur.name, cur.rot)) {
      particles.push({
        x: BX + (cur.x + cx + 0.5) * CELL,
        y: BY + (cur.y + 1) * CELL,
        vx: 0,
        vy: 480,
        life: 0.22,
        max: 0.22,
        color: 'rgba(230, 240, 255, 0.6)',
      })
    }
    cur.y = y
    settle()
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
        if (msg.axis === 'left_x') {
          const dir = msg.value > 0.45 ? 1 : msg.value < -0.45 ? -1 : 0
          if (dir !== moveDir) {
            moveDir = dir
            moveHeld = 0
            if (dir) {
              tryMove(dir)
              lastHumanInput = performance.now()
            }
          }
        } else if (msg.axis === 'left_y') {
          softDrop = msg.value > 0.5
          if (softDrop) lastHumanInput = performance.now()
        }
      } else if (msg.kind === 'button' && msg.pressed) {
        lastHumanInput = performance.now()
        if (gameOver) return reset()
        if (msg.button === 'r2') tryRotate()
        else if (msg.button === 'l2') hardDrop()
      }
    } else if (msg.type === 'reload') {
      location.href = msg.url // controller swapped games — load the new one
    }
  }
  events.onerror = () => setStatus('host disconnected — is vibesense running?', false)

  // Keyboard fallback for development.
  addEventListener('keydown', (e) => {
    if (e.repeat) return
    if (gameOver && (e.key === ' ' || e.key === 'Shift')) {
      e.preventDefault()
      lastHumanInput = performance.now()
      return reset()
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      moveDir = e.key === 'ArrowLeft' ? -1 : 1
      moveHeld = 0
      tryMove(moveDir)
    } else if (e.key === 'ArrowDown') softDrop = true
    else if (e.key === ' ') tryRotate()
    else if (e.key === 'Shift') hardDrop()
    else return
    e.preventDefault() // arrows/space would scroll the page
    lastHumanInput = performance.now()
  })
  addEventListener('keyup', (e) => {
    if ((e.key === 'ArrowLeft' && moveDir === -1) || (e.key === 'ArrowRight' && moveDir === 1)) moveDir = 0
    if (e.key === 'ArrowDown') softDrop = false
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? 'agent executing — stack clean!' : 'claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // Dev affordance: `?play` runs the game without a host.
  if (location.search.includes('play')) setPlaying(true)

  // ── Simulation ────────────────────────────────────────────────────────
  function settle() {
    lock(board, cur.name, cur.rot, cur.x, cur.y, NAMES.indexOf(cur.name) + 1)
    const full = []
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every((v) => v)) full.push(y)
    }
    cur = null
    if (full.length) {
      clearing = { rows: full, t: 0.32 }
      for (const y of full) {
        for (let x = 0; x < COLS; x++) {
          particles.push({
            x: BX + (x + 0.5) * CELL,
            y: BY + (y + 0.5) * CELL,
            vx: (Math.random() - 0.5) * 220,
            vy: -40 - Math.random() * 120,
            life: 0.5,
            max: 0.5,
            color: '#e9d5ff',
          })
        }
      }
    } else {
      spawn()
    }
  }

  function finishClear() {
    const n = clearLines(board).length
    clearing = null
    lines += n
    score += LINE_SCORES[n] * level
    const newLevel = 1 + Math.floor(lines / 10)
    if (newLevel !== level) {
      level = newLevel
      banner = { text: `LEVEL ${level}`, t: 1.3 }
    }
    spawn()
  }

  function autopilotStep(dt) {
    if (!cur) return
    if (!plan) {
      plan = bestMove(board, cur.name)
      planTimer = 0.12
    }
    if (!plan) return
    planTimer -= dt
    if (planTimer > 0) return
    planTimer = 0.09 // human-ish cadence, one action at a time
    if (cur.rot !== plan.rot) tryRotate()
    else if (cur.x > plan.x) tryMove(-1)
    else if (cur.x < plan.x) tryMove(1)
    else hardDrop()
  }

  function tick(dt, now) {
    banner.t = Math.max(0, banner.t - dt)
    for (const p of particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 300 * dt
      p.life -= dt
    }
    particles = particles.filter((p) => p.life > 0)

    if (gameOver) return
    if (clearing) {
      clearing.t -= dt
      if (clearing.t <= 0) finishClear()
      return
    }
    if (!cur) return

    const idle = autopilotEnabled && now - lastHumanInput > AUTOPILOT_IDLE_MS
    if (idle) {
      autopilotStep(dt)
      if (!cur || clearing) return // autopilot may have locked the piece
    } else if (moveDir) {
      // DAS-style repeat: initial delay, then fast taps.
      moveHeld += dt
      if (moveHeld > 0.17) {
        moveRepeat -= dt
        if (moveRepeat <= 0) {
          moveRepeat = 0.055
          tryMove(moveDir)
        }
      }
    }

    gravAcc += dt
    const interval = softDrop && !idle ? 0.045 : gravityInterval()
    while (gravAcc >= interval) {
      gravAcc -= interval
      if (!collides(board, cur.name, cur.rot, cur.x, cur.y + 1)) {
        cur.y++
        if (softDrop && !idle) score += 1
        lockDelay = 0
      } else {
        // Grounded: give a short grace period before locking.
        lockDelay += interval
        if (lockDelay >= 0.35) {
          settle()
          return
        }
      }
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
  const colorOf = (v) => SHAPES[NAMES[v - 1]].color

  function drawCell(px, py, color, ghost = false) {
    const x = BX + px * CELL
    const y = BY + py * CELL
    if (y < BY - CELL) return
    if (ghost) {
      ctx.strokeStyle = color
      ctx.globalAlpha = 0.35
      ctx.lineWidth = 1.5
      ctx.strokeRect(x + 2.5, y + 2.5, CELL - 5, CELL - 5)
      ctx.globalAlpha = 1
      return
    }
    const g = ctx.createLinearGradient(0, y, 0, y + CELL)
    g.addColorStop(0, color)
    g.addColorStop(1, shade(color))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(x + 1.5, y + 1.5, CELL - 3, CELL - 3, 4)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.beginPath()
    ctx.roundRect(x + 3.5, y + 3.5, CELL - 7, 4, 2)
    ctx.fill()
  }

  // Darken a hex color ~35% for the cell gradient's bottom edge.
  const shadeCache = {}
  function shade(hex) {
    if (!shadeCache[hex]) {
      const n = parseInt(hex.slice(1), 16)
      const f = (v) => Math.round(v * 0.62)
      shadeCache[hex] =
        `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`
    }
    return shadeCache[hex]
  }

  function drawWell(now) {
    // Frame + faint grid.
    ctx.save()
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 22
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.5)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(BX - 6, BY - 6, COLS * CELL + 12, ROWS * CELL + 12)
    ctx.restore()
    ctx.fillStyle = 'rgba(10, 14, 30, 0.55)'
    ctx.fillRect(BX, BY, COLS * CELL, ROWS * CELL)
    ctx.strokeStyle = 'rgba(140, 170, 255, 0.05)'
    ctx.lineWidth = 1
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath()
      ctx.moveTo(BX + x * CELL, BY)
      ctx.lineTo(BX + x * CELL, BY + ROWS * CELL)
      ctx.stroke()
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath()
      ctx.moveTo(BX, BY + y * CELL)
      ctx.lineTo(BX + COLS * CELL, BY + y * CELL)
      ctx.stroke()
    }

    for (let y = 0; y < ROWS; y++) {
      const flashing = clearing && clearing.rows.includes(y)
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue
        if (flashing) {
          const a = 0.5 + 0.5 * Math.sin(now / 30)
          ctx.fillStyle = `rgba(255, 255, 255, ${a})`
          ctx.fillRect(BX + x * CELL + 1, BY + y * CELL + 1, CELL - 2, CELL - 2)
        } else {
          drawCell(x, y, colorOf(board[y][x]))
        }
      }
    }
  }

  function drawPiece() {
    if (!cur) return
    const ghostY = dropY(board, cur.name, cur.rot, cur.x, cur.y)
    for (const [cx, cy] of cellsFor(cur.name, cur.rot)) {
      if (ghostY !== cur.y) drawCell(cur.x + cx, ghostY + cy, SHAPES[cur.name].color, true)
      drawCell(cur.x + cx, cur.y + cy, SHAPES[cur.name].color)
    }
  }

  function drawPanels() {
    // Right: next piece.
    const nx = BX + COLS * CELL + 34
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `600 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('NEXT', nx, BY + 12)
    ctx.strokeStyle = 'rgba(140, 170, 255, 0.16)'
    ctx.lineWidth = 1
    ctx.strokeRect(nx, BY + 22, 5 * 24, 4 * 24)
    if (nextName) {
      const cells = cellsFor(nextName, 0)
      const n = SHAPES[nextName].n
      const off = (5 - n) / 2
      for (const [cx, cy] of cells) {
        const x = nx + (cx + off) * 24
        const y = BY + 22 + (cy + (n === 2 ? 1 : 0.5)) * 24
        const g = ctx.createLinearGradient(0, y, 0, y + 22)
        g.addColorStop(0, SHAPES[nextName].color)
        g.addColorStop(1, shade(SHAPES[nextName].color))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x + 1, y + 1, 20, 20, 3)
        ctx.fill()
      }
    }
    // Left: stats.
    const sx = BX - 34
    ctx.textAlign = 'right'
    const stat = (label, value, y) => {
      ctx.fillStyle = '#8fa3c0'
      ctx.font = `600 13px ${FONT}`
      ctx.fillText(label, sx, y)
      ctx.fillStyle = '#eaf2ff'
      ctx.font = `700 20px ${FONT}`
      ctx.fillText(String(value), sx, y + 24)
    }
    stat('SCORE', String(score).padStart(6, '0'), BY + 12)
    stat('LINES', lines, BY + 76)
    stat('LEVEL', level, BY + 140)
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
      ctx.fillText(`SCORE ${score} · LINES ${lines} · LEVEL ${level}`, W / 2, cy + 100)
    }
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(sub, W / 2, cy + ch - 38)
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H)
    drawWell(now)
    drawPiece()
    drawPanels()

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }
    ctx.globalAlpha = 1

    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 0.4)
      ctx.fillStyle = '#e9d5ff'
      ctx.font = `700 40px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(banner.text, W / 2, H / 2 - 40)
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
    const key = (cells) =>
      cells
        .map(([x, y]) => `${x},${y}`)
        .sort()
        .join(' ')

    ok(key(cellsFor('T', 4)) === key(cellsFor('T', 0)), 'four rotations return home')
    ok(key(cellsFor('O', 1)) === key(cellsFor('O', 0)), 'O is rotation-invariant')
    ok(cellsFor('I', 1).every(([x]) => x === 2), 'vertical I occupies one column')

    const b = emptyBoard()
    ok(collides(b, 'T', 0, -1, 0), 'left wall collides')
    ok(!collides(b, 'T', 0, 4, 0), 'open space does not collide')
    ok(dropY(b, 'O', 0, 0, 0) === ROWS - 2, 'O drops to the floor')

    // Fill the bottom row except one gap; clearing works after filling it.
    for (let x = 0; x < COLS - 1; x++) b[ROWS - 1][x] = 1
    b[ROWS - 1][COLS - 1] = 1
    b[ROWS - 2][0] = 2
    const cleared = clearLines(b)
    ok(cleared.length === 1, 'full row clears')
    ok(b[ROWS - 1][0] === 2, 'stack shifts down after a clear')

    const bagged = shuffledBag()
    ok(bagged.length === 7 && new Set(bagged).size === 7, 'bag holds all 7 pieces once')

    // AI prefers filling a gap (clearing a line) over stacking a hole.
    const b2 = emptyBoard()
    for (let x = 0; x < COLS; x++) if (x !== 4) b2[ROWS - 1][x] = 1
    const mv = bestMove(b2, 'I')
    ok(mv && mv.rot % 2 === 1 && mv.x + (mv.rot === 1 ? 2 : 1) === 4, 'AI slots the I into the gap')

    console.log('[tetris] selftest passed')
    document.getElementById('status').textContent = 'selftest passed ✓'
  }
})()
