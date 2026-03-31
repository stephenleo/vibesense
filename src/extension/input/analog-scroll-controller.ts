// src/extension/input/analog-scroll-controller.ts
// Controls terminal scrolling via analog stick input with proportional speed

import * as vscode from 'vscode'
import { logger } from '../logger'
import { SCROLL_TICK_MS, MAX_LINES_PER_TICK, SCROLL_DEAD_ZONE } from '../../shared/constants'
import type { AxisId } from '../../shared/types'

/**
 * Manages a fixed-interval scroll loop driven by analog stick displacement.
 *
 * Design notes:
 * - Owns the setInterval/clearInterval loop; never blocks the hot path (NFR-P1).
 * - Receives all axis values (including dead zone) via update() so it can self-manage
 *   start/stop and detect the return-to-dead-zone transition (avoids missed-stop bug).
 * - All executeCommand calls are fire-and-forget and wrapped in try/catch (NFR-R1).
 * - Auto-scroll restore: fires workbench.action.terminal.scrollToBottom when stick
 *   returns to dead zone after scrolling was active (AC 3). VSCode terminals auto-scroll
 *   by default when at the bottom of the buffer — this command navigates to bottom and
 *   restores the follow-new-output behavior.
 */
export class AnalogScrollController implements vscode.Disposable {
  private scrollInterval: ReturnType<typeof setInterval> | undefined = undefined

  /**
   * Called on every axis event (including dead zone values) so the controller
   * can detect the return-to-dead-zone transition and stop the scroll loop.
   *
   * Only left_y and right_y are acted upon; other axes are ignored.
   */
  update(axis: AxisId, value: number): void {
    if (axis !== 'left_y' && axis !== 'right_y') {
      return
    }

    if (Math.abs(value) < SCROLL_DEAD_ZONE) {
      // Stick returned to dead zone — stop scrolling and restore auto-scroll
      if (this.scrollInterval !== undefined) {
        this.stopScroll(/* restoreAutoScroll */ true)
      }
      return
    }

    const linesPerTick = this.computeLinesPerTick(Math.abs(value))
    const commandId =
      value < 0
        ? 'workbench.action.terminal.scrollUp'
        : 'workbench.action.terminal.scrollDown'

    // If already scrolling with same axis and direction, update is handled by the running interval.
    // Restart interval on any axis/direction change to pick up updated magnitude.
    if (this.scrollInterval !== undefined) {
      clearInterval(this.scrollInterval)
      this.scrollInterval = undefined
    }

    this.scrollInterval = setInterval(() => {
      try {
        for (let i = 0; i < linesPerTick; i++) {
          void vscode.commands.executeCommand(commandId)
        }
      } catch (err) {
        logger.error('AnalogScrollController: executeCommand error', err)
      }
    }, SCROLL_TICK_MS)
  }

  /**
   * Computes lines to scroll per tick based on stick displacement.
   * magnitude = (absValue - DEAD_ZONE) / (1 - DEAD_ZONE) → [0, 1]
   * linesPerTick = max(1, round(magnitude * MAX_LINES_PER_TICK))
   */
  private computeLinesPerTick(absValue: number): number {
    const clamped = Math.min(absValue, 1.0)
    const magnitude = (clamped - SCROLL_DEAD_ZONE) / (1.0 - SCROLL_DEAD_ZONE)
    return Math.max(1, Math.round(magnitude * MAX_LINES_PER_TICK))
  }

  private stopScroll(restoreAutoScroll: boolean): void {
    if (this.scrollInterval !== undefined) {
      clearInterval(this.scrollInterval)
      this.scrollInterval = undefined
    }

    if (restoreAutoScroll) {
      // workbench.action.terminal.scrollToBottom navigates to the live output position
      // and re-enables the terminal's follow-new-output behavior (AC 3).
      try {
        void vscode.commands.executeCommand('workbench.action.terminal.scrollToBottom')
      } catch (err) {
        logger.error('AnalogScrollController: scrollToBottom error', err)
      }
    }
  }

  dispose(): void {
    this.stopScroll(/* restoreAutoScroll */ false)
  }
}
