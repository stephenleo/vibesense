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

/** Normalized HID HAL controller events */
export type ControllerEvent =
  | { kind: 'button'; button: ButtonId; pressed: boolean }
  | { kind: 'axis'; axis: AxisId; value: number } // value: -1.0 to 1.0
  | { kind: 'connected'; controllerType: ControllerType }
  | { kind: 'disconnected' }
  | { kind: 'battery'; level: number } // level: 0–100
