// src/extension/telemetry/telemetry-schema.ts
// Zod validation schema for TelemetryPayload — Story 11.1
// Extension-host-only — do NOT import from webview code.
// ONLY src/extension/extension.ts may import from this module (AC3, ESLint-enforced).

import { z } from 'zod'

/**
 * Zod schema for a single telemetry payload.
 *
 * Constraints (FR46, NFR-S4):
 * - Aggregate counts and ratios ONLY
 * - No keystrokes, terminal content, file names, project names, or PII
 */
export const TelemetryPayloadSchema = z.object({
  /** Payload schema version — bump when breaking changes are made */
  version: z.literal('1.0'),
  /** Unix epoch ms — session end time */
  timestamp: z.number().int().nonnegative(),
  /** True iff the session had zero keyboard touches */
  controllerOnly: z.boolean(),
  /** Ratio of controller actions to total actions (0–1). 1.0 if no actions. */
  controllerActionRatio: z.number().min(0).max(1),
  /**
   * Names of distinct VibeSense features used in the session.
   * e.g. ['radialWheel', 'miniGame', 'sessionSwitch']
   * Feature names are internal identifiers — never user-entered text.
   */
  featuresActive: z.array(z.string()),
  /** Session duration in milliseconds (endedAt - startedAt) */
  sessionDurationMs: z.number().int().nonnegative(),
  /**
   * Total controller button presses recorded during the session.
   * Used as a proxy for agent interaction count.
   */
  agentInteractionCount: z.number().int().nonnegative(),
  /** Controller type, or null if no controller was connected */
  controllerType: z.enum(['dualsense', 'xbox', 'generic-hid']).nullable(),
  /** Operating system platform (process.platform) */
  platform: z.string(),
})

/** Validated telemetry payload type */
export type TelemetryPayload = z.infer<typeof TelemetryPayloadSchema>

/** Zod schema for the telemetry queue stored in globalState */
export const TelemetryQueueSchema = z.array(TelemetryPayloadSchema)
