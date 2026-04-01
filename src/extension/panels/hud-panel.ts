// src/extension/panels/hud-panel.ts
// Host-side WebviewPanel manager for the VibeSense HUD Overlay (Story 7.3)
// Pattern: follows SlidePanelManager — lazy panel creation, postMessage-only (display-only)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { ControllerType } from '../../shared/types'
import type { BindingMap, BindingMode } from '../input/default-bindings'

export class HudPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private visible = false

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Toggle HUD visibility. Creates the panel on first show.
   * Returns new visible state.
   */
  toggle(): boolean {
    if (this.visible && this.panel) {
      this.panel.webview.postMessage({ type: 'HUD_TOGGLE', payload: { visible: false } }).then(
        undefined,
        (err: unknown) => logger.error('HudPanelManager: postMessage failed (hide)', err),
      )
      this.visible = false
      logger.info('HudPanelManager: hidden')
    } else {
      this.ensurePanelExists()
      if (!this.panel) {
        logger.warn('HudPanelManager: panel creation failed, cannot show')
        return this.visible
      }
      this.panel.webview.postMessage({ type: 'HUD_TOGGLE', payload: { visible: true } }).then(
        undefined,
        (err: unknown) => logger.error('HudPanelManager: postMessage failed (show)', err),
      )
      this.visible = true
      logger.info('HudPanelManager: shown')
    }
    return this.visible
  }

  /**
   * Push updated bindings to HUD webview (called on profile change — AC2).
   */
  updateBindings(bindings: BindingMap, controllerType: ControllerType | null, mode: BindingMode): void {
    if (!this.panel) return
    this.panel.webview.postMessage({
      type: 'HUD_BINDINGS_UPDATED',
      payload: {
        bindings: bindings as Record<string, string>,
        controllerType,
        mode,
      },
    }).then(
      undefined,
      (err: unknown) => logger.error('HudPanelManager: postMessage failed (bindings)', err),
    )
    logger.info('HudPanelManager: bindings updated, mode =', mode)
  }

  /**
   * Notify HUD of mode change while visible (AC3).
   */
  updateMode(mode: BindingMode, bindings: BindingMap): void {
    if (!this.panel) return
    this.panel.webview.postMessage({
      type: 'HUD_MODE_CHANGED',
      payload: { mode, bindings: bindings as Record<string, string> },
    }).then(
      undefined,
      (err: unknown) => logger.error('HudPanelManager: postMessage failed (mode)', err),
    )
    logger.info('HudPanelManager: mode changed to', mode)
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = undefined
    logger.info('HudPanelManager: disposed')
  }

  private ensurePanelExists(): void {
    if (this.panel) return
    try {
      this.panel = vscode.window.createWebviewPanel(
        'vibesense.hudPanel',
        'VibeSense HUD',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
        },
      )
      this.panel.webview.html = this.getHtml(this.panel.webview)
      this.panel.onDidDispose(() => {
        logger.info('HudPanelManager: panel disposed externally')
        this.panel = undefined
        this.visible = false
      })
    } catch (err) {
      logger.error('HudPanelManager: failed to create panel', err)
      // NFR-R1: never propagate to VSCode process
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'hud.js'),
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
