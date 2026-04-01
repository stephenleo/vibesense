// src/webview/stats/StatsPanel.tsx
// Main React component for the VibeSense Stats Dashboard (Story 9.2)
// Manages state via useReducer; receives all data from host via postMessage
// AC1: ratio trend chart, completion rate, streak
// AC2: placeholder when < 5 sessions
// AC3: keyboard-navigable (NFR-A1)

import React, { useEffect, useReducer } from 'react'
import { parseHostMessage } from '../../shared/messages'
import { RatioTrendChart } from './RatioTrendChart'
import { StatsCard } from './StatsCard'

interface SessionData {
  sessionId: string
  startedAt: number
  endedAt: number
  controllerActions: number
  keyboardActions: number
  ratio: number
  controllerOnly: boolean
}

interface StatsPanelState {
  sessions: SessionData[]
  streak: number
  loaded: boolean
}

type StatsPanelAction =
  | { type: 'STATS_LOADED'; sessions: SessionData[]; streak: number }

function statsReducer(state: StatsPanelState, action: StatsPanelAction): StatsPanelState {
  switch (action.type) {
    case 'STATS_LOADED':
      return { ...state, sessions: action.sessions, streak: action.streak, loaded: true }
    default:
      return state
  }
}

const initialState: StatsPanelState = {
  sessions: [],
  streak: 0,
  loaded: false,
}

export function StatsPanel(): React.ReactElement {
  const [state, dispatch] = useReducer(statsReducer, initialState)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = parseHostMessage(event.data)
      if (!msg) return
      if (msg.type === 'STATS_LOADED') {
        dispatch({
          type: 'STATS_LOADED',
          sessions: msg.payload.sessions,
          streak: msg.payload.streak,
        })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Compute derived stats
  const last30 = state.sessions.slice(-30)
  const completionRate = state.sessions.length > 0
    ? Math.round((state.sessions.filter(s => s.controllerOnly).length / state.sessions.length) * 100)
    : 0

  const hasEnoughData = state.sessions.length >= 5

  return (
    <main className="stats-panel" role="main" aria-label="VibeSense Stats Dashboard">
      <header className="stats-header">
        <h1 className="stats-title">VibeSense Stats</h1>
        <span className="stats-subtitle">
          {state.loaded
            ? `${state.sessions.length} session${state.sessions.length !== 1 ? 's' : ''} recorded`
            : 'Loading…'
          }
        </span>
      </header>

      <section
        className="stats-cards-row"
        aria-label="Summary statistics"
      >
        <StatsCard
          label="Controller-Only Rate"
          value={`${completionRate}%`}
          description="Sessions completed without any keyboard input"
          highlight={completionRate >= 80}
        />
        <StatsCard
          label="Current Streak"
          value={`${state.streak} day${state.streak !== 1 ? 's' : ''}`}
          description="Consecutive days with at least one session"
          highlight={state.streak >= 3}
        />
        <StatsCard
          label="Total Sessions"
          value={String(state.sessions.length)}
          description="Sessions tracked since VibeSense was installed"
          highlight={false}
        />
      </section>

      <section
        className="stats-chart-section"
        aria-label="Controller action ratio trend"
      >
        <h2 className="stats-section-title">Ratio Trend</h2>
        <p className="stats-section-subtitle">Controller actions as % of total — last {Math.min(30, state.sessions.length)} sessions</p>
        {!state.loaded ? (
          <div className="stats-placeholder" role="status" aria-live="polite">
            Loading session data…
          </div>
        ) : !hasEnoughData ? (
          <div className="stats-placeholder" role="status" aria-live="polite">
            <span className="stats-placeholder-icon" aria-hidden="true">📊</span>
            <p className="stats-placeholder-heading">Not enough data yet</p>
            <p className="stats-placeholder-body">
              {state.sessions.length === 0
                ? 'No sessions recorded. Start coding with your controller to see stats here.'
                : `${state.sessions.length} of 5 sessions needed. Keep going!`
              }
            </p>
          </div>
        ) : (
          <RatioTrendChart sessions={last30} />
        )}
      </section>
    </main>
  )
}
