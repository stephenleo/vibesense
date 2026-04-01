// test/unit/shared/messages.test.ts
// Test suite for src/shared/messages.ts

import { describe, it, expect } from 'vitest'
import {
  parseWebviewMessage,
  parseHostMessage,
  parseNotifyMessage,
  NotifySchema,
  HostMessageSchema,
  WebviewMessageSchema,
} from '../../../src/shared/messages'

describe('HostMessage parsing', () => {
  it('should parse a valid FSM_STATE_CHANGED message', () => {
    const raw = { type: 'FSM_STATE_CHANGED', payload: { sessionId: 'abc', state: 'idle' } }
    const result = parseHostMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('FSM_STATE_CHANGED')
  })

  it('should parse a valid CONTROLLER_CONNECTED message', () => {
    const raw = { type: 'CONTROLLER_CONNECTED', payload: { controllerType: 'dualsense' } }
    const result = parseHostMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('CONTROLLER_CONNECTED')
  })

  it('should parse a valid SESSION_LIST_UPDATED message', () => {
    const raw = {
      type: 'SESSION_LIST_UPDATED',
      payload: { sessions: [{ sessionId: 'abc', agentState: 'idle' }] },
    }
    const result = parseHostMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('SESSION_LIST_UPDATED')
  })

  it('should return null for an unknown type discriminant', () => {
    const raw = { type: 'UNKNOWN_TYPE', payload: {} }
    const result = parseHostMessage(raw)
    expect(result).toBeNull()
  })

  it('should strip unknown fields on valid parses', () => {
    const raw = {
      type: 'FSM_STATE_CHANGED',
      payload: { sessionId: 'abc', state: 'idle' },
      extraField: 'should be stripped',
    }
    const result = parseHostMessage(raw)
    expect(result).not.toBeNull()
    expect((result as Record<string, unknown>).extraField).toBeUndefined()
  })

  it('should return null for missing required payload fields', () => {
    const raw = { type: 'FSM_STATE_CHANGED', payload: { sessionId: 'abc' } } // missing 'state'
    const result = parseHostMessage(raw)
    expect(result).toBeNull()
  })

  it('should throw ZodError for missing required fields when using .parse()', () => {
    const raw = { type: 'FSM_STATE_CHANGED', payload: {} }
    expect(() => HostMessageSchema.parse(raw)).toThrow()
  })
})

describe('WebviewMessage parsing', () => {
  it('should parse a valid WHEEL_SEGMENT_SELECTED message', () => {
    const raw = { type: 'WHEEL_SEGMENT_SELECTED', payload: { segmentIndex: 3 } }
    const result = parseWebviewMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('WHEEL_SEGMENT_SELECTED')
  })

  it('should parse a valid APPROVE_ACTION message', () => {
    const raw = { type: 'APPROVE_ACTION', payload: {} }
    const result = parseWebviewMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.type).toBe('APPROVE_ACTION')
  })

  it('should return null for an unknown type discriminant', () => {
    const raw = { type: 'UNKNOWN_TYPE', payload: {} }
    const result = parseWebviewMessage(raw)
    expect(result).toBeNull()
  })

  it('should silently return null (not throw) for unknown messages', () => {
    const raw = { type: 'SOME_FUTURE_MESSAGE', payload: { data: 'whatever' } }
    expect(() => parseWebviewMessage(raw)).not.toThrow()
    const result = parseWebviewMessage(raw)
    expect(result).toBeNull()
  })

  it('should strip unknown fields on valid parses', () => {
    const raw = {
      type: 'WHEEL_SEGMENT_SELECTED',
      payload: { segmentIndex: 2, unknownPayloadField: 'stripped' },
      topLevelUnknown: 'also stripped',
    }
    const result = parseWebviewMessage(raw)
    expect(result).not.toBeNull()
    if (result?.type === 'WHEEL_SEGMENT_SELECTED') {
      expect((result.payload as Record<string, unknown>).unknownPayloadField).toBeUndefined()
    }
  })

  it('should return null for a negative segmentIndex', () => {
    const raw = { type: 'WHEEL_SEGMENT_SELECTED', payload: { segmentIndex: -1 } }
    const result = parseWebviewMessage(raw)
    expect(result).toBeNull()
  })

  it('should throw ZodError for missing required fields when using .parse()', () => {
    const raw = { type: 'WHEEL_SEGMENT_SELECTED', payload: {} } // missing segmentIndex
    expect(() => WebviewMessageSchema.parse(raw)).toThrow()
  })
})

// ── NotifySchema / parseNotifyMessage ─────────────────────────────────────────

describe('NotifySchema validation', () => {
  // Test 15: Valid full payload parses successfully; priority defaults to 'normal' when omitted
  it('valid full payload parses successfully', () => {
    const raw = {
      event: 'deploy_success',
      haptic: 'triple_pulse',
      led: { color: '#00ff00' },
      audio: 'success',
      priority: 'high',
    }
    const result = NotifySchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.event).toBe('deploy_success')
      expect(result.data.haptic).toBe('triple_pulse')
      expect(result.data.led?.color).toBe('#00ff00')
      expect(result.data.audio).toBe('success')
      expect(result.data.priority).toBe('high')
    }
  })

  it('priority defaults to "normal" when omitted', () => {
    const raw = { event: 'ping', haptic: 'single_pulse' }
    const result = NotifySchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('normal')
    }
  })

  // Test 16: Invalid haptic pattern → safeParse fails
  it('invalid haptic pattern → safeParse fails', () => {
    const raw = { event: 'x', haptic: 'unknown_pattern' }
    const result = NotifySchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  // Test 17: Invalid LED hex color → fails
  it('invalid LED hex color → safeParse fails', () => {
    const raw = { event: 'x', led: { color: 'notacolor' } }
    const result = NotifySchema.safeParse(raw)
    expect(result.success).toBe(false)
  })

  // Test 18: Unknown fields are stripped
  it('unknown fields are stripped on parse', () => {
    const raw = { event: 'x', haptic: 'single_pulse', unknownKey: 'value' }
    const result = NotifySchema.safeParse(raw)
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>).unknownKey).toBeUndefined()
    }
  })

  // Test 19: parseNotifyMessage returns null for invalid payload
  it('parseNotifyMessage returns null for invalid payload', () => {
    const raw = { event: 'x', haptic: 'bad_haptic' }
    const result = parseNotifyMessage(raw)
    expect(result).toBeNull()
  })

  it('parseNotifyMessage returns parsed message for valid payload', () => {
    const raw = { event: 'ping' }
    const result = parseNotifyMessage(raw)
    expect(result).not.toBeNull()
    expect(result?.event).toBe('ping')
    expect(result?.priority).toBe('normal')
  })
})
