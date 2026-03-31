// test/webview/SessionCard.test.tsx
// Component tests for SessionCard using Vitest + @testing-library/react (jsdom)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SessionCard } from '../../src/webview/session/SessionCard'
import type { Session } from '../../src/shared/types'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    sessionId: 'test-session-1',
    agentState: 'idle',
    ...overrides,
  }
}

describe('SessionCard — processing state', () => {
  it('renders slow-pulse cyan dot with text label "Processing"', () => {
    const session = makeSession({ agentState: 'processing' })
    const { container } = render(<SessionCard session={session} />)
    expect(screen.getByText('Processing')).toBeInTheDocument()
    const dot = container.querySelector('.dot--processing')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('title', 'Processing')
  })
})

describe('SessionCard — needs-input state', () => {
  it('renders fast-pulse amber dot with text label "Needs input"', () => {
    const session = makeSession({ agentState: 'needs-input' })
    const { container } = render(<SessionCard session={session} />)
    expect(screen.getByText('Needs input')).toBeInTheDocument()
    const dot = container.querySelector('.dot--needs-input')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('title', 'Needs input')
  })
})

describe('SessionCard — idle state', () => {
  it('renders static muted dot with text label "Idle"', () => {
    const session = makeSession({ agentState: 'idle' })
    const { container } = render(<SessionCard session={session} />)
    expect(screen.getByText('Idle')).toBeInTheDocument()
    const dot = container.querySelector('.dot--idle')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('title', 'Idle')
  })
})

describe('SessionCard — error state', () => {
  it('renders static red dot with text label "Error"', () => {
    const session = makeSession({ agentState: 'error' })
    const { container } = render(<SessionCard session={session} />)
    expect(screen.getByText('Error')).toBeInTheDocument()
    const dot = container.querySelector('.dot--error')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveAttribute('title', 'Error')
  })
})

describe('SessionCard — accessibility', () => {
  it('has aria-live="polite" on status region (NFR-A2)', () => {
    const session = makeSession({ agentState: 'processing' })
    const { container } = render(<SessionCard session={session} />)
    const statusRegion = container.querySelector('[aria-live="polite"]')
    expect(statusRegion).toBeInTheDocument()
  })

  it('uses both color class AND text label together — never color alone (NFR-A2)', () => {
    const session = makeSession({ agentState: 'processing' })
    const { container } = render(<SessionCard session={session} />)
    const dot = container.querySelector('.dot--processing')
    expect(dot).toBeInTheDocument()
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })
})

describe('SessionCard — active state', () => {
  it('applies active class when isActive=true', () => {
    const session = makeSession({ agentState: 'processing' })
    const { container } = render(<SessionCard session={session} isActive />)
    const card = container.querySelector('.session-card')
    expect(card).toHaveClass('session-card--active')
  })

  it('does not apply active class when isActive=false (default)', () => {
    const session = makeSession({ agentState: 'idle' })
    const { container } = render(<SessionCard session={session} />)
    const card = container.querySelector('.session-card')
    expect(card).not.toHaveClass('session-card--active')
  })
})

describe('SessionCard — session label display', () => {
  it('shows session label when provided', () => {
    const session = makeSession({ label: 'My Agent Session' })
    render(<SessionCard session={session} />)
    expect(screen.getByText('My Agent Session')).toBeInTheDocument()
  })

  it('shows sessionId as fallback when label is not provided', () => {
    const session = makeSession({ sessionId: 'session-abc-123', label: undefined })
    render(<SessionCard session={session} />)
    expect(screen.getByText('session-abc-123')).toBeInTheDocument()
  })

  it('never shows an empty card — always renders a label', () => {
    const session = makeSession({ sessionId: 'fallback-id', label: undefined })
    const { container } = render(<SessionCard session={session} />)
    const card = container.querySelector('.session-card')
    expect(card?.textContent?.trim()).not.toBe('')
  })
})
