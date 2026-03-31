// test/unit/input/profile-schema.test.ts
// Unit tests for VibeProfileSchema and CLAUDE_CODE_DEFAULT_PROFILE

import { describe, it, expect } from 'vitest'
import { VibeProfileSchema, CLAUDE_CODE_DEFAULT_PROFILE } from '../../../src/extension/input/profile-schema'

describe('VibeProfileSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = VibeProfileSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid full profile', () => {
    const result = VibeProfileSchema.safeParse({
      profile: 'test',
      bindings: { cross: 'vibesense.approve' },
      radialWheel: { segments: ['vibesense.approve'] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects bindings with empty string value (min(1))', () => {
    const result = VibeProfileSchema.safeParse({ bindings: { cross: '' } })
    expect(result.success).toBe(false)
  })

  it('rejects bindings with non-string value', () => {
    const result = VibeProfileSchema.safeParse({ bindings: { cross: 123 } })
    expect(result.success).toBe(false)
  })
})

describe('CLAUDE_CODE_DEFAULT_PROFILE', () => {
  it('passes VibeProfileSchema validation', () => {
    const result = VibeProfileSchema.safeParse(CLAUDE_CODE_DEFAULT_PROFILE)
    expect(result.success).toBe(true)
  })

  it('has profile equal to "claude-code-default"', () => {
    expect(CLAUDE_CODE_DEFAULT_PROFILE.profile).toBe('claude-code-default')
  })

  it('has bindings.cross equal to "vibesense.approve"', () => {
    expect(CLAUDE_CODE_DEFAULT_PROFILE.bindings?.cross).toBe('vibesense.approve')
  })

  it('has bindings.l2 equal to "vibesense.openRadialWheel"', () => {
    expect(CLAUDE_CODE_DEFAULT_PROFILE.bindings?.l2).toBe('vibesense.openRadialWheel')
  })
})
