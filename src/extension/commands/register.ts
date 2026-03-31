// src/extension/commands/register.ts
// Centralised command registration for controller-triggered terminal and agent launch (Story 3.1)
// FR10: open terminal, FR11: launch Claude Code, FR12: launch Copilot Chat
// FR13: L1/R1 session switching (Story 3.3)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { SlidePanelManager } from '../panels/slide-panel-manager'

/**
 * Register all vibesense.* commands with the extension context.
 * Disposables are pushed to context.subscriptions so VSCode auto-disposes on deactivation.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  slidePanelManager: SlidePanelManager,
): void {
  context.subscriptions.push(
    // FR10: Open a new VSCode integrated terminal and focus it
    vscode.commands.registerCommand('vibesense.openTerminal', () => {
      try {
        const terminal = vscode.window.createTerminal({ name: 'VibeSense' })
        terminal.show(false) // false = focus the new terminal (AC 1: "focus moves to the new terminal")
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
        terminal.show(false) // false = focus the terminal so user sees Claude Code start
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

    // FR17, FR21: Push-to-talk voice input; graceful fallback when VS Code Speech not available (NFR-I2, NFR-A3, NFR-R1, NFR-R4)
    vscode.commands.registerCommand('vibesense.voicePtt', () => {
      try {
        vscode.commands.executeCommand('workbench.action.voiceChat.start').then(
          () => {
            vscode.window.setStatusBarMessage('$(mic) Voice input active', 5000)
            logger.info('vibesense.voicePtt: voice PTT activated')
          },
          (_err: unknown) => {
            // Voice unavailable — non-blocking fallback (NFR-I2, NFR-A3)
            vscode.window.setStatusBarMessage(
              'Voice input unavailable — use radial wheel or keyboard',
              5000,
            )
            logger.warn(
              'vibesense.voicePtt: voice unavailable — VS Code Speech not installed or voice mode inactive',
            )
          },
        )
      } catch (err) {
        logger.error('vibesense.voicePtt: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR13: Switch to next terminal session (R1 button) — Story 3.3 (AC 1, 3, 4)
    vscode.commands.registerCommand('vibesense.switchSessionNext', () => {
      try {
        const terminals = vscode.window.terminals
        if (terminals.length < 2) return // AC 3: no-op with 0 or 1 terminal

        const activeTerminal = vscode.window.activeTerminal
        const currentIndex = activeTerminal ? terminals.findIndex((t) => t === activeTerminal) : -1
        const nextIndex = (currentIndex + 1) % terminals.length
        const nextTerminal = terminals[nextIndex]

        nextTerminal.show(false) // false = focus the terminal (within 100ms, AC 1)

        const sessionName = nextTerminal.name ?? `Terminal ${nextIndex + 1}`
        slidePanelManager.notifySessionSwitched(nextIndex, sessionName, terminals.length)
      } catch (err) {
        logger.error('vibesense.switchSessionNext: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR13: Switch to previous terminal session (L1 button) — Story 3.3 (AC 2, 3, 4)
    vscode.commands.registerCommand('vibesense.switchSessionPrev', () => {
      try {
        const terminals = vscode.window.terminals
        if (terminals.length < 2) return // AC 3: no-op with 0 or 1 terminal

        const activeTerminal = vscode.window.activeTerminal
        const foundIndex = activeTerminal ? terminals.findIndex((t) => t === activeTerminal) : -1
        // When no active terminal (or not found), treat as index 0 so prev wraps to last
        const currentIndex = foundIndex === -1 ? 0 : foundIndex
        const prevIndex = (currentIndex - 1 + terminals.length) % terminals.length
        const prevTerminal = terminals[prevIndex]

        prevTerminal.show(false) // false = focus the terminal (within 100ms, AC 2)

        const sessionName = prevTerminal.name ?? `Terminal ${prevIndex + 1}`
        slidePanelManager.notifySessionSwitched(prevIndex, sessionName, terminals.length)
      } catch (err) {
        logger.error('vibesense.switchSessionPrev: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),
  )
}
