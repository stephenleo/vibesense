// src/extension/telemetry/telemetry-transmitter.ts
// Telemetry transmission layer — Story 11.3
// FR44: Transmit queued telemetry payloads when user has opted in
// NFR-S2: HTTPS with TLS 1.2+ (enforced by Node.js TLS stack on https:// URLs)
// NFR-R1: Never crash the extension — all async paths wrapped in try/catch
//
// ARCHITECTURE: Lives in src/extension/telemetry/ — only extension.ts may import this file.
// STUB GUARD: TELEMETRY_BACKEND_ENABLED=false at MVP — no network calls until backend deploys.

import { logger } from '../logger'
import type { TelemetryCollector } from './telemetry'
import type { TelemetryPayload } from './telemetry-schema'

/** POST endpoint for telemetry ingestion at vibesense.dev backend */
const TELEMETRY_INGEST_URL = 'https://telemetry.vibesense.dev/ingest'

/**
 * Feature flag — set to `false` at MVP.
 * Change to `true` when the vibesense.dev backend is deployed.
 * Architecture reference: architecture.md line 359–361 — "No network calls for telemetry at MVP"
 */
const TELEMETRY_BACKEND_ENABLED = false

/** Options for overriding defaults (primarily used in tests) */
export interface TelemetryTransmitterOptions {
  /** Override for TELEMETRY_BACKEND_ENABLED — used in unit tests to exercise transmission path */
  backendEnabled?: boolean
}

/**
 * Transmits queued telemetry payloads to the vibesense.dev backend.
 *
 * At MVP: `TELEMETRY_BACKEND_ENABLED` is `false` — no network calls are made.
 * The stub guard exists so that removing this flag and deploying the backend is the
 * only change required to activate transmission.
 *
 * Retry policy: exponential backoff — initial 1 s, max 5 retries, capped at 32 s.
 *
 * Isolation guarantee: Only `src/extension/extension.ts` may import this module
 * (ESLint `no-restricted-imports` rule, `.eslintrc.json` lines 68–86).
 *
 * All methods are try/catch wrapped — never throw (NFR-R1).
 */
export class TelemetryTransmitter {
  private readonly backendEnabled: boolean

  constructor(
    private readonly collector: TelemetryCollector,
    options?: TelemetryTransmitterOptions,
  ) {
    this.backendEnabled = options?.backendEnabled ?? TELEMETRY_BACKEND_ENABLED
  }

  /**
   * Flush all queued telemetry payloads to the backend.
   *
   * No-op when:
   * - `TELEMETRY_BACKEND_ENABLED` is false (MVP stub guard — AC4)
   * - Queue is empty
   *
   * On successful transmission, clears the queue (AC3).
   * Never throws — wrapped in try/catch (NFR-R1).
   */
  async flushQueue(): Promise<void> {
    try {
      // AC4: MVP stub guard — no network calls until backend is deployed
      if (!this.backendEnabled) {
        logger.debug('TelemetryTransmitter: backend not enabled (stub guard active) — skipping flush')
        return
      }

      const payloads = this.collector.getQueue()

      if (payloads.length === 0) {
        return
      }

      // NFR-S4: Log for local inspectability (consistent with Story 11.1 pattern)
      logger.info(`TelemetryTransmitter: flushing ${payloads.length} payload(s)`)

      const success = await this.sendWithRetry(payloads)

      if (success) {
        // AC3: Clear queue after successful transmission
        await this.collector.clearQueue()
      }
    } catch (err) {
      logger.error('TelemetryTransmitter: flushQueue failed', err)
      // NFR-R1: never rethrow
    }
  }

  /**
   * Send payloads to the ingest endpoint with exponential backoff retry.
   *
   * Retry policy (AC2):
   * - Max retries: 5
   * - Initial delay: 1000 ms
   * - Delay cap: 32000 ms
   * - Multiplier: 2
   *
   * Returns true on success (2xx), false when all retries are exhausted.
   * Never throws (NFR-R1).
   */
  private async sendWithRetry(payloads: TelemetryPayload[]): Promise<boolean> {
    const MAX_RETRIES = 5
    const INITIAL_DELAY_MS = 1000
    const MAX_DELAY_MS = 32000
    let delay = INITIAL_DELAY_MS

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(TELEMETRY_INGEST_URL, {
          method: 'POST',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloads),
        })

        if (response.ok) {
          // 2xx — success
          return true
        }

        logger.warn(`TelemetryTransmitter: attempt ${attempt + 1} failed — HTTP ${response.status}`)
      } catch (err) {
        logger.warn(`TelemetryTransmitter: attempt ${attempt + 1} network error`, err)
      }

      if (attempt < MAX_RETRIES) {
        await new Promise<void>(resolve => setTimeout(resolve, delay))
        delay = Math.min(delay * 2, MAX_DELAY_MS)
      }
    }

    logger.error('TelemetryTransmitter: all retries exhausted, payloads retained in queue')
    return false
  }
}
