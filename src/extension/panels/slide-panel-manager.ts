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
