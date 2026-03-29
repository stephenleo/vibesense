// src/shared/messages.ts
// Single source of truth for Webview ↔ extension host message protocol
// DO NOT import vscode, Node.js built-ins, DOM APIs, or any runtime-specific module

import { z } from 'zod'

// ─── Domain type Zod schemas (mirroring src/shared/types.ts) ─────────────────

export const AgentStateSchema = z.enum(['idle', 'processing', 'needs-input', 'error'])

export const ControllerTypeSchema = z.enum(['dualsense', 'xbox', 'generic-hid'])

export const SessionSchema = z.object({
  sessionId: z.string(),
  agentState: AgentStateSchema,
  label: z.string().optional(),
})

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
