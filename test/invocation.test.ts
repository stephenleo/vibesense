import { describe, expect, it } from 'vitest'
import { harnessFor } from '../src/harness.js'
import { parseInvocation } from '../src/invocation.js'

describe('parseInvocation', () => {
  it('wraps Claude by default and passes unknown arguments through', () => {
    expect(parseInvocation(['--model', 'opus'])).toEqual({
      mode: 'agent',
      agentKind: 'claude',
      agentArgs: ['--model', 'opus'],
      game: undefined,
      noGame: false,
      autoPlay: false,
    })
  })

  it('selects Codex only when codex is the first argument', () => {
    expect(parseInvocation(['codex', '--model', 'gpt-5.4', '--no-game'])).toEqual({
      mode: 'agent',
      agentKind: 'codex',
      agentArgs: ['--model', 'gpt-5.4'],
      game: undefined,
      noGame: true,
      autoPlay: false,
    })
    expect(parseInvocation(['--no-game', 'codex'])).toMatchObject({
      agentKind: 'claude',
      agentArgs: ['codex'],
    })
  })

  it('keeps play mode separate from agent arguments', () => {
    expect(parseInvocation(['play', 'snake', '--auto-play'])).toEqual({
      mode: 'play',
      agentKind: null,
      agentArgs: [],
      game: 'snake',
      noGame: false,
      autoPlay: true,
    })
  })
})

describe('harnessFor', () => {
  it('keeps Claude compatibility policy separate from Codex ownership policy', () => {
    const claude = harnessFor('claude')
    const codex = harnessFor('codex')

    expect(claude.command).toBe('claude')
    expect(claude.childWrapperId('wrapper')).toBeUndefined()
    expect(claude.trustNotice).toBeNull()
    expect(codex.command).toBe('codex')
    expect(codex.childWrapperId('wrapper')).toBe('wrapper')
    expect(codex.trustNotice).toContain('/hooks')
  })
})
