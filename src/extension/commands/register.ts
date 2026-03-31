// src/extension/commands/register.ts
// Centralised command registration for controller-triggered terminal and agent launch (Story 3.1)
// FR10: open terminal, FR11: launch Claude Code, FR12: launch Copilot Chat

import * as vscode from 'vscode'
import { logger } from '../logger'

/**
 * Register all vibesense.* commands with the extension context.
 * Disposables are pushed to context.subscriptions so VSCode auto-disposes on deactivation.
 */
export function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    // FR10: Open a new VSCode integrated terminal and focus it
    vscode.commands.registerCommand('vibesense.openTerminal', () => {
      try {
        const terminal = vscode.window.createTerminal({ name: 'VibeSense' })
        terminal.show(true) // true = preserve focus on terminal (not editor)
      } catch (err) {
        logger.error('vibesense.openTerminal: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR11: Send "claude\n" to the active terminal to start a Claude Code session
    vscode.commands.registerCommand('vibesense.launchClaudeCode', () => {
      try {
        const terminal =
          vscode.window.activeTerminal ?? vscode.window.createTerminal({ name: 'VibeSense' })
        terminal.show(true)
        terminal.sendText('claude', true) // true = add newline (presses Enter)
      } catch (err) {
        logger.error('vibesense.launchClaudeCode: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR12: Open GitHub Copilot Chat panel; show non-blocking message if not installed (NFR-R4, NFR-A3)
    vscode.commands.registerCommand('vibesense.launchCopilotChat', () => {
      vscode.commands.executeCommand('workbench.action.chat.open').then(
        undefined,
        (_err: unknown) => {
          // Copilot Chat not installed — non-blocking, auto-dismissing status bar message (NFR-A3)
          vscode.window.setStatusBarMessage('GitHub Copilot Chat not installed', 5000)
          logger.warn('vibesense.launchCopilotChat: Copilot Chat not installed')
        },
      )
    }),
  )
}
