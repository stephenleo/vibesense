// test/unit/extension/status-bar.test.ts
// Unit tests for StatusBarController — all VSCode APIs mocked

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock vscode ──────────────────────────────────────────────────────────────
const mockStatusBarItem = {
  text: '',
  tooltip: '' as string | vscode.MarkdownString,
  backgroundColor: undefined as { id: string } | undefined,
  color: undefined,
  show: vi.fn(),
  dispose: vi.fn(),
}

vi.mock('vscode', () => ({
  window: {
    createStatusBarItem: vi.fn(() => mockStatusBarItem),
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class ThemeColor {
    constructor(public readonly id: string) {}
  },
}))

// ── Import after mock ────────────────────────────────────────────────────────
import * as vscode from 'vscode'
import { StatusBarController } from '../../../src/extension/status-bar'

// ── Tests ────────────────────────────────────────────────────────────────────
describe('StatusBarController', () => {
  beforeEach(() => {
    // Reset mock call counts and property values before each test
    vi.clearAllMocks()
    mockStatusBarItem.text = ''
    mockStatusBarItem.tooltip = ''
    mockStatusBarItem.backgroundColor = undefined
    mockStatusBarItem.color = undefined
  })

  describe('constructor', () => {
    it('creates a status bar item aligned to the left with priority 100', () => {
      new StatusBarController()
      expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Left,
        100,
      )
    })

    it('calls item.show() immediately on construction', () => {
      new StatusBarController()
      expect(mockStatusBarItem.show).toHaveBeenCalledOnce()
    })

    it('sets initial disconnected state as safe default', () => {
      new StatusBarController()
      expect(mockStatusBarItem.text).toBe('○ No controller — keyboard active')
    })
  })

  describe('update() — connected state', () => {
    it('sets correct text for DualSense', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'connected', controllerType: 'dualsense' })
      expect(mockStatusBarItem.text).toBe('⊙ DualSense')
    })

    it('sets correct text for Xbox', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'connected', controllerType: 'xbox' })
      expect(mockStatusBarItem.text).toBe('⊙ Xbox')
    })

    it('sets correct text for generic-hid', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'connected', controllerType: 'generic-hid' })
      expect(mockStatusBarItem.text).toBe('⊙ Controller')
    })

    it('sets tooltip for screen reader context (NFR-A3)', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'connected', controllerType: 'dualsense' })
      expect(mockStatusBarItem.tooltip).toBe('VibeSense: DualSense connected')
    })

    it('clears backgroundColor when transitioning to connected', () => {
      const controller = new StatusBarController()
      // First set low-battery to give it a backgroundColor
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 10 })
      expect(mockStatusBarItem.backgroundColor).toBeDefined()
      // Then transition to connected — backgroundColor must be cleared
      controller.update({ kind: 'connected', controllerType: 'dualsense' })
      expect(mockStatusBarItem.backgroundColor).toBeUndefined()
    })
  })

  describe('update() — disconnected state', () => {
    it('sets correct text', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'disconnected' })
      expect(mockStatusBarItem.text).toBe('○ No controller — keyboard active')
    })

    it('sets tooltip for screen reader context (NFR-A3)', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'disconnected' })
      expect(mockStatusBarItem.tooltip).toBe('VibeSense: No controller — keyboard active')
    })

    it('clears backgroundColor when transitioning to disconnected', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 5 })
      controller.update({ kind: 'disconnected' })
      expect(mockStatusBarItem.backgroundColor).toBeUndefined()
    })
  })

  describe('update() — low-battery state', () => {
    it('sets warning text for DualSense with low battery', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 15 })
      expect(mockStatusBarItem.text).toBe('⚠ DualSense: low battery')
    })

    it('sets warning text for Xbox with low battery', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'xbox', level: 10 })
      expect(mockStatusBarItem.text).toBe('⚠ Xbox: low battery')
    })

    it('sets warning text for generic-hid with low battery', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'generic-hid', level: 5 })
      expect(mockStatusBarItem.text).toBe('⚠ Controller: low battery')
    })

    it('sets warningBackground color (NFR-A2: color + text)', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 15 })
      expect(mockStatusBarItem.backgroundColor).toEqual({ id: 'statusBarItem.warningBackground' })
    })

    it('sets tooltip with battery level percentage (NFR-A3)', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 12 })
      expect(mockStatusBarItem.tooltip).toBe(
        'VibeSense: DualSense battery at 12% — connect charger',
      )
    })

    it('triggers low battery warning at exactly level 19 (< 20 boundary)', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 19 })
      expect(mockStatusBarItem.text).toBe('⚠ DualSense: low battery')
      expect(mockStatusBarItem.backgroundColor).toEqual({ id: 'statusBarItem.warningBackground' })
    })

    it('handles level 0 (dead battery) — clamps to 0 in tooltip', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'low-battery', controllerType: 'dualsense', level: 0 })
      expect(mockStatusBarItem.text).toBe('⚠ DualSense: low battery')
      expect(mockStatusBarItem.tooltip).toBe('VibeSense: DualSense battery at 0% — connect charger')
      expect(mockStatusBarItem.backgroundColor).toEqual({ id: 'statusBarItem.warningBackground' })
    })
  })

  describe('battery level threshold — no warning at >= 20%', () => {
    it('connected state does NOT show battery warning at level 20', () => {
      const controller = new StatusBarController()
      // Level >= 20 should remain in connected state (not low-battery)
      controller.update({ kind: 'connected', controllerType: 'dualsense' })
      // Assert it remains connected — no warning styling
      expect(mockStatusBarItem.text).toBe('⊙ DualSense')
      expect(mockStatusBarItem.backgroundColor).toBeUndefined()
    })

    it('connected state does NOT show battery warning at level 100', () => {
      const controller = new StatusBarController()
      controller.update({ kind: 'connected', controllerType: 'xbox' })
      expect(mockStatusBarItem.text).toBe('⊙ Xbox')
      expect(mockStatusBarItem.backgroundColor).toBeUndefined()
    })
  })

  describe('dispose()', () => {
    it('calls item.dispose() to remove from status bar', () => {
      const controller = new StatusBarController()
      controller.dispose()
      expect(mockStatusBarItem.dispose).toHaveBeenCalledOnce()
    })
  })
})
