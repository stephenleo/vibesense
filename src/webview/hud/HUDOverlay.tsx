// src/webview/hud/HUDOverlay.tsx
// Main React component for the VibeSense HUD Overlay (Story 7.3)
// Manages state via useReducer; receives all data from host via postMessage (display-only)

import React, { useEffect, useReducer } from 'react'
import { parseHostMessage } from '../../shared/messages'
import type { ControllerType } from '../../shared/types'
import { ButtonMap } from './ButtonMap'

interface HUDState {
  visible: boolean
  bindings: Record<string, string>
  controllerType: ControllerType | null
  mode: 'guided' | 'full'
}

type HUDAction =
  | { type: 'TOGGLE'; visible: boolean }
  | {
      type: 'UPDATE_BINDINGS'
      bindings: Record<string, string>
      controllerType: ControllerType | null
      mode: 'guided' | 'full'
    }
  | { type: 'UPDATE_MODE'; mode: 'guided' | 'full'; bindings: Record<string, string> }

function hudReducer(state: HUDState, action: HUDAction): HUDState {
  switch (action.type) {
    case 'TOGGLE':
      return { ...state, visible: action.visible }
    case 'UPDATE_BINDINGS':
      return {
        ...state,
        bindings: action.bindings,
        controllerType: action.controllerType,
        mode: action.mode,
      }
    case 'UPDATE_MODE':
      return { ...state, mode: action.mode, bindings: action.bindings }
    default:
      return state
  }
}

const initialState: HUDState = {
  visible: false,
  bindings: {},
  controllerType: null,
  mode: 'guided',
}

export function HUDOverlay(): React.ReactElement {
  const [state, dispatch] = useReducer(hudReducer, initialState)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'HUD_TOGGLE') {
        dispatch({ type: 'TOGGLE', visible: msg.payload.visible })
      } else if (msg.type === 'HUD_BINDINGS_UPDATED') {
        dispatch({
          type: 'UPDATE_BINDINGS',
          bindings: msg.payload.bindings,
          controllerType: msg.payload.controllerType,
          mode: msg.payload.mode,
        })
      } else if (msg.type === 'HUD_MODE_CHANGED') {
        dispatch({ type: 'UPDATE_MODE', mode: msg.payload.mode, bindings: msg.payload.bindings })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (!state.visible) return <></>

  return (
    <div className="hud-overlay" role="region" aria-label="VibeSense Button Map">
      <div className="hud-header">
        <span className="hud-title">Button Map</span>
        <span className="hud-mode-badge">{state.mode === 'guided' ? 'Guided' : 'Full'}</span>
      </div>
      <ButtonMap
        bindings={state.bindings}
        controllerType={state.controllerType}
        mode={state.mode}
      />
    </div>
  )
}
