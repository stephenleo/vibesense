// Asteroids — bundled VibeSense game. Runs while the Claude agent executes;
// freezes when it needs you. Input over SSE from the vibesense host: left
// stick X rotates the ship (analog), stick Y (up) thrusts, R2 fires (hold for
// autofire), L2 hyperspace-jumps out of trouble. Untouched controller hands
// the ship to an autopilot that leads its shots and sidesteps close rocks so
// the demo survives long agent runs.
// Keyboard fallback (arrows + space + shift) for development. `?play` forces
// the playing state so the game is testable without a host.

;(() => {
  'use strict'

  // ── Pure logic (unit-testable, no I/O) ────────────────────────────────
  const W = 800
  const H = 600

  const wrap = (v, max) => ((v % max) + max) % max

  // Shortest signed rotation taking `from` onto `to`, in (-π, π].
  function angleDiff(to, from) {
    let d = (to - from) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d <= -Math.PI) d += Math.PI * 2
    return d
  }

  // Rock sizes: 3 large → two mediums → two smalls each → dust.
  const ROCK_RADIUS = { 1: 12, 2: 22, 3: 38 }
  const ROCK_SCORE = { 1: 100, 2: 50, 3: 20 }
  const splitSizes = (size) => (size > 1 ? [size - 1, size - 1] : [])

  // One-step intercept estimate: aim where the target will be when the
  // bullet arrives (good enough for slow rocks, and it's what a human does).
  function leadPoint(sx, sy, tx, ty, tvx, tvy, bulletSpeed) {
    const t = Math.hypot(tx - sx, ty - sy) / bulletSpeed
    return { x: tx + tvx * t, y: ty + tvy * t }
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

  const ACCENT = '#7dd3fc'
  const ROT_SPEED = 3.8 // rad/s at full stick
  const THRUST = 360
  const MAX_SPEED = 430
  const DRAG = 0.35 // gentle exponential damping — friendlier than pure Newton
  const BULLET_SPEED = 520
  const BULLET_LIFE = 1.05
  const MAX_BULLETS = 4
  const FIRE_COOLDOWN = 0.18
  const AUTOPILOT_IDLE_MS = 2500

  let playing = false
  let ship = null // {x, y, a, vx, vy, invulnUntil, deadUntil}
  let rocks = [] // {x, y, vx, vy, size, r, spin, rot, verts}
  let bullets = [] // {x, y, vx, vy, life}
  let particles = [] // {x, y, vx, vy, life, max, color}
  let debris = [] // ship wreckage lines {x, y, vx, vy, a, spin, len, life, max}
  let stars = [] // static backdrop {x, y, r, tw}
  let score = 0
  let lives = 3
  let wave = 0
  let gameOver = false
  let gameOverAt = 0
  let banner = { text: '', t: 0 }
  let lastHumanInput = 0
  let autopilotEnabled = false // opt-in: toggled from the sidebar via {type:"autopilot"}
  let stickX = 0
  let stickY = 0
  let keyRot = 0
  let keyThrust = false
  let firing = false
  let fireTimer = 0
  let hyperTimer = 0

  for (let i = 0; i < 90; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.85 ? 1 : 1.6,
      tw: Math.random() * Math.PI * 2,
    })
  }

  function makeRock(x, y, size, speedBoost = 0) {
    const n = 10 + Math.floor(Math.random() * 3)
    const verts = Array.from({ length: n }, () => 0.72 + Math.random() * 0.5)
    const a = Math.random() * Math.PI * 2
    const sp = 34 + (3 - size) * 34 + speedBoost + Math.random() * 30
    return {
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      size,
      r: ROCK_RADIUS[size],
      spin: (Math.random() - 0.5) * 1.6,
      rot: Math.random() * Math.PI * 2,
      verts,
    }
  }

  function spawnWave() {
    wave++
    banner = { text: `WAVE ${wave}`, t: 1.5 }
    const count = 3 + wave
    for (let i = 0; i < count; i++) {
      // Keep new rocks away from the ship so a fresh wave can't be a death.
      let x, y
      do {
        x = Math.random() * W
        y = Math.random() * H
      } while (ship && Math.hypot(x - ship.x, y - ship.y) < 180)
      rocks.push(makeRock(x, y, 3, wave * 5))
    }
  }

  function spawnShip() {
    ship = { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, invulnUntil: performance.now() + 2500, deadUntil: 0 }
  }

  function reset() {
    score = 0
    lives = 3
    wave = 0
    gameOver = false
    rocks = []
    bullets = []
    particles = []
    debris = []
    spawnShip()
    spawnWave()
  }
  reset()

  // ── Input: SSE from the vibesense host ────────────────────────────────
  function pressFire(pressed) {
    firing = pressed
    if (pressed) {
      lastHumanInput = performance.now()
      if (gameOver) reset()
    }
  }

  function hyperspace() {
    if (!ship || ship.deadUntil || hyperTimer > 0 || gameOver) return
    lastHumanInput = performance.now()
    hyperTimer = 2
    burst(ship.x, ship.y, ACCENT, 16)
    ship.x = 60 + Math.random() * (W - 120)
    ship.y = 60 + Math.random() * (H - 120)
    ship.vx = 0
    ship.vy = 0
    ship.invulnUntil = performance.now() + 1000
    burst(ship.x, ship.y, '#c9ecff', 16)
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
          stickX = Math.abs(msg.value) > 0.18 ? msg.value : 0
          if (stickX !== 0) lastHumanInput = performance.now()
        } else if (msg.axis === 'left_y') {
          stickY = Math.abs(msg.value) > 0.3 ? msg.value : 0
          if (stickY !== 0) lastHumanInput = performance.now()
        }
      } else if (msg.kind === 'button') {
        if (msg.button === 'r2') pressFire(msg.pressed)
        else if (msg.button === 'l2' && msg.pressed) {
          if (gameOver) reset()
          else hyperspace()
        }
      }
    } else if (msg.type === 'reload') {
      location.href = msg.url // controller swapped games — load the new one
    }
  }
  events.onerror = () => setStatus('host disconnected — is vibesense running?', false)

  // Keyboard fallback for development.
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keyRot = -1
    else if (e.key === 'ArrowRight') keyRot = 1
    else if (e.key === 'ArrowUp') keyThrust = true
    else if (e.key === ' ') pressFire(true)
    else if (e.key === 'Shift') hyperspace()
    else return
    e.preventDefault() // arrows/space would scroll the page
    lastHumanInput = performance.now()
  })
  addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' && keyRot === -1) keyRot = 0
    if (e.key === 'ArrowRight' && keyRot === 1) keyRot = 0
    if (e.key === 'ArrowUp') keyThrust = false
    if (e.key === ' ') pressFire(false)
  })

  function setPlaying(next) {
    playing = next
    setStatus(
      playing ? 'agent executing — clear the field!' : 'claude needs you — controller is on the terminal',
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
      const v = 50 + Math.random() * 170
      const max = 0.35 + Math.random() * 0.4
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: max, max, color })
    }
  }

  function explodeShip() {
    for (let i = 0; i < 5; i++) {
      debris.push({
        x: ship.x,
        y: ship.y,
        vx: (Math.random() - 0.5) * 160,
        vy: (Math.random() - 0.5) * 160,
        a: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 6,
        len: 8 + Math.random() * 10,
        life: 1.4,
        max: 1.4,
      })
    }
    burst(ship.x, ship.y, '#ff9d6d', 26)
  }

  // ── Autopilot ─────────────────────────────────────────────────────────
  let thrusting = false // shared with the renderer for the flame

  function autopilot(now, dt) {
    if (!ship || ship.deadUntil || !rocks.length) return
    // Nearest rock (by surface distance, wrap-aware on x/y separately).
    let nearest = null
    let best = Infinity
    for (const r of rocks) {
      const d = Math.hypot(r.x - ship.x, r.y - ship.y) - r.r
      if (d < best) {
        best = d
        nearest = r
      }
    }
    const danger = best < 95
    let targetA
    if (danger) {
      // Face away from the rock and burn.
      targetA = Math.atan2(ship.y - nearest.y, ship.x - nearest.x)
    } else {
      const aim = leadPoint(ship.x, ship.y, nearest.x, nearest.y, nearest.vx, nearest.vy, BULLET_SPEED)
      targetA = Math.atan2(aim.y - ship.y, aim.x - ship.x)
    }
    const d = angleDiff(targetA, ship.a)
    ship.a += Math.max(-ROT_SPEED * dt, Math.min(ROT_SPEED * dt, d))
    thrusting = danger && Math.abs(d) < 0.9
    if (thrusting) {
      ship.vx += Math.cos(ship.a) * THRUST * dt
      ship.vy += Math.sin(ship.a) * THRUST * dt
    }
    // Fire when lined up (and not mid-evasion turn).
    if (!danger && Math.abs(d) < 0.12) tryFire()
    // Last resort: rock basically on top of us and we're not invulnerable.
    if (best < 30 && now > ship.invulnUntil && hyperTimer <= 0) hyperspace()
  }

  function tryFire() {
    if (!ship || ship.deadUntil || fireTimer > 0 || bullets.length >= MAX_BULLETS) return
    fireTimer = FIRE_COOLDOWN
    bullets.push({
      x: ship.x + Math.cos(ship.a) * 14,
      y: ship.y + Math.sin(ship.a) * 14,
      vx: Math.cos(ship.a) * BULLET_SPEED + ship.vx * 0.35,
      vy: Math.sin(ship.a) * BULLET_SPEED + ship.vy * 0.35,
      life: BULLET_LIFE,
    })
  }

  // ── Simulation ────────────────────────────────────────────────────────
  function loseShip(now) {
    explodeShip()
    lives--
    if (lives <= 0) {
      gameOver = true
      gameOverAt = now
      ship = null
      return
    }
    ship.deadUntil = now + 1600
    ship.x = W / 2
    ship.y = H / 2
    ship.vx = 0
    ship.vy = 0
    ship.a = -Math.PI / 2
  }

  function killRock(i, now) {
    const r = rocks[i]
    score += ROCK_SCORE[r.size]
    burst(r.x, r.y, ACCENT, r.size * 6)
    const kids = splitSizes(r.size).map(() => {
      const k = makeRock(r.x, r.y, r.size - 1, wave * 5)
      return k
    })
    rocks.splice(i, 1, ...kids)
    if (!rocks.length) {
      // Brief breather, then the next wave.
      setTimeout(() => {
        if (playing && !gameOver && !rocks.length) spawnWave()
      }, 1200)
    }
  }

  function tick(dt, now) {
    fireTimer = Math.max(0, fireTimer - dt)
    hyperTimer = Math.max(0, hyperTimer - dt)
    banner.t = Math.max(0, banner.t - dt)

    const idle = autopilotEnabled && now - lastHumanInput > AUTOPILOT_IDLE_MS
    thrusting = false

    if (ship && ship.deadUntil && now >= ship.deadUntil) {
      ship.deadUntil = 0
      ship.invulnUntil = now + 2500
    }

    if (ship && !ship.deadUntil) {
      if (idle) {
        autopilot(now, dt)
      } else {
        const rot = stickX !== 0 ? stickX : keyRot
        ship.a += rot * ROT_SPEED * dt
        thrusting = stickY < -0.3 || keyThrust
        if (thrusting) {
          ship.vx += Math.cos(ship.a) * THRUST * dt
          ship.vy += Math.sin(ship.a) * THRUST * dt
        }
        if (firing) tryFire()
      }
      const damp = Math.exp(-DRAG * dt)
      ship.vx *= damp
      ship.vy *= damp
      const sp = Math.hypot(ship.vx, ship.vy)
      if (sp > MAX_SPEED) {
        ship.vx = (ship.vx / sp) * MAX_SPEED
        ship.vy = (ship.vy / sp) * MAX_SPEED
      }
      ship.x = wrap(ship.x + ship.vx * dt, W)
      ship.y = wrap(ship.y + ship.vy * dt, H)
    }

    for (const r of rocks) {
      r.x = wrap(r.x + r.vx * dt, W)
      r.y = wrap(r.y + r.vy * dt, H)
      r.rot += r.spin * dt
    }

    for (const b of bullets) {
      b.x = wrap(b.x + b.vx * dt, W)
      b.y = wrap(b.y + b.vy * dt, H)
      b.life -= dt
    }
    bullets = bullets.filter((b) => b.life > 0)

    // Bullet ↔ rock.
    outer: for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi]
      for (let ri = 0; ri < rocks.length; ri++) {
        const r = rocks[ri]
        if ((b.x - r.x) ** 2 + (b.y - r.y) ** 2 < r.r * r.r) {
          bullets.splice(bi, 1)
          killRock(ri, now)
          continue outer
        }
      }
    }

    // Ship ↔ rock.
    if (ship && !ship.deadUntil && now > ship.invulnUntil) {
      for (const r of rocks) {
        if ((ship.x - r.x) ** 2 + (ship.y - r.y) ** 2 < (r.r + 9) ** 2) {
          loseShip(now)
          break
        }
      }
    }

    for (const p of particles) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
    }
    particles = particles.filter((p) => p.life > 0)
    for (const s of debris) {
      s.x += s.vx * dt
      s.y += s.vy * dt
      s.a += s.spin * dt
      s.life -= dt
    }
    debris = debris.filter((s) => s.life > 0)
  }

  // ── Rendering ─────────────────────────────────────────────────────────
  const FONT = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

  function drawStars(now) {
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(now / 900 + s.tw)
      ctx.globalAlpha = 0.35 * tw
      ctx.fillStyle = '#cfe4ff'
      ctx.fillRect(s.x, s.y, s.r, s.r)
    }
    ctx.globalAlpha = 1
  }

  function shipPath(x, y, a) {
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * 15, y + Math.sin(a) * 15)
    ctx.lineTo(x + Math.cos(a + 2.5) * 11, y + Math.sin(a + 2.5) * 11)
    ctx.lineTo(x + Math.cos(a + Math.PI) * 5, y + Math.sin(a + Math.PI) * 5)
    ctx.lineTo(x + Math.cos(a - 2.5) * 11, y + Math.sin(a - 2.5) * 11)
    ctx.closePath()
  }

  function drawShip(now) {
    if (!ship || ship.deadUntil) return
    const invuln = now < ship.invulnUntil
    if (invuln && Math.floor(now / 125) % 2 === 0) return // respawn blink
    ctx.save()
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 14
    ctx.strokeStyle = '#d9f2ff'
    ctx.lineWidth = 1.8
    ctx.fillStyle = 'rgba(125, 211, 252, 0.08)'
    shipPath(ship.x, ship.y, ship.a)
    ctx.fill()
    ctx.stroke()
    if (thrusting) {
      // Flickering flame out the back.
      const len = 10 + Math.random() * 9
      const back = ship.a + Math.PI
      ctx.strokeStyle = '#ffb347'
      ctx.shadowColor = '#ffb347'
      ctx.beginPath()
      ctx.moveTo(ship.x + Math.cos(ship.a + 2.7) * 9, ship.y + Math.sin(ship.a + 2.7) * 9)
      ctx.lineTo(ship.x + Math.cos(back) * len, ship.y + Math.sin(back) * len)
      ctx.lineTo(ship.x + Math.cos(ship.a - 2.7) * 9, ship.y + Math.sin(ship.a - 2.7) * 9)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawRocks() {
    ctx.save()
    ctx.shadowColor = ACCENT
    ctx.shadowBlur = 10
    ctx.strokeStyle = '#9fc6e8'
    ctx.lineWidth = 1.6
    ctx.fillStyle = 'rgba(125, 211, 252, 0.045)'
    for (const r of rocks) {
      ctx.beginPath()
      for (let i = 0; i < r.verts.length; i++) {
        const a = r.rot + (i / r.verts.length) * Math.PI * 2
        const rad = r.r * r.verts[i]
        const x = r.x + Math.cos(a) * rad
        const y = r.y + Math.sin(a) * rad
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawBullets() {
    ctx.save()
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 8
    ctx.fillStyle = '#ffffff'
    for (const b of bullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, 2.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function drawDebris() {
    ctx.strokeStyle = '#d9f2ff'
    ctx.lineWidth = 1.6
    for (const s of debris) {
      ctx.globalAlpha = Math.max(0, s.life / s.max)
      ctx.beginPath()
      ctx.moveTo(s.x - (Math.cos(s.a) * s.len) / 2, s.y - (Math.sin(s.a) * s.len) / 2)
      ctx.lineTo(s.x + (Math.cos(s.a) * s.len) / 2, s.y + (Math.sin(s.a) * s.len) / 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  function drawHud() {
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `600 13px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText('SCORE', 16, 18)
    ctx.textAlign = 'center'
    ctx.fillText(`WAVE ${wave}`, W / 2, 18)
    ctx.textAlign = 'right'
    ctx.fillText('LIVES', W - 16, 18)
    ctx.fillStyle = '#eaf2ff'
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'left'
    ctx.fillText(String(score).padStart(6, '0'), 16, 33)
    // Lives as tiny ship outlines.
    ctx.strokeStyle = ACCENT
    ctx.lineWidth = 1.4
    for (let i = 0; i < lives; i++) {
      shipPath(W - 26 - i * 24, 40, -Math.PI / 2)
      ctx.stroke()
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
      ctx.fillText(`SCORE ${score} · WAVE ${wave}`, W / 2, cy + 100)
    }
    ctx.fillStyle = '#8fa3c0'
    ctx.font = `500 14px ${FONT}`
    ctx.fillText(sub, W / 2, cy + ch - 38)
  }

  function render(now) {
    ctx.clearRect(0, 0, W, H)
    drawStars(now)
    drawRocks()
    drawBullets()
    drawDebris()
    drawShip(now)

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
    }
    ctx.globalAlpha = 1
    drawHud()

    if (banner.t > 0) {
      ctx.globalAlpha = Math.min(1, banner.t / 0.4)
      ctx.fillStyle = '#c9ecff'
      ctx.font = `700 40px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(banner.text, W / 2, H / 2 - 60)
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
    if (playing && !gameOver) tick(dt, now)
    else if (playing) {
      // Keep the pyrotechnics settling behind the game-over card.
      for (const p of particles) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
      }
      particles = particles.filter((p) => p.life > 0)
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
    const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps

    ok(near(wrap(850, 800), 50), 'wrap right edge')
    ok(near(wrap(-10, 800), 790), 'wrap left edge')
    ok(near(wrap(400, 800), 400), 'wrap identity inside bounds')

    ok(near(angleDiff(1, 0), 1), 'angleDiff simple')
    ok(near(angleDiff(0.1, 0.2 + Math.PI * 2), -0.1, 1e-9), 'angleDiff normalizes turns')
    ok(Math.abs(angleDiff(3.1, -3.1)) < 0.1, 'angleDiff takes the short way around')

    ok(splitSizes(3).length === 2 && splitSizes(3)[0] === 2, 'large rock splits into mediums')
    ok(splitSizes(1).length === 0, 'small rocks vaporize')

    const still = leadPoint(0, 0, 100, 0, 0, 0, 500)
    ok(near(still.x, 100) && near(still.y, 0), 'stationary target needs no lead')
    const moving = leadPoint(0, 0, 100, 0, 0, 50, 500)
    ok(moving.y > 0 && near(moving.x, 100), 'moving target is led in its direction')

    console.log('[asteroids] selftest passed')
    document.getElementById('status').textContent = 'selftest passed ✓'
  }
})()
