// src/extension/panels/achievement-burst-panel.ts
// Host-side WebviewPanel manager for the AchievementBurst overlay (Story 9.5)
// Pattern: follows HudPanelManager — lazy panel creation, postMessage-only (display-only)

import * as vscode from 'vscode'
import { logger } from '../logger'

export class AchievementBurstPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Show the achievement burst overlay for the given achievement.
   * Creates the panel on first call (lazy); posts ACHIEVEMENT_BURST_SHOW message.
   * Never throws (NFR-R1).
   */
  show(id: string, label: string, tier: string, description: string): void {
    try {
      this.ensurePanelExists()
      if (!this.panel) {
        logger.warn('AchievementBurstPanelManager: panel creation failed, cannot show')
        return
      }
      this.panel.webview.postMessage({
        type: 'ACHIEVEMENT_BURST_SHOW',
        payload: { id, label, tier, description },
      }).then(
        undefined,
        (err: unknown) => logger.error('AchievementBurstPanelManager: postMessage failed', err),
      )
      logger.info(`AchievementBurstPanelManager: showing burst for "${id}" (${tier})`)
    } catch (err) {
      logger.error('AchievementBurstPanelManager: show() failed', err)
      // NFR-R1: never propagate
    }
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = undefined
    logger.info('AchievementBurstPanelManager: disposed')
  }

  private ensurePanelExists(): void {
    if (this.panel) return
    try {
      this.panel = vscode.window.createWebviewPanel(
        'vibesense.achievementBurst',
        'VibeSense · Achievement',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
        },
      )
      this.panel.webview.html = this.getHtml(this.panel.webview)
      this.panel.onDidDispose(() => {
        logger.info('AchievementBurstPanelManager: panel disposed externally')
        this.panel = undefined
      })
    } catch (err) {
      logger.error('AchievementBurstPanelManager: failed to create panel', err)
      // NFR-R1: never propagate to VSCode process
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'achievement-burst.js'),
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
