// Idempotent Claude Code hook registration in ~/.claude/settings.json.
// Merge/purge/atomic-write logic ported from v1's hook-writer.ts (git history).
// The hook command is a curl POST that no-ops harmlessly when vibesense isn't
// running, so hooks never need uninstalling.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { logger } from './logger.js'
import { HOST_PORT } from './server.js'

interface HookEntry {
  type: string
  command: string
}

interface HookGroup {
  matcher?: string
  hooks: HookEntry[]
}

interface ClaudeSettings {
  hooks?: Record<string, HookGroup[] | undefined>
  [key: string]: unknown
}

// Marker string used both to build commands and to recognize ours on re-runs
// (even if the port or event set changes in a future version).
const COMMAND_MARKER = '/hook/'

function hookCommand(event: string): string {
  return `curl -s --max-time 1 -X POST http://127.0.0.1:${HOST_PORT}/hook/${event} -H 'Content-Type: application/json' -d @- >/dev/null 2>&1 || true`
}

/** Event name → matcher (undefined = all). PreToolUse only fires for AskUserQuestion. */
const HOOK_EVENTS: Record<string, string | undefined> = {
  UserPromptSubmit: undefined,
  Stop: undefined,
  Notification: undefined,
  PreToolUse: 'AskUserQuestion',
  PostToolUse: undefined, // resume signal after question answers / permission grants
  SessionEnd: undefined,
}

function isOurs(group: HookGroup): boolean {
  return (
    group.hooks?.some((h) => typeof h.command === 'string' && h.command.includes(COMMAND_MARKER)) ??
    false
  )
}

/**
 * Merge vibesense hook entries into settingsPath (default ~/.claude/settings.json),
 * replacing any stale vibesense entries and preserving everything else.
 * Atomic write via tmp + rename. Never throws.
 */
export function installHooks(settingsPath?: string): void {
  const target = settingsPath ?? path.join(os.homedir(), '.claude', 'settings.json')

  let settings: ClaudeSettings = {}
  try {
    settings = JSON.parse(fs.readFileSync(target, 'utf8')) as ClaudeSettings
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('hooks-install: could not parse settings.json — leaving it untouched', err)
      return // don't clobber a file we can't read
    }
    // No settings file: claude not configured yet — still fine to create one.
  }

  if (!settings.hooks || typeof settings.hooks !== 'object') settings.hooks = {}

  let changed = false
  for (const [event, matcher] of Object.entries(HOOK_EVENTS)) {
    const groups = (settings.hooks[event] ?? []).filter((g) => g && Array.isArray(g.hooks))
    const foreign = groups.filter((g) => !isOurs(g))
    const desired: HookGroup = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: 'command', command: hookCommand(event) }],
    }
    const existingOurs = groups.filter(isOurs)
    const upToDate =
      existingOurs.length === 1 && JSON.stringify(existingOurs[0]) === JSON.stringify(desired)
    if (!upToDate) {
      settings.hooks[event] = [...foreign, desired]
      changed = true
    }
  }

  if (!changed) return

  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    const tmp = `${target}.vibesense-tmp`
    fs.writeFileSync(tmp, JSON.stringify(settings, null, 2) + '\n', 'utf8')
    fs.renameSync(tmp, target)
    logger.info('hooks-install: Claude Code hooks registered', { target })
  } catch (err) {
    logger.warn('hooks-install: failed to write settings.json', err)
  }
}
