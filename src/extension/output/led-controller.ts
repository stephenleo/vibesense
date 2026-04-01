// src/extension/output/led-controller.ts
// LED color state controller — maps agent FSM states to DualSense lightbar colors
// Subscribes to SessionManager 'sessionStateChanged', computes priority color, drives HAL.setLED()

import type { SessionManager } from '../session/session-manager'
import type { ControllerHAL } from '../hid/hal'
import type { AgentFSM } from '../fsm/agent-fsm'
import type { AgentState, FeedbackPriority } from '../../shared/types'
import { AGENT_STATE_PRIORITY } from '../../shared/types'
import { logger } from '../logger'

/**
 * Color mapping: agent state → hex color string (or null = off)
 * Matches UX design spec (UX-DR4) and FR25 requirements.
 */
/* eslint-disable @typescript-eslint/naming-convention */
const STATE_COLORS: Record<AgentState, string | null> = {
  error: '#E05555',
  'needs-input': '#FFB800',
  processing: '#00C8FF',
  idle: null, // off
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Priority order for multi-session color resolution (AC5).
 * error > needs-input > processing > idle
 */
const STATE_PRIORITY: AgentState[] = ['error', 'needs-input', 'processing', 'idle']

/**
 * LedController — drives the DualSense lightbar based on the highest-priority
 * agent FSM state across all active sessions.
 *
 * - Subscribes to `sessionManager.on('sessionStateChanged', ...)`
 * - Implements amber pulsing (1Hz) for 'needs-input' state
 * - Hot-swaps HAL via `updateHal()` for controller reconnect
 * - Cleans up via `dispose()` — removes listener, clears pulse timer
 */
export class LedController {
  private hal: ControllerHAL | null
  private pulseTimer: ReturnType<typeof setInterval> | null = null
  private currentColor: string | null = null

  constructor(
    private readonly sessionManager: SessionManager,
    hal: ControllerHAL | null,
    private readonly isDndSuppressed: (priority: FeedbackPriority) => boolean = () => false,
  ) {
    this.hal = hal
    this.sessionManager.on('sessionStateChanged', this.onSessionStateChanged)
  }

  /**
   * Hot-swap the HAL when a controller reconnects or disconnects.
   * Re-applies current color to the new controller immediately.
   */
  updateHal(hal: ControllerHAL | null): void {
    this.hal = hal
    // Re-apply current color to new controller (AC: controller reconnect)
    if (this.currentColor === '#FFB800') {
      // Amber pulse is running — re-apply static amber to new HAL
      this.applyColor('#FFB800')
    } else {
      this.applyColor(this.currentColor)
    }
  }

  /**
   * Dispose: remove sessionStateChanged listener and clear pulse timer.
   * Safe to call multiple times (NFR-R1).
   */
  dispose(): void {
    this.stopPulse()
    this.sessionManager.removeListener('sessionStateChanged', this.onSessionStateChanged)
  }

  /**
   * Arrow function — bound to `this` for use as event listener.
   * Called on every FSM state transition across all sessions.
   */
  private readonly onSessionStateChanged = (
    _sessionId: string,
    _prev: AgentState,
    next: AgentState,
  ): void => {
    try {
      // DND suppression — skip for idle ("turn off feedback" always passes through)
      if (next !== 'idle') {
        const priority = AGENT_STATE_PRIORITY[next]
        if (this.isDndSuppressed(priority)) {
          logger.info(`LedController: LED suppressed by DND for state "${next}"`)
          return
        }
      }
      const color = this.computeColor(this.sessionManager.getSessions())
      if (color !== this.currentColor) {
        this.currentColor = color
        this.stopPulse()
        if (color === '#FFB800') {
          this.startAmberPulse()
        } else {
          this.applyColor(color)
        }
      }
    } catch (err) {
      logger.error('LedController: onSessionStateChanged error', err)
    }
  }

  /**
   * Compute the highest-priority color across all sessions.
   * Returns null when all sessions are idle (lightbar off).
   * AC5: error > needs-input > processing > idle
   */
  computeColor(sessions: ReadonlyMap<string, AgentFSM>): string | null {
    for (const state of STATE_PRIORITY) {
      for (const fsm of sessions.values()) {
        if (fsm.state === state) {
          return STATE_COLORS[state]
        }
      }
    }
    return null // all idle or no sessions
  }

  /**
   * Apply a single static color to the HAL.
   * Silently skips when hal is null (controller disconnected — NFR-R1).
   */
  private applyColor(color: string | null): void {
    if (!this.hal) {
      return
    }
    try {
      this.hal.setLED(color ?? '#000000')
    } catch (err) {
      logger.error('LedController: setLED error', err)
    }
  }

  /**
   * Start amber pulse: 1Hz full cycle (500ms on, 500ms off) for needs-input state.
   * AC2: slow pulsing pattern.
   */
  private startAmberPulse(): void {
    let on = true
    this.applyColor('#FFB800') // initial on state
    this.pulseTimer = setInterval(() => {
      try {
        on = !on
        this.applyColor(on ? '#FFB800' : '#000000')
      } catch (err) {
        logger.error('LedController: pulse error', err)
      }
    }, 500) // 500ms half-period = 1Hz full cycle
  }

  /**
   * Stop the amber pulse timer and clear the reference.
   */
  private stopPulse(): void {
    if (this.pulseTimer !== null) {
      clearInterval(this.pulseTimer)
      this.pulseTimer = null
    }
  }
}
