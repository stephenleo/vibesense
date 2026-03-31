// src/webview/onboarding/index.tsx
// Onboarding tutorial webview entry point — React root for VibeSense Onboarding

import React, { useReducer, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import { parseHostMessage } from '../../shared/messages'
import type { ControllerType } from '../../shared/types'
import { OnboardingFlow } from './OnboardingFlow'
import '../shared-ui/tokens.css'
import './onboarding.css'

// VSCode API available in webview browser context (injected by VSCode)
declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void }
const vscode = acquireVsCodeApi()

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  controllerType: ControllerType | null
  currentStep: number
  pressedButton: string | null
  status: 'idle' | 'loading' | 'ready'
}

type AppAction =
  | { type: 'ONBOARDING_INIT'; controllerType: ControllerType | null }
  | { type: 'BUTTON_PRESSED'; button: string }
  | { type: 'CLEAR_PRESSED_BUTTON' }
  | { type: 'ADVANCE_STEP' }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ONBOARDING_INIT':
      return { ...state, controllerType: action.controllerType, status: 'ready' }
    case 'BUTTON_PRESSED':
      return { ...state, pressedButton: action.button }
    case 'CLEAR_PRESSED_BUTTON':
      return { ...state, pressedButton: null }
    case 'ADVANCE_STEP':
      return { ...state, currentStep: state.currentStep + 1 }
    default:
      return state
  }
}

const initialState: AppState = {
  controllerType: null,
  currentStep: 0,
  pressedButton: null,
  status: 'idle',
}

// ─── App Component ────────────────────────────────────────────────────────────

function App(): React.ReactElement {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    let highlightTimer: ReturnType<typeof setTimeout> | undefined

    function handleMessage(event: MessageEvent): void {
      const msg = parseHostMessage(event.data)
      if (!msg) return

      if (msg.type === 'ONBOARDING_INIT') {
        dispatch({ type: 'ONBOARDING_INIT', controllerType: msg.payload.controllerType })
      } else if (msg.type === 'ONBOARDING_BUTTON_PRESSED') {
        dispatch({ type: 'BUTTON_PRESSED', button: msg.payload.button })
        // Clear any previous highlight timer before scheduling a new one
        if (highlightTimer !== undefined) clearTimeout(highlightTimer)
        // Clear pressed button after 800ms visual highlight delay
        highlightTimer = setTimeout(() => {
          dispatch({ type: 'CLEAR_PRESSED_BUTTON' })
          highlightTimer = undefined
        }, 800)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
      if (highlightTimer !== undefined) clearTimeout(highlightTimer)
    }
  }, [])

  const advanceStep = useCallback(() => {
    const TOTAL_STEPS = 6
    // Guard: ignore advances after tutorial is already complete
    if (state.currentStep >= TOTAL_STEPS) return
    const nextStep = state.currentStep + 1
    if (nextStep >= TOTAL_STEPS) {
      // Final step — post ONBOARDING_COMPLETE
      vscode.postMessage({ type: 'ONBOARDING_COMPLETE', payload: {} })
    } else {
      // Post step complete notification
      vscode.postMessage({ type: 'ONBOARDING_STEP_COMPLETE', payload: { stepIndex: state.currentStep } })
    }
    dispatch({ type: 'ADVANCE_STEP' })
  }, [state.currentStep])

  // AC 5: Keyboard fallback — Space/Enter advances the current step
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === ' ' || e.key === 'Enter') {
        // Skip if a <button> is focused — its own click handler will fire
        if ((e.target as HTMLElement)?.tagName === 'BUTTON') return
        advanceStep()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [advanceStep])

  return (
    <OnboardingFlow
      controllerType={state.controllerType}
      currentStep={state.currentStep}
      pressedButton={state.pressedButton}
      onStepAdvance={advanceStep}
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
