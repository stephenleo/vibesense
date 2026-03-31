// test/webview/ErrorMenu.test.tsx
// Component tests for ErrorMenu — Story 5.5 (AC 1, 2, 3)
// jsdom environment (configured in vitest.config.ts for test/webview/)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ErrorMenu } from '../../src/webview/session/ErrorMenu'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ErrorMenu — visible state (AC 1)', () => {
  it('renders with role="dialog" and aria-modal="true" when visible=true', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('applies error-menu--visible class when visible=true', () => {
    const { container } = render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.error-menu')
    expect(panel).toHaveClass('error-menu--visible')
  })
})

describe('ErrorMenu — hidden state (AC 3)', () => {
  it('applies error-menu--hidden class when visible=false', () => {
    const { container } = render(
      <ErrorMenu
        visible={false}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.error-menu')
    expect(panel).toHaveClass('error-menu--hidden')
  })

  it('does not apply error-menu--visible class when visible=false', () => {
    const { container } = render(
      <ErrorMenu
        visible={false}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.error-menu')
    expect(panel).not.toHaveClass('error-menu--visible')
  })

  it('still renders in the DOM when visible=false (do not unmount for fade-out)', () => {
    const { container } = render(
      <ErrorMenu
        visible={false}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const panel = container.querySelector('.error-menu')
    expect(panel).toBeInTheDocument()
  })
})

describe('ErrorMenu — four action buttons (AC 1)', () => {
  it('renders all four action buttons', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/Retry/i)).toBeInTheDocument()
    expect(screen.getByText(/Clear/i)).toBeInTheDocument()
    expect(screen.getByText(/new agent/i)).toBeInTheDocument()
    expect(screen.getByText(/error log/i)).toBeInTheDocument()
  })

  it('renders title containing "Agent Error"', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText(/Agent Error/i)).toBeInTheDocument()
  })
})

describe('ErrorMenu — hasLastCommand=false (AC 2)', () => {
  it('Retry button has disabled class when hasLastCommand=false', () => {
    const { container } = render(
      <ErrorMenu
        visible={true}
        hasLastCommand={false}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const retryBtn = container.querySelector('.error-menu__action-btn--disabled')
    expect(retryBtn).toBeInTheDocument()
    expect(retryBtn).toHaveTextContent(/Retry/i)
  })

  it('Retry button has disabled attribute when hasLastCommand=false', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={false}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const retryBtn = screen.getByText(/Retry last command/i).closest('button')
    expect(retryBtn).toBeDisabled()
  })
})

describe('ErrorMenu — hasLastCommand=true (AC 2)', () => {
  it('Retry button is enabled when hasLastCommand=true', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const retryBtn = screen.getByText(/Retry last command/i).closest('button')
    expect(retryBtn).not.toBeDisabled()
  })

  it('Retry button does not have disabled class when hasLastCommand=true', () => {
    const { container } = render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    const retryBtn = screen.getByText(/Retry last command/i).closest('button')
    expect(retryBtn).not.toHaveClass('error-menu__action-btn--disabled')
  })
})

describe('ErrorMenu — onAction callbacks (AC 2)', () => {
  it('clicking Retry calls onAction("retry")', () => {
    const onAction = vi.fn()
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={onAction}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(/Retry last command/i))
    expect(onAction).toHaveBeenCalledWith('retry')
  })

  it('clicking Clear calls onAction("clear")', () => {
    const onAction = vi.fn()
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={onAction}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(/Clear terminal output/i))
    expect(onAction).toHaveBeenCalledWith('clear')
  })

  it('clicking "Open new agent session" calls onAction("new-session")', () => {
    const onAction = vi.fn()
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={onAction}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(/Open new agent session/i))
    expect(onAction).toHaveBeenCalledWith('new-session')
  })

  it('clicking "View error log" calls onAction("view-log")', () => {
    const onAction = vi.fn()
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={onAction}
        onDismiss={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(/View error log/i))
    expect(onAction).toHaveBeenCalledWith('view-log')
  })
})

describe('ErrorMenu — onDismiss callback (AC 3)', () => {
  it('clicking Dismiss button calls onDismiss', () => {
    const onDismiss = vi.fn()
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={onDismiss}
      />,
    )
    const dismissBtn = screen.getByRole('button', { name: /dismiss error menu/i })
    fireEvent.click(dismissBtn)
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})

describe('ErrorMenu — accessibility (AC 1, NFR-A2)', () => {
  it('has aria-label="Agent error quick-action menu" on the dialog container', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute(
      'aria-label',
      'Agent error quick-action menu',
    )
  })

  it('action list has role="menu"', () => {
    render(
      <ErrorMenu
        visible={true}
        hasLastCommand={true}
        onAction={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})
