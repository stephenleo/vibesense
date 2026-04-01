// test/webview/Tetris.test.tsx
// Component tests for Tetris and extended GameCanvas using Vitest + @testing-library/react (jsdom)
// Story 8.3: Tetris Game Mode

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/mini-game/mini-game.css', () => ({}))

// Mock canvas context — include strokeRect for Tetris grid drawing
const mockCtx = {
  fillRect: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  globalAlpha: 1.0,
  lineWidth: 1,
  strokeStyle: '',
  fillStyle: '',
  font: '',
}

// Mock HTMLCanvasElement.prototype.getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

// Mock requestAnimationFrame and cancelAnimationFrame
// Do NOT call callback synchronously — RAF loop is recursive and would cause stack overflow
let rafIdCounter = 0
globalThis.requestAnimationFrame = vi.fn((_cb: FrameRequestCallback) => {
  return ++rafIdCounter
}) as unknown as typeof requestAnimationFrame
globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame

import React from 'react'
import { render, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Tetris } from '../../src/webview/mini-game/Tetris'
import { GameCanvas } from '../../src/webview/mini-game/GameCanvas'

/**
 * Dispatch a host message to the GameCanvas via window.dispatchEvent.
 * Mirrors how the VSCode webview host sends messages.
 */
function dispatchHostMessage(data: unknown): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data }))
  })
}

// ─── Tetris component tests ──────────────────────────────────────────────────

describe('Tetris — component output', () => {
  it('1. Tetris component returns null (renders to canvas, not DOM)', () => {
    const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement>
    const { container } = render(
      <Tetris
        canvasRef={canvasRef}
        gameInput={null}
        running={false}
        onInputConsumed={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('2. Tetris does not throw on mount (running=true)', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    expect(() => {
      render(
        <Tetris
          canvasRef={canvasRef}
          gameInput={null}
          running={true}
          onInputConsumed={vi.fn()}
        />,
      )
    }).not.toThrow()
  })

  it('3. Tetris does not throw on mount (running=false)', () => {
    const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement>
    expect(() => {
      render(
        <Tetris
          canvasRef={canvasRef}
          gameInput={null}
          running={false}
          onInputConsumed={vi.fn()}
        />,
      )
    }).not.toThrow()
  })
})

describe('Tetris — input consumption', () => {
  it('4. onInputConsumed called when gameInput="left"', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    const onInputConsumed = vi.fn()

    // We need to simulate the RAF callback firing to call processInput
    // Strategy: capture the RAF callback and invoke it manually
    let capturedCallback: FrameRequestCallback | null = null
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      if (!capturedCallback) capturedCallback = cb
      return ++rafIdCounter
    }) as unknown as typeof requestAnimationFrame

    const { rerender } = render(
      <Tetris
        canvasRef={canvasRef}
        gameInput={null}
        running={true}
        onInputConsumed={onInputConsumed}
      />,
    )

    // Update gameInput to 'left' — this updates the ref
    act(() => {
      rerender(
        <Tetris
          canvasRef={canvasRef}
          gameInput="left"
          running={true}
          onInputConsumed={onInputConsumed}
        />,
      )
    })

    // Fire the RAF callback to trigger processInput
    if (capturedCallback) {
      act(() => {
        ;(capturedCallback as FrameRequestCallback)(1000)
      })
    }

    expect(onInputConsumed).toHaveBeenCalled()
    globalThis.requestAnimationFrame = originalRaf
  })

  it('5. onInputConsumed called when gameInput="right"', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    const onInputConsumed = vi.fn()

    let capturedCallback: FrameRequestCallback | null = null
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      if (!capturedCallback) capturedCallback = cb
      return ++rafIdCounter
    }) as unknown as typeof requestAnimationFrame

    const { rerender } = render(
      <Tetris canvasRef={canvasRef} gameInput={null} running={true} onInputConsumed={onInputConsumed} />,
    )

    act(() => {
      rerender(
        <Tetris canvasRef={canvasRef} gameInput="right" running={true} onInputConsumed={onInputConsumed} />,
      )
    })

    if (capturedCallback) {
      act(() => { ;(capturedCallback as FrameRequestCallback)(1000) })
    }

    expect(onInputConsumed).toHaveBeenCalled()
    globalThis.requestAnimationFrame = originalRaf
  })

  it('6. onInputConsumed called when gameInput="down"', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    const onInputConsumed = vi.fn()

    let capturedCallback: FrameRequestCallback | null = null
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      if (!capturedCallback) capturedCallback = cb
      return ++rafIdCounter
    }) as unknown as typeof requestAnimationFrame

    const { rerender } = render(
      <Tetris canvasRef={canvasRef} gameInput={null} running={true} onInputConsumed={onInputConsumed} />,
    )

    act(() => {
      rerender(
        <Tetris canvasRef={canvasRef} gameInput="down" running={true} onInputConsumed={onInputConsumed} />,
      )
    })

    if (capturedCallback) {
      act(() => { ;(capturedCallback as FrameRequestCallback)(1000) })
    }

    expect(onInputConsumed).toHaveBeenCalled()
    globalThis.requestAnimationFrame = originalRaf
  })

  it('7. onInputConsumed called when gameInput="rotate"', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    const onInputConsumed = vi.fn()

    let capturedCallback: FrameRequestCallback | null = null
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      if (!capturedCallback) capturedCallback = cb
      return ++rafIdCounter
    }) as unknown as typeof requestAnimationFrame

    const { rerender } = render(
      <Tetris canvasRef={canvasRef} gameInput={null} running={true} onInputConsumed={onInputConsumed} />,
    )

    act(() => {
      rerender(
        <Tetris canvasRef={canvasRef} gameInput="rotate" running={true} onInputConsumed={onInputConsumed} />,
      )
    })

    if (capturedCallback) {
      act(() => { ;(capturedCallback as FrameRequestCallback)(1000) })
    }

    expect(onInputConsumed).toHaveBeenCalled()
    globalThis.requestAnimationFrame = originalRaf
  })

  it('8. onInputConsumed NOT called when gameInput=null', () => {
    const canvas = document.createElement('canvas')
    const canvasRef = { current: canvas } as React.RefObject<HTMLCanvasElement>
    const onInputConsumed = vi.fn()

    let capturedCallback: FrameRequestCallback | null = null
    const originalRaf = globalThis.requestAnimationFrame
    globalThis.requestAnimationFrame = vi.fn((cb: FrameRequestCallback) => {
      if (!capturedCallback) capturedCallback = cb
      return ++rafIdCounter
    }) as unknown as typeof requestAnimationFrame

    render(
      <Tetris canvasRef={canvasRef} gameInput={null} running={true} onInputConsumed={onInputConsumed} />,
    )

    if (capturedCallback) {
      act(() => { ;(capturedCallback as FrameRequestCallback)(1000) })
    }

    expect(onInputConsumed).not.toHaveBeenCalled()
    globalThis.requestAnimationFrame = originalRaf
  })
})

// ─── GameCanvas integration tests (Story 8.3 extensions) ────────────────────

describe('GameCanvas — Tetris mode (AC1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('9. GameCanvas renders Tetris when mode="tetris" and game is running', () => {
    const { container } = render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    dispatchHostMessage({ type: 'GAME_SET_MODE', payload: { mode: 'tetris' } })
    // Canvas still in DOM — Tetris renders null (no DOM output) but useEffect runs
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('10. GameCanvas renders Snake by default (mode="snake") when running', () => {
    const { container } = render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    // Default mode is snake — no GAME_SET_MODE needed
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('11. GameCanvas handles GAME_INPUT message without throwing', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    expect(() => {
      dispatchHostMessage({ type: 'GAME_INPUT', payload: { action: 'left', source: 'button' } })
    }).not.toThrow()
  })

  it('12. GameCanvas handles GAME_SET_MODE message without throwing', () => {
    render(<GameCanvas />)
    expect(() => {
      dispatchHostMessage({ type: 'GAME_SET_MODE', payload: { mode: 'tetris' } })
    }).not.toThrow()
  })

  it('13. GameCanvas switches from Tetris to Snake on mode change', () => {
    const { container } = render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    dispatchHostMessage({ type: 'GAME_SET_MODE', payload: { mode: 'tetris' } })
    // Switch back to snake
    expect(() => {
      dispatchHostMessage({ type: 'GAME_SET_MODE', payload: { mode: 'snake' } })
    }).not.toThrow()
    // Canvas still present
    expect(container.querySelector('canvas')).toBeInTheDocument()
  })

  it('14. GameCanvas handles all GAME_INPUT action types without throwing', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    dispatchHostMessage({ type: 'GAME_SET_MODE', payload: { mode: 'tetris' } })
    const actions = ['left', 'right', 'down', 'rotate'] as const
    for (const action of actions) {
      expect(() => {
        dispatchHostMessage({ type: 'GAME_INPUT', payload: { action, source: 'button' } })
      }).not.toThrow()
    }
  })

  it('15. GameCanvas handles GAME_INPUT with source="axis" without throwing', () => {
    render(<GameCanvas />)
    dispatchHostMessage({ type: 'GAME_START', payload: {} })
    expect(() => {
      dispatchHostMessage({ type: 'GAME_INPUT', payload: { action: 'right', source: 'axis' } })
    }).not.toThrow()
  })
})
