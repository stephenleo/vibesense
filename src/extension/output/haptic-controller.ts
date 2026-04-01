// src/extension/output/haptic-controller.ts
// Haptic routing layer — listens to SessionManager FSM events and calls hal.setHaptic(pattern)
// DO NOT reimplement rumble logic; DualSenseDriver.setHaptic() already handles all patterns.

import type { SessionManager } from '../session/session-manager'
import type { ControllerHAL } from '../hid/hal'
import type { AgentState, HapticPattern, FeedbackPriority } from '../../shared/types'
import { AGENT_STATE_PRIORITY } from '../../shared/types'
import { logger } from '../logger'

/** Maps agent FSM states to haptic patterns */
const STATE_TO_HAPTIC: Record<AgentState, HapticPattern> = {
  processing: 'slow_rumble',
  'needs-input': 'double_pulse',
  idle: 'single_pulse',
  error: 'double_pulse',
}

/**
 * HapticController subscribes to sessionManager state transitions and routes
 * the appropriate haptic pattern to the active DualSense HAL.
 *
 * Responsibilities:
 * - Map AgentState → HapticPattern
 * - Guard: only fire for controllerType === 'dualsense'
 * - Anti-stacking: cancel any in-flight haptic before starting a new one
 * - DND: suppress haptic when isDndSuppressed() returns true
 * - Never throw (NFR-R1)
 */
export class HapticController {
  private readonly boundHandler: (sessionId: string, prev: AgentState, next: AgentState) => void

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly getHal: () => ControllerHAL | null,
    private readonly isDndSuppressed: (priority: FeedbackPriority) => boolean = () => false,
  ) {
    this.boundHandler = (_sessionId: string, _prev: AgentState, next: AgentState) => {
      try {
        this.handleStateChange(next)
      } catch (err) {
        logger.error('HapticController: sessionStateChanged handler error', err)
      }
    }

    this.sessionManager.on('sessionStateChanged', this.boundHandler)
  }

  /**
   * Route state transition to the appropriate haptic pattern.
   * Guards against non-DualSense controllers and DND suppression.
   * Cancels any in-flight haptic before firing a new one (anti-stacking).
   */
  private handleStateChange(next: AgentState): void {
    const hal = this.getHal()

    // Guard: only fire haptics for DualSense — silent no-op for xbox/generic-hid
    if (!hal || hal.controllerType !== 'dualsense') {
      return
    }

    // DND suppression — check priority for this state
    const priority = AGENT_STATE_PRIORITY[next]
    if (this.isDndSuppressed(priority)) {
      logger.info(`HapticController: haptic suppressed by DND for state "${next}"`)
      return
    }

    const pattern = STATE_TO_HAPTIC[next]

    // Anti-stacking: cancel any in-flight haptic sequence before starting a new one
    // DualSenseDriver.setHaptic('none') cancels ongoing rumble timers
    hal.setHaptic('none')

    hal.setHaptic(pattern)
    logger.info(`HapticController: fired "${pattern}" for state "${next}"`)
  }

  /** Remove listener from sessionManager — called by VSCode subscription dispose */
  dispose(): void {
    this.sessionManager.removeListener('sessionStateChanged', this.boundHandler)
  }
}
