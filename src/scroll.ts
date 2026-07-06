// Terminal scrollback control. Pty writes reach claude, not the emulator's
// viewport, so scrolling is synthesized at the OS level: a tiny Swift helper
// posts pixel scroll-wheel events (smooth), compiled on demand with swiftc.
// Falls back to osascript Page Up/Down key events (choppy but dependable)
// when the helper can't be built. Both need Accessibility permission.

import { execFile, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './logger.js'

const HELPER_SRC = fileURLToPath(new URL('../helpers/scroll-helper.swift', import.meta.url))
const HELPER_BIN = path.join(os.homedir(), '.vibesense', 'scroll-helper')

const TICK_MS = 16 // ~60Hz
const MAX_PIXELS_PER_SEC = 2500
export const STICK_DEADZONE = 0.2

/**
 * Velocity curve: stick value (-1..1) → scroll pixels/sec (signed).
 * Quadratic response gives fine control near the deadzone and speed at full
 * deflection. Stick up (negative) scrolls up (positive wheel delta).
 */
export function scrollVelocity(stickValue: number): number {
  const magnitude = Math.abs(stickValue)
  if (magnitude < STICK_DEADZONE) return 0
  const t = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE)
  return -Math.sign(stickValue) * t * t * MAX_PIXELS_PER_SEC
}

const PAGE_KEY_CODES = { up: 116, down: 121 }

function pageScrollFallback(direction: 'up' | 'down'): void {
  execFile(
    'osascript',
    ['-e', `tell application "System Events" to key code ${PAGE_KEY_CODES[direction]}`],
    (err) => {
      if (err) logger.warn('page-scroll fallback failed', err)
    },
  )
}

/**
 * Drives smooth scrolling from the right stick. setValue() with the live stick
 * value; a 60Hz tick streams fractional pixel deltas to the helper.
 */
export class SmoothScroller {
  private helper: ChildProcess | null = null
  private helperReady = false
  private value = 0
  private carry = 0
  private tick: ReturnType<typeof setInterval> | null = null
  private lastPageAt = 0
  private warned = false

  /** Compile (if needed) and launch the scroll helper. Safe to call once at startup. */
  start(): void {
    if (process.platform !== 'darwin') return
    const launch = (): void => {
      this.helper = spawn(HELPER_BIN, [], { stdio: ['pipe', 'ignore', 'ignore'] })
      this.helper.on('error', (err) => {
        logger.warn('scroll helper failed to start — falling back to page scroll', err)
        this.helper = null
      })
      this.helper.on('exit', () => (this.helper = null))
      this.helperReady = true
    }

    const srcTime = fs.existsSync(HELPER_SRC) ? fs.statSync(HELPER_SRC).mtimeMs : 0
    const binTime = fs.existsSync(HELPER_BIN) ? fs.statSync(HELPER_BIN).mtimeMs : -1
    if (binTime > srcTime) {
      launch()
      return
    }
    fs.mkdirSync(path.dirname(HELPER_BIN), { recursive: true })
    execFile('swiftc', ['-O', '-o', HELPER_BIN, HELPER_SRC], (err) => {
      if (err) {
        logger.warn('swiftc unavailable — scroll uses page fallback', err)
        return
      }
      launch()
    })
  }

  stop(): void {
    this.setValue(0)
    this.helper?.kill()
    this.helper = null
  }

  /** Feed the current right-stick Y value (-1..1). */
  setValue(stickValue: number): void {
    this.value = stickValue
    const active = scrollVelocity(stickValue) !== 0
    if (active && !this.tick) {
      this.tick = setInterval(() => this.emitDelta(), TICK_MS)
      this.tick.unref()
    } else if (!active && this.tick) {
      clearInterval(this.tick)
      this.tick = null
      this.carry = 0
    }
  }

  private emitDelta(): void {
    const velocity = scrollVelocity(this.value)
    if (velocity === 0) return

    if (this.helper?.stdin?.writable) {
      this.carry += (velocity * TICK_MS) / 1000
      const whole = Math.trunc(this.carry)
      if (whole !== 0) {
        this.carry -= whole
        this.helper.stdin.write(`${whole}\n`)
      }
      return
    }

    if (!this.helperReady && !this.warned) {
      this.warned = true
      logger.warn('smooth scroll helper not ready — using page scroll')
    }
    // Fallback: page-wise, rate-limited like a key repeat.
    const now = Date.now()
    if (now - this.lastPageAt > 350) {
      this.lastPageAt = now
      pageScrollFallback(velocity > 0 ? 'up' : 'down')
    }
  }
}
