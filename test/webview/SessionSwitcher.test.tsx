// test/webview/SessionSwitcher.test.tsx
// Component tests for SessionSwitcher — Story 3.3 (AC 1, 2, 5, 6)
// jsdom environment (configured in vitest.config.ts for test/webview/)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SessionSwitcher } from '../../src/webview/session/SessionSwitcher'

describe('SessionSwitcher — visible state', () => {
  it('renders session name when visible=true', () => {
    render(
      <SessionSwitcher
        sessionIndex={1}
        sessionName="Agent Session"
        totalSessions={4}
        visible={true}
      />,
    )
    expect(screen.getByText('Agent Session')).toBeInTheDocument()
  })

  it('renders session counter in "X / Y" format when visible=true', () => {
    render(
      <SessionSwitcher
        sessionIndex={1}
        sessionName="Agent Session"
        totalSessions={4}
        visible={true}
      />,
    )
    // sessionIndex + 1 = 2, totalSessions = 4 → "2 / 4"
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
  })

  it('applies session-switcher--visible class when visible=true', () => {
    const { container } = render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={true}
      />,
    )
    const overlay = container.querySelector('.session-switcher')
    expect(overlay).toHaveClass('session-switcher--visible')
  })
})

describe('SessionSwitcher — hidden state', () => {
  it('applies session-switcher--hidden class when visible=false', () => {
    const { container } = render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={false}
      />,
    )
    const overlay = container.querySelector('.session-switcher')
    expect(overlay).toHaveClass('session-switcher--hidden')
  })

  it('does not apply session-switcher--visible class when visible=false', () => {
    const { container } = render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={false}
      />,
    )
    const overlay = container.querySelector('.session-switcher')
    expect(overlay).not.toHaveClass('session-switcher--visible')
  })

  it('still renders in the DOM when visible=false (do not unmount for fade-out)', () => {
    const { container } = render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={false}
      />,
    )
    const overlay = container.querySelector('.session-switcher')
    expect(overlay).toBeInTheDocument()
  })
})

describe('SessionSwitcher — accessibility', () => {
  it('has role="status" on the overlay container', () => {
    render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={true}
      />,
    )
    const overlay = screen.getByRole('status')
    expect(overlay).toBeInTheDocument()
  })

  it('has aria-live="polite" on the overlay container', () => {
    render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="VibeSense"
        totalSessions={2}
        visible={true}
      />,
    )
    const overlay = screen.getByRole('status')
    expect(overlay).toHaveAttribute('aria-live', 'polite')
  })
})

describe('SessionSwitcher — counter display', () => {
  it('renders "1 / 3" for sessionIndex=0, totalSessions=3', () => {
    render(
      <SessionSwitcher
        sessionIndex={0}
        sessionName="Terminal 1"
        totalSessions={3}
        visible={true}
      />,
    )
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('renders "3 / 3" for sessionIndex=2, totalSessions=3', () => {
    render(
      <SessionSwitcher
        sessionIndex={2}
        sessionName="Terminal 3"
        totalSessions={3}
        visible={true}
      />,
    )
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('renders both session name and counter together (NFR-A2: not color alone)', () => {
    render(
      <SessionSwitcher
        sessionIndex={1}
        sessionName="Copilot"
        totalSessions={4}
        visible={true}
      />,
    )
    expect(screen.getByText('Copilot')).toBeInTheDocument()
    expect(screen.getByText('2 / 4')).toBeInTheDocument()
  })
})
