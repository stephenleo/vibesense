// test/unit/output/dnd-controller.test.ts
// Unit tests for DndController — Do Not Disturb suppression logic (Story 6.5)
// Tests: suppression logic, threshold boundary, config error fallback, forPriority()

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Hoisted mocks (vi.hoisted runs before vi.mock hoisting) ──────────────────
const { mockGetConfiguration, mockLogger } = vi.hoisted(() => ({
  mockGetConfiguration: vi.fn(),
  mockLogger: { info: vi.fn(), error: vi.fn() },
}))

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: mockGetConfiguration,
  },
}))

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../src/extension/logger', () => ({ logger: mockLogger }))

// ── Import after mocks ────────────────────────────────────────────────────────
import { DndController } from '../../../src/extension/output/dnd-controller'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a mock config object returned by vscode.workspace.getConfiguration().
 */
function buildMockConfig(dndEnabled: boolean, dndThreshold: string): { get: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn((key: string, defaultVal?: unknown) => {
      if (key === 'dndEnabled') return dndEnabled
      if (key === 'dndThreshold') return dndThreshold
      return defaultVal
    }),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DndController', () => {
  let dndController: DndController

  beforeEach(() => {
    vi.clearAllMocks()
    dndController = new DndController()
  })

  // Test 1: DND disabled → never suppress
  it('returns false for any priority when DND is disabled', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(false, 'high'))

    expect(dndController.isDndSuppressed('low')).toBe(false)
    expect(dndController.isDndSuppressed('normal')).toBe(false)
    expect(dndController.isDndSuppressed('high')).toBe(false)
  })

  // Test 2: DND enabled, threshold='high', priority='normal' → suppressed
  it('suppresses normal priority when DND is enabled with threshold=high', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))

    expect(dndController.isDndSuppressed('normal')).toBe(true)
  })

  // Test 3: DND enabled, threshold='high', priority='high' → not suppressed
  it('does NOT suppress high priority when DND is enabled with threshold=high (AC2: error always passes through)', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))

    expect(dndController.isDndSuppressed('high')).toBe(false)
  })

  // Test 4: DND enabled, threshold='normal', priority='low' → suppressed
  it('suppresses low priority when DND is enabled with threshold=normal', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'normal'))

    expect(dndController.isDndSuppressed('low')).toBe(true)
  })

  // Test 5: DND enabled, threshold='normal', priority='normal' → not suppressed (at threshold passes through)
  it('does NOT suppress normal priority when DND threshold=normal (threshold is exclusive — events AT threshold pass through)', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'normal'))

    expect(dndController.isDndSuppressed('normal')).toBe(false)
  })

  // Test 6: DND enabled, threshold='low', priority='low' → not suppressed (at threshold)
  it('does NOT suppress low priority when DND threshold=low (at threshold)', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'low'))

    expect(dndController.isDndSuppressed('low')).toBe(false)
  })

  // Test 7: Config read throws → returns false (fail open)
  it('returns false and logs error when getConfiguration throws (fail open)', () => {
    mockGetConfiguration.mockImplementation(() => {
      throw new Error('config read error')
    })

    const result = dndController.isDndSuppressed('normal')

    expect(result).toBe(false)
    expect(mockLogger.error).toHaveBeenCalledWith(
      'DndController: failed to read config — defaulting to not suppressed',
      expect.any(Error),
    )
  })

  // Test 8: forPriority() returns correct callback
  it('forPriority() returns a callback that calls isDndSuppressed with the bound priority', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))

    const callback = dndController.forPriority('normal')
    expect(typeof callback).toBe('function')

    // Calling the returned function should suppress 'normal' when threshold='high'
    expect(callback()).toBe(true)

    // Verify reads config live on each call
    mockGetConfiguration.mockReturnValue(buildMockConfig(false, 'high'))
    expect(callback()).toBe(false) // DND now disabled
  })

  // Additional: logs info when suppressing
  it('logs info when suppressing feedback', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))

    dndController.isDndSuppressed('normal')

    expect(mockLogger.info).toHaveBeenCalledWith(
      'DndController: suppressing normal feedback (threshold=high)',
    )
  })

  // Additional: does NOT log when not suppressing
  it('does not log info when not suppressing', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))

    dndController.isDndSuppressed('high')

    expect(mockLogger.info).not.toHaveBeenCalled()
  })

  // Additional: DND disabled with threshold=high — still no suppression (enabled takes precedence)
  it('does not suppress low priority when dndEnabled=false even with threshold=high', () => {
    mockGetConfiguration.mockReturnValue(buildMockConfig(false, 'high'))

    expect(dndController.isDndSuppressed('low')).toBe(false)
  })

  // Additional: error state (high priority) always passes through — AC2
  it('does NOT suppress high priority regardless of threshold (AC2: error state always passes through)', () => {
    // Even with threshold='high' — 2 < 2 = false
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'high'))
    expect(dndController.isDndSuppressed('high')).toBe(false)

    // Also with threshold='normal'
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'normal'))
    expect(dndController.isDndSuppressed('high')).toBe(false)

    // Also with threshold='low'
    mockGetConfiguration.mockReturnValue(buildMockConfig(true, 'low'))
    expect(dndController.isDndSuppressed('high')).toBe(false)
  })
})
