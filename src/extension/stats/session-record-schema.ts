// src/extension/stats/session-record-schema.ts
// Zod validation schemas for SessionRecord and XpRecord — used when reading from globalState (defensive parse)
// Extension-host-only — do NOT import from webview code.
import { z } from 'zod'

export const SessionRecordSchema = z.object({
  sessionId: z.string(),
  startedAt: z.number().int().nonnegative(),
  endedAt: z.number().int().nonnegative(),
  controllerActions: z.number().int().nonnegative(),
  keyboardActions: z.number().int().nonnegative(),
  ratio: z.number().min(0).max(1),
  controllerOnly: z.boolean(),
})

export const SessionHistorySchema = z.array(SessionRecordSchema)

/** Zod schema for XpRecord — used when reading from globalState (Story 9.3) */
export const XpRecordSchema = z.object({
  totalXp: z.number().int().nonnegative(),
  level: z.number().int().min(1),
  streakDays: z.number().int().nonnegative(),
  lastSessionDate: z.string().nullable(),
})
