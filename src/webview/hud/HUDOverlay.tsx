// src/webview/hud/HUDOverlay.tsx
// Main React component for the VibeSense HUD Overlay (Story 7.3)
// Manages state via useReducer; receives all data from host via postMessage (display-only)
// Story 10.1: Extended to handle Streaming Mode (CINEMA overlay)
// Story 10.3: Extended to handle streaming wheel mirror messages

import React, { useEffect, useReducer, useRef, useState } from 'react'
import { parseHostMessage } from '../../shared/messages'
import type { ControllerType, Session, WheelSegmentDef } from '../../shared/types'
import { ButtonMap } from './ButtonMap'
import { StreamingOverlay } from './StreamingOverlay'

interface HUDState {
  visible: boolean
  bindings: Record<string, string>
  controllerType: ControllerType | null
  mode: 'guided' | 'full'
  // Story 10.1: Streaming Mode state
  streamingMode: boolean
  streamingSessions: Session[]
  streamingBindings: Record<string, string>
  streamingControllerType: ControllerType | null
  streamingBindingsMode: 'guided' | 'full'
  // Story 10.3: Streaming wheel mirror state
  streamingWheelOpen: boolean
  streamingWheelActiveWheel: 'l2' | 'r2'
  streamingWheelL2Segments: WheelSegmentDef[]
  streamingWheelR2Segments: WheelSegmentDef[]
  streamingWheelSelectedIndex: number
  streamingWheelIsClosing: boolean
  streamingWheelDispatched: boolean
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
  // Story 10.1: Streaming Mode actions
  | { type: 'STREAMING_MODE_TOGGLED'; enabled: boolean }
  | { type: 'STREAMING_BINDINGS_UPDATED'; bindings: Record<string, string>; controllerType: ControllerType | null; mode: 'guided' | 'full' }
  | { type: 'STREAMING_SESSION_STATE_CHANGED'; sessions: Session[] }
  // Story 10.3: Streaming wheel mirror actions
  | { type: 'STREAMING_WHEEL_OPEN'; activeWheel: 'l2' | 'r2'; l2Segments: WheelSegmentDef[]; r2Segments: WheelSegmentDef[] }
  | { type: 'STREAMING_WHEEL_STICK_UPDATE'; selectedIndex: number }
  | { type: 'STREAMING_WHEEL_CLOSE'; dispatched: boolean }
  | { type: 'STREAMING_WHEEL_OPEN_CLEAR' }

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
    // Story 10.1: Streaming Mode reducers
    case 'STREAMING_MODE_TOGGLED':
      return { ...state, streamingMode: action.enabled }
    case 'STREAMING_BINDINGS_UPDATED':
      return {
        ...state,
        streamingBindings: action.bindings,
        streamingControllerType: action.controllerType,
        streamingBindingsMode: action.mode,
      }
    case 'STREAMING_SESSION_STATE_CHANGED':
      return { ...state, streamingSessions: action.sessions }
    // Story 10.3: Streaming wheel mirror reducers
    case 'STREAMING_WHEEL_OPEN':
      return {
        ...state,
        streamingWheelOpen: true,
        streamingWheelActiveWheel: action.activeWheel,
        streamingWheelL2Segments: action.l2Segments,
        streamingWheelR2Segments: action.r2Segments,
        streamingWheelIsClosing: false,
        streamingWheelSelectedIndex: -1,
        streamingWheelDispatched: false,
      }
    case 'STREAMING_WHEEL_STICK_UPDATE':
      return { ...state, streamingWheelSelectedIndex: action.selectedIndex }
    case 'STREAMING_WHEEL_CLOSE':
      return { ...state, streamingWheelIsClosing: true, streamingWheelDispatched: action.dispatched }
    case 'STREAMING_WHEEL_OPEN_CLEAR':
      return { ...state, streamingWheelOpen: false, streamingWheelIsClosing: false }
    default:
      return state
  }
}

const initialState: HUDState = {
  visible: false,
  bindings: {},
  controllerType: null,
  mode: 'guided',
  // Story 10.1: Streaming Mode initial state
  streamingMode: false,
  streamingSessions: [],
  streamingBindings: {},
  streamingControllerType: null,
  streamingBindingsMode: 'guided',
  // Story 10.3: Streaming wheel mirror initial state
  streamingWheelOpen: false,
  streamingWheelActiveWheel: 'l2',
  streamingWheelL2Segments: [],
  streamingWheelR2Segments: [],
  streamingWheelSelectedIndex: -1,
  streamingWheelIsClosing: false,
  streamingWheelDispatched: false,
}

export function HUDOverlay(): React.ReactElement {
  const [state, dispatch] = useReducer(hudReducer, initialState)
  // Story 10.2: Active-press state — separate useState (not in useReducer) to allow timer side effects
  // Uses Map<string, number> where number is a monotonically increasing press counter.
  // The counter forces React key changes in ButtonMap, ensuring CSS animation restarts on rapid re-press.
  const [pressedButtons, setPressedButtons] = useState<Map<string, number>>(new Map())
  const pressTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const pressCounter = useRef(0)

  useEffect(() => {
    let wheelCloseTimer: ReturnType<typeof setTimeout> | undefined
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
      // Story 10.1: Handle streaming messages
      } else if (msg.type === 'STREAMING_MODE_TOGGLED') {
        dispatch({ type: 'STREAMING_MODE_TOGGLED', enabled: msg.payload.enabled })
      } else if (msg.type === 'STREAMING_BINDINGS_UPDATED') {
        dispatch({
          type: 'STREAMING_BINDINGS_UPDATED',
          bindings: msg.payload.bindings,
          controllerType: msg.payload.controllerType,
          mode: msg.payload.mode,
        })
      } else if (msg.type === 'STREAMING_SESSION_STATE_CHANGED') {
        dispatch({ type: 'STREAMING_SESSION_STATE_CHANGED', sessions: msg.payload.sessions })
      // Story 10.2: Handle button-press animation trigger
      } else if (msg.type === 'STREAMING_BUTTON_PRESSED') {
        const btn = msg.payload.button
        // Clear existing timer for re-press (allows re-triggering if button held and re-pressed)
        const existing = pressTimers.current.get(btn)
        if (existing !== undefined) clearTimeout(existing)
        // Add to pressed map with incrementing counter — forces React key change for animation restart
        pressCounter.current += 1
        const count = pressCounter.current
        setPressedButtons(prev => new Map([...prev, [btn, count]]))
        // Schedule removal after 300ms
        const timer = setTimeout(() => {
          setPressedButtons(prev => {
            const next = new Map(prev)
            next.delete(btn)
            return next
          })
          pressTimers.current.delete(btn)
        }, 300)
        pressTimers.current.set(btn, timer)
      // Story 10.3: Handle streaming wheel mirror messages
      } else if (msg.type === 'STREAMING_WHEEL_OPEN') {
        // Cancel any pending close timer from a previous wheel session
        if (wheelCloseTimer !== undefined) {
          clearTimeout(wheelCloseTimer)
          wheelCloseTimer = undefined
        }
        dispatch({
          type: 'STREAMING_WHEEL_OPEN',
          activeWheel: msg.payload.activeWheel,
          l2Segments: msg.payload.l2Segments,
          r2Segments: msg.payload.r2Segments,
        })
      } else if (msg.type === 'STREAMING_WHEEL_STICK_UPDATE') {
        dispatch({ type: 'STREAMING_WHEEL_STICK_UPDATE', selectedIndex: msg.payload.selectedIndex })
      } else if (msg.type === 'STREAMING_WHEEL_CLOSE') {
        dispatch({ type: 'STREAMING_WHEEL_CLOSE', dispatched: msg.payload.dispatched })
        // Clear wheel open state after animation completes (200ms dispatch + buffer)
        if (wheelCloseTimer !== undefined) {
          clearTimeout(wheelCloseTimer)
        }
        wheelCloseTimer = setTimeout(() => {
          wheelCloseTimer = undefined
          dispatch({ type: 'STREAMING_WHEEL_OPEN_CLEAR' })
        }, 250)
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      // Story 10.2: Clear all in-flight timers on unmount
      pressTimers.current.forEach(clearTimeout)
      if (wheelCloseTimer !== undefined) {
        clearTimeout(wheelCloseTimer)
      }
    }
  }, [])

  return (
    <>
      {state.visible && (
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
      )}
      {state.streamingMode && (
        <StreamingOverlay
          sessions={state.streamingSessions}
          bindings={state.streamingBindings}
          controllerType={state.streamingControllerType}
          mode={state.streamingBindingsMode}
          pressedButtons={pressedButtons}
          wheelOpen={state.streamingWheelOpen}
          wheelActiveWheel={state.streamingWheelActiveWheel}
          wheelL2Segments={state.streamingWheelL2Segments}
          wheelR2Segments={state.streamingWheelR2Segments}
          wheelSelectedIndex={state.streamingWheelSelectedIndex}
          wheelIsClosing={state.streamingWheelIsClosing}
          wheelDispatched={state.streamingWheelDispatched}
        />
      )}
    </>
  )
}
