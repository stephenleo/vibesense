import {
  harnessFor as openmicroHarnessFor,
  type Harness,
  type InstallResult,
} from 'openmicro/harness'
import {
  installClaudeHooks,
  installCodexHooks,
  type InstallResult as LocalInstallResult,
} from './hooks-install.js'

export type AgentKind = 'claude' | 'codex' | 'codex-app'

export interface AgentHarness extends Harness {
  readonly kind: AgentKind
  childWrapperId(wrapperId: string): string | undefined
}

function localInstall(result: LocalInstallResult, trustNotice: string | null): InstallResult {
  return { changed: result === 'changed', trustNotice: result === 'changed' ? trustNotice : null }
}

const claude = openmicroHarnessFor('claude')
const codex = openmicroHarnessFor('codex')
const codexApp = openmicroHarnessFor('codex-app')

const HARNESSES: Record<AgentKind, AgentHarness> = {
  claude: {
    ...claude,
    kind: 'claude',
    installHooks: () => localInstall(installClaudeHooks(), null),
    childWrapperId: () => undefined,
  },
  codex: {
    ...codex,
    kind: 'codex',
    installHooks: () =>
      localInstall(
        installCodexHooks(),
        'vibesense: Codex hooks changed; run codex, then /hooks, and trust the VibeSense hooks',
      ),
    childWrapperId: (wrapperId) => wrapperId,
  },
  'codex-app': {
    ...codexApp,
    kind: 'codex-app',
    installHooks: () => {
      const openmicro = codexApp.installHooks()
      const vibesense = installCodexHooks()
      const changed = openmicro.changed || vibesense === 'changed'
      return {
        changed,
        trustNotice: changed
          ? 'vibesense: Codex hooks changed; trust the VibeSense and OpenMicro hooks in Codex Desktop Settings → Hooks (or run codex, then /hooks)'
          : null,
      }
    },
    childWrapperId: () => undefined,
  },
}

export function harnessFor(kind: AgentKind): AgentHarness {
  return HARNESSES[kind]
}
