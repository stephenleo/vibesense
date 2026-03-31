// src/extension/input/input-router.ts
// Dispatches controller events to VSCode commands with input buffering

import * as vscode from 'vscode'
import { logger } from '../logger'
import { INPUT_BUFFER_WINDOW_MS } from '../../shared/constants'
import type { ControllerEvent, ButtonId, AxisId } from '../../shared/types'
import type { BindingMap } from './default-bindings'
import { AnalogScrollController } from './analog-scroll-controller'

export class InputRouter implements vscode.Disposable {
  private bindings: BindingMap
  private buffering = false
  private buffer: ControllerEvent[] = []
  private bufferTimer: ReturnType<typeof setTimeout> | undefined = undefined
  private scrollController: AnalogScrollController

  constructor(bindings: BindingMap) {
    this.bindings = bindings
    this.scrollController = new AnalogScrollController()
  }

  /**
   * Hot-path dispatcher — processes a single ControllerEvent.
   * Synchronous by design; vscode.commands.executeCommand is fire-and-forget (NFR-P1 <16ms).
   */
  handleEvent(event: ControllerEvent): void {
    try {
      if (this.buffering) {
        this.buffer.push(event)
        return
      }
      if (event.kind === 'button' && event.pressed) {
        const commandId = this.bindings[event.button]
        if (commandId !== undefined) {
          this.executeCommand(event.button, commandId)
        }
        // No binding — silently ignore (AC 3, NFR-I3)
      } else if (event.kind === 'axis') {
        this.handleAxis(event.axis, event.value)
      }
      // 'connected', 'disconnected', 'battery' — handled by StatusBarController; ignore here
    } catch (err) {
      logger.error('InputRouter: handleEvent error', err)
    }
  }

  private executeCommand(button: ButtonId, commandId: string): void {
    try {
      logger.debug(`InputRouter: ${button} → ${commandId}`)
      void vscode.commands.executeCommand(commandId)
    } catch (err) {
      logger.error('InputRouter: executeCommand error', err)
    }
  }

  private handleAxis(axis: AxisId, value: number): void {
    // All axis values (including dead zone) are passed to scrollController so it can
    // detect the return-to-dead-zone transition and stop the scroll loop (avoids missed-stop bug).
    // left_y and right_y drive terminal scroll (Story 3.2); all other axes are no-ops.
    this.scrollController.update(axis, value)
  }

  /**
   * Hot-reload bindings after a VSCode configuration change (Story 4.2).
   * Updates the internal binding map in-place; no router reinitialization needed.
   */
  updateBindings(bindings: BindingMap): void {
    this.bindings = bindings
  }

  /**
   * Begin buffering incoming events.
   * After INPUT_BUFFER_WINDOW_MS, buffered events are automatically flushed in order.
   */
  startBuffering(): void {
    this.buffering = true
    if (this.bufferTimer !== undefined) {
      clearTimeout(this.bufferTimer)
    }
    this.bufferTimer = setTimeout(() => {
      this.flushBuffer()
    }, INPUT_BUFFER_WINDOW_MS)
  }

  private flushBuffer(): void {
    this.buffering = false
    this.bufferTimer = undefined
    const queued = [...this.buffer]
    this.buffer = []
    for (const event of queued) {
      this.handleEvent(event)
    }
  }

  /**
   * Immediately flush buffered events (explicit end-of-transition).
   */
  stopBuffering(): void {
    if (this.bufferTimer !== undefined) {
      clearTimeout(this.bufferTimer)
      this.bufferTimer = undefined
    }
    this.flushBuffer()
  }

  dispose(): void {
    if (this.bufferTimer !== undefined) {
      clearTimeout(this.bufferTimer)
      this.bufferTimer = undefined
    }
    this.buffer = []
    this.scrollController.dispose()
  }
}
