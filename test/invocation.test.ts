import { describe, expect, it } from 'vitest'
import { harnessFor } from '../src/harness.js'
import { parseInvocation, USAGE } from '../src/invocation.js'

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

  it('selects the Codex desktop app as a no-argument GUI mode', () => {
    expect(parseInvocation(['codex-app', '--auto-play', '--no-game'])).toEqual({
      mode: 'agent',
      agentKind: 'codex-app',
      agentArgs: [],
      game: undefined,
      noGame: true,
      autoPlay: true,
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

  it('documents the no-PTY Codex app mode in help', () => {
    expect(USAGE).toContain('vibesense codex-app [--no-game] [--auto-play]')
  })
})

describe('harnessFor', () => {
  it('keeps Claude compatibility policy separate from Codex ownership policy', () => {
    const claude = harnessFor('claude')
    const codex = harnessFor('codex')
    const codexApp = harnessFor('codex-app')

    expect(claude.command).toBe('claude')
    expect(claude.childWrapperId('wrapper')).toBeUndefined()
    expect(codex.command).toBe('codex')
    expect(codex.childWrapperId('wrapper')).toBe('wrapper')
    expect(codexApp.command).toBe('open')
    expect(codexApp.usesPty).toBe(false)
  })
})
