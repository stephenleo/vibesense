// src/shared/messages.ts
// Single source of truth for Webview ↔ extension host message protocol
// DO NOT import vscode, Node.js built-ins, DOM APIs, or any runtime-specific module

import { z } from 'zod'
import type { AgentState, ControllerType, Session, WheelSegmentDef } from './types'

// ─── WheelSegmentDef Zod schema (mirrors types.ts) ───────────────────────────

export const WheelSegmentDefSchema = z.object({
  index: z.number().int().min(0).max(7),
  label: z.string(),
  commandId: z.string(),
  promptText: z.string().optional(),
  labelMode: z.enum(['full', 'abbreviated', 'icon-only']).optional(),
})

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
const wheelSegmentDefOk: AssertEqual<z.infer<typeof WheelSegmentDefSchema>, WheelSegmentDef> = true
void agentStateOk; void controllerTypeOk; void sessionOk; void wheelSegmentDefOk

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
  z.object({
    type: z.literal('SETTINGS_LOADED'),
    payload: z.object({
      bindings: z.record(z.string(), z.string()),
      controllerType: ControllerTypeSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal('SETTINGS_BINDING_APPLIED'),
    payload: z.object({
      button: z.string(),
      command: z.string(),
    }),
  }),
  z.object({
    type: z.literal('ONBOARDING_INIT'),
    payload: z.object({
      controllerType: ControllerTypeSchema.nullable(),
    }),
  }),
  z.object({
    type: z.literal('ONBOARDING_BUTTON_PRESSED'),
    payload: z.object({
      button: z.string(),
    }),
  }),
  z.object({
    type: z.literal('ERROR_MENU_OPEN'),
    payload: z.object({
      sessionId: z.string(),
      hasLastCommand: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('ERROR_MENU_CLOSE'),
    payload: z.object({}),
  }),
  // Story 7.1: Radial wheel messages
  z.object({
    type: z.literal('WHEEL_OPEN'),
    payload: z.object({
      activeWheel: z.enum(['l2', 'r2']),
      l2Segments: z.array(WheelSegmentDefSchema),
      r2Segments: z.array(WheelSegmentDefSchema),
    }),
  }),
  z.object({
    type: z.literal('WHEEL_STICK_UPDATE'),
    payload: z.object({
      x: z.number(),
      y: z.number(),
    }),
  }),
  z.object({
    type: z.literal('WHEEL_CLOSE'),
    payload: z.object({
      cancelled: z.boolean(),
    }),
  }),
  // Story 7.3: HUD overlay messages — Host → Webview
  z.object({
    type: z.literal('HUD_TOGGLE'),
    payload: z.object({
      visible: z.boolean(),
    }),
  }),
  z.object({
    type: z.literal('HUD_BINDINGS_UPDATED'),
    payload: z.object({
      bindings: z.record(z.string(), z.string()),
      controllerType: ControllerTypeSchema.nullable(),
      mode: z.enum(['guided', 'full']),
    }),
  }),
  z.object({
    type: z.literal('HUD_MODE_CHANGED'),
    payload: z.object({
      mode: z.enum(['guided', 'full']),
      bindings: z.record(z.string(), z.string()),
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
  z.object({
    type: z.literal('SETTINGS_BINDING_CHANGED'),
    payload: z.object({
      button: z.string(),
      command: z.string(),
    }),
  }),
  z.object({
    type: z.literal('SETTINGS_RESET_SECTION'),
    payload: z.object({
      buttons: z.array(z.string()),
    }),
  }),
  z.object({
    type: z.literal('SETTINGS_REQUEST_LOAD'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('ONBOARDING_STEP_COMPLETE'),
    payload: z.object({
      stepIndex: z.number().int().nonnegative(),
    }),
  }),
  z.object({
    type: z.literal('ONBOARDING_COMPLETE'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('ONBOARDING_DISMISSED'),
    payload: z.object({}),
  }),
  z.object({
    type: z.literal('ERROR_MENU_ACTION'),
    payload: z.object({
      action: z.enum(['retry', 'clear', 'new-session', 'view-log']),
    }),
  }),
  z.object({
    type: z.literal('ERROR_MENU_DISMISS'),
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

// ─── vibeSense.notify() inbound IPC payload ───────────────────────────────────

export const NotifySchema = z.object({
  event: z.string(),
  haptic: z.enum(['single_pulse', 'double_pulse', 'triple_pulse', 'slow_rumble', 'none']).optional(),
  led: z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i) }).optional(),
  audio: z.enum(['success', 'warning', 'error', 'none']).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
})

export type NotifyMessage = z.infer<typeof NotifySchema>

/**
 * Parse a raw unknown value as a NotifyMessage.
 * Returns the parsed message on success, or null on failure.
 * Unknown fields are stripped by Zod's default behavior.
 */
export function parseNotifyMessage(raw: unknown): NotifyMessage | null {
  const result = NotifySchema.safeParse(raw)
  return result.success ? result.data : null
}

// ─── Inbound hook messages (Claude Code hooks → extension) ───────────────────

export const HookMessageSchema = z.object({
  hook: z.enum(['stop', 'post_tool_use']),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  session_id: z.string(),
})

export type HookMessage = z.infer<typeof HookMessageSchema>

/**
 * Parse a raw unknown value as a HookMessage.
 * Returns the parsed message on success, or null on failure.
 */
export function parseHookMessage(raw: unknown): HookMessage | null {
  const result = HookMessageSchema.safeParse(raw)
  return result.success ? result.data : null
}
