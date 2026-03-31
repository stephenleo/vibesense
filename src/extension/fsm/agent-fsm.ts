// src/extension/fsm/agent-fsm.ts
// Per-session Agent FSM backed by Node EventEmitter
// State transitions are enforced via dispatch() — direct mutation is blocked by private field

import { EventEmitter } from 'events'
import type { AgentState } from '../../shared/types'
import { FSM_TRANSITIONS } from './states'
import type { AgentFsmEvent } from './states'
import { logger } from '../logger'

export class AgentFSM extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _state: AgentState = 'idle'

  /** Public read-only accessor — private _state blocks direct mutation (AC 4) */
  get state(): AgentState {
    return this._state
  }

  /**
   * Dispatch an FSM event. Applies FSM_TRANSITIONS to compute next state.
   * Emits 'stateChanged' with (prev, next) only when state actually changes.
   * Invalid transitions (source state not in the event map) are silently ignored with a warn log.
   */
  dispatch(event: AgentFsmEvent): void {
    const eventTransitions = FSM_TRANSITIONS[event]
    const nextState = eventTransitions[this._state]

    if (nextState === undefined) {
      logger.warn(
        `AgentFSM: invalid transition ignored — event="${event}" currentState="${this._state}"`,
      )
      return
    }

    if (nextState === this._state) {
      // RESET to 'idle' when already idle — no-op (no event emitted)
      return
    }

    const prev = this._state
    this._state = nextState
    this.emit('stateChanged', prev, nextState)
  }

  /** Remove all listeners and release references */
  dispose(): void {
    this.removeAllListeners()
  }
}
