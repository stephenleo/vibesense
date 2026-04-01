// src/extension/commands/register.ts
// Centralised command registration for controller-triggered terminal and agent launch (Story 3.1)
// FR10: open terminal, FR11: launch Claude Code, FR12: launch Copilot Chat
// FR13: L1/R1 session switching (Story 3.3)
// FR14: quick session panel (Story 3.5)
// Story 4.3: vibesense.completeTutorial (Guided → Full mode unlock)
// Story 5.5: vibesense.openErrorMenu + error recovery commands (FR56)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { SlidePanelManager } from '../panels/slide-panel-manager'
import type { ModeManager } from '../input/mode-manager'
import type { OnboardingPanelManager } from '../panels/onboarding-panel'
import type { SessionManager } from '../session/session-manager'
import type { LastCommandTracker } from '../session/last-command-tracker'

/**
 * Register all vibesense.* commands with the extension context.
 * Disposables are pushed to context.subscriptions so VSCode auto-disposes on deactivation.
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  slidePanelManager: SlidePanelManager,
  modeManager: ModeManager,
  onboardingPanelManager: OnboardingPanelManager,
  sessionManager?: SessionManager,
  lastCommandTracker?: LastCommandTracker,
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
        // Story 5.5: Record 'claude' as the last command for retry support.
        // NOTE: Uses terminal.name as the key. Hook-based session IDs (Story 5.2)
        // will differ from terminal.name, so retry lookup will miss until Story 5.2
        // aligns the key spaces. This is a known limitation pending hook integration.
        lastCommandTracker?.setLastCommand(terminal.name, 'claude')
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

    // FR14: Open quick session panel (R2/RT button) — Story 3.5 (AC 1, 2, 3)
    vscode.commands.registerCommand('vibesense.openQuickPanel', () => {
      try {
        const terminals = vscode.window.terminals
        const sessions = terminals.map((t) => ({
          sessionId: t.name,
          agentState: 'idle' as const,
          label: t.name,
        }))
        slidePanelManager.notifyQuickPanelOpen(sessions, 0)
      } catch (err) {
        logger.error('vibesense.openQuickPanel: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR14: Switch to a specific session by index (called by QUICK_PANEL_SELECT) — Story 3.5
    vscode.commands.registerCommand('vibesense.switchToSession', (sessionIndex: number) => {
      try {
        const terminals = vscode.window.terminals
        const terminal = terminals[sessionIndex]
        if (terminal) {
          terminal.show(false)
        }
        slidePanelManager.notifyQuickPanelClose()
      } catch (err) {
        logger.error('vibesense.switchToSession: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // FR14: Navigate quick panel to next item (D-pad down) — Story 3.5
    vscode.commands.registerCommand('vibesense.quickPanelNext', () => {
      try {
        slidePanelManager.quickPanelNext()
      } catch (err) {
        logger.error('vibesense.quickPanelNext: failed', err)
      }
    }),

    // FR14: Navigate quick panel to previous item (D-pad up) — Story 3.5
    vscode.commands.registerCommand('vibesense.quickPanelPrev', () => {
      try {
        slidePanelManager.quickPanelPrev()
      } catch (err) {
        logger.error('vibesense.quickPanelPrev: failed', err)
      }
    }),

    // Story 4.3: Complete onboarding tutorial and unlock Full mode (AC 2)
    // Called by Story 4.4's onboarding panel when tutorial is finished.
    vscode.commands.registerCommand('vibesense.completeTutorial', () => {
      try {
        modeManager.setFullMode()
        logger.info('vibesense.completeTutorial: Full mode unlocked')
      } catch (err) {
        logger.error('vibesense.completeTutorial: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 4.4: Open onboarding tutorial (AC 1, 4) — always starts from beginning
    vscode.commands.registerCommand('vibesense.startOnboarding', () => {
      try {
        // null = no controller type known at command time; panel will use last notified type
        onboardingPanelManager.open(null)
      } catch (err) {
        logger.error('vibesense.startOnboarding: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 5.5 / FR56: Open error recovery menu for currently active error session (manual trigger)
    vscode.commands.registerCommand('vibesense.openErrorMenu', () => {
      try {
        const sessions = sessionManager?.getSessions()
        if (!sessions) return
        let errorSessionId = ''
        for (const [id, fsm] of sessions) {
          if (fsm.state === 'error') {
            errorSessionId = id
            break
          }
        }
        if (!errorSessionId) return
        const hasLastCommand = lastCommandTracker?.getLastCommand(errorSessionId) !== undefined
        slidePanelManager.notifyErrorMenuOpen(errorSessionId, hasLastCommand)
      } catch (err) {
        logger.error('vibesense.openErrorMenu: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 5.5 / FR56: Retry last command in error session (AC 2)
    vscode.commands.registerCommand('vibesense.errorRetryLastCommand', (sessionId: string) => {
      try {
        const terminal = vscode.window.activeTerminal
        const lastCommand = lastCommandTracker?.getLastCommand(sessionId)
        let didRetry = false
        if (terminal) {
          if (lastCommand) {
            terminal.sendText(lastCommand, true)
            didRetry = true
          } else {
            // Fallback: delegate to VSCode's built-in terminal history
            vscode.commands
              .executeCommand('workbench.action.terminal.runRecentCommand')
              .then(undefined, (err: unknown) => {
                logger.error('vibesense.errorRetryLastCommand: runRecentCommand failed', err)
              })
            didRetry = true
          }
        } else {
          logger.warn('vibesense.errorRetryLastCommand: no active terminal — no-op')
        }
        // Transition FSM back to processing only when a retry was actually attempted (AC 2)
        if (didRetry && sessionId) {
          sessionManager?.getOrCreateFsm(sessionId).dispatch('AGENT_PROCESSING')
        }
      } catch (err) {
        logger.error('vibesense.errorRetryLastCommand: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 5.5 / FR56: Clear terminal output
    vscode.commands.registerCommand('vibesense.errorClearTerminal', () => {
      try {
        vscode.commands
          .executeCommand('workbench.action.terminal.clear')
          .then(undefined, (err: unknown) => {
            logger.error('vibesense.errorClearTerminal: clear failed', err)
          })
      } catch (err) {
        logger.error('vibesense.errorClearTerminal: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 5.5 / FR56: View error log — shows status bar message pointing to output panel
    vscode.commands.registerCommand('vibesense.errorViewLog', () => {
      try {
        vscode.window.setStatusBarMessage('$(error) View VibeSense Output panel for error log', 5000)
        logger.info('vibesense.errorViewLog: status bar message shown')
      } catch (err) {
        logger.error('vibesense.errorViewLog: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 7.1: Dispatch a prompt text to the active terminal (FR38)
    // Inserts the prompt text as stdin to the active terminal with a newline.
    vscode.commands.registerCommand('vibesense.dispatchPrompt', (promptText: string) => {
      try {
        if (!promptText) return
        // Insert the prompt text into the active terminal (send as stdin text)
        void vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
          text: promptText + '\n',
        })
        logger.info(`vibesense.dispatchPrompt: dispatched "${promptText.slice(0, 40)}..."`)
      } catch (err) {
        logger.error('vibesense.dispatchPrompt: failed', err)
        // NFR-R1: swallow — never propagate to VSCode process
      }
    }),

    // Story 7.1: No-op placeholder for vibesense.openRadialWheel
    // The real L2 hold/release logic is handled by RadialWheelController directly.
    // This command exists for compatibility with binding profiles that reference it.
    vscode.commands.registerCommand('vibesense.openRadialWheel', () => {
      // No-op: RadialWheelController handles L2 hold/release directly
      logger.debug('vibesense.openRadialWheel: handled by RadialWheelController')
    }),
  )
}
