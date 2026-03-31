// src/extension/panels/slide-panel-manager.ts
// Host-side Webview panel manager for the VibeSense session SlidePanel

import * as vscode from 'vscode'
import { logger } from '../logger'
import { parseWebviewMessage } from '../../shared/messages'
import type { Session, ControllerType } from '../../shared/types'

export class SlidePanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private panelExpanded = false

  constructor(private readonly context: vscode.ExtensionContext) {
    this.panel = vscode.window.createWebviewPanel(
      'vibesense.slidePanel',
      'VibeSense Sessions',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      },
    )

    logger.info('SlidePanelManager: panel created')

    this.panel.webview.html = this.getHtml(this.panel.webview)

    this.panel.webview.onDidReceiveMessage((raw) => {
      const msg = parseWebviewMessage(raw)
      if (!msg) return
      if (msg.type === 'SLIDE_PANEL_TOGGLE') {
        this.panelExpanded = !this.panelExpanded
        logger.info('SlidePanelManager: toggle received, expanded =', this.panelExpanded)
      } else if (msg.type === 'QUICK_PANEL_SELECT') {
        logger.info('SlidePanelManager: quick panel select', msg.payload.sessionIndex)
        vscode.commands
          .executeCommand('vibesense.switchToSession', msg.payload.sessionIndex)
          .then(undefined, (err: unknown) => {
            logger.error('SlidePanelManager: switchToSession command failed', err)
          })
      } else if (msg.type === 'QUICK_PANEL_DISMISS') {
        logger.info('SlidePanelManager: quick panel dismissed without session switch')
        this.notifyQuickPanelClose()
      }
    })

    this.panel.onDidDispose(() => {
      logger.info('SlidePanelManager: panel disposed')
      this.panel = undefined
    })
  }

  /**
   * Send updated session list to the webview.
   */
  updateSessions(sessions: Session[]): void {
    this.panel?.webview.postMessage({ type: 'SESSION_LIST_UPDATED', payload: { sessions } })
  }

  /**
   * Notify the webview that a controller connected (expands panel).
   */
  notifyControllerConnected(controllerType: ControllerType): void {
    this.panel?.webview.postMessage({ type: 'CONTROLLER_CONNECTED', payload: { controllerType } })
    logger.info('SlidePanelManager: controller connected', controllerType)
  }

  /**
   * Open the quick session panel in the webview (Story 3.5 / FR14).
   */
  notifyQuickPanelOpen(sessions: Session[], selectedIndex: number): void {
    this.panel?.webview.postMessage({
      type: 'QUICK_PANEL_OPEN',
      payload: { sessions, selectedIndex },
    })
    logger.info('SlidePanelManager: quick panel open', sessions.length, 'sessions')
  }

  /**
   * Close the quick session panel in the webview (Story 3.5).
   */
  notifyQuickPanelClose(): void {
    this.panel?.webview.postMessage({ type: 'QUICK_PANEL_CLOSE', payload: {} })
    logger.info('SlidePanelManager: quick panel close')
  }

  /**
   * Update the selected index in the quick panel (Story 3.5 / D-pad navigation).
   */
  notifyQuickPanelNavigate(selectedIndex: number): void {
    this.panel?.webview.postMessage({
      type: 'QUICK_PANEL_NAVIGATE',
      payload: { selectedIndex },
    })
    logger.info('SlidePanelManager: quick panel navigate', selectedIndex)
  }

  /**
   * Notify the webview that a session switch occurred via L1/R1 (Story 3.3).
   * Posts SESSION_SWITCHED message to trigger the SessionSwitcher overlay.
   */
  notifySessionSwitched(sessionIndex: number, sessionName: string, totalSessions: number): void {
    this.panel?.webview.postMessage({
      type: 'SESSION_SWITCHED',
      payload: { sessionIndex, sessionName, totalSessions },
    })
    logger.info('SlidePanelManager: session switched', sessionIndex, sessionName)
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = undefined
    logger.info('SlidePanelManager: disposed')
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'session.js'),
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
