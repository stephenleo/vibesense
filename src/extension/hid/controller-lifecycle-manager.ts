// src/extension/hid/controller-lifecycle-manager.ts
// ControllerLifecycleManager — handles connect, disconnect, and auto-reconnect lifecycle
// Wraps a ControllerHAL driver and monitors for disconnect/reconnect events,
// polling for reconnection every 500ms (satisfying NFR-R3: reconnect within 3 seconds).

import { logger } from '../logger'
import { createDriver } from './hid-manager'
import type { ControllerHAL } from './hal'
import type { ControllerEvent } from '../../shared/types'

type ConnectionState = 'connected' | 'disconnected'

// Maximum number of reconnect polls (30s ceiling: 60 × 500ms).
// Prevents indefinite polling when a controller is permanently removed.
// Well beyond NFR-R3's 3-second requirement.
const MAX_RECONNECT_POLLS = 60

/**
 * ControllerLifecycleManager — lifecycle layer over the HID HAL.
 *
 * Responsibilities:
 * - Subscribes to ControllerHAL 'data' events to detect disconnect
 * - On disconnect: stops the old driver, invokes `onDisconnected` callback, starts 500ms reconnect poll
 * - On reconnect: starts new driver, invokes `onConnected` callback
 * - Satisfies NFR-R2 (100ms disconnect detection via synchronous node-hid error path)
 * - Satisfies NFR-R3 (auto-reconnect within 3 seconds via 500ms polling)
 * - NFR-R1: all errors caught and logged; never throws; polling continues on error
 */
export class ControllerLifecycleManager {
  private connectionState: ConnectionState
  private currentDriver: ControllerHAL | null
  private reconnectInterval: ReturnType<typeof setInterval> | undefined
  private reconnectPollCount = 0

  /**
   * @param initialDriver - The initially detected driver (may be null if no device found at startup)
   * @param onConnected - Callback invoked when a controller connects or reconnects
   * @param onDisconnected - Callback invoked when a controller disconnects
   */
  constructor(
    initialDriver: ControllerHAL | null,
    private readonly onConnected: (driver: ControllerHAL) => void,
    private readonly onDisconnected: () => void,
  ) {
    this.currentDriver = initialDriver
    this.connectionState = initialDriver ? 'connected' : 'disconnected'

    if (initialDriver) {
      this.attachDriver(initialDriver)
      // If we have an initial driver, notify connected (driver was already started by HidManager)
    } else {
      // No controller at startup — begin polling for one
      this.startReconnectLoop()
    }
  }

  /**
   * Returns the current connection state.
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Returns the current active ControllerHAL driver, or null if disconnected.
   */
  getCurrentDriver(): ControllerHAL | null {
    return this.currentDriver
  }

  /**
   * Stop the lifecycle manager: clear reconnect polling and stop the current driver.
   */
  stop(): void {
    this.clearReconnectLoop()
    if (this.currentDriver) {
      try {
        this.currentDriver.stop()
      } catch (err) {
        logger.error('ControllerLifecycleManager: error stopping driver', err)
      }
      this.currentDriver = null
    }
    this.connectionState = 'disconnected'
  }

  /**
   * Attach event listener to a HAL driver to monitor for disconnect events.
   */
  private attachDriver(driver: ControllerHAL): void {
    driver.on('data', (event: unknown) => this.handleEvent(event))
  }

  /**
   * Handle a ControllerEvent from the active driver.
   * Disconnect detection is synchronous (node-hid error path) — no async here.
   */
  private handleEvent(event: unknown): void {
    try {
      const e = event as ControllerEvent
      if (e.kind === 'disconnected') {
        // Stop the old driver to release the HID device file handle before nulling it
        const driverToStop = this.currentDriver
        this.currentDriver = null
        this.connectionState = 'disconnected'
        if (driverToStop) {
          try {
            driverToStop.stop()
          } catch (stopErr) {
            logger.error('ControllerLifecycleManager: error stopping disconnected driver', stopErr)
          }
        }
        try {
          this.onDisconnected()
        } catch (cbErr) {
          logger.error('ControllerLifecycleManager: onDisconnected callback error', cbErr)
        }
        this.startReconnectLoop()
      }
      // 'connected' events from re-attach are handled in the reconnect loop
    } catch (err) {
      logger.error('ControllerLifecycleManager: handleEvent error', err)
    }
  }

  /**
   * Start polling for a reconnected controller every 500ms.
   * On first successful detection, starts the driver and invokes onConnected.
   * Satisfies NFR-R3: reconnect within 3 seconds (6 polls × 500ms).
   * Stops polling after MAX_RECONNECT_POLLS (30s) to avoid indefinite resource use.
   */
  private startReconnectLoop(): void {
    // Guard against double-starting
    if (this.reconnectInterval !== undefined) {
      return
    }

    this.reconnectPollCount = 0

    this.reconnectInterval = setInterval(() => {
      this.reconnectPollCount++

      // Cap polling at MAX_RECONNECT_POLLS to avoid indefinite resource use
      if (this.reconnectPollCount > MAX_RECONNECT_POLLS) {
        logger.warn(
          `ControllerLifecycleManager: reconnect polling stopped after ${MAX_RECONNECT_POLLS} attempts — controller not found`,
        )
        this.clearReconnectLoop()
        return
      }

      try {
        const driver = createDriver()
        if (driver) {
          this.clearReconnectLoop()
          driver.start()
          this.currentDriver = driver
          this.connectionState = 'connected'
          this.attachDriver(driver)
          try {
            this.onConnected(driver)
          } catch (cbErr) {
            logger.error('ControllerLifecycleManager: onConnected callback error', cbErr)
          }
        }
      } catch (err) {
        logger.error('ControllerLifecycleManager: reconnect poll error', err)
        // continue polling — do NOT clear interval on error (NFR-R1)
      }
    }, 500)
  }

  /**
   * Clear the reconnect polling interval.
   */
  private clearReconnectLoop(): void {
    if (this.reconnectInterval !== undefined) {
      clearInterval(this.reconnectInterval)
      this.reconnectInterval = undefined
    }
  }
}
