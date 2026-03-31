// src/extension/panels/onboarding-panel.ts
// Extension host panel manager for the VibeSense Onboarding Tutorial Webview

import * as vscode from 'vscode'
import { logger } from '../logger'
import { parseWebviewMessage } from '../../shared/messages'
import type { ControllerType } from '../../shared/types'

export class OnboardingPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private readonly subscriptions: vscode.Disposable[] = []

  constructor(
    private readonly context: vscode.ExtensionContext,
  ) {}

  /**
   * Creates a new OnboardingPanel — always starts fresh (AC 4).
   * Disposes any existing panel before creating a new one so the tutorial
   * always restarts from step 0.
   */
  open(controllerType: ControllerType | null): void {
    try {
      // Dispose existing panel if any — ensures fresh start (AC 4)
      this.panel?.dispose()
      this.panel = undefined

      this.panel = vscode.window.createWebviewPanel(
        'vibesense.onboarding',
        'VibeSense Onboarding',
        { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
        {
          enableScripts: true,
          localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
          retainContextWhenHidden: false,
        },
      )

      logger.info('OnboardingPanelManager: panel created')

      this.panel.webview.html = this.getHtml(this.panel.webview)

      // Post ONBOARDING_INIT immediately after panel creation
      void this.panel.webview.postMessage({
        type: 'ONBOARDING_INIT',
        payload: { controllerType },
      })

      // Handle messages from the webview
      const msgDisposable = this.panel.webview.onDidReceiveMessage((raw) => {
        const msg = parseWebviewMessage(raw)
        if (!msg) return

        if (msg.type === 'ONBOARDING_COMPLETE') {
          try {
            // Emit celebration event — Epic 6 will wire this to HAL.setHaptic()
            logger.info('OnboardingPanelManager: onboarding complete — celebration haptic event (Epic 6)')
            // Unlock Full mode via completeTutorial command (Story 4.3)
            void vscode.commands.executeCommand('vibesense.completeTutorial').then(() => {
              // Mark onboarding complete in globalState
              void this.context.globalState.update('vibesense.onboardingComplete', true).then(() => {
                logger.info('OnboardingPanelManager: globalState.onboardingComplete set to true')
              })
              this.panel?.dispose()
            })
          } catch (err) {
            logger.error('OnboardingPanelManager: error handling ONBOARDING_COMPLETE', err)
          }
        } else if (msg.type === 'ONBOARDING_DISMISSED') {
          try {
            logger.info('OnboardingPanelManager: panel dismissed by user')
            this.panel?.dispose()
          } catch (err) {
            logger.error('OnboardingPanelManager: error handling ONBOARDING_DISMISSED', err)
          }
        } else if (msg.type === 'ONBOARDING_STEP_COMPLETE') {
          // No-op on extension host side — webview manages its own step state
          logger.info(`OnboardingPanelManager: step ${msg.payload.stepIndex} complete`)
        }
      })
      this.subscriptions.push(msgDisposable)

      const disposeDisposable = this.panel.onDidDispose(() => {
        logger.info('OnboardingPanelManager: panel disposed')
        this.panel = undefined
      })
      this.subscriptions.push(disposeDisposable)
    } catch (err) {
      logger.error('OnboardingPanelManager: error opening panel', err)
      // NFR-R1: never rethrow
    }
  }

  /**
   * Posts ONBOARDING_BUTTON_PRESSED HostMessage if panel is currently open.
   * Called by extension.ts to forward HAL button events to the tutorial.
   */
  notifyButtonPressed(button: string): void {
    if (this.panel) {
      void this.panel.webview.postMessage({
        type: 'ONBOARDING_BUTTON_PRESSED',
        payload: { button },
      })
    }
  }

  /**
   * Returns true if the panel is currently open.
   */
  isOpen(): boolean {
    return this.panel !== undefined
  }

  dispose(): void {
    for (const sub of this.subscriptions) {
      sub.dispose()
    }
    this.subscriptions.length = 0
    this.panel?.dispose()
    this.panel = undefined
    logger.info('OnboardingPanelManager: disposed')
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'onboarding.js'),
    )
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
  }
}

function getNonce(): string {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}
