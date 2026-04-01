// src/webview/mini-game/GameCanvas.tsx
// HTML5 Canvas wrapper for VibeSense Mini-Game (Story 8.1)
// Manages devicePixelRatio scaling, window resize, and host message routing
// Extended in Story 8.3 to support Tetris game mode and GAME_INPUT routing
import React, { useRef, useEffect, useCallback, useReducer } from 'react'
import { parseHostMessage } from '../../shared/messages'
import { Snake } from './Snake'
import { Tetris } from './Tetris'
import type { GameInputAction } from './Tetris'

export type Direction = 'up' | 'down' | 'left' | 'right'

interface GameState {
  running: boolean
  direction: Direction
  gameMode: 'snake' | 'tetris'  // Story 8.3: active game mode
  gameInput: GameInputAction | null  // Story 8.3: latest Tetris input action
}

type GameAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SET_DIRECTION'; direction: Direction }
  | { type: 'SET_MODE'; mode: 'snake' | 'tetris' }  // Story 8.3
  | { type: 'GAME_INPUT'; action: GameInputAction }  // Story 8.3
  | { type: 'CLEAR_INPUT' }                          // Story 8.3

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return { ...state, running: true }
    case 'PAUSE':
      return { ...state, running: false }
    case 'RESUME':
      return { ...state, running: true }
    case 'SET_DIRECTION':
      return { ...state, direction: action.direction }
    case 'SET_MODE':
      return { ...state, gameMode: action.mode }
    case 'GAME_INPUT':
      return { ...state, gameInput: action.action }
    case 'CLEAR_INPUT':
      return { ...state, gameInput: null }
    default:
      return state
  }
}

/** Deadzone threshold for right analog stick */
const STICK_DEADZONE = 0.5

/** Convert right-stick x/y to a cardinal Direction. Prefers the dominant axis. */
function stickToDirection(x: number, y: number): Direction | null {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ax <= STICK_DEADZONE && ay <= STICK_DEADZONE) return null
  if (ax >= ay) {
    return x > 0 ? 'right' : 'left'
  }
  return y > 0 ? 'down' : 'up'
}

export function GameCanvas(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [state, dispatch] = useReducer(gameReducer, {
    running: false,
    direction: 'right',
    gameMode: 'snake',   // Story 8.3: default to snake
    gameInput: null,     // Story 8.3: no pending input initially
  })

  // Scale canvas for devicePixelRatio (AC2)
  const scaleCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio ?? 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.scale(dpr, dpr)
  }, [])

  // Handle window resize (AC3 — re-scale on detach)
  useEffect(() => {
    scaleCanvas()
    const onResize = () => scaleCanvas()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [scaleCanvas])

  // Host message handler
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'GAME_START') {
        dispatch({ type: 'START' })
      } else if (msg.type === 'GAME_PAUSE') {
        dispatch({ type: 'PAUSE' })
      } else if (msg.type === 'GAME_RESUME') {
        dispatch({ type: 'RESUME' })
      } else if (msg.type === 'GAME_STICK_UPDATE') {
        const dir = stickToDirection(msg.payload.x, msg.payload.y)
        if (dir) dispatch({ type: 'SET_DIRECTION', direction: dir })
      } else if (msg.type === 'GAME_SET_MODE') {
        // Story 8.3: switch active game mode
        dispatch({ type: 'SET_MODE', mode: msg.payload.mode })
      } else if (msg.type === 'GAME_INPUT') {
        // Story 8.3: route Tetris input action
        dispatch({ type: 'GAME_INPUT', action: msg.payload.action })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className="game-canvas" />
      {state.running && state.gameMode === 'snake' && (
        <Snake canvasRef={canvasRef} direction={state.direction} running={state.running} />
      )}
      {state.running && state.gameMode === 'tetris' && (
        <Tetris
          canvasRef={canvasRef}
          gameInput={state.gameInput}
          running={state.running}
          onInputConsumed={() => dispatch({ type: 'CLEAR_INPUT' })}
        />
      )}
    </div>
  )
}
