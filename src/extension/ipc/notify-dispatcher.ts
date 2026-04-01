// src/extension/ipc/notify-dispatcher.ts
// Routes validated vibeSense.notify() payloads to hardware output controllers
// Called by message-handler.ts after Zod validation succeeds

import type { NotifyMessage } from '../../shared/messages'
import type { ControllerHAL } from '../hid/hal'
import { logger } from '../logger'

export class NotifyDispatcher {
  private readonly getHal: () => ControllerHAL | null

  constructor(getHal: () => ControllerHAL | null) {
    this.getHal = getHal
  }

  /**
   * Dispatch a validated NotifyMessage to the appropriate hardware channels.
   * Each channel (haptic, LED, audio) is independently guarded — one failure
   * does not suppress the others.
   */
  dispatch(msg: NotifyMessage): void {
    const hal = this.getHal()
    if (!hal) {
      logger.info('NotifyDispatcher: no controller connected, payload discarded', msg.event)
      return
    }

    logger.info(`NotifyDispatcher: dispatching event "${msg.event}"`)

    if (msg.haptic !== undefined && msg.haptic !== 'none') {
      try {
        hal.setHaptic(msg.haptic)
      } catch (err) {
        logger.error('NotifyDispatcher: setHaptic error', err)
      }
    }

    if (msg.led !== undefined) {
      try {
        hal.setLED(msg.led.color)
      } catch (err) {
        logger.error('NotifyDispatcher: setLED error', err)
      }
    }

    if (msg.audio !== undefined && msg.audio !== 'none') {
      try {
        hal.playAudio(msg.audio)
      } catch (err) {
        logger.error('NotifyDispatcher: playAudio error', err)
      }
    }
  }
}
