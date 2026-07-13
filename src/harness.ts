import { installClaudeHooks, installCodexHooks, type InstallResult } from './hooks-install.js'

export type AgentKind = 'claude' | 'codex'

export interface AgentHarness {
  command: string
  installHooks(): InstallResult
  trustNotice: string | null
  childWrapperId(wrapperId: string): string | undefined
}

const HARNESSES: Record<AgentKind, AgentHarness> = {
  claude: {
    command: 'claude',
    installHooks: installClaudeHooks,
    trustNotice: null,
    childWrapperId: () => undefined,
  },
  codex: {
    command: 'codex',
    installHooks: installCodexHooks,
    trustNotice: 'vibesense: Codex hooks changed; open /hooks and trust the Vibesense hooks',
    childWrapperId: (wrapperId) => wrapperId,
  },
}

export function harnessFor(kind: AgentKind): AgentHarness {
  return HARNESSES[kind]
}
