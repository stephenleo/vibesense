// src/extension/ipc/hook-writer.ts
// Registers Claude Code Stop + PostToolUse hooks in ~/.claude/settings.json

import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { logger } from '../logger'

/** Shape of a single hook entry in ~/.claude/settings.json */
interface ClaudeHookEntry {
  type: string
  command: string
}

/** Shape of a hook group (matcher + hooks[]) in ~/.claude/settings.json */
interface ClaudeHookGroup {
  matcher: string
  hooks: ClaudeHookEntry[]
}

/** Partial shape of ~/.claude/settings.json we care about */
interface ClaudeSettings {
  hooks?: {
    Stop?: ClaudeHookGroup[]
    PostToolUse?: ClaudeHookGroup[]
    [key: string]: ClaudeHookGroup[] | undefined
  }
  [key: string]: unknown
}

/**
 * Registers VibeSense's Claude Code hooks in ~/.claude/settings.json.
 *
 * - Detects whether Claude Code is installed (settings.json existence check)
 * - Merges Stop + PostToolUse hook entries, preserving existing entries
 * - Writes atomically via tmp file + rename (NFR-R5)
 * - Never throws (NFR-R1)
 * - Skips gracefully if Claude Code is not installed (NFR-R4, NFR-I1)
 */
export function registerHooks(context: vscode.ExtensionContext): void {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')

  // AC 3: If Claude Code not detected, skip gracefully with info log
  if (!fs.existsSync(settingsPath)) {
    logger.info('HookWriter: Claude Code not detected — skipping hook registration')
    return
  }

  // Resolve absolute paths to the bundled hook scripts
  const stopScriptPath = vscode.Uri.joinPath(
    context.extensionUri,
    'scripts',
    'hooks',
    'stop.sh',
  ).fsPath
  const postToolUseScriptPath = vscode.Uri.joinPath(
    context.extensionUri,
    'scripts',
    'hooks',
    'post-tool-use.sh',
  ).fsPath

  // Read and parse existing settings.json (or start with empty object)
  let existing: ClaudeSettings = {}
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8')
    existing = JSON.parse(raw) as ClaudeSettings
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('HookWriter: failed to parse ~/.claude/settings.json — starting fresh merge', err)
    }
    existing = {}
  }

  // Ensure hooks object exists
  if (!existing.hooks || typeof existing.hooks !== 'object') {
    existing.hooks = {}
  }

  // Merge Stop hook entry
  if (!existing.hooks.Stop) {
    existing.hooks.Stop = []
  }
  const stopAlreadyPresent = existing.hooks.Stop.some((group) =>
    group.hooks?.some((h) => h.command === stopScriptPath),
  )
  if (!stopAlreadyPresent) {
    existing.hooks.Stop.push({
      matcher: '',
      hooks: [{ type: 'command', command: stopScriptPath }],
    })
  }

  // Merge PostToolUse hook entry
  if (!existing.hooks.PostToolUse) {
    existing.hooks.PostToolUse = []
  }
  const postToolUseAlreadyPresent = existing.hooks.PostToolUse.some((group) =>
    group.hooks?.some((h) => h.command === postToolUseScriptPath),
  )
  if (!postToolUseAlreadyPresent) {
    existing.hooks.PostToolUse.push({
      matcher: '',
      hooks: [{ type: 'command', command: postToolUseScriptPath }],
    })
  }

  // If both hooks were already present, nothing to write
  if (stopAlreadyPresent && postToolUseAlreadyPresent) {
    logger.info('HookWriter: VibeSense hooks already present — skipping write')
    return
  }

  // Atomic write: write to .tmp, then rename (NFR-R5)
  const tmpPath = settingsPath + '.tmp'
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(existing, null, 2) + '\n', 'utf-8')
    fs.renameSync(tmpPath, settingsPath)
    logger.info('HookWriter: ~/.claude/settings.json updated with VibeSense hooks')
  } catch (err) {
    logger.warn('HookWriter: failed to write ~/.claude/settings.json', err)
    try {
      fs.unlinkSync(tmpPath)
    } catch (cleanupErr) {
      logger.debug('HookWriter: tmp cleanup failed (best-effort)', cleanupErr)
    }
    // NFR-R1: never throw
  }
}
