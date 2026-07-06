import { describe, expect, it } from 'vitest'
import { scrollVelocity, STICK_DEADZONE } from '../src/scroll.js'

describe('scrollVelocity', () => {
  it('is zero inside the deadzone', () => {
    expect(scrollVelocity(0)).toBe(0)
    expect(scrollVelocity(STICK_DEADZONE - 0.01)).toBe(0)
    expect(scrollVelocity(-(STICK_DEADZONE - 0.01))).toBe(0)
  })

  it('stick up (negative) scrolls up (positive wheel delta)', () => {
    expect(scrollVelocity(-1)).toBeGreaterThan(0)
    expect(scrollVelocity(1)).toBeLessThan(0)
  })

  it('is monotonic: more deflection, more speed', () => {
    expect(Math.abs(scrollVelocity(1))).toBeGreaterThan(Math.abs(scrollVelocity(0.6)))
    expect(Math.abs(scrollVelocity(0.6))).toBeGreaterThan(Math.abs(scrollVelocity(0.3)))
  })

  it('quadratic curve: gentle near the deadzone', () => {
    // Halfway deflection should be well under half of max speed.
    expect(Math.abs(scrollVelocity(0.6))).toBeLessThan(Math.abs(scrollVelocity(1)) / 2)
  })
})
