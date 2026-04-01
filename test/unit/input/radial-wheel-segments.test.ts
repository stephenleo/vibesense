// test/unit/input/radial-wheel-segments.test.ts
// Unit tests for loadR2PersonalSegments — Story 7.4

import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { mockLogger } = vi.hoisted(() => {
  return {
    mockLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }
})

// ── Mock fs ───────────────────────────────────────────────────────────────────
vi.mock('node:fs')

// ── Mock logger ────────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({
  logger: mockLogger,
}))

// ── Imports after mocks ────────────────────────────────────────────────────────
import { loadR2PersonalSegments, R2_PERSONAL_WHEEL_SEGMENTS } from '../../../src/extension/input/radial-wheel-segments'

// ── Mock dispatch tracker ──────────────────────────────────────────────────────

function makeMockDispatchTracker(countMap: Record<number, number> = {}) {
  return {
    getCount: vi.fn((index: number) => countMap[index] ?? 0),
    increment: vi.fn().mockResolvedValue(undefined),
    computeLabelMode: vi.fn((index: number, forceIconOnly: boolean) => {
      if (forceIconOnly) return 'icon-only'
      const count = countMap[index] ?? 0
      if (count >= 15) return 'icon-only'
      if (count >= 5) return 'abbreviated'
      return 'full'
    }),
  }
}

const WORKSPACE_ROOT = '/fake/workspace'
const PROFILE_PATH = path.join(WORKSPACE_ROOT, '.vscode', 'vibesense.json')

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('loadR2PersonalSegments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // ── AC6: File missing / ENOENT ────────────────────────────────────────────────

  describe('ENOENT — file missing (AC6)', () => {
    it('falls back to R2_PERSONAL_WHEEL_SEGMENTS defaults silently when vibesense.json is absent', () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw enoent })

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result).toHaveLength(8)
      expect(result[0].promptText).toBe(R2_PERSONAL_WHEEL_SEGMENTS[0].promptText)
      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('does not throw on ENOENT', () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw enoent })

      const tracker = makeMockDispatchTracker()
      expect(() => loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)).not.toThrow()
    })
  })

  // ── Malformed JSON ────────────────────────────────────────────────────────────

  describe('malformed JSON', () => {
    it('falls back to defaults and does not throw on malformed JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{')

      const tracker = makeMockDispatchTracker()
      expect(() => loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)).not.toThrow()
    })

    it('falls back to R2_PERSONAL_WHEEL_SEGMENTS defaults on malformed JSON', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{')

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)
      expect(result).toHaveLength(8)
      expect(result[0].promptText).toBe(R2_PERSONAL_WHEEL_SEGMENTS[0].promptText)
    })

    it('logs a warning on non-ENOENT read errors', () => {
      vi.mocked(fs.readFileSync).mockReturnValue('not valid json {{{')

      const tracker = makeMockDispatchTracker()
      loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('loadR2PersonalSegments'),
        expect.anything(),
      )
    })
  })

  // ── AC1: Custom segments from vibesense.json ──────────────────────────────────

  describe('AC1: custom segments from vibesense.json', () => {
    it('uses custom prompt texts from radialWheel.segments array at correct index positions', () => {
      const customSegments = [
        'fix this',
        'explain this',
        'add tests',
        'commit',
        'review',
        'document',
        'refactor',
        'optimize',
      ]
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: customSegments } }),
      )

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].promptText).toBe('fix this')
      expect(result[1].promptText).toBe('explain this')
      expect(result[2].promptText).toBe('add tests')
      expect(result[3].promptText).toBe('commit')
    })

    it('reads the correct file path (.vscode/vibesense.json)', () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw enoent })

      const tracker = makeMockDispatchTracker()
      loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(vi.mocked(fs.readFileSync)).toHaveBeenCalledWith(PROFILE_PATH, 'utf-8')
    })
  })

  // ── AC6: Missing segments fall back to defaults ───────────────────────────────

  describe('AC6: partial segments — missing positions fall back to defaults', () => {
    it('uses default promptText for indices beyond the provided array length', () => {
      // Only provide 3 custom segments
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['custom-0', 'custom-1', 'custom-2'] } }),
      )

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].promptText).toBe('custom-0')
      expect(result[1].promptText).toBe('custom-1')
      expect(result[2].promptText).toBe('custom-2')
      // Index 3 and beyond should fall back to defaults
      expect(result[3].promptText).toBe(R2_PERSONAL_WHEEL_SEGMENTS[3].promptText)
      expect(result[7].promptText).toBe(R2_PERSONAL_WHEEL_SEGMENTS[7].promptText)
    })

    it('does not throw when radialWheel.segments is not present', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ profile: 'claude-code' }))

      const tracker = makeMockDispatchTracker()
      expect(() => loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)).not.toThrow()
    })
  })

  // ── promptText always contains full prompt text ───────────────────────────────

  describe('promptText always contains full prompt text', () => {
    it('promptText always equals the full custom prompt regardless of labelMode', () => {
      const customSegments = ['Fix this now', 'explain', 'test', 'commit', 'review', 'doc', 'refactor', 'opt']
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: customSegments } }),
      )

      // High dispatch count — label will be 'icon-only' → "1", but promptText stays full
      const tracker = makeMockDispatchTracker({ 0: 20 })
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].promptText).toBe('Fix this now')
      expect(result[0].label).toBe('1')       // icon-only digit
      expect(result[0].labelMode).toBe('icon-only')
    })
  })

  // ── label reflects labelMode ──────────────────────────────────────────────────

  describe('label reflects labelMode', () => {
    it("label equals full prompt text when labelMode is 'full'", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['Fix this bug'] } }),
      )

      // count = 0 → 'full'
      const tracker = makeMockDispatchTracker({ 0: 0 })
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].labelMode).toBe('full')
      expect(result[0].label).toBe('Fix this bug')
    })

    it("label is the first word (≤8 chars) when labelMode is 'abbreviated'", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['Refactor the code'] } }),
      )

      // count = 5 → 'abbreviated'
      const tracker = makeMockDispatchTracker({ 0: 5 })
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].labelMode).toBe('abbreviated')
      expect(result[0].label).toBe('Refactor')  // first word, ≤8 chars
    })

    it("abbreviated label truncates to 8 chars when first word is longer", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['Optimization for performance'] } }),
      )

      const tracker = makeMockDispatchTracker({ 0: 5 })
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].labelMode).toBe('abbreviated')
      expect(result[0].label).toBe('Optimiza')   // 8-char slice of "Optimization"
      expect(result[0].label.length).toBeLessThanOrEqual(8)
    })

    it("label is digit '1'–'8' when labelMode is 'icon-only'", () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['Fix this', 'Explain', 'Tests', 'Commit', 'Review', 'Doc', 'Refactor', 'Opt'] } }),
      )

      // All at count 15+ → icon-only
      const countMap: Record<number, number> = {}
      for (let i = 0; i < 8; i++) countMap[i] = 15
      const tracker = makeMockDispatchTracker(countMap)
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      for (let i = 0; i < 8; i++) {
        expect(result[i].labelMode).toBe('icon-only')
        expect(result[i].label).toBe(`${i + 1}`)  // "1"–"8"
      }
    })

    it('label is digit when forceIconOnly = true regardless of count', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['Fix this bug'] } }),
      )

      // count = 0, but forceIconOnly = true
      const tracker = makeMockDispatchTracker({ 0: 0 })
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, true)

      expect(result[0].labelMode).toBe('icon-only')
      expect(result[0].label).toBe('1')
    })
  })

  // ── commandId preserved from defaults ─────────────────────────────────────────

  describe('commandId preserved from defaults', () => {
    it('preserves commandId from R2_PERSONAL_WHEEL_SEGMENTS even when custom prompt is set', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: ['my custom prompt'] } }),
      )

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)

      expect(result[0].commandId).toBe(R2_PERSONAL_WHEEL_SEGMENTS[0].commandId)
    })
  })

  // ── Returns exactly 8 segments ────────────────────────────────────────────────

  describe('always returns 8 segments', () => {
    it('returns exactly 8 segments when vibesense.json is absent', () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw enoent })

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)
      expect(result).toHaveLength(8)
    })

    it('returns exactly 8 segments when all custom prompts are provided', () => {
      const segs = Array.from({ length: 8 }, (_, i) => `custom ${i}`)
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({ radialWheel: { segments: segs } }),
      )

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)
      expect(result).toHaveLength(8)
    })

    it('segment indices are 0–7', () => {
      const enoent = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      vi.mocked(fs.readFileSync).mockImplementation(() => { throw enoent })

      const tracker = makeMockDispatchTracker()
      const result = loadR2PersonalSegments(WORKSPACE_ROOT, tracker as never, false)
      const indices = result.map((s) => s.index)
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    })
  })
})
