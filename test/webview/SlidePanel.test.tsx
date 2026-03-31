// test/webview/SlidePanel.test.tsx
// Component tests for SlidePanel using Vitest + @testing-library/react (jsdom)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/session/session.css', () => ({}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SlidePanel } from '../../src/webview/session/SlidePanel'
import type { Session } from '../../src/shared/types'

function makeSessions(count: number): Session[] {
  return Array.from({ length: count }, (_, i) => ({
    sessionId: `session-${i + 1}`,
    agentState: 'idle' as const,
    label: `Agent ${i + 1}`,
  }))
}

describe('SlidePanel — expanded state', () => {
  it('applies expanded class when isExpanded=true', () => {
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={true} onToggle={() => undefined} />,
    )
    const panel = container.querySelector('.slide-panel')
    expect(panel).toHaveClass('slide-panel--expanded')
  })

  it('sets --vs-panel-width to 200px when expanded', () => {
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={true} onToggle={() => undefined} />,
    )
    const panel = container.querySelector('.slide-panel') as HTMLElement
    expect(panel.style.getPropertyValue('--vs-panel-width')).toBe('200px')
  })
})

describe('SlidePanel — retracted state', () => {
  it('does not apply expanded class when isExpanded=false', () => {
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={false} onToggle={() => undefined} />,
    )
    const panel = container.querySelector('.slide-panel')
    expect(panel).not.toHaveClass('slide-panel--expanded')
  })

  it('sets --vs-panel-width to 12px (drag handle only) when retracted', () => {
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={false} onToggle={() => undefined} />,
    )
    const panel = container.querySelector('.slide-panel') as HTMLElement
    expect(panel.style.getPropertyValue('--vs-panel-width')).toBe('12px')
  })

  it('still renders the drag handle when retracted', () => {
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={false} onToggle={() => undefined} />,
    )
    const handle = container.querySelector('.slide-panel__handle')
    expect(handle).toBeInTheDocument()
  })
})

describe('SlidePanel — drag handle interaction', () => {
  it('fires onToggle callback when drag handle is clicked', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <SlidePanel sessions={[]} isExpanded={false} onToggle={onToggle} />,
    )
    const handle = container.querySelector('.slide-panel__handle')
    expect(handle).toBeInTheDocument()
    fireEvent.click(handle!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})

describe('SlidePanel — empty sessions state', () => {
  it('shows "Hold L1+R1 to open a terminal" hint when sessions is empty and expanded', () => {
    render(<SlidePanel sessions={[]} isExpanded={true} onToggle={() => undefined} />)
    expect(screen.getByText('Hold L1+R1 to open a terminal')).toBeInTheDocument()
  })
})

describe('SlidePanel — session list', () => {
  it('renders one SessionCard per session when expanded', () => {
    const sessions = makeSessions(3)
    const { container } = render(
      <SlidePanel sessions={sessions} isExpanded={true} onToggle={() => undefined} />,
    )
    const cards = container.querySelectorAll('[data-testid="session-card"]')
    expect(cards).toHaveLength(3)
  })

  it('shows session labels when expanded', () => {
    const sessions = makeSessions(2)
    render(<SlidePanel sessions={sessions} isExpanded={true} onToggle={() => undefined} />)
    expect(screen.getByText('Agent 1')).toBeInTheDocument()
    expect(screen.getByText('Agent 2')).toBeInTheDocument()
  })
})

describe('SlidePanel — auto-retract when editorWidth < 800', () => {
  it('auto-retracts (does not expand) when editorWidth < 800', () => {
    const { container } = render(
      <SlidePanel
        sessions={[]}
        isExpanded={true}
        onToggle={() => undefined}
        editorWidth={600}
      />,
    )
    const panel = container.querySelector('.slide-panel')
    // Should be retracted even though isExpanded=true
    expect(panel).not.toHaveClass('slide-panel--expanded')
  })

  it('sets --vs-panel-width to 12px when editorWidth < 800', () => {
    const { container } = render(
      <SlidePanel
        sessions={[]}
        isExpanded={true}
        onToggle={() => undefined}
        editorWidth={799}
      />,
    )
    const panel = container.querySelector('.slide-panel') as HTMLElement
    expect(panel.style.getPropertyValue('--vs-panel-width')).toBe('12px')
  })

  it('drag handle remains accessible when auto-retracted', () => {
    const { container } = render(
      <SlidePanel
        sessions={[]}
        isExpanded={true}
        onToggle={() => undefined}
        editorWidth={600}
      />,
    )
    const handle = container.querySelector('.slide-panel__handle')
    expect(handle).toBeInTheDocument()
  })

  it('expands normally when editorWidth >= 800', () => {
    const { container } = render(
      <SlidePanel
        sessions={[]}
        isExpanded={true}
        onToggle={() => undefined}
        editorWidth={800}
      />,
    )
    const panel = container.querySelector('.slide-panel')
    expect(panel).toHaveClass('slide-panel--expanded')
  })
})
