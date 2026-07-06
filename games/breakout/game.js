// Breakout — bundled VibeSense game. Runs while the Claude agent executes;
// freezes when it needs you. Input over SSE from the vibesense host: left
// stick X slides the paddle (analog — stick deflection is paddle speed),
// R2/L2 launches the ball and restarts after game over. When the controller
// sits untouched, an autopilot predicts the ball's landing point and keeps
// the rally alive so the demo survives long agent runs.
// Keyboard fallback (arrows + space) for development. `?play` forces the
// playing state so the game is testable without a host.

;(() => {
  'use strict'

  // ── Pure logic (unit-testable, no I/O) ────────────────────────────────
  const W = 800
  const H = 600
  const COLS = 12
  const ROWS = 6
  const MARGIN = 26
  const GAP = 6
  const BRICK_W = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS
  const BRICK_H = 20
  const BRICK_TOP = 76
  const BALL_R = 7
  const PADDLE_W = 110
  const PADDLE_H = 14
  const PADDLE_Y = H - 42
  const MAX_BOUNCE = (60 * Math.PI) / 180 // widest exit angle off the paddle

  const brickRect = (col, row) => ({
    x: MARGIN + col * (BRICK_W + GAP),
    y: BRICK_TOP + row * (BRICK_H + GAP),
    w: BRICK_W,
    h: BRICK_H,
  })

  // Paddle "english": hit offset in [-1, 1] → unit direction, straight up at
  // the center, MAX_BOUNCE at the edges.
  function bounceDir(offset) {
    const a = Math.max(-1, Math.min(1, offset)) * MAX_BOUNCE
    return { vx: Math.sin(a), vy: -Math.cos(a) }
  }

  // Fold a raw x onto [0, W] as if reflecting off both side walls.
  function foldX(raw, w) {
    const m = ((raw % (2 * w)) + 2 * w) % (2 * w)
    return m > w ? 2 * w - m : m
  }

  // Where a falling ball crosses targetY, after any side-wall reflections.
  // Rising balls return null — the caller just shadows the ball until it turns.
  function predictLandingX(x, y, vx, vy, targetY) {
    if (vy <= 0) return null
    return foldX(x + (vx * (targetY - y)) / vy, W)
  }

  // Which axis a ball centered at (bx, by) should reflect on after hitting
  // rect: the axis of least penetration.
  function hitAxis(bx, by, r, rect) {
    const cx = Math.max(rect.x, Math.min(bx, rect.x + rect.w))
    const cy = Math.max(rect.y, Math.min(by, rect.y + rect.h))
    return Math.abs(bx - cx) > Math.abs(by - cy) ? 'x' : 'y'
  }

  if (location.search.includes('selftest')) return selftest()

  // ── Setup ─────────────────────────────────────────────────────────────
  const canvas = document.getElementById('game')
  const ctx = canvas.getContext('2d')
  const statusEl = document.getElementById('status')

  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  ctx.scale(dpr, dpr)

  // Warm→cool per row, top rows worth more.
  const ROW_HUES = [352, 18, 38, 52, 158, 205]
  const rowColor = (row, l = 60) => `hsl(${ROW_HUES[row]}, 85%, ${l}%)`

  let playing = false
  let paddleX = W / 2 // paddle center
  let stick = 0 // analog input in [-1, 1]
  let keyDir = 0
  let ball = { x: 0, y: 0, vx: 0, vy: 0 }
  let stuck = true // ball riding the paddle, waiting for launch
  let stuckAt = 0
  let bricks = [] // alive flags, row-major
  let bricksLeft = 0
  let score = 0
  let lives = 3
  let level = 1
  let combo = 0
  let bestCombo = 0
  let broken = 0 // bricks broken this life (feeds the speed ramp)
  let gameOver = false
  let gameOverAt = 0
  let lastHumanInput = 0
  let shake = { t: 0, mag: 0 }
  let banner = { text: '', t: 0 }
  let particles = [] // {x, y, vx, vy, life, max, color}
  let floats = [] // {x, y, text, life, max, color}
  let trail = [] // recent ball positions

  const PADDLE_SPEED = 620
  const BASE_SPEED = 330
  const AUTOPILOT_IDLE_MS = 2500

  const ballSpeed = () => Math.min(BASE_SPEED + (level - 1) * 28 + broken * 2.2, 560)

  function buildWall() {
    bricks = Array.from({ length: COLS * ROWS }, () => true)
    bricksLeft = COLS * ROWS
  }

  function serve() {
    stuck = true
    stuckAt = performance.now()
    ball.x = paddleX
    ball.y = PADDLE_Y - BALL_R - 1
    ball.vx = 0
    ball.vy = 0
    trail = []
  }

  function launch() {
    if (!stuck) return
    stuck = false
    const d = bounceDir((Math.random() - 0.5) * 0.7)
    const s = ballSpeed()
    ball.vx = d.vx * s
    ball.vy = d.vy * s
  }

  function reset() {
    score = 0
    lives = 3
    level = 1
    combo = 0
    bestCombo = 0
    broken = 0
    gameOver = false
    particles = []
    floats = []
    buildWall()
    paddleX = W / 2
    serve()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
  function pressFire() {
    lastHumanInput = performance.now()
    if (gameOver) reset()
    else launch()
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
      if (msg.kind === 'axis' && msg.axis === 'left_x') {
        stick = Math.abs(msg.value) > 0.15 ? msg.value : 0
        if (stick !== 0) lastHumanInput = performance.now()
      } else if (msg.kind === 'button' && (msg.button === 'r2' || msg.button === 'l2')) {
        if (msg.pressed) pressFire()
      }
    } else if (msg.type === 'reload') {
      location.href = msg.url // controller swapped games — load the new one
    }
  }
  events.onerror = () => setStatus('host disconnected — is vibesense running?', false)

  // Keyboard fallback for development.
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keyDir = -1
    else if (e.key === 'ArrowRight') keyDir = 1
    else if (e.key === ' ') pressFire()
    else return
    lastHumanInput = performance.now()
  })
  addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' && keyDir === -1) keyDir = 0
    if (e.key === 'ArrowRight' && keyDir === 1) keyDir = 0
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? 'agent executing — clear the wall!' : 'claude needs you — controller is on the terminal',
      playing,
    )
  }

  function setStatus(text, isPlaying) {
    statusEl.textContent = text
    statusEl.className = isPlaying ? 'playing' : ''
  }

  // Dev affordance: `?play` runs the game without a host.
  if (location.search.includes('play')) setPlaying(true)

  // ── Effects ───────────────────────────────────────────────────────────
  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 70 + Math.random() * 160
      const max = 0.3 + Math.random() * 0.35
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: max, max, color })
    }
  }

  function float(x, y, text, color) {
    floats.push({ x, y, text, life: 0.8, max: 0.8, color })
  }

  function kick(mag) {
    shake = { t: 0.3, mag: Math.max(shake.mag, mag) }
  }

  // ── Simulation ────────────────────────────────────────────────────────
  function movePaddle(dt, now) {
    const idle = now - lastHumanInput > AUTOPILOT_IDLE_MS
    let vx
    if (idle) {
      // Autopilot: chase the predicted landing point (or shadow a rising ball),
      // capped at human paddle speed so it never looks superhuman. Catch the
      // ball off-center, aimed at the remaining wall's centroid — a perfectly
      // centered catch would rally the ball vertically in a cleared channel
      // forever.
      const landing = stuck ? ball.x : predictLandingX(ball.x, ball.y, ball.vx, ball.vy, PADDLE_Y)
      let target = ball.x
      if (landing !== null && !stuck) {
        let sum = 0
        let n = 0
        for (let i = 0; i < bricks.length; i++) {
          if (bricks[i]) (sum += brickRect(i % COLS, 0).x + BRICK_W / 2), n++
        }
        const aim = n ? sum / n : W / 2
        const desired = Math.max(-0.8, Math.min(0.8, (aim - landing) / 320))
        target = landing - (desired * PADDLE_W) / 2
      }
      vx = Math.max(-PADDLE_SPEED, Math.min(PADDLE_SPEED, (target - paddleX) * 8))
      if (stuck && now - stuckAt > 900) launch()
    } else {
      vx = (stick !== 0 ? stick : keyDir) * PADDLE_SPEED
    }
    paddleX = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, paddleX + vx * dt))
    if (stuck) ball.x = paddleX
  }

  function loseLife() {
    lives--
    combo = 0
    broken = 0
    kick(9)
    burst(ball.x, H - 8, '#ff4d6d', 20)
    if (lives <= 0) {
      gameOver = true
      gameOverAt = performance.now()
    } else {
      serve()
    }
  }

  function nextLevel() {
    level++
    combo = 0
    broken = 0
    banner = { text: `LEVEL ${level}`, t: 1.4 }
    buildWall()
    serve()
  }

  function hitBrick(i) {
    bricks[i] = false
    bricksLeft--
    broken++
    combo++
    bestCombo = Math.max(bestCombo, combo)
    const row = Math.floor(i / COLS)
    const r = brickRect(i % COLS, row)
    const points = (ROWS - row) * 10 * Math.max(1, combo)
    score += points
    burst(r.x + r.w / 2, r.y + r.h / 2, rowColor(row, 65))
    float(r.x + r.w / 2, r.y, `+${points}`, rowColor(row, 75))
    kick(1.6)
    if (bricksLeft <= 0) nextLevel()
  }

  function moveBall(dt) {
    if (stuck || gameOver) return
    // Substep so a fast ball can't tunnel through a brick or the paddle.
    const dist = Math.hypot(ball.vx, ball.vy) * dt
    const steps = Math.max(1, Math.ceil(dist / (BALL_R * 0.8)))
    for (let s = 0; s < steps; s++) {
      ball.x += (ball.vx * dt) / steps
      ball.y += (ball.vy * dt) / steps

      if (ball.x < BALL_R) (ball.x = BALL_R), (ball.vx = Math.abs(ball.vx))
      if (ball.x > W - BALL_R) (ball.x = W - BALL_R), (ball.vx = -Math.abs(ball.vx))
      if (ball.y < BALL_R) (ball.y = BALL_R), (ball.vy = Math.abs(ball.vy))
      if (ball.y > H + BALL_R * 2) return loseLife()

      // Paddle (only while falling, so the ball can't get trapped inside).
      if (
        ball.vy > 0 &&
        ball.y + BALL_R >= PADDLE_Y &&
        ball.y < PADDLE_Y + PADDLE_H &&
        Math.abs(ball.x - paddleX) <= PADDLE_W / 2 + BALL_R
      ) {
        const d = bounceDir((ball.x - paddleX) / (PADDLE_W / 2))
        const sp = ballSpeed()
        ball.vx = d.vx * sp
        ball.vy = d.vy * sp
        ball.y = PADDLE_Y - BALL_R
        combo = 0
        continue
      }

      // Bricks: circle-vs-AABB on the cell neighborhood of the ball.
      if (ball.y - BALL_R < BRICK_TOP + ROWS * (BRICK_H + GAP)) {
        for (let i = 0; i < bricks.length; i++) {
          if (!bricks[i]) continue
          const r = brickRect(i % COLS, Math.floor(i / COLS))
          const cx = Math.max(r.x, Math.min(ball.x, r.x + r.w))
          const cy = Math.max(r.y, Math.min(ball.y, r.y + r.h))
          if ((ball.x - cx) ** 2 + (ball.y - cy) ** 2 > BALL_R * BALL_R) continue
          if (hitAxis(ball.x, ball.y, BALL_R, r) === 'x') ball.vx = -ball.vx
          else ball.vy = -ball.vy
          hitBrick(i)
          // Rescale to the new ramped speed so hits genuinely accelerate play.
          const sp = ballSpeed() / Math.hypot(ball.vx, ball.vy)
          ball.vx *= sp
          ball.vy *= sp
          break
        }
      }
    }
    trail.push({ x: ball.x, y: ball.y })
    if (trail.length > 10) trail.shift()
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

  function drawBackdrop() {
    // Faint vignette wash so the play area has depth without stealing focus.
    const g = ctx.createRadialGradient(W / 2, H * 0.3, 60, W / 2, H * 0.55, H * 0.75)
    g.addColorStop(0, 'rgba(140, 170, 255, 0.045)')
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  function drawBricks() {
    for (let i = 0; i < bricks.length; i++) {
      if (!bricks[i]) continue
      const row = Math.floor(i / COLS)
      const r = brickRect(i % COLS, row)
      const grad = ctx.createLinearGradient(0, r.y, 0, r.y + r.h)
      grad.addColorStop(0, rowColor(row, 66))
      grad.addColorStop(1, rowColor(row, 46))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(r.x, r.y, r.w, r.h, 5)
      ctx.fill()
      // Glossy top edge.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.beginPath()
      ctx.roundRect(r.x + 2, r.y + 2, r.w - 4, 4, 2)
      ctx.fill()
    }
  }

  function drawPaddle() {
    ctx.save()
    ctx.shadowColor = '#ffb347'
    ctx.shadowBlur = 16
    const g = ctx.createLinearGradient(0, PADDLE_Y, 0, PADDLE_Y + PADDLE_H)
    g.addColorStop(0, '#ffd28f')
    g.addColorStop(1, '#e08c1f')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.roundRect(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, PADDLE_H / 2)
    ctx.fill()
    ctx.restore()
  }

  function drawBall(now) {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i]
      ctx.globalAlpha = ((i + 1) / trail.length) * 0.25
      ctx.fillStyle = '#ffb347'
      ctx.beginPath()
      ctx.arc(t.x, t.y, BALL_R * 0.8 * ((i + 1) / trail.length), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.save()
    ctx.shadowColor = '#ffcf8a'
    ctx.shadowBlur = 18
    const g = ctx.createRadialGradient(ball.x - 2, ball.y - 3, 1, ball.x, ball.y, BALL_R)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.5, '#ffe1b0')
    g.addColorStop(1, '#f5a623')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    if (stuck && !gameOver) {
      const pulse = 0.55 + 0.45 * Math.sin(now / 240)
      ctx.globalAlpha = pulse
      ctx.fillStyle = '#8fa3c0'
      ctx.font = `500 13px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('R2 / SPACE — launch', W / 2, PADDLE_Y - 26)
      ctx.globalAlpha = 1
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
    // Lives as mini paddles.
    for (let i = 0; i < lives; i++) {
      ctx.fillStyle = '#f5a623'
      ctx.beginPath()
      ctx.roundRect(W - 16 - (i + 1) * 26, 26, 20, 6, 3)
      ctx.fill()
    }
    if (combo > 1) {
      ctx.fillStyle = '#ffd28f'
      ctx.font = `700 15px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(`COMBO ×${combo}`, W / 2, 36)
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
      ctx.fillText(`SCORE ${score} · LEVEL ${level} · BEST COMBO ×${bestCombo}`, W / 2, cy + 100)
    }
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(sub, W / 2, cy + ch - 38)
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H)
    ctx.save()
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / 0.3)
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
    }
    drawBackdrop()
    drawBricks()
    drawPaddle()
    drawBall(now)

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2.5, p.y - 2.5, 5, 5)
    }
    for (const f of floats) {
      ctx.globalAlpha = Math.max(0, f.life / f.max)
      ctx.fillStyle = f.color
      ctx.font = `700 14px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(f.text, f.x, f.y)
    }
    ctx.globalAlpha = 1
    drawHud()

    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 0.4)
      ctx.fillStyle = '#ffd28f'
      ctx.font = `700 40px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(banner.text, W / 2, H / 2 - 40)
      ctx.globalAlpha = 1
    }
    ctx.restore()

    if (gameOver) {
      overlay('GAME OVER', 'R2 / SPACE to play again — restarting…', '#ff4d6d', true)
    } else if (!playing) {
      overlay('PAUSED', 'claude needs you — answer in the terminal', '#ffb347', false)
    }
  }

  // ── Main loop ─────────────────────────────────────────────────────────
  let last = performance.now()
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    if (gameOver && now - gameOverAt > 4000) reset()
    if (playing) {
      shake.t = Math.max(0, shake.t - dt)
      banner.t = Math.max(0, banner.t - dt)
      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vy += 260 * dt
        p.life -= dt
      }
      particles = particles.filter((p) => p.life > 0)
      for (const f of floats) {
        f.y -= 28 * dt
        f.life -= dt
      }
      floats = floats.filter((f) => f.life > 0)
      if (!gameOver) {
        movePaddle(dt, now)
        moveBall(dt)
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
    const near = (a, b) => Math.abs(a - b) < 1e-6

    const up = bounceDir(0)
    ok(near(up.vx, 0) && up.vy < 0, 'center hit bounces straight up')
    ok(bounceDir(1).vx > 0 && bounceDir(-1).vx < 0, 'edge hits angle outward')
    ok(near(Math.hypot(bounceDir(0.6).vx, bounceDir(0.6).vy), 1), 'bounce dir is unit length')

    ok(near(foldX(850, 800), 750), 'fold reflects off the right wall')
    ok(near(foldX(-60, 800), 60), 'fold reflects off the left wall')
    ok(near(predictLandingX(750, 0, 100, 100, 200), 650), 'landing prediction reflects')
    ok(predictLandingX(400, 300, 50, -100, 560) === null, 'rising ball has no landing yet')

    const r = brickRect(0, 0)
    ok(hitAxis(r.x - 5, r.y + r.h / 2, 7, r) === 'x', 'side hit reflects on x')
    ok(hitAxis(r.x + r.w / 2, r.y + r.h + 5, 7, r) === 'y', 'bottom hit reflects on y')

    console.log('[breakout] selftest passed')
    document.getElementById('status').textContent = 'selftest passed ✓'
  }
})()
