// test/webview/RadialWheel.test.tsx
// Component tests for RadialWheelApp — Story 7.1

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/radial-wheel/radial-wheel.css', () => ({}))

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { RadialWheelApp } from '../../src/webview/radial-wheel/RadialWheel'
import type { WheelSegmentDef } from '../../src/shared/types'

// ─── Mock acquireVsCodeApi ────────────────────────────────────────────────────
// RadialWheelApp handles the case where acquireVsCodeApi is not available
// (falls back to window.postMessage). No setup needed here.

// ─── Test fixtures ─────────────────────────────────────────────────────────────

const mockL2Segments: WheelSegmentDef[] = [
  { index: 0, label: 'Voice PTT', commandId: 'vibesense.voicePtt' },
  { index: 1, label: 'Approve', commandId: 'vibesense.approve' },
  { index: 2, label: 'New Terminal', commandId: 'vibesense.openTerminal' },
  { index: 3, label: 'Launch Agent', commandId: 'vibesense.launchClaudeCode' },
  { index: 4, label: 'Explain This', commandId: 'vibesense.dispatchPrompt', promptText: 'Explain the selected code' },
  { index: 5, label: 'Fix This', commandId: 'vibesense.dispatchPrompt', promptText: 'Fix the issue in the selected code' },
  { index: 6, label: 'Add Tests', commandId: 'vibesense.dispatchPrompt', promptText: 'Add unit tests for the selected code' },
  { index: 7, label: 'Deny', commandId: 'vibesense.deny' },
]

/** Helper to post a host message to the component */
function postHostMessage(data: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }))
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RadialWheelApp — initial state', () => {
  // Test 1: Renders null when closed
  it('renders null when wheelState is closed (initial state)', () => {
    const { container } = render(<RadialWheelApp />)
    expect(container.firstChild).toBeNull()
  })
})

describe('RadialWheelApp — WHEEL_OPEN message', () => {
  // Test 2: Renders wheel on WHEEL_OPEN message
  it('renders wheel SVG with role="menu" on WHEEL_OPEN message', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  // Test 3: 8 segments rendered with role="menuitem"
  it('renders 8 segments with role="menuitem" when wheel is opened', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(8)
  })

  // Test 4: No segment active at open
  it('has no active segment on initial open (no stick update)', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const activeSegments = container.querySelectorAll('.wheel-segment--active')
    expect(activeSegments).toHaveLength(0)
  })
})

describe('RadialWheelApp — WHEEL_STICK_UPDATE', () => {
  // Test 5: WHEEL_STICK_UPDATE highlights segment
  it('highlights segment 0 when stick points up (x=0, y=-1.0)', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: -1.0 },
    })
    const activeSegments = container.querySelectorAll('.wheel-segment--active')
    expect(activeSegments).toHaveLength(1)
  })

  // Test 6: Dead zone — no selection
  it('does not highlight any segment when stick is in dead zone (x=0.1, y=0.1)', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0.1, y: 0.1 },
    })
    const activeSegments = container.querySelectorAll('.wheel-segment--active')
    expect(activeSegments).toHaveLength(0)
  })

  // Test 7: Preview text appears after 200ms
  it('shows preview text after 200ms hold on a segment', async () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    // Stick pointing up → segment 0 (Voice PTT)
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: -1.0 },
    })
    // Before 200ms — no preview div
    expect(container.querySelector('.radial-wheel__preview')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(200)
    })
    // After 200ms — preview div should appear
    expect(container.querySelector('.radial-wheel__preview')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('RadialWheelApp — WHEEL_CLOSE', () => {
  // Test 8: WHEEL_CLOSE collapses wheel
  it('removes wheel from DOM after 120ms on WHEEL_CLOSE', async () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    expect(container.querySelector('.radial-wheel')).toBeInTheDocument()

    postHostMessage({
      type: 'WHEEL_CLOSE',
      payload: { cancelled: false },
    })

    // During closing animation (before 120ms), element has closing class
    const closingEl = container.querySelector('.radial-wheel--closing')
    expect(closingEl).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(120)
    })
    // After 120ms, wheel should be removed from DOM
    expect(container.querySelector('.radial-wheel')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

describe('RadialWheelApp — WHEEL_SEGMENT_SELECTED', () => {
  // Test 9: WHEEL_SEGMENT_SELECTED emitted on segment change
  it('emits WHEEL_SEGMENT_SELECTED via postMessage when segment changes', () => {
    const postedMessages: unknown[] = []
    const origPostMessage = window.postMessage.bind(window)
    vi.spyOn(window, 'postMessage').mockImplementation((msg: unknown) => {
      postedMessages.push(msg)
      origPostMessage(msg, '*')
    })

    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: -1.0 }, // segment 0
    })

    const segmentSelected = postedMessages.find(
      (m): m is { type: string; payload: { segmentIndex: number } } =>
        typeof m === 'object' && m !== null && (m as { type: string }).type === 'WHEEL_SEGMENT_SELECTED',
    )
    expect(segmentSelected).toBeDefined()
    expect(segmentSelected?.payload.segmentIndex).toBe(0)

    vi.restoreAllMocks()
  })
})

describe('RadialWheelApp — ARIA attributes', () => {
  // Test 10: ARIA attributes
  it('all segments have aria-label with the segment label', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems).toHaveLength(8)
    for (const item of menuItems) {
      expect(item).toHaveAttribute('aria-label')
      const label = item.getAttribute('aria-label')
      expect(label).toBeTruthy()
    }
  })

  it('wheel container has role="menu" with aria-label', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-label', 'Radial wheel')
  })

  it('all 8 segment aria-labels use promptText when available, label otherwise', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const expectedLabels = mockL2Segments.map((s) => s.promptText ?? s.label)
    for (const label of expectedLabels) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })
})

describe('RadialWheelApp — preview text for prompt segments', () => {
  it('shows promptText in preview when a prompt segment is held for 200ms', async () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    // Stick pointing down → segment 4 (Explain This, with promptText)
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: 1.0 },
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    // Preview div should show the promptText, not just the label
    const preview = container.querySelector('.radial-wheel__preview')
    expect(preview).toBeInTheDocument()
    expect(preview?.textContent).toBe('Explain the selected code')
    vi.useRealTimers()
  })
})
