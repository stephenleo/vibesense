// test/webview/QuickPanel.test.tsx
// Component tests for QuickPanel — Story 3.5 (AC 1, 2, 3)
// jsdom environment (configured in vitest.config.ts for test/webview/)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QuickPanel } from '../../src/webview/session/QuickPanel'
import type { Session } from '../../src/shared/types'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const sessions: Session[] = [
  { sessionId: 'session-1', agentState: 'idle', label: 'Terminal 1' },
  { sessionId: 'session-2', agentState: 'processing', label: 'Terminal 2' },
  { sessionId: 'session-3', agentState: 'error', label: 'Terminal 3' },
]

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuickPanel — visible state (AC 1)', () => {
  it('renders with role="dialog" and aria-modal="true" when visible=true', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('applies quick-panel--visible class when visible=true', () => {
    const { container } = render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.quick-panel')
    expect(panel).toHaveClass('quick-panel--visible')
  })

  it('renders "Select Session" title', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('Select Session')).toBeInTheDocument()
  })
})

describe('QuickPanel — hidden state (AC 2)', () => {
  it('applies quick-panel--hidden class when visible=false', () => {
    const { container } = render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={false}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.quick-panel')
    expect(panel).toHaveClass('quick-panel--hidden')
  })

  it('does not apply quick-panel--visible class when visible=false', () => {
    const { container } = render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={false}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.quick-panel')
    expect(panel).not.toHaveClass('quick-panel--visible')
  })

  it('still renders in the DOM when visible=false (do not unmount for fade-out)', () => {
    const { container } = render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={false}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.quick-panel')
    expect(panel).toBeInTheDocument()
  })
})

describe('QuickPanel — session list rendering (AC 1)', () => {
  it('renders all session labels', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('Terminal 1')).toBeInTheDocument()
    expect(screen.getByText('Terminal 2')).toBeInTheDocument()
    expect(screen.getByText('Terminal 3')).toBeInTheDocument()
  })

  it('renders a listbox with role="listbox"', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('renders each session as role="option"', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(sessions.length)
  })
})

describe('QuickPanel — selected item highlighting (AC 1)', () => {
  it('sets aria-selected=true on the selected item', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={1}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveAttribute('aria-selected', 'false')
    expect(options[1]).toHaveAttribute('aria-selected', 'true')
    expect(options[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('applies quick-panel__item--selected class to selected item', () => {
    const { container } = render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={1}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const items = container.querySelectorAll('.quick-panel__item')
    expect(items[0]).not.toHaveClass('quick-panel__item--selected')
    expect(items[1]).toHaveClass('quick-panel__item--selected')
    expect(items[2]).not.toHaveClass('quick-panel__item--selected')
  })
})

describe('QuickPanel — onSelect callback (AC 1)', () => {
  it('calls onSelect with correct index when Select button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={onSelect}
        onDismiss={vi.fn()}
      />,
    )
    const selectButtons = screen.getAllByRole('button', { name: /select session/i })
    fireEvent.click(selectButtons[1])
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it('calls onSelect with index 0 when first Select button is clicked', () => {
    const onSelect = vi.fn()
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={onSelect}
        onDismiss={vi.fn()}
      />,
    )
    const selectButtons = screen.getAllByRole('button', { name: /select session/i })
    fireEvent.click(selectButtons[0])
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})

describe('QuickPanel — onDismiss callback (AC 2)', () => {
  it('calls onDismiss when Dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    const dismissButton = screen.getByRole('button', { name: /dismiss panel/i })
    fireEvent.click(dismissButton)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('QuickPanel — empty state (AC 3)', () => {
  it('shows empty state hint when sessions array is empty', () => {
    render(
      <QuickPanel
        sessions={[]}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(
      screen.getByText('No terminal sessions open. Hold L1+R1 to open a terminal.'),
    ).toBeInTheDocument()
  })

  it('does not render listbox when sessions array is empty', () => {
    render(
      <QuickPanel
        sessions={[]}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('QuickPanel — accessibility (AC 1, NFR-A2)', () => {
  it('has aria-label="Quick session panel" on the dialog container', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Quick session panel')
  })

  it('session list has role="listbox" (UX-DR18)', () => {
    render(
      <QuickPanel
        sessions={sessions}
        selectedIndex={0}
        visible={true}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
