// src/extension/fsm/states.ts
// Agent FSM state, event, and AggregateGameState types
// DO NOT redefine AgentState — import from src/shared/types

import type { AgentState } from '../../shared/types'

/** FSM events that drive agent state transitions */
export type AgentFsmEvent =
  | 'AGENT_PROCESSING'
  | 'NEEDS_INPUT'
  | 'AGENT_COMPLETE'
  | 'AGENT_ERROR'
  | 'RESET'

/** Aggregate game state derived from all open sessions */
export type AggregateGameState = 'PLAY' | 'PAUSE'

/**
 * Valid FSM transition table.
 * Key = event; value = map of (source state → target state).
 * Source states NOT listed in an event's map are invalid for that event — silently ignored.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const FSM_TRANSITIONS: Record<AgentFsmEvent, Partial<Record<AgentState, AgentState>>> = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AGENT_PROCESSING: { idle: 'processing', 'needs-input': 'processing', error: 'processing' },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  NEEDS_INPUT:      { processing: 'needs-input' },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AGENT_COMPLETE:   { processing: 'idle', 'needs-input': 'idle' },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AGENT_ERROR:      { processing: 'error', 'needs-input': 'error' },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  RESET:            { idle: 'idle', processing: 'idle', 'needs-input': 'idle', error: 'idle' },
}
