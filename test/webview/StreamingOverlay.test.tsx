// test/webview/StreamingOverlay.test.tsx
// Unit tests for StreamingOverlay component (Story 10.1)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/hud/hud.css', () => ({}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { StreamingOverlay } from '../../src/webview/hud/StreamingOverlay'
import type { Session } from '../../src/shared/types'

const emptySessions: Session[] = []
const emptyBindings: Record<string, string> = {}

describe('StreamingOverlay — basic rendering', () => {
  it('renders CINEMA band with correct role and aria-label', () => {
    render(
      <StreamingOverlay
        sessions={emptySessions}
        bindings={emptyBindings}
        controllerType={null}
        mode="guided"
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
      />,
    )
    expect(screen.getByText('No bindings configured')).toBeInTheDocument()
  })
})
