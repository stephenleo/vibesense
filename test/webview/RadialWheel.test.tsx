// test/webview/RadialWheel.test.tsx
// Component tests for RadialWheelApp — Story 7.1 + Story 7.2 (dual-wheel)

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

const mockR2Segments: WheelSegmentDef[] = [
  { index: 0, label: 'Refactor', commandId: 'vibesense.dispatchPrompt', promptText: 'Refactor the selected code for clarity and efficiency' },
  { index: 1, label: 'Summarize', commandId: 'vibesense.dispatchPrompt', promptText: 'Summarize what this code does in plain English' },
  { index: 2, label: 'Document', commandId: 'vibesense.dispatchPrompt', promptText: 'Add JSDoc comments to the selected code' },
  { index: 3, label: 'Optimize', commandId: 'vibesense.dispatchPrompt', promptText: 'Optimize the selected code for performance' },
  { index: 4, label: 'Review', commandId: 'vibesense.dispatchPrompt', promptText: 'Review the selected code for bugs and issues' },
  { index: 5, label: 'Simplify', commandId: 'vibesense.dispatchPrompt', promptText: 'Simplify the selected code' },
  { index: 6, label: 'Convert', commandId: 'vibesense.dispatchPrompt', promptText: 'Convert the selected code to TypeScript with strict types' },
  { index: 7, label: 'Git Commit', commandId: 'vibesense.dispatchPrompt', promptText: 'Write a concise conventional commit message for my changes' },
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
  // Test 2: Renders wheel on WHEEL_OPEN message (dual-wheel: two SVG menus present)
  it('renders L2 Smart wheel SVG with role="menu" on WHEEL_OPEN message', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    expect(screen.getByRole('menu', { name: 'L2 Smart wheel' })).toBeInTheDocument()
  })

  // Test 3: 8 segments rendered with role="menuitem" (L2 only, r2Segments empty)
  it('renders 8 segments with role="menuitem" when L2 wheel is opened (r2 empty)', () => {
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

  it('L2 wheel SVG has role="menu" with aria-label "L2 Smart wheel"', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: [] },
    })
    const menu = screen.getByRole('menu', { name: 'L2 Smart wheel' })
    expect(menu).toHaveAttribute('aria-label', 'L2 Smart wheel')
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

// ─── Story 7.2 — Dual Wheel Tests ─────────────────────────────────────────────

describe('Story 7.2 — Dual Wheel rendering', () => {
  // Test 7.2-1: Both wheels render when wheel is open (R2 active)
  it('renders both L2 and R2 wheel SVGs when opened with R2 active', () => {
    render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    expect(screen.getByRole('menu', { name: 'L2 Smart wheel' })).toBeInTheDocument()
    expect(screen.getByRole('menu', { name: 'R2 Personal wheel' })).toBeInTheDocument()
  })

  // Test 7.2-2: R2 active → R2 wrapper has active class, L2 wrapper has inactive class
  it('R2 wheel wrapper has active class and L2 has inactive class when R2 is active', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    const r2Wrapper = container.querySelector('.radial-wheel__wheel--r2')
    const l2Wrapper = container.querySelector('.radial-wheel__wheel--l2')
    expect(r2Wrapper).toHaveClass('radial-wheel__wheel--active')
    expect(l2Wrapper).toHaveClass('radial-wheel__wheel--inactive')
  })

  // Test 7.2-3: L2 active → L2 wrapper has active class, R2 wrapper has inactive class
  it('L2 wheel wrapper has active class and R2 has inactive class when L2 is active', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    const l2Wrapper = container.querySelector('.radial-wheel__wheel--l2')
    const r2Wrapper = container.querySelector('.radial-wheel__wheel--r2')
    expect(l2Wrapper).toHaveClass('radial-wheel__wheel--active')
    expect(r2Wrapper).toHaveClass('radial-wheel__wheel--inactive')
  })

  // Test 7.2-4: Right stick navigation controls active (R2) wheel only
  it('right stick navigation highlights segment in R2 wheel only when R2 is active', () => {
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: -1.0 }, // segment 0
    })
    // R2 wheel should have one active segment
    const r2Wrapper = container.querySelector('.radial-wheel__wheel--r2')
    const l2Wrapper = container.querySelector('.radial-wheel__wheel--l2')
    expect(r2Wrapper?.querySelectorAll('.wheel-segment--active')).toHaveLength(1)
    expect(l2Wrapper?.querySelectorAll('.wheel-segment--active')).toHaveLength(0)
  })

  // Test 7.2-5: Trigger swap — WHEEL_OPEN with new activeWheel while open triggers swap class
  it('container gets radial-wheel--swapping class on trigger swap and it clears after 50ms', () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    // Open with L2
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    // Swap to R2
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    expect(container.querySelector('.radial-wheel--swapping')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(container.querySelector('.radial-wheel--swapping')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  // Test 7.2-6: Swap resets stick selection
  it('swap to R2 resets selection — no active segment in R2 wheel after swap', () => {
    const { container } = render(<RadialWheelApp />)
    // Open with L2 and select segment 2
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 1.0, y: 0 }, // segment 2 (right)
    })
    // Swap to R2
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    const r2Wrapper = container.querySelector('.radial-wheel__wheel--r2')
    expect(r2Wrapper?.querySelectorAll('.wheel-segment--active')).toHaveLength(0)
  })

  // Test 7.2-7: Preview text shows for active wheel's segment only (R2 active)
  it('preview text shows R2 segment promptText (not L2) when R2 is active', () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'r2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    postHostMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x: 0, y: -1.0 }, // segment 0
    })
    act(() => {
      vi.advanceTimersByTime(200)
    })
    const preview = container.querySelector('.radial-wheel__preview')
    expect(preview).toBeInTheDocument()
    // R2 segment 0 promptText = 'Refactor the selected code for clarity and efficiency'
    expect(preview?.textContent).toBe('Refactor the selected code for clarity and efficiency')
    vi.useRealTimers()
  })

  // Test 7.2-8: Both wheels collapse on WHEEL_CLOSE
  it('both wheel containers are removed from DOM after 120ms on WHEEL_CLOSE', () => {
    vi.useFakeTimers()
    const { container } = render(<RadialWheelApp />)
    postHostMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: 'l2', l2Segments: mockL2Segments, r2Segments: mockR2Segments },
    })
    expect(container.querySelector('.radial-wheel__wheel--l2')).toBeInTheDocument()
    expect(container.querySelector('.radial-wheel__wheel--r2')).toBeInTheDocument()

    postHostMessage({
      type: 'WHEEL_CLOSE',
      payload: { cancelled: false },
    })
    // During close animation
    expect(container.querySelector('.radial-wheel--closing')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(120)
    })
    // After 120ms, entire wheel (including both sub-wheels) removed from DOM
    expect(container.querySelector('.radial-wheel__wheel--l2')).not.toBeInTheDocument()
    expect(container.querySelector('.radial-wheel__wheel--r2')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
