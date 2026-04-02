// src/extension/telemetry/telemetry.ts
// Opt-in telemetry collection module — Story 11.1
// FR44: Collect anonymous usage telemetry when user has explicitly opted in
// FR46: Payloads contain only aggregate counts and ratios — NO PII
// NFR-S2: Transmission uses HTTPS with TLS 1.2+ (enforced in Story 11.3)
// NFR-S4: Payload is loggable locally when VSCode DevTools are open
//
// ARCHITECTURE: This module is isolated — ONLY src/extension/extension.ts may import it (AC3, ESLint-enforced).

import * as vscode from 'vscode'
import { logger } from '../logger'
import { TelemetryPayloadSchema, TelemetryQueueSchema } from './telemetry-schema'
import { TELEMETRY_QUEUE_KEY } from '../../shared/constants'
import type { TelemetryPayload } from './telemetry-schema'
import type { SessionRecord, ControllerType } from '../../shared/types'

/** Context required to build a telemetry payload from a session record */
export interface TelemetrySessionContext {
  /** Names of VibeSense features used this session (from SessionRatioTracker) */
  featuresActive: string[]
  /** The controller type connected during the session, or null */
  controllerType: ControllerType | null
}

const PAYLOAD_SCHEMA_VERSION = '1.0' as const

/**
 * Collects and queues aggregate-only, non-PII telemetry payloads when the user has opted in.
 *
 * At MVP: payloads are queued locally in globalState. Story 11.3 activates the transmission layer.
 *
 * Isolation guarantee (AC3): Only `src/extension/extension.ts` may import this module.
 * This is enforced by ESLint `no-restricted-imports` rule in `.eslintrc.json`.
 *
 * All methods are try/catch wrapped — never throw (NFR-R1).
 */
export class TelemetryCollector {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly getConfig: () => vscode.WorkspaceConfiguration,
  ) {}

  /**
   * Returns true if the user has explicitly opted in to telemetry.
   * Reads the live VSCode configuration — reflects changes immediately.
   * Default is `false` (opt-in model, not opt-out) — FR44, FR45.
   */
  isOptedIn(): boolean {
    try {
      // 'telemetry.enabled' maps to 'vibesense.telemetry.enabled' via getConfiguration('vibesense') namespace
      return this.getConfig().get<boolean>('telemetry.enabled') ?? false
    } catch (err) {
      logger.error('TelemetryCollector: failed to read opt-in setting', err)
      return false
    }
  }

  /**
   * Collect a session's aggregate usage signals and queue for later transmission.
   *
   * No-op if user has not opted in — telemetry remains OFF by default (FR44).
   * Payload is logged locally for inspectability (NFR-S4).
   *
   * @param record - Finalized session record from SessionRatioTracker
   * @param context - Additional session context (features used, controller type)
   */
  async collectSession(record: SessionRecord, context: TelemetrySessionContext): Promise<void> {
    if (!this.isOptedIn()) {
      return
    }

    try {
      const payload: TelemetryPayload = {
        version: PAYLOAD_SCHEMA_VERSION,
        timestamp: record.endedAt,
        controllerOnly: record.controllerOnly,
        controllerActionRatio: record.ratio,
        featuresActive: context.featuresActive,
        sessionDurationMs: record.endedAt - record.startedAt,
        agentInteractionCount: record.controllerActions,
        controllerType: context.controllerType,
        platform: process.platform,
      }

      // NFR-S4: Log exact JSON payload for local inspectability when DevTools are open
      logger.info(`TelemetryCollector: payload — ${JSON.stringify(payload)}`)

      // Validate payload before queuing (defensive — catches schema violations)
      const parseResult = TelemetryPayloadSchema.safeParse(payload)
      if (!parseResult.success) {
        logger.error('TelemetryCollector: payload validation failed', parseResult.error)
        return
      }

      await this.enqueuePayload(parseResult.data)
    } catch (err) {
      logger.error('TelemetryCollector: collectSession failed', err)
      // NFR-R1: never rethrow
    }
  }

  /**
   * Returns the current telemetry queue from globalState.
   * Used by Story 11.3 transmission layer to read and flush queued payloads.
   */
  getQueue(): TelemetryPayload[] {
    try {
      const raw = this.globalState.get<unknown>(TELEMETRY_QUEUE_KEY)
      const parseResult = TelemetryQueueSchema.safeParse(raw ?? [])
      return parseResult.success ? parseResult.data : []
    } catch (err) {
      logger.error('TelemetryCollector: getQueue failed', err)
      return []
    }
  }

  /**
   * Clear all queued payloads from globalState.
   * Called by Story 11.3 after successful transmission.
   */
  async clearQueue(): Promise<void> {
    try {
      await this.globalState.update(TELEMETRY_QUEUE_KEY, [])
    } catch (err) {
      logger.error('TelemetryCollector: clearQueue failed', err)
      // NFR-R1: never rethrow
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async enqueuePayload(payload: TelemetryPayload): Promise<void> {
    const raw = this.globalState.get<unknown>(TELEMETRY_QUEUE_KEY)
    const parseResult = TelemetryQueueSchema.safeParse(raw ?? [])
    const existing = parseResult.success ? parseResult.data : []
    const updated = [...existing, payload]
    await this.globalState.update(TELEMETRY_QUEUE_KEY, updated)
    logger.info(`TelemetryCollector: queued payload (queue length: ${updated.length})`)
  }
}
