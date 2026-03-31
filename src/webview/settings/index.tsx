// src/webview/settings/index.tsx
// Settings panel webview entry point — React root for VibeSense Settings

import React, { useReducer } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHostMessage } from '../../shared/messages'
import type { ControllerType } from '../../shared/types'
import { SettingsPanel } from './SettingsPanel'
import '../shared-ui/tokens.css'
import './settings.css'

// VSCode API available in webview browser context (injected by VSCode)
declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void }
const vscode = acquireVsCodeApi()

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  bindings: Record<string, string>
  controllerType: ControllerType | null
  status: 'idle' | 'loading' | 'ready' | 'error'
}

type AppAction =
  | { type: 'REQUEST_LOAD' }
  | { type: 'SETTINGS_LOADED'; bindings: Record<string, string>; controllerType: ControllerType | null }
  | { type: 'CONTROLLER_CONNECTED'; controllerType: ControllerType }
  | { type: 'BINDING_APPLIED'; button: string; command: string }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'REQUEST_LOAD':
      return { ...state, status: 'loading' }
    case 'SETTINGS_LOADED':
      return {
        ...state,
        bindings: action.bindings,
        controllerType: action.controllerType,
        status: 'ready',
      }
    case 'CONTROLLER_CONNECTED':
      return { ...state, controllerType: action.controllerType }
    case 'BINDING_APPLIED':
      return {
        ...state,
        bindings: { ...state.bindings, [action.button]: action.command },
      }
    default:
      return state
  }
}

const initialState: AppState = {
  bindings: {},
  controllerType: null,
  status: 'idle',
}

// ─── App Component ────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState)

  React.useEffect(() => {
    // Request current state from extension host on mount
    dispatch({ type: 'REQUEST_LOAD' })
    vscode.postMessage({ type: 'SETTINGS_REQUEST_LOAD', payload: {} })

    function handleMessage(event: MessageEvent): void {
      const msg = parseHostMessage(event.data)
      if (!msg) return

      if (msg.type === 'SETTINGS_LOADED') {
        dispatch({
          type: 'SETTINGS_LOADED',
          bindings: msg.payload.bindings,
          controllerType: msg.payload.controllerType,
        })
      } else if (msg.type === 'CONTROLLER_CONNECTED') {
        dispatch({ type: 'CONTROLLER_CONNECTED', controllerType: msg.payload.controllerType })
      } else if (msg.type === 'SETTINGS_BINDING_APPLIED') {
        dispatch({ type: 'BINDING_APPLIED', button: msg.payload.button, command: msg.payload.command })
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  function handleBindingChange(button: string, command: string): void {
    vscode.postMessage({ type: 'SETTINGS_BINDING_CHANGED', payload: { button, command } })
  }

  function handleResetSection(buttons: string[]): void {
    vscode.postMessage({ type: 'SETTINGS_RESET_SECTION', payload: { buttons } })
  }

  return (
    <SettingsPanel
      bindings={state.bindings}
      controllerType={state.controllerType}
      onBindingChange={handleBindingChange}
      onResetSection={handleResetSection}
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
