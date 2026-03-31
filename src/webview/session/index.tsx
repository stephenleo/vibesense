// src/webview/session/index.tsx
// Session panel webview entry point — React root for SlidePanel

import React, { useReducer } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHostMessage } from '../../shared/messages'
import type { Session, ControllerType } from '../../shared/types'
import { SlidePanel } from './SlidePanel'
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
}

type AppAction =
  | { type: 'SET_SESSIONS'; sessions: Session[] }
  | { type: 'SET_CONTROLLER'; controllerType: ControllerType }
  | { type: 'TOGGLE_EXPANDED' }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.sessions }
    case 'SET_CONTROLLER':
      return { ...state, controllerType: action.controllerType, isExpanded: true }
    case 'TOGGLE_EXPANDED':
      return { ...state, isExpanded: !state.isExpanded }
    default:
      return state
  }
}

const initialState: AppState = {
  sessions: [],
  controllerType: null,
  isExpanded: false,
}

// ─── App Component ────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState)

  React.useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'SESSION_LIST_UPDATED') {
        dispatch({ type: 'SET_SESSIONS', sessions: msg.payload.sessions })
      } else if (msg.type === 'CONTROLLER_CONNECTED') {
        dispatch({ type: 'SET_CONTROLLER', controllerType: msg.payload.controllerType })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  function handleToggle(): void {
    dispatch({ type: 'TOGGLE_EXPANDED' })
    vscode.postMessage({ type: 'SLIDE_PANEL_TOGGLE', payload: {} })
  }

  return (
    <SlidePanel
      sessions={state.sessions}
      isExpanded={state.isExpanded}
      onToggle={handleToggle}
    />
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
