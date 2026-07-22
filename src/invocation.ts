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

export const USAGE = `vibesense — play retro games while your coding agent works.

Usage:
  vibesense [claude args...]                   Wrap Claude Code (default)
  vibesense codex [codex args...]             Wrap Codex CLI
  vibesense codex-app [--no-game] [--auto-play]
                                                Drive the Codex desktop app (macOS)
  vibesense play [game] [--auto-play]          Play without an agent
  vibesense --help                             Show this message
  vibesense --version                          Show the installed version`

export function parseInvocation(args: string[]): ParsedInvocation {
  const mode = args[0] === 'play' ? 'play' : 'agent'
  const game = mode === 'play' && !args[1]?.startsWith('-') ? args[1] : undefined
  const noGame = args.includes('--no-game')
  const autoPlay = args.includes('--auto-play')

  if (mode === 'play') {
    return { mode, agentKind: null, agentArgs: [], game, noGame, autoPlay }
  }

  const agentKind: AgentKind =
    args[0] === 'codex-app' ? 'codex-app' : args[0] === 'codex' ? 'codex' : 'claude'
  const agentInput = agentKind === 'claude' ? args : args.slice(1)
  const agentArgs = agentInput.filter((arg) => arg !== '--no-game' && arg !== '--auto-play')
  return { mode, agentKind, agentArgs, game, noGame, autoPlay }
}
