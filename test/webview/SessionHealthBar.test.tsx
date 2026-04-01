// test/webview/SessionHealthBar.test.tsx
// Component tests for SessionHealthBar — Story 9.4 (AC1, AC2, AC3)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SessionHealthBar, formatDuration } from '../../src/webview/session/SessionHealthBar'

// ─── formatDuration helper ────────────────────────────────────────────────────

describe('formatDuration()', () => {
  it('formats 0ms as 00:00', () => {
    expect(formatDuration(0)).toBe('00:00')
  })

  it('formats 59_999ms as 00:59', () => {
    expect(formatDuration(59999)).toBe('00:59')
  })

  it('formats 60_000ms as 01:00', () => {
    expect(formatDuration(60000)).toBe('01:00')
  })

  it('formats 734_000ms as 12:14', () => {
    expect(formatDuration(734000)).toBe('12:14')
  })

  it('formats 3_600_000ms as 60:00 (no hours rollover)', () => {
    expect(formatDuration(3600000)).toBe('60:00')
  })

  it('pads seconds with leading zero', () => {
    expect(formatDuration(5000)).toBe('00:05')
  })
})

// ─── SessionHealthBar — connected=false (AC5.6) ───────────────────────────────

describe('SessionHealthBar — hidden when not connected', () => {
  it('renders null when connected=false', () => {
    const { container } = render(
      <SessionHealthBar ratio={0.8} durationMs={5000} sessionXp={100} connected={false} />,
    )
    expect(container.firstChild).toBeNull()
  })
})

// ─── SessionHealthBar — rendering when connected ──────────────────────────────

describe('SessionHealthBar — renders content when connected', () => {
  it('renders the health bar when connected=true', () => {
    render(
      <SessionHealthBar ratio={0.75} durationMs={5000} sessionXp={50} connected={true} />,
    )
    expect(screen.getByTestId('session-health-bar')).toBeInTheDocument()
  })

  it('displays the ratio as integer percent with ctrl label', () => {
    render(
      <SessionHealthBar ratio={0.73} durationMs={5000} sessionXp={50} connected={true} />,
    )
    expect(screen.getByText('73% ctrl')).toBeInTheDocument()
  })

  it('rounds ratio percentage correctly (0.996 → 100%)', () => {
    render(
      <SessionHealthBar ratio={0.996} durationMs={5000} sessionXp={0} connected={true} />,
    )
    expect(screen.getByText('100% ctrl')).toBeInTheDocument()
  })

  it('displays session duration in mm:ss format', () => {
    render(
      <SessionHealthBar ratio={0.75} durationMs={75000} sessionXp={50} connected={true} />,
    )
    expect(screen.getByText('01:15')).toBeInTheDocument()
  })

  it('displays XP with + prefix', () => {
    render(
      <SessionHealthBar ratio={0.75} durationMs={5000} sessionXp={125} connected={true} />,
    )
    expect(screen.getByText('+125 XP')).toBeInTheDocument()
  })
})

// ─── SessionHealthBar — ratio color classes (AC2, AC3) ───────────────────────

describe('SessionHealthBar — ratio color classes (AC2 amber / AC3 cyan)', () => {
  it('applies warning class (amber) when ratio < 0.5 (AC2)', () => {
    render(
      <SessionHealthBar ratio={0.49} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('49% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--warning')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--good')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--neutral')
  })

  it('applies warning class at ratio = 0.0 (AC2)', () => {
    render(
      <SessionHealthBar ratio={0.0} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('0% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--warning')
  })

  it('applies neutral class when ratio is between 0.5 and 0.79 (AC2, AC3)', () => {
    render(
      <SessionHealthBar ratio={0.65} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('65% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--neutral')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--warning')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--good')
  })

  it('applies neutral class at ratio = 0.5 (boundary — AC2)', () => {
    render(
      <SessionHealthBar ratio={0.5} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('50% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--neutral')
  })

  it('applies good class (cyan) when ratio >= 0.8 (AC3)', () => {
    render(
      <SessionHealthBar ratio={0.8} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('80% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--good')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--warning')
    expect(ratioEl).not.toHaveClass('health-bar__ratio--neutral')
  })

  it('applies good class at ratio = 1.0 (AC3)', () => {
    render(
      <SessionHealthBar ratio={1.0} durationMs={0} sessionXp={0} connected={true} />,
    )
    const ratioEl = screen.getByText('100% ctrl')
    expect(ratioEl).toHaveClass('health-bar__ratio--good')
  })
})

// ─── SessionHealthBar — ARIA (NFR-A1) ────────────────────────────────────────

describe('SessionHealthBar — ARIA attributes (NFR-A1)', () => {
  it('has role="status" on the container', () => {
    render(
      <SessionHealthBar ratio={0.75} durationMs={5000} sessionXp={50} connected={true} />,
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('has descriptive aria-label summarizing all stats', () => {
    render(
      <SessionHealthBar ratio={0.73} durationMs={75000} sessionXp={50} connected={true} />,
    )
    const el = screen.getByRole('status')
    expect(el).toHaveAttribute(
      'aria-label',
      'Session health: 73% controller ratio, duration 01:15, 50 XP earned',
    )
  })
})
