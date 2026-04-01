// src/shared/types.ts
// Shared TypeScript types — importable from both extension host and Webview contexts
// DO NOT add Node.js or browser-specific APIs here

/** Agent FSM states */
export type AgentState = 'idle' | 'processing' | 'needs-input' | 'error'

/** Supported controller types */
export type ControllerType = 'dualsense' | 'xbox' | 'generic-hid'

/** Haptic feedback patterns */
export type HapticPattern = 'single_pulse' | 'double_pulse' | 'triple_pulse' | 'slow_rumble' | 'none'

/** Audio tone identifiers for DualSense speaker feedback */
export type AudioTone = 'success' | 'warning' | 'error' | 'none'

/** Priority level for ambient feedback — controls Do Not Disturb suppression */
export type FeedbackPriority = 'low' | 'normal' | 'high'

/** Default priority for each agent FSM state */
/* eslint-disable @typescript-eslint/naming-convention */
export const AGENT_STATE_PRIORITY: Record<AgentState, FeedbackPriority> = {
  processing: 'normal',
  'needs-input': 'normal',
  idle: 'normal',
  error: 'high', // error ALWAYS passes through DND (AC2)
}
/* eslint-enable @typescript-eslint/naming-convention */

/** DualSense and Xbox button identifiers */
export type ButtonId =
  // DualSense buttons
  | 'cross'
  | 'circle'
  | 'square'
  | 'triangle'
  | 'l1'
  | 'r1'
  | 'l2'
  | 'r2'
  | 'l3'
  | 'r3'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'options'
  | 'touchpad'
  // Xbox buttons
  | 'a'
  | 'b'
  | 'x'
  | 'y'
  | 'lb'
  | 'rb'
  | 'lt'
  | 'rt'
  | 'ls'
  | 'rs'
  | 'menu'
  | 'view'

/** Axis identifiers */
export type AxisId = 'left_x' | 'left_y' | 'right_x' | 'right_y' | 'l2' | 'r2'

/** A VibeSense session */
export interface Session {
  sessionId: string
  agentState: AgentState
  label?: string
}

/** Label fading mode for R2 Personal Wheel segments (Story 7.4) */
export type LabelMode = 'full' | 'abbreviated' | 'icon-only'

/** Definition for a single radial wheel segment (Story 7.1) */
export interface WheelSegmentDef {
  index: number          // 0–7
  label: string          // display label (full text or abbreviation, based on labelMode)
  commandId: string      // vibesense.* command or 'vibesense.dispatchPrompt'
  promptText?: string    // full prompt text for ARIA and preview (always present for prompt segments)
  labelMode?: LabelMode  // controls rendering; undefined = 'full' (Story 7.4)
}

/** Record of a single VibeSense session's controller action ratio (Story 9.1) */
export interface SessionRecord {
  sessionId: string        // unique identifier (timestamp-based)
  startedAt: number        // Unix epoch ms
  endedAt: number          // Unix epoch ms
  controllerActions: number
  keyboardActions: number
  ratio: number            // controllerActions / totalActions; 1.0 if totalActions === 0
  controllerOnly: boolean  // true iff keyboardActions === 0
}

/** Persisted quicksave snapshot for session restore (Story 9.6) */
export interface QuickSaveState {
  /** Names of open VSCode terminals at save time */
  terminalNames: string[]
  /** Claude Code session IDs from SessionManager.getSessions() keys */
  sessionIds: string[]
  /** R2 Personal wheel prompt texts (one per slot, up to 8) */
  r2Segments: string[]
}

/** Achievement record persisted in globalState (Story 9.5) */
export interface AchievementRecord {
  id: string
  unlockedAt: number | null  // Unix epoch ms, or null if not yet unlocked
}

/** XP, level, and streak record persisted in globalState (Story 9.3) */
export interface XpRecord {
  /** Cumulative XP earned across all sessions */
  totalXp: number
  /** Current level (starts at 1; Level 2 = 500 XP, doubling each level) */
  level: number
  /** Number of consecutive days with at least one session */
  streakDays: number
  /** ISO date string of the last session date (YYYY-MM-DD UTC), or null if no sessions yet */
  lastSessionDate: string | null
}

/** Normalized HID HAL controller events */
export type ControllerEvent =
  | { kind: 'button'; button: ButtonId; pressed: boolean }
  | { kind: 'axis'; axis: AxisId; value: number } // value: -1.0 to 1.0
  | { kind: 'connected'; controllerType: ControllerType }
  | { kind: 'disconnected' }
  | { kind: 'battery'; level: number } // level: 0–100
