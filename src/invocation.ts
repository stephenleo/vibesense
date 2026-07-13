import type { AgentKind } from './harness.js'

export type { AgentKind } from './harness.js'

export interface ParsedInvocation {
  mode: 'agent' | 'play'
  agentKind: AgentKind | null
  agentArgs: string[]
  game: string | undefined
  noGame: boolean
  autoPlay: boolean
}

export function parseInvocation(args: string[]): ParsedInvocation {
  const mode = args[0] === 'play' ? 'play' : 'agent'
  const game = mode === 'play' && !args[1]?.startsWith('-') ? args[1] : undefined
  const noGame = args.includes('--no-game')
  const autoPlay = args.includes('--auto-play')

  if (mode === 'play') {
    return { mode, agentKind: null, agentArgs: [], game, noGame, autoPlay }
  }

  const agentKind: AgentKind = args[0] === 'codex' ? 'codex' : 'claude'
  const agentInput = agentKind === 'codex' ? args.slice(1) : args
  const agentArgs = agentInput.filter((arg) => arg !== '--no-game' && arg !== '--auto-play')
  return { mode, agentKind, agentArgs, game, noGame, autoPlay }
}
