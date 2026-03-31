// src/extension/session/terminal-parser.ts
// Fallback terminal output stream parser for agent state detection (Story 5.4)
// Active when Claude Code hooks are unavailable (Copilot Chat and other non-hook agents)
// FR20: Parse terminal output streams as fallback for agent state detection
// NFR-I1: Degrades gracefully if Claude Code hooks are not installed

import * as vscode from 'vscode'
import { SessionManager } from './session-manager'
import { logger } from '../logger'

// ── VSCode API type augmentation ──────────────────────────────────────────────
// vscode.window.onDidWriteTerminalData is available since VSCode 1.56 (stable in 1.85+)
// but @types/vscode may not include it in all versions.
// We define a minimal interface to type-safely access it at runtime.

interface TerminalDataWriteEvent {
  readonly terminal: vscode.Terminal
  readonly data: string
}

interface VscodeWindowWithTerminalData {
  onDidWriteTerminalData(listener: (e: TerminalDataWriteEvent) => void): vscode.Disposable
}

// ── ANSI Escape Code Stripper ─────────────────────────────────────────────────
// Strip color, cursor movement, and other control sequences before pattern matching
// eslint-disable-next-line no-control-regex -- ESC (U+001B) is intentionally matched here to strip ANSI sequences
const ANSI_ESCAPE_RE = /\u001B\[[0-9;]*[mGKHF]/g

function stripAnsi(data: string): string {
  return data.replace(ANSI_ESCAPE_RE, '')
}

// ── Pattern Definitions ───────────────────────────────────────────────────────
// Priority order: NEEDS_INPUT first, then PROCESSING, then COMPLETE
// Only the first matching category fires per data chunk (no double-fire)

/** Signals: Copilot Chat needs input / waiting for user response */
const NEEDS_INPUT_PATTERNS: RegExp[] = [
  /\?\s*$/m,               // ends with a question mark
  /Press .* to continue/i,
  /\[y\/n\]/i,
  /Enter .* to/i,
]

/** Signals: Copilot Chat is actively processing / working */
const PROCESSING_PATTERNS: RegExp[] = [
  /\.\.\./,
  /Thinking/i,
  /Generating/i,
  /Working/i,
]

/** Signals: Copilot Chat completes / agent goes idle */
const COMPLETE_PATTERNS: RegExp[] = [
  /✓\s+Done/i,
  /^>\s*$/m,               // bare prompt reappears after output
  /\[done\]/i,
  /completed successfully/i,
]

/**
 * Test whether a string matches any pattern in the given array.
 */
function matchesAny(data: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(data))
}

// ── TerminalOutputParser ──────────────────────────────────────────────────────

/**
 * Parses VSCode terminal PTY output to detect agent state signals via regex patterns.
 * Active when Claude Code hooks are unavailable (AC 1, 3).
 * Implements vscode.Disposable — push into context.subscriptions (AC 4).
 */
export class TerminalOutputParser implements vscode.Disposable {
  private readonly disposable: vscode.Disposable

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly hookActive: () => boolean,
  ) {
    // Register terminal data listener once in constructor; store Disposable for dispose()
    // Cast vscode.window to our augmented interface — onDidWriteTerminalData is stable in VSCode 1.85+
    // but may not be in all @types/vscode versions.
    const vscodeWindow = vscode.window as unknown as VscodeWindowWithTerminalData

    // Guard against older VSCode hosts where onDidWriteTerminalData is absent (NFR-I1).
    // Fall back to a no-op disposable so the extension activates cleanly.
    if (typeof vscodeWindow.onDidWriteTerminalData !== 'function') {
      logger.info('TerminalOutputParser: onDidWriteTerminalData not available — terminal fallback disabled')
      this.disposable = { dispose: () => undefined }
      return
    }

    this.disposable = vscodeWindow.onDidWriteTerminalData((event: TerminalDataWriteEvent) => {
      this.processOutput(event.terminal, event.data)
    })
  }

  /**
   * Process raw terminal output for a given terminal.
   * Strips ANSI escapes, matches patterns in priority order, dispatches FSM event.
   */
  private processOutput(terminal: vscode.Terminal, data: string): void {
    try {
      // AC 3: Skip dispatch entirely when hooks are live — hooks take precedence
      if (this.hookActive()) {
        return
      }

      const clean = stripAnsi(data)

      // Priority: NEEDS_INPUT → PROCESSING → COMPLETE (only first match fires)
      if (matchesAny(clean, NEEDS_INPUT_PATTERNS)) {
        this.sessionManager.getOrCreateFsm(terminal.name).dispatch('NEEDS_INPUT')
        return
      }

      if (matchesAny(clean, PROCESSING_PATTERNS)) {
        this.sessionManager.getOrCreateFsm(terminal.name).dispatch('AGENT_PROCESSING')
        return
      }

      if (matchesAny(clean, COMPLETE_PATTERNS)) {
        this.sessionManager.getOrCreateFsm(terminal.name).dispatch('AGENT_COMPLETE')
        return
      }

      // AC 2: No match → no FSM transition, no error log
    } catch (err) {
      // NFR-R1: Never throw into VSCode's event bus — swallow and log
      logger.error('TerminalOutputParser: error processing terminal data', err)
    }
  }

  /**
   * Remove the terminal data listener.
   * Called automatically when pushed into context.subscriptions (AC 4).
   */
  dispose(): void {
    this.disposable.dispose()
  }
}
