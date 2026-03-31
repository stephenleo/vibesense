// src/extension/session/session-manager.ts
// Owns Map<sessionId, AgentFSM> and derives AggregateGameState (PLAY | PAUSE)
// Future stories (5.2 IPC + 5.3 pipe-server) inject events via handleHookMessage()

import { EventEmitter } from 'events'
import type { AgentState } from '../../shared/types'
import type { HookMessage } from '../../shared/messages'
import { AgentFSM } from '../fsm/agent-fsm'
import type { AggregateGameState } from '../fsm/states'
import { logger } from '../logger'

export class SessionManager extends EventEmitter {
  private sessions: Map<string, AgentFSM> = new Map()
  private lastAggregateState: AggregateGameState = 'PLAY'

  /**
   * Route an inbound hook message to the appropriate FSM.
   * Creates a new FSM for unknown session_ids automatically.
   * Hook → FSM event mapping:
   *   stop           → AGENT_COMPLETE
   *   post_tool_use  → NEEDS_INPUT
   */
  handleHookMessage(msg: HookMessage): void {
    const fsm = this.getOrCreateFsm(msg.session_id)

    switch (msg.hook) {
      case 'stop':
        fsm.dispatch('AGENT_COMPLETE')
        break
      case 'post_tool_use':
        fsm.dispatch('NEEDS_INPUT')
        break
      default: {
        // Exhaustiveness guard — TypeScript will catch unknown hooks at compile time
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const _exhaustive: never = msg.hook
        logger.warn(`SessionManager: unhandled hook type "${String(_exhaustive)}"`)
      }
    }
  }

  /**
   * Return an existing FSM for sessionId, or create a new one.
   * Subscribes to the new FSM's 'stateChanged' event to recompute aggregate state and emit
   * 'aggregateGameStateChanged' and 'sessionStateChanged'.
   */
  getOrCreateFsm(sessionId: string): AgentFSM {
    const existing = this.sessions.get(sessionId)
    if (existing !== undefined) {
      return existing
    }

    const fsm = new AgentFSM()
    this.sessions.set(sessionId, fsm)

    fsm.on('stateChanged', (prev: AgentState, next: AgentState) => {
      logger.info(
        `SessionManager: session "${sessionId}" state changed ${prev} → ${next}`,
      )
      this.emit('sessionStateChanged', sessionId, prev, next)

      const aggregateState = this.getAggregateGameState()
      if (aggregateState !== this.lastAggregateState) {
        this.lastAggregateState = aggregateState
        this.emit('aggregateGameStateChanged', aggregateState)
      }
    })

    logger.info(`SessionManager: created new FSM for session "${sessionId}"`)
    return fsm
  }

  /**
   * Derive aggregate game state from all tracked sessions.
   * Returns PAUSE if any session is 'needs-input' or 'error'.
   * Returns PLAY when all sessions are 'processing' or 'idle', or when no sessions exist.
   */
  getAggregateGameState(): AggregateGameState {
    for (const fsm of this.sessions.values()) {
      if (fsm.state === 'needs-input' || fsm.state === 'error') {
        return 'PAUSE'
      }
    }
    return 'PLAY'
  }

  /**
   * Read-only access to the session map — for HUD/LED subsystems.
   * Returns the internal map as ReadonlyMap to prevent external mutation.
   */
  getSessions(): ReadonlyMap<string, AgentFSM> {
    return this.sessions
  }

  /** Dispose all FSMs and remove all listeners from this manager */
  dispose(): void {
    for (const fsm of this.sessions.values()) {
      fsm.dispose()
    }
    this.sessions.clear()
    this.removeAllListeners()
  }
}
