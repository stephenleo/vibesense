// src/extension/input/input-router.ts
// Dispatches controller events to VSCode commands with input buffering

import * as vscode from 'vscode'
import { logger } from '../logger'
import { INPUT_BUFFER_WINDOW_MS } from '../../shared/constants'
import type { ControllerEvent, ButtonId, AxisId } from '../../shared/types'
import type { BindingMap } from './default-bindings'

const DEAD_ZONE = 0.15

export class InputRouter implements vscode.Disposable {
  private bindings: BindingMap
  private buffering = false
  private buffer: ControllerEvent[] = []
  private bufferTimer: ReturnType<typeof setTimeout> | undefined = undefined

  constructor(bindings: BindingMap) {
    this.bindings = bindings
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
    if (Math.abs(value) < DEAD_ZONE) return
    // Proportional magnitude: (Math.abs(value) - DEAD_ZONE) / (1.0 - DEAD_ZONE)
    // Axis-to-command mappings introduced in Story 3.2 (AnalogStickScroll).
    // Structure is in place; no axis commands dispatched in this story.
    void axis // used in future stories
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
  }
}
