// Snake — a second bundled VibeSense game, proving the marketplace serves more
// than one title. Runs while the Claude agent executes; freezes when it needs
// you. Input arrives over SSE from the vibesense host: left stick steers (uses
// BOTH axes, unlike Alien Defenders' 1-D move), R2 boosts. When nobody's
// touching the controller, a greedy-safe autopilot keeps the snake alive so the
// demo doesn't wall itself the moment the agent starts a long run.
// Keyboard fallback (arrows + space) for development. `?play` forces the
// playing state so the game is testable without a host.

;(() => {
  'use strict'

  // ── Pure grid logic (unit-testable, no I/O) ───────────────────────────
  const COLS = 32
  const ROWS = 24
  const DIRS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' }

  const step = (cell, d) => ({ x: cell.x + d.x, y: cell.y + d.y })
  const inBounds = (c) => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS
  const occupied = (c, body) => body.some((s) => s.x === c.x && s.y === c.y)
  const safe = (c, body) => inBounds(c) && !occupied(c, body)

  // Directions ranked by how much they close on the food, dominant axis first,
  // then the remaining two as fallbacks. Head/food are grid cells.
  function preferOrder(head, food) {
    const h = food.x > head.x ? 'right' : 'left'
    const v = food.y > head.y ? 'down' : 'up'
    const primary = Math.abs(food.x - head.x) >= Math.abs(food.y - head.y) ? [h, v] : [v, h]
    const rest = ['up', 'down', 'left', 'right'].filter((d) => !primary.includes(d))
    return [...primary, ...rest]
  }

  // ponytail: greedy heuristic, not a Hamiltonian solver — chase food, but only
  // via a move that clears the walls and the body (tail excluded: it moves out
  // of the way). Upgrade to a full path planner only if it dies too often to demo.
  function autoDir(snake, food, curDir) {
    const head = snake[0]
    const obstacles = snake.slice(0, -1) // head collides with everything but the moving tail
    for (const name of preferOrder(head, food)) {
      if (name === OPP[curDir]) continue // snake can't reverse into its own neck
      if (safe(step(head, DIRS[name]), obstacles)) return name
    }
    return curDir // boxed in — keep going and die
  }

  if (location.search.includes('selftest')) return selftest()

  // ── Setup ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('status')

  // Logical resolution stays 800×600; backing store scales for HiDPI.
  const W = 800
  const H = 600
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)
  const CELL = W / COLS // 25px logical; grid is 32×24 cells

  let playing = false
  let snake = []
  let dir = 'right'
  let pendingDir = 'right'
  let food = { x: 0, y: 0 }
  let score = 0
  let gameOver = false
  let gameOverAt = 0
  let boost = false
  let lastHumanInput = 0
  let autopilotEnabled = false // opt-in: toggled from the sidebar via {type:"autopilot"}
  let acc = 0 // seconds accumulated toward the next grid step
  let particles = [] // {x, y, vx, vy, life, max, color}

  const STEP_MS = 120
  const BOOST_MS = 55
  const AUTOPILOT_IDLE_MS = 2500 // hand back to the AI after this long untouched

  function placeFood() {
    // Rejection-sample an empty cell. Grid is 768 cells; snake is tiny — fine.
    let c
    do {
      c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) }
    } while (occupied(c, snake))
    food = c
  }

  function reset() {
    snake = [
      { x: 8, y: 12 },
      { x: 7, y: 12 },
      { x: 6, y: 12 },
    ]
    dir = 'right'
    pendingDir = 'right'
    score = 0
    gameOver = false
    boost = false
    acc = 0
    particles = []
    placeFood()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
  function steer(name) {
    if (name === OPP[dir]) return // no instant 180° into the neck
    pendingDir = name
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
        // Left stick → dominant-axis direction, past a deadzone.
        if (msg.axis === 'left_x' && Math.abs(msg.value) > 0.4) {
          steer(msg.value > 0 ? 'right' : 'left')
        } else if (msg.axis === 'left_y' && Math.abs(msg.value) > 0.4) {
          steer(msg.value > 0 ? 'down' : 'up')
        }
      } else if (msg.kind === 'button' && (msg.button === 'r2' || msg.button === 'l2')) {
        boost = msg.pressed
        if (msg.pressed && gameOver) reset()
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
    else if (e.key === ' ') {
      boost = true
      lastHumanInput = performance.now()
      if (gameOver) reset()
    } else return
    e.preventDefault() // arrows/space would scroll the page
  })
  addEventListener('keyup', (e) => {
    if (e.key === ' ') boost = false
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? 'agent executing — steer the snake!' : 'claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // Dev affordance: `?play` runs the game without a host.
  if (location.search.includes('play')) setPlaying(true)

  // ── Simulation: advance one grid cell ─────────────────────────────────
  const center = (c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 })

  function burst(cell, color, n = 14) {
    const p = center(cell)
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 90 + Math.random() * 130
      const max = 0.3 + Math.random() * 0.35
      particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, color })
    }
  }

  function tick() {
    if (gameOver) return

    // Untouched for a while → let the autopilot drive so the demo survives.
    const idle = autopilotEnabled && performance.now() - lastHumanInput > AUTOPILOT_IDLE_MS
    const chosen = idle ? autoDir(snake, food, dir) : pendingDir
    dir = chosen === OPP[dir] ? dir : chosen

    const head = step(snake[0], DIRS[dir])

    // Wall or self (tail moves away this tick, so it's not an obstacle).
    if (!safe(head, snake.slice(0, -1))) {
      gameOver = true
      gameOverAt = performance.now()
      burst(snake[0], '#ff4d6d', 22)
      return
    }

    snake.unshift(head)
    if (boost) {
      const tail = snake[snake.length - 1]
      const t = center(tail)
      particles.push({ x: t.x, y: t.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#2e7d4f' })
    }
    if (head.x === food.x && head.y === food.y) {
      score += 10
      burst(food, '#ff4d6d')
      placeFood() // grew: keep the tail
    } else {
      snake.pop()
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

  function drawBoard() {
    ctx.fillStyle = 'rgba(140, 170, 255, 0.022)'
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if ((x + y) % 2 === 0) ctx.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
  }

  function drawFood(now) {
    const p = center(food)
    const pulse = 0.5 + 0.5 * Math.sin(now / 220)
    ctx.save()
    ctx.shadowColor = '#ff4d6d'
    ctx.shadowBlur = 14 + pulse * 8
    const grad = ctx.createRadialGradient(p.x - 2, p.y - 3, 1, p.x, p.y, CELL * 0.42)
    grad.addColorStop(0, '#ffb3c2')
    grad.addColorStop(0.45, '#ff4d6d')
    grad.addColorStop(1, '#c9184a')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(p.x, p.y, CELL * 0.3 + pulse * 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Body drawn as capsules spanning each adjacent pair of cells — connected
  // and rounded instead of a row of loose squares. Painted tail→head so the
  // brighter head-end sits on top.
  function drawSnake() {
    const inset = 3
    for (let i = snake.length - 1; i >= 0; i--) {
      const a = snake[i]
      const b = snake[Math.max(0, i - 1)]
      const x = Math.min(a.x, b.x) * CELL + inset
      const y = Math.min(a.y, b.y) * CELL + inset
      const w = (Math.abs(a.x - b.x) + 1) * CELL - inset * 2
      const h = (Math.abs(a.y - b.y) + 1) * CELL - inset * 2
      const t = i / Math.max(1, snake.length - 1) // 0 head → 1 tail
      ctx.fillStyle = `hsl(140, ${85 - t * 30}%, ${62 - t * 28}%)`
      if (i === 0) {
        ctx.save()
        ctx.shadowColor = '#4dff88'
        ctx.shadowBlur = 12
      }
      ctx.beginPath()
      ctx.roundRect(x, y, w, h, (CELL - inset * 2) / 2)
      ctx.fill()
      if (i === 0) ctx.restore()
    }

    // Eyes on the head, facing the direction of travel.
    const hp = center(snake[0])
    const d = DIRS[dir]
    const fx = d.x * 4
    const fy = d.y * 4
    const sx = d.y * 4.5 // perpendicular offset
    const sy = d.x * 4.5
    ctx.fillStyle = '#06210f'
    for (const s of [1, -1]) {
      ctx.beginPath()
      ctx.arc(hp.x + fx + s * sx, hp.y + fy + s * sy, 2.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function drawHud() {
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `600 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('SCORE', 16, 18)
    ctx.textAlign = 'right'
    ctx.fillText('LENGTH', W - 16, 18)
    ctx.fillStyle = '#eaf2ff'
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(String(score).padStart(5, '0'), 16, 33)
    ctx.textAlign = 'right'
    ctx.fillText(String(snake.length), W - 16, 33)
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
      ctx.fillText(`SCORE ${score} · LENGTH ${snake.length}`, W / 2, cy + 100)
    }
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(sub, W / 2, cy + ch - 38)
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H)
    drawBoard()
    drawFood(now)
    drawSnake()

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5)
    }
    ctx.globalAlpha = 1

    drawHud()

    if (gameOver) {
      overlay('GAME OVER', 'restarting…', '#ff4d6d', true)
    } else if (!playing) {
      overlay('PAUSED', 'claude needs you — answer in the terminal', '#4dff88', false)
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (gameOver && now - gameOverAt > 4000) reset()
    if (playing) {
      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
      }
      particles = particles.filter((p) => p.life > 0)
      if (!gameOver) {
        acc += dt
        const stepInterval = (boost ? BOOST_MS : STEP_MS) / 1000
        while (acc >= stepInterval) {
          acc -= stepInterval
          tick()
        }
      }
    }
    render(now)
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  // ── Self-test: `?selftest` runs the pure logic and asserts. ────────────
  function selftest() {
    const ok = (cond, msg) => {
      if (!cond) throw new Error('selftest failed: ' + msg)
    }
    ok(step({ x: 1, y: 1 }, DIRS.right).x === 2, 'step moves right')
    ok(step({ x: 1, y: 1 }, DIRS.up).y === 0, 'step moves up')
    ok(!inBounds({ x: -1, y: 0 }) && !inBounds({ x: COLS, y: 0 }), 'walls out of bounds')
    ok(safe({ x: 5, y: 5 }, [{ x: 6, y: 6 }]), 'empty cell is safe')
    ok(!safe({ x: 6, y: 6 }, [{ x: 6, y: 6 }]), 'occupied cell is unsafe')

    // Autopilot heads toward the food and never reverses into its own neck.
    const body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]
    ok(autoDir(body, { x: 10, y: 5 }, 'right') === 'right', 'AI chases food to the right')
    ok(autoDir(body, { x: 0, y: 5 }, 'right') !== 'left', 'AI never reverses into neck')
    // Boxed against the top wall while food is up → must pick a safe side move.
    const atTop = [
      { x: 5, y: 0 },
      { x: 4, y: 0 },
    ]
    ok(safe(step(atTop[0], DIRS[autoDir(atTop, { x: 5, y: -5 }, 'right')]), atTop.slice(0, -1)), 'AI stays safe near a wall')

    console.log('[snake] selftest passed')
    document.getElementById('status').textContent = 'selftest passed ✓'
  }
})()
