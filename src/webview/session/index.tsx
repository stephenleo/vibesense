// src/webview/session/index.tsx
// Session panel webview entry point — React root for SlidePanel + SessionSwitcher

import React, { useReducer, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHostMessage } from '../../shared/messages'
import { SESSION_SWITCHER_DISPLAY_MS } from '../../shared/constants'
import type { Session, ControllerType } from '../../shared/types'
import { SlidePanel } from './SlidePanel'
import { SessionSwitcher } from './SessionSwitcher'
import '../shared-ui/tokens.css'
import './session.css'

// VSCode API available in webview browser context (injected by VSCode)
declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void }
const vscode = acquireVsCodeApi()

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  sessions: Session[]
  controllerType: ControllerType | null
  isExpanded: boolean
  switcherVisible: boolean
  switcherSessionIndex: number
  switcherSessionName: string
  switcherTotalSessions: number
}

type AppAction =
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SET_CONTROLLER'; controllerType: ControllerType }
  | { type: 'TOGGLE_EXPANDED' }
  | {
      type: 'SHOW_SWITCHER'
      payload: { sessionIndex: number; sessionName: string; totalSessions: number }
    }
  | { type: 'HIDE_SWITCHER' }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }
    case 'SET_CONTROLLER':
      return { ...state, controllerType: action.controllerType, isExpanded: true }
    case 'TOGGLE_EXPANDED':
      return { ...state, isExpanded: !state.isExpanded }
    case 'SHOW_SWITCHER':
      return {
        ...state,
        switcherVisible: true,
        switcherSessionIndex: action.payload.sessionIndex,
        switcherSessionName: action.payload.sessionName,
        switcherTotalSessions: action.payload.totalSessions,
      }
    case 'HIDE_SWITCHER':
      return { ...state, switcherVisible: false }
    default:
      return state
  }
}

const initialState: AppState = {
  sessions: [],
  controllerType: null,
  isExpanded: false,
  switcherVisible: false,
  switcherSessionIndex: 0,
  switcherSessionName: '',
  switcherTotalSessions: 1,
}

// ─── App Component ────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState)
  // Timer ref (not state) to avoid extra re-renders on timer changes (AC 6: rapid L1/R1)
  const switcherTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'SESSION_LIST_UPDATED') {
        dispatch({ type: 'SET_SESSIONS', sessions: msg.payload.sessions })
      } else if (msg.type === 'CONTROLLER_CONNECTED') {
        dispatch({ type: 'SET_CONTROLLER', controllerType: msg.payload.controllerType })
      } else if (msg.type === 'SESSION_SWITCHED') {
        // AC 6: Cancel any pending dismiss timer before starting new one (no flicker/stacking)
        if (switcherTimerRef.current !== null) {
          clearTimeout(switcherTimerRef.current)
        }
        dispatch({ type: 'SHOW_SWITCHER', payload: msg.payload })
        switcherTimerRef.current = setTimeout(() => {
          dispatch({ type: 'HIDE_SWITCHER' })
          switcherTimerRef.current = null
        }, SESSION_SWITCHER_DISPLAY_MS)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      // Cleanup timer on unmount (prevent memory leak)
      if (switcherTimerRef.current !== null) {
        clearTimeout(switcherTimerRef.current)
      }
    }
  }, [])

  function handleToggle(): void {
    dispatch({ type: 'TOGGLE_EXPANDED' })
    vscode.postMessage({ type: 'SLIDE_PANEL_TOGGLE', payload: {} })
  }

  return (
    <>
      <SlidePanel
        sessions={state.sessions}
        isExpanded={state.isExpanded}
        onToggle={handleToggle}
      />
      <SessionSwitcher
        sessionIndex={state.switcherSessionIndex}
        sessionName={state.switcherSessionName}
        totalSessions={state.switcherTotalSessions}
        visible={state.switcherVisible}
      />
    </>
  )
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const container = document.getElementById('root')
if (container) {
  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
