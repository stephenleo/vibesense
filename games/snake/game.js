// Snake — a second bundled VibeSense game, proving the marketplace serves more
// than one title. Runs while the Claude agent executes; freezes when it needs
// you. Input arrives over SSE from the vibesense host: left stick steers (uses
// BOTH axes, unlike Alien Defenders' 1-D move), R2 boosts. When nobody's
// touching the controller, a greedy-safe autopilot keeps the snake alive so the
// demo doesn't wall itself the moment the agent starts a long run.
// Keyboard fallback (arrows + space) for development.

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
  const CELL = canvas.width / COLS // 25px; canvas is 800×600 = 32×24 cells

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
  let acc = 0 // seconds accumulated toward the next grid step

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
    if (e.key === ' ') {
      boost = true
      if (gameOver) reset()
    }
  })
  addEventListener('keyup', (e) => {
    if (e.key === ' ') boost = false
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? '▶ agent executing — steer the snake!' : '⏸ claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // ── Simulation: advance one grid cell ─────────────────────────────────
  function tick() {
    if (gameOver) return

    // Untouched for a while → let the autopilot drive so the demo survives.
    const idle = performance.now() - lastHumanInput > AUTOPILOT_IDLE_MS
    const chosen = idle ? autoDir(snake, food, dir) : pendingDir
    dir = chosen === OPP[dir] ? dir : chosen

    const head = step(snake[0], DIRS[dir])

    // Wall or self (tail moves away this tick, so it's not an obstacle).
    if (!safe(head, snake.slice(0, -1))) {
      gameOver = true
      gameOverAt = performance.now()
      return
    }

    snake.unshift(head)
    if (head.x === food.x && head.y === food.y) {
      score += 10
      placeFood() // grew: keep the tail
    } else {
      snake.pop()
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const W = canvas.width
  const H = canvas.height

  function cellRect(c, inset) {
    ctx.fillRect(c.x * CELL + inset, c.y * CELL + inset, CELL - inset * 2, CELL - inset * 2)
  }

  function render() {
    ctx.clearRect(0, 0, W, H)

    // Faint grid dots.
    ctx.fillStyle = '#0c1420'
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) ctx.fillRect(x * CELL + CELL / 2, y * CELL + CELL / 2, 1, 1)
    }

    ctx.fillStyle = '#ff5c8a'
    cellRect(food, 5)

    snake.forEach((s, i) => {
      ctx.fillStyle = i === 0 ? '#eaffea' : '#7cff7c'
      cellRect(s, 2)
    })

    ctx.fillStyle = '#7cff7c'
    ctx.font = '16px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${score}`, 16, 22)
    ctx.textAlign = 'right'
    ctx.fillText(`LEN ${snake.length}`, W - 16, 22)

    if (gameOver || !playing) {
      ctx.fillStyle = 'rgba(2, 2, 10, 0.72)'
      ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.fillStyle = gameOver ? '#ff5c8a' : '#7cff7c'
      ctx.font = 'bold 36px "Courier New", monospace'
      ctx.fillText(gameOver ? 'GAME OVER' : 'PAUSED', W / 2, H / 2 - 12)
      ctx.font = '18px "Courier New", monospace'
      ctx.fillStyle = '#9ab'
      ctx.fillText(
        gameOver ? 'restarting…' : 'claude needs you — answer in the terminal',
        W / 2,
        H / 2 + 22,
      )
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (gameOver && now - gameOverAt > 4000) reset()
    if (playing && !gameOver) {
      acc += dt
      const stepInterval = (boost ? BOOST_MS : STEP_MS) / 1000
      while (acc >= stepInterval) {
        acc -= stepInterval
        tick()
      }
    }
    render()
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
