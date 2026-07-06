// Alien Defenders — the bundled VibeSense game.
// Auto-plays while the Claude agent executes; pauses when it needs you.
// Input arrives over SSE from the vibesense host (left stick = move, R2 = fire).
// Keyboard fallback (arrows + space) for development.

;(() => {
  'use strict'

  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('status')
  const W = canvas.width
  const H = canvas.height

  // ── State ─────────────────────────────────────────────────────────────
  let playing = false
  let moveInput = 0 // -1..1 from stick or keyboard
  let firing = false
  let lastShot = 0

  const ship = { x: W / 2, y: H - 50, w: 40, h: 20, speed: 320 }
  let bullets = [] // {x, y}
  let bombs = [] // {x, y}
  let aliens = []
  let alienDir = 1
  let alienSpeed = 24
  let score = 0
  let lives = 3
  let wave = 1
  let gameOver = false

  function spawnWave() {
    aliens = []
    const rows = 4
    const cols = 10
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        aliens.push({ x: 90 + c * 62, y: 70 + r * 48, alive: true, row: r })
      }
    }
    alienDir = 1
    alienSpeed = 24 + (wave - 1) * 10
  }

  function reset() {
    score = 0
    lives = 3
    wave = 1
    gameOver = false
    bullets = []
    bombs = []
    ship.x = W / 2
    spawnWave()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
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
      if (msg.kind === 'axis' && msg.axis === 'left_x') moveInput = msg.value
      if (msg.kind === 'button' && (msg.button === 'r2' || msg.button === 'l2')) {
        firing = msg.pressed
        if (msg.pressed && gameOver) reset()
      }
    }
  }
  events.onerror = () => setStatus('host disconnected — is vibesense running?', false)

  // Keyboard fallback for development.
  const keys = {}
  addEventListener('keydown', (e) => {
    keys[e.key] = true
    if (e.key === ' ' && gameOver) reset()
  })
  addEventListener('keyup', (e) => (keys[e.key] = false))

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? '▶ agent executing — defend!' : '⏸ claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // ── Simulation ────────────────────────────────────────────────────────
  function step(dt) {
    if (gameOver) return

    const kb = (keys.ArrowLeft ? -1 : 0) + (keys.ArrowRight ? 1 : 0)
    const move = Math.abs(moveInput) > 0.15 ? moveInput : kb
    ship.x = Math.max(ship.w / 2, Math.min(W - ship.w / 2, ship.x + move * ship.speed * dt))

    const wantFire = firing || keys[' ']
    const now = performance.now()
    if (wantFire && now - lastShot > 280) {
      bullets.push({ x: ship.x, y: ship.y - 14 })
      lastShot = now
    }

    bullets = bullets.filter((b) => (b.y -= 480 * dt) > 0)
    bombs = bombs.filter((b) => (b.y += 220 * dt) < H)

    // March the fleet; drop and reverse at the edges.
    const alive = aliens.filter((a) => a.alive)
    if (alive.length === 0) {
      wave++
      spawnWave()
      return
    }
    const minX = Math.min(...alive.map((a) => a.x))
    const maxX = Math.max(...alive.map((a) => a.x))
    if ((alienDir > 0 && maxX > W - 50) || (alienDir < 0 && minX < 50)) {
      alienDir *= -1
      for (const a of aliens) a.y += 22
    }
    for (const a of aliens) a.x += alienDir * alienSpeed * dt

    // Random bombs from the lowest alien in a column.
    if (Math.random() < 0.9 * dt) {
      const shooter = alive[Math.floor(Math.random() * alive.length)]
      bombs.push({ x: shooter.x, y: shooter.y + 14 })
    }

    // Collisions.
    for (const b of bullets) {
      for (const a of alive) {
        if (a.alive && Math.abs(b.x - a.x) < 22 && Math.abs(b.y - a.y) < 16) {
          a.alive = false
          b.y = -99
          score += 10 * wave
        }
      }
    }
    for (const b of bombs) {
      if (Math.abs(b.x - ship.x) < ship.w / 2 && Math.abs(b.y - ship.y) < ship.h) {
        b.y = H + 99
        lives--
        if (lives <= 0) gameOver = true
      }
    }
    if (alive.some((a) => a.y > ship.y - 30)) gameOver = true
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  function drawAlien(a) {
    ctx.fillStyle = ['#ff5c8a', '#ffb45c', '#7cff7c', '#5cc8ff'][a.row % 4]
    ctx.fillRect(a.x - 16, a.y - 10, 32, 20)
    ctx.fillRect(a.x - 22, a.y - 2, 6, 8)
    ctx.fillRect(a.x + 16, a.y - 2, 6, 8)
    ctx.fillStyle = '#02020a'
    ctx.fillRect(a.x - 9, a.y - 4, 5, 5)
    ctx.fillRect(a.x + 4, a.y - 4, 5, 5)
  }

  function render() {
    ctx.clearRect(0, 0, W, H)

    ctx.fillStyle = '#123'
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(((i * 137) % W) + ((i * 61) % 7), (i * 97) % H, 2, 2)
    }

    for (const a of aliens) if (a.alive) drawAlien(a)

    ctx.fillStyle = '#7cff7c'
    ctx.fillRect(ship.x - ship.w / 2, ship.y, ship.w, 8)
    ctx.fillRect(ship.x - ship.w / 4, ship.y - 6, ship.w / 2, 6)
    ctx.fillRect(ship.x - 3, ship.y - 12, 6, 6)

    ctx.fillStyle = '#eaffea'
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 10)
    ctx.fillStyle = '#ff5c8a'
    for (const b of bombs) ctx.fillRect(b.x - 2, b.y, 4, 10)

    ctx.fillStyle = '#7cff7c'
    ctx.font = '16px "Courier New", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`SCORE ${score}`, 16, 26)
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave}`, W / 2, 26)
    ctx.textAlign = 'right'
    ctx.fillText(`LIVES ${'▲'.repeat(Math.max(0, lives))}`, W - 16, 26)

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
        gameOver ? 'fire to restart' : 'claude needs you — answer in the terminal',
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
    if (playing) step(dt)
    render()
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
})()
