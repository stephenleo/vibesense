import { describe, expect, it } from 'vitest'
import { Deduper } from '../src/controller/hal.js'
import { normalizeGenericAxis, parseGenericReport } from '../src/controller/generic-driver.js'
import { parseXboxReport } from '../src/controller/xbox-driver.js'
import type { ControllerEvent } from '../src/types.js'

function buttons(events: ControllerEvent[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const e of events) if (e.kind === 'button') map.set(e.button, e.pressed)
  return map
}

function axes(events: ControllerEvent[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const e of events) if (e.kind === 'axis') map.set(e.axis, e.value)
  return map
}

describe('parseXboxReport', () => {
  function report(overrides: Record<number, number> = {}): Buffer {
    const data = Buffer.alloc(16)
    for (const [index, value] of Object.entries(overrides)) data[Number(index)] = value
    return data
  }

  it('parses face buttons from byte 2', () => {
    const b = buttons(parseXboxReport(report({ 2: 0x01 | 0x08 })))
    expect(b.get('south')).toBe(true)
    expect(b.get('north')).toBe(true)
    expect(b.get('east')).toBe(false)
    expect(b.get('west')).toBe(false)
  })

  it('parses the d-pad hat value including diagonals', () => {
    expect(buttons(parseXboxReport(report({ 3: 1 }))).get('dpad_up')).toBe(true)
    expect(buttons(parseXboxReport(report({ 3: 2 }))).get('dpad_up')).toBe(true)
    expect(buttons(parseXboxReport(report({ 3: 2 }))).get('dpad_right')).toBe(true)
    expect(buttons(parseXboxReport(report({ 3: 5 }))).get('dpad_down')).toBe(true)
    expect(buttons(parseXboxReport(report({ 3: 0 }))).get('dpad_up')).toBe(false)
  })

  it('treats a >50% trigger as an r2 button press', () => {
    const pressed = report({ 6: 0xff, 7: 0x03 }) // 1023 = fully pulled
    expect(buttons(parseXboxReport(pressed)).get('r2')).toBe(true)
    expect(axes(parseXboxReport(pressed)).get('r2')).toBe(1)
    expect(buttons(parseXboxReport(report())).get('r2')).toBe(false)
  })

  it('normalizes stick int16 values to -1..1', () => {
    const data = report()
    data.writeInt16LE(-32768, 8)
    data.writeInt16LE(32767, 10)
    const a = axes(parseXboxReport(data))
    expect(a.get('left_x')).toBe(-1)
    expect(a.get('left_y')).toBe(1)
  })

  it('returns nothing for short reports', () => {
    expect(parseXboxReport(Buffer.alloc(8))).toEqual([])
  })
})

describe('parseGenericReport', () => {
  it('parses button bitmask and centered axes', () => {
    const events = parseGenericReport(Buffer.from([0b00000001, 0, 0, 255, 128, 0]))
    expect(buttons(events).get('south')).toBe(true)
    expect(buttons(events).get('east')).toBe(false)
    expect(axes(events).get('left_y')).toBeCloseTo(0.992, 2)
    expect(axes(events).get('right_x')).toBe(0)
  })

  it('normalizeGenericAxis centers at 128', () => {
    expect(normalizeGenericAxis(128)).toBe(0)
    expect(normalizeGenericAxis(0)).toBe(-1)
    expect(normalizeGenericAxis(255)).toBeCloseTo(0.992, 2)
  })
})

describe('Deduper', () => {
  it('passes state changes and drops repeats', () => {
    const d = new Deduper()
    const press: ControllerEvent = { kind: 'button', button: 'south', pressed: true }
    expect(d.filter(press)).toEqual(press)
    expect(d.filter(press)).toBeNull()
    expect(d.filter({ kind: 'button', button: 'south', pressed: false })).not.toBeNull()
  })

  it('resets state on disconnect so reconnect re-emits', () => {
    const d = new Deduper()
    const press: ControllerEvent = { kind: 'button', button: 'south', pressed: true }
    d.filter(press)
    d.filter({ kind: 'disconnected' })
    expect(d.filter(press)).toEqual(press)
  })
})
