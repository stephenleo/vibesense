// src/shared/messages.ts
// Single source of truth for Webview ↔ extension host message protocol
// DO NOT import vscode, Node.js built-ins, DOM APIs, or any runtime-specific module

import { z } from 'zod'
import type { AgentState, ControllerType, Session } from './types'

// ─── Compile-time drift guards ───────────────────────────────────────────────
// These assertions ensure Zod schemas stay in sync with the canonical
// TypeScript types in types.ts. A mismatch causes a compile error here,
// not a silent runtime bug.

type AssertEqual<T, U> = [T] extends [U] ? ([U] extends [T] ? true : never) : never

// ─── Domain type Zod schemas (mirroring src/shared/types.ts) ─────────────────

export const AgentStateSchema = z.enum(['idle', 'processing', 'needs-input', 'error'])

export const ControllerTypeSchema = z.enum(['dualsense', 'xbox', 'generic-hid'])

export const SessionSchema = z.object({
  sessionId: z.string(),
  agentState: AgentStateSchema,
  label: z.string().optional(),
})

// Drift guards — break the build if schemas diverge from types.ts
const agentStateOk: AssertEqual<z.infer<typeof AgentStateSchema>, AgentState> = true
const controllerTypeOk: AssertEqual<z.infer<typeof ControllerTypeSchema>, ControllerType> = true
const sessionOk: AssertEqual<z.infer<typeof SessionSchema>, Session> = true
void agentStateOk; void controllerTypeOk; void sessionOk

// ─── Host → Webview messages ─────────────────────────────────────────────────

export const HostMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('FSM_STATE_CHANGED'),
    payload: z.object({
      sessionId: z.string(),
      state: AgentStateSchema,
    }),
  }),
  z.object({
    type: z.literal('CONTROLLER_CONNECTED'),
    payload: z.object({
      controllerType: ControllerTypeSchema,
    }),
  }),
  z.object({
    type: z.literal('SESSION_LIST_UPDATED'),
    payload: z.object({
      sessions: z.array(SessionSchema),
    }),
  }),
  z.object({
    type: z.literal('SESSION_SWITCHED'),
    payload: z.object({
      sessionIndex: z.number().int().nonnegative(),
      sessionName: z.string(),
      totalSessions: z.number().int().positive(),
    }),
  }),
  z.object({
    type: z.literal('QUICK_PANEL_OPEN'),
    payload: z.object({
      sessions: z.array(SessionSchema),
      selectedIndex: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('QUICK_PANEL_CLOSE'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('QUICK_PANEL_NAVIGATE'),
    payload: z.object({
      selectedIndex: z.number().int().nonnegative(),
    }),
  }),
])

export type HostMessage = z.infer<typeof HostMessageSchema>

// ─── Webview → Host messages ──────────────────────────────────────────────────

export const WebviewMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('WHEEL_SEGMENT_SELECTED'),
    payload: z.object({
      segmentIndex: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('APPROVE_ACTION'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('SLIDE_PANEL_TOGGLE'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('QUICK_PANEL_SELECT'),
    payload: z.object({
      sessionIndex: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('QUICK_PANEL_DISMISS'),
    payload: z.object({}),
  }),
])

export type WebviewMessage = z.infer<typeof WebviewMessageSchema>

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Parse a raw unknown value as a WebviewMessage.
 * Returns the parsed message on success, or null on failure.
 * Unknown message types are silently dropped — callers should return/ignore null.
 */
export function parseWebviewMessage(raw: unknown): WebviewMessage | null {
  const result = WebviewMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}

/**
 * Parse a raw unknown value as a HostMessage.
 * Returns the parsed message on success, or null on failure.
 */
export function parseHostMessage(raw: unknown): HostMessage | null {
  const result = HostMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}
