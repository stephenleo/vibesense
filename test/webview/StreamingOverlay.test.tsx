// test/webview/StreamingOverlay.test.tsx
// Unit tests for StreamingOverlay component (Story 10.1, Story 10.3)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/hud/hud.css', () => ({}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StreamingOverlay } from '../../src/webview/hud/StreamingOverlay'
import type { Session, WheelSegmentDef } from '../../src/shared/types'

// jsdom does not implement window.matchMedia — provide a minimal stub
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const emptySessions: Session[] = []
const emptyBindings: Record<string, string> = {}

// Default wheel-closed props (Story 10.3 new required props)
const defaultWheelProps = {
  wheelOpen: false,
  wheelActiveWheel: 'l2' as const,
  wheelL2Segments: [] as WheelSegmentDef[],
  wheelR2Segments: [] as WheelSegmentDef[],
  wheelSelectedIndex: -1,
  wheelIsClosing: false,
  wheelDispatched: false,
}

describe('StreamingOverlay — basic rendering', () => {
  it('renders CINEMA band with correct role and aria-label', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(screen.getByRole('region', { name: 'VibeSense Streaming Overlay' })).toBeInTheDocument()
  })

  it('renders CINEMA badge text', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(screen.getByText('CINEMA')).toBeInTheDocument()
  })

  it('applies streaming-overlay CSS class to root element', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-overlay')).toBeInTheDocument()
  })

  it('renders CINEMA badge with streaming-badge CSS class', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-badge')).toBeInTheDocument()
  })
})

describe('StreamingOverlay — session indicator dots (AC2, UX-DR4)', () => {
  it('renders one dot per session', () => {
    const sessions: Session[] = [
      { sessionId: 'a', agentState: 'idle' },
      { sessionId: 'b', agentState: 'processing' },
    ]
    const { container } = render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelectorAll('.streaming-session-dot')).toHaveLength(2)
  })

  it('renders no dots when sessions array is empty', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={[]}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelectorAll('.streaming-session-dot')).toHaveLength(0)
  })

  it('applies --processing class for processing state', () => {
    const sessions: Session[] = [{ sessionId: 's1', agentState: 'processing' }]
    const { container } = render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-session-dot--processing')).toBeInTheDocument()
  })

  it('applies --needs-input class for needs-input state', () => {
    const sessions: Session[] = [{ sessionId: 's1', agentState: 'needs-input' }]
    const { container } = render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-session-dot--needs-input')).toBeInTheDocument()
  })

  it('applies --idle class for idle state', () => {
    const sessions: Session[] = [{ sessionId: 's1', agentState: 'idle' }]
    const { container } = render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-session-dot--idle')).toBeInTheDocument()
  })

  it('applies --error class for error state', () => {
    const sessions: Session[] = [{ sessionId: 's1', agentState: 'error' }]
    const { container } = render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(container.querySelector('.streaming-session-dot--error')).toBeInTheDocument()
  })

  it('uses session label in aria-label when provided', () => {
    const sessions: Session[] = [{ sessionId: 's1', agentState: 'processing', label: 'Claude' }]
    render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    const dot = screen.getByLabelText('Session Claude: processing')
    expect(dot).toBeInTheDocument()
  })

  it('falls back to sessionId in aria-label when label not provided', () => {
    const sessions: Session[] = [{ sessionId: 'session-123', agentState: 'idle' }]
    render(
      <StreamingOverlay
        sessions={sessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    const dot = screen.getByLabelText('Session session-123: idle')
    expect(dot).toBeInTheDocument()
  })
})

describe('StreamingOverlay — button-map section (AC4)', () => {
  it('renders ButtonMap with guided bindings when bindings provided', () => {
    const bindings: Record<string, string> = {
      cross: 'vibesense.approve',
      circle: 'vibesense.deny',
    }
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={bindings}
        controllerType="dualsense"
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    // ButtonMap renders labels for known commands
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Deny')).toBeInTheDocument()
  })

  it('shows "No bindings configured" when bindings is empty', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={{}}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(screen.getByText('No bindings configured')).toBeInTheDocument()
  })
})

describe('StreamingOverlay — pressedButtons animation class (Story 10.2, AC1/AC2/AC5)', () => {
  const bindings: Record<string, string> = {
    cross: 'vibesense.approve',
    circle: 'vibesense.deny',
  }

  it('applies streaming-button-pressed class to the row for a pressed button', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={bindings}
        controllerType="dualsense"
        mode="full"
        pressedButtons={new Map([['cross', 1]])}
        {...defaultWheelProps}
      />,
    )
    const rows = container.querySelectorAll('.hud-binding-row')
    const pressedRow = Array.from(rows).find(r => r.classList.contains('streaming-button-pressed'))
    expect(pressedRow).toBeDefined()
  })

  it('does NOT apply streaming-button-pressed class to a non-pressed button row', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={bindings}
        controllerType="dualsense"
        mode="full"
        pressedButtons={new Map([['cross', 1]])}
        {...defaultWheelProps}
      />,
    )
    // circle row should NOT have the pressed class
    const rows = container.querySelectorAll('.hud-binding-row')
    const circleRow = Array.from(rows).find(r => !r.classList.contains('streaming-button-pressed'))
    expect(circleRow).toBeDefined()
  })

  it('shows no animation classes when pressedButtons is an empty map', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={bindings}
        controllerType="dualsense"
        mode="full"
        pressedButtons={new Map()}
        {...defaultWheelProps}
      />,
    )
    const pressedRows = container.querySelectorAll('.streaming-button-pressed')
    expect(pressedRows).toHaveLength(0)
  })

  it('shows no animation classes when pressedButtons prop is omitted', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={bindings}
        controllerType="dualsense"
        mode="full"
        {...defaultWheelProps}
      />,
    )
    const pressedRows = container.querySelectorAll('.streaming-button-pressed')
    expect(pressedRows).toHaveLength(0)
  })
})

describe('StreamingOverlay — wheel-visible state (Story 10.3, AC1–AC6)', () => {
  const sampleSegment: WheelSegmentDef = {
    index: 0,
    label: 'Approve',
    commandId: 'vibesense.approve',
  }
  const l2Segments: WheelSegmentDef[] = Array.from({ length: 8 }, (_, i) => ({
    index: i,
    label: `L2-${i}`,
    commandId: `vibesense.cmd${i}`,
  }))
  const r2Segments: WheelSegmentDef[] = Array.from({ length: 8 }, (_, i) => ({
    index: i,
    label: `R2-${i}`,
    commandId: `vibesense.r2cmd${i}`,
  }))

  it('renders StreamingWheelMirror when wheelOpen=true (AC1)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="l2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    // StreamingWheelMirror renders with role="img"
    expect(screen.getByRole('img', { name: /Radial wheel/i })).toBeInTheDocument()
  })

  it('does not render StreamingWheelMirror when wheelOpen=false (AC6)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(screen.queryByRole('img', { name: /Radial wheel/i })).not.toBeInTheDocument()
  })

  it('shows CINEMA badge when wheel is closed (AC6)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        {...defaultWheelProps}
      />,
    )
    expect(screen.getByText('CINEMA')).toBeInTheDocument()
  })

  it('hides CINEMA badge when wheel is open (AC1)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="l2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    expect(screen.queryByText('CINEMA')).not.toBeInTheDocument()
  })

  it('shows active wheel label L2 when activeWheel=l2 (AC5)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="l2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    expect(screen.getByText('L2')).toBeInTheDocument()
  })

  it('shows active wheel label R2 when activeWheel=r2 (AC5)', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="r2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    expect(screen.getByText('R2')).toBeInTheDocument()
  })

  it('passes selectedIndex through to mirror — segment 3 is selected (AC2)', () => {
    const { container } = render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="l2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={3}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    // The SVG paths should be in the container (8 segments rendered)
    const paths = container.querySelectorAll('svg path')
    expect(paths).toHaveLength(8)
    // The 4th path (index 3) should have the accent fill
    const activePath = paths[3]
    expect(activePath).toHaveAttribute('fill', 'var(--vs-accent, #00C8FF)')
  })

  it('renders correct ARIA label for L2 Smart wheel', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="l2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    expect(screen.getByRole('img', { name: 'Radial wheel: L2 Smart wheel' })).toBeInTheDocument()
  })

  it('renders correct ARIA label for R2 Personal wheel', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
        wheelOpen={true}
        wheelActiveWheel="r2"
        wheelL2Segments={l2Segments}
        wheelR2Segments={r2Segments}
        wheelSelectedIndex={-1}
        wheelIsClosing={false}
        wheelDispatched={false}
      />,
    )
    expect(screen.getByRole('img', { name: 'Radial wheel: R2 Personal wheel' })).toBeInTheDocument()
  })

  void sampleSegment // suppress unused warning
})
