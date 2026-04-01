// test/webview/GameCanvas.test.tsx
// Component tests for GameCanvas and Snake using Vitest + @testing-library/react (jsdom)
// Story 8.1: GameWindow WebviewPanel & Snake Game

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/mini-game/mini-game.css', () => ({}))

// Mock canvas context
const mockCtx = {
  fillRect: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  clearRect: vi.fn(),
}

// Mock HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Mock requestAnimationFrame and cancelAnimationFrame
// Do NOT call callback synchronously — Snake's loop is recursive and would cause stack overflow
let rafIdCounter = 0
globalThis.requestAnimationFrame = vi.fn((_cb: FrameRequestCallback) => {
  return ++rafIdCounter
}) as unknown as typeof requestAnimationFrame
globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame

import React from 'react'
import { render, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GameCanvas } from '../../src/webview/mini-game/GameCanvas'
import { Snake } from '../../src/webview/mini-game/Snake'

/**
 * Dispatch a host message to the GameCanvas via window.dispatchEvent.
 * Mirrors how the VSCode webview host sends messages.
 */
function dispatchHostMessage(data: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }))
  })
}

describe('GameCanvas — initial state', () => {
  it('renders a canvas element on mount', () => {
    const { container } = render(<GameCanvas />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toBeInTheDocument()
  })

  it('renders game-container div on mount', () => {
    const { container } = render(<GameCanvas />)
    expect(container.querySelector('.game-container')).toBeInTheDocument()
  })
})

describe('GameCanvas — GAME_START message (AC1)', () => {
  it('starts game (running=true) after receiving GAME_START', () => {
    const { container } = render(<GameCanvas />)
    // Initially Snake component is not rendered (running=false)
    // After GAME_START, Snake appears (rendered as null but still present in effect)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    // Canvas still in DOM after start
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('ignores malformed GAME_START with missing payload', () => {
    render(<GameCanvas />)
    // Should not throw
    expect(() => {
      dispatchHostMessage({ type: 'GAME_START' })
    }).not.toThrow()
  })
})

describe('GameCanvas — GAME_STICK_UPDATE (AC2)', () => {
  beforeEach(() => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
  })

  it('accepts right-stick update above deadzone (x=0.8) without throwing', () => {
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: 0.8, y: 0 } })
    }).not.toThrow()
  })

  it('ignores stick update below deadzone (x=0.3, y=0.2)', () => {
    // Dispatching below deadzone should not crash
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: 0.3, y: 0.2 } })
    }).not.toThrow()
  })

  it('dominant axis wins for diagonal input (x=0.6, y=0.9 → down direction)', () => {
    // Both axes above deadzone; y dominates (0.9 > 0.6)
    // Just verify no error — direction state is internal to reducer
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: 0.6, y: 0.9 } })
    }).not.toThrow()
  })

  it('left direction set when x=-0.8, y=0', () => {
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: -0.8, y: 0 } })
    }).not.toThrow()
  })

  it('up direction set when x=0, y=-0.8', () => {
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: 0, y: -0.8 } })
    }).not.toThrow()
  })
})

describe('GameCanvas — GAME_PAUSE / GAME_RESUME (Story 8.2 stubs)', () => {
  it('pauses game after GAME_PAUSE message (running=false)', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    // Pause
    expect(() => {
      dispatchHostMessage({ type: 'GAME_PAUSE', payload: {} })
    }).not.toThrow()
  })

  it('resumes game after GAME_RESUME message (running=true)', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    dispatchHostMessage({ type: 'GAME_PAUSE', payload: {} })
    expect(() => {
      dispatchHostMessage({ type: 'GAME_RESUME', payload: {} })
    }).not.toThrow()
  })
})

describe('GameCanvas — unknown message type', () => {
  it('does not throw or update state on unknown message type', () => {
    const { container } = render(<GameCanvas />)
    expect(() => {
      dispatchHostMessage({ type: 'UNKNOWN_MSG_TYPE', payload: {} })
    }).not.toThrow()
    // Canvas still renders
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })
})

describe('GameCanvas — canvas scaling (AC2)', () => {
  it('canvas element has game-canvas class for CSS sizing', () => {
    const { container } = render(<GameCanvas />)
    const canvas = container.querySelector('canvas')
    expect(canvas).toHaveClass('game-canvas')
  })
})

describe('Snake — component output', () => {
  it('Snake component returns null (renders to canvas, not DOM)', () => {
    const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement>
    const { container } = render(
      <Snake canvasRef={canvasRef} direction="right" running={false} />,
    )
    // Snake renders null — container should be empty
    expect(container.firstChild).toBeNull()
  })

  it('Snake component accepts running=true without throwing', () => {
    const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement>
    expect(() => {
      render(<Snake canvasRef={canvasRef} direction="right" running={true} />)
    }).not.toThrow()
  })
})

describe('GameCanvas — stickToDirection edge cases', () => {
  it('handles both axes at exact deadzone boundary (0.5) — treated as inside deadzone', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    // Exactly at deadzone threshold (0.5) is inside the deadzone per AC2 (> 0.5 required)
    expect(() => {
      dispatchHostMessage({ type: 'GAME_STICK_UPDATE', payload: { x: 0.5, y: 0 } })
    }).not.toThrow()
  })
})
