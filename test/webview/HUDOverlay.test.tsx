// test/webview/HUDOverlay.test.tsx
// Component tests for HUDOverlay using Vitest + @testing-library/react (jsdom)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/hud/hud.css', () => ({}))

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { HUDOverlay } from '../../src/webview/hud/HUDOverlay'

/**
 * Dispatch a host message to the HUDOverlay via window.dispatchEvent.
 * Mirrors how the VSCode webview host sends messages.
 */
function dispatchHostMessage(data: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }))
  })
}

describe('HUDOverlay — initial state', () => {
  it('renders with no visible content when no HUD_TOGGLE received', () => {
    const { container } = render(<HUDOverlay />)
    expect(container.querySelector('.hud-overlay')).not.toBeInTheDocument()
  })
})

describe('HUDOverlay — HUD_TOGGLE message', () => {
  it('renders overlay after receiving HUD_TOGGLE visible=true', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    expect(screen.getByRole('region', { name: 'VibeSense Button Map' })).toBeInTheDocument()
  })

  it('hides overlay after receiving HUD_TOGGLE visible=false', () => {
    const { container } = render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    expect(container.querySelector('.hud-overlay')).toBeInTheDocument()
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: false } })
    expect(container.querySelector('.hud-overlay')).not.toBeInTheDocument()
  })
})

describe('HUDOverlay — HUD_BINDINGS_UPDATED message', () => {
  beforeEach(() => {
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
  })

  it('renders binding list with new bindings after HUD_BINDINGS_UPDATED', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: { cross: 'vibesense.approve', circle: 'vibesense.deny' },
        controllerType: 'dualsense',
        mode: 'full',
      },
    })
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Deny')).toBeInTheDocument()
  })

  it('shows mode badge "Full" when mode=full in HUD_BINDINGS_UPDATED', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: { cross: 'vibesense.approve' },
        controllerType: 'dualsense',
        mode: 'full',
      },
    })
    expect(screen.getByText('Full')).toBeInTheDocument()
  })

  it('shows mode badge "Guided" when mode=guided in HUD_BINDINGS_UPDATED', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: { cross: 'vibesense.approve' },
        controllerType: 'dualsense',
        mode: 'guided',
      },
    })
    expect(screen.getByText('Guided')).toBeInTheDocument()
  })
})

describe('HUDOverlay — Guided mode filtering (AC3)', () => {
  it('shows only GUIDED_BUTTONS subset when mode=guided', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    // cross and circle are guided; square and triangle are NOT
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: {
          cross: 'vibesense.approve',
          circle: 'vibesense.deny',
          square: 'vibesense.openTerminal',
          triangle: 'workbench.action.terminal.focus',
        },
        controllerType: 'dualsense',
        mode: 'guided',
      },
    })
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Deny')).toBeInTheDocument()
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument()
    expect(screen.queryByText('Focus Term')).not.toBeInTheDocument()
  })

  it('shows all bindings when mode=full', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: {
          cross: 'vibesense.approve',
          square: 'vibesense.openTerminal',
          triangle: 'workbench.action.terminal.focus',
        },
        controllerType: 'dualsense',
        mode: 'full',
      },
    })
    expect(screen.getByText('Approve')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
    expect(screen.getByText('Focus Term')).toBeInTheDocument()
  })
})

describe('HUDOverlay — HUD_MODE_CHANGED message (AC3)', () => {
  it('updates mode badge and binding list on HUD_MODE_CHANGED', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    // First set full mode with all bindings
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: {
          cross: 'vibesense.approve',
          square: 'vibesense.openTerminal',
        },
        controllerType: 'dualsense',
        mode: 'full',
      },
    })
    expect(screen.getByText('Full')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()

    // Now switch to guided with filtered bindings
    dispatchHostMessage({
      type: 'HUD_MODE_CHANGED',
      payload: {
        mode: 'guided',
        bindings: { cross: 'vibesense.approve' },
      },
    })
    expect(screen.getByText('Guided')).toBeInTheDocument()
    expect(screen.queryByText('Terminal')).not.toBeInTheDocument()
  })
})

describe('HUDOverlay — unknown message type', () => {
  it('does not crash or update state on unknown message type', () => {
    const { container } = render(<HUDOverlay />)
    // HUD starts hidden
    expect(container.querySelector('.hud-overlay')).not.toBeInTheDocument()
    // Dispatch unknown message
    dispatchHostMessage({ type: 'UNKNOWN_TYPE', payload: {} })
    // Still hidden — no crash, no state change
    expect(container.querySelector('.hud-overlay')).not.toBeInTheDocument()
  })
})

describe('HUDOverlay — empty bindings state', () => {
  it('shows empty state element when bindings is empty {}', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: {},
        controllerType: null,
        mode: 'full',
      },
    })
    expect(screen.getByText('No bindings configured')).toBeInTheDocument()
  })
})

describe('HUDOverlay — Streaming Mode (Story 10.1, AC1/AC2/AC3/AC5)', () => {
  it('renders StreamingOverlay when STREAMING_MODE_TOGGLED enabled=true', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'STREAMING_MODE_TOGGLED', payload: { enabled: true } })
    expect(screen.getByRole('region', { name: 'VibeSense Streaming Overlay' })).toBeInTheDocument()
  })

  it('does not render StreamingOverlay by default', () => {
    render(<HUDOverlay />)
    expect(screen.queryByRole('region', { name: 'VibeSense Streaming Overlay' })).not.toBeInTheDocument()
  })

  it('unmounts StreamingOverlay when STREAMING_MODE_TOGGLED enabled=false', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'STREAMING_MODE_TOGGLED', payload: { enabled: true } })
    expect(screen.getByRole('region', { name: 'VibeSense Streaming Overlay' })).toBeInTheDocument()
    dispatchHostMessage({ type: 'STREAMING_MODE_TOGGLED', payload: { enabled: false } })
    expect(screen.queryByRole('region', { name: 'VibeSense Streaming Overlay' })).not.toBeInTheDocument()
  })

  it('passes sessions to StreamingOverlay on STREAMING_SESSION_STATE_CHANGED', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'STREAMING_MODE_TOGGLED', payload: { enabled: true } })
    dispatchHostMessage({
      type: 'STREAMING_SESSION_STATE_CHANGED',
      payload: {
        sessions: [
          { sessionId: 'abc', agentState: 'processing', label: 'Agent1' },
        ],
      },
    })
    expect(screen.getByLabelText('Session Agent1: processing')).toBeInTheDocument()
  })

  it('shows standard HUD and StreamingOverlay simultaneously when both enabled', () => {
    render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({ type: 'STREAMING_MODE_TOGGLED', payload: { enabled: true } })
    expect(screen.getByRole('region', { name: 'VibeSense Button Map' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'VibeSense Streaming Overlay' })).toBeInTheDocument()
  })
})

describe('HUDOverlay — ControllerIcon per row', () => {
  it('renders a ControllerIcon (svg img) for each binding row', () => {
    const { container } = render(<HUDOverlay />)
    dispatchHostMessage({ type: 'HUD_TOGGLE', payload: { visible: true } })
    dispatchHostMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: { cross: 'vibesense.approve', circle: 'vibesense.deny' },
        controllerType: 'dualsense',
        mode: 'full',
      },
    })
    // Each row should have one SVG icon (from ControllerIcon)
    const rows = container.querySelectorAll('.hud-binding-row')
    expect(rows).toHaveLength(2)
    rows.forEach((row) => {
      expect(row.querySelector('svg')).toBeInTheDocument()
    })
  })
})
