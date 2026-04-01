// src/webview/achievement-burst/AchievementBurst.tsx
// AchievementBurst overlay React component (Story 9.5)
// Listens for ACHIEVEMENT_BURST_SHOW via postMessage; renders non-blocking celebration overlay.
// States: hidden → animating → fading-out (auto-dismisses after animation completes)

import React, { useEffect, useReducer } from 'react'
import { parseHostMessage } from '../../shared/messages'
import './achievement-burst.css'

type BurstPhase = 'hidden' | 'animating' | 'fading-out'

interface BurstState {
  phase: BurstPhase
  id: string
  label: string
  tier: string
  description: string
}

type BurstAction =
  | { type: 'SHOW'; id: string; label: string; tier: string; description: string }
  | { type: 'FADE_OUT' }
  | { type: 'HIDE' }

function burstReducer(state: BurstState, action: BurstAction): BurstState {
  switch (action.type) {
    case 'SHOW':
      return {
        phase: 'animating',
        id: action.id,
        label: action.label,
        tier: action.tier,
        description: action.description,
      }
    case 'FADE_OUT':
      return { ...state, phase: 'fading-out' }
    case 'HIDE':
      return { ...state, phase: 'hidden' }
    default:
      return state
  }
}

const initialState: BurstState = {
  phase: 'hidden',
  id: '',
  label: '',
  tier: '',
  description: '',
}

/** Total visible duration: 2000ms animating + 400ms fading-out = 2400ms total */
const ANIMATING_DURATION_MS = 2000
const FADING_OUT_DURATION_MS = 400

export function AchievementBurst(): React.ReactElement {
  const [state, dispatch] = useReducer(burstReducer, initialState)

  // Listen for ACHIEVEMENT_BURST_SHOW host messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'ACHIEVEMENT_BURST_SHOW') {
        dispatch({
          type: 'SHOW',
          id: msg.payload.id,
          label: msg.payload.label,
          tier: msg.payload.tier,
          description: msg.payload.description,
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Auto-dismiss: animating → fading-out → hidden
  useEffect(() => {
    if (state.phase !== 'animating') return

    const fadeTimer = setTimeout(() => {
      dispatch({ type: 'FADE_OUT' })
    }, ANIMATING_DURATION_MS)

    return () => clearTimeout(fadeTimer)
  }, [state.phase, state.id])

  useEffect(() => {
    if (state.phase !== 'fading-out') return

    const hideTimer = setTimeout(() => {
      dispatch({ type: 'HIDE' })
    }, FADING_OUT_DURATION_MS)

    return () => clearTimeout(hideTimer)
  }, [state.phase])

  return (
    <div
      className={`achievement-burst-overlay ${state.phase}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {state.phase !== 'hidden' && (
        <div className="achievement-burst-card">
          <div className="achievement-burst-unlocked">Achievement Unlocked</div>
          <div className={`achievement-burst-tier ${state.tier}`}>{state.tier}</div>
          <h2 className="achievement-burst-label">{state.label}</h2>
          <p className="achievement-burst-description">{state.description}</p>
        </div>
      )}
    </div>
  )
}
