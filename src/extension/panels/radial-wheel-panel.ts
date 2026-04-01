// src/extension/panels/radial-wheel-panel.ts
// Extension host panel manager for the VibeSense Radial Wheel Webview (Story 7.1)

import * as vscode from 'vscode'
import { logger } from '../logger'
import type { WheelSegmentDef } from '../../shared/types'

/**
 * Manages the VibeSense Radial Wheel Webview panel.
 *
 * Design notes:
 * - Panel is created lazily on first open() and reused (avoids slow create/dispose cycle per L2 press).
 * - On close(), we post WHEEL_CLOSE to the Webview — we do NOT dispose the panel.
 * - This satisfies the <25ms snap-open requirement (AC1) — panel stays alive, Webview hides the overlay.
 * - Uses ViewColumn.Active + preserveFocus: true for always-on-top overlay behaviour.
 */
export class RadialWheelPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private readonly subscriptions: vscode.Disposable[] = []

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Opens the radial wheel overlay.
   * Creates the panel on first call; reuses it on subsequent calls.
   */
  open(activeWheel: 'l2' | 'r2', l2Segments: WheelSegmentDef[], r2Segments: WheelSegmentDef[]): void {
    if (!this.panel) {
      this.createPanel()
    }

    this.panel?.reveal(vscode.ViewColumn.Active, /* preserveFocus */ true)
    this.panel?.webview.postMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel, l2Segments, r2Segments },
    })
    logger.debug(`RadialWheelPanelManager: opened wheel (${activeWheel})`)
  }

  /**
   * Swaps the active wheel without closing/reopening the panel.
   * Re-sends WHEEL_OPEN with the new activeWheel — the Webview detects the swap
   * and applies the ~50ms ease-out transition.
   */
  swap(newActiveWheel: 'l2' | 'r2', l2Segments: WheelSegmentDef[], r2Segments: WheelSegmentDef[]): void {
    this.panel?.webview.postMessage({
      type: 'WHEEL_OPEN',
      payload: { activeWheel: newActiveWheel, l2Segments, r2Segments },
    })
    logger.debug(`RadialWheelPanelManager: swapped active wheel to ${newActiveWheel}`)
  }

  /**
   * Sends a right-stick position update to the Webview.
   * Only called when the wheel is open (enforced by RadialWheelController).
   */
  updateStick(x: number, y: number): void {
    this.panel?.webview.postMessage({
      type: 'WHEEL_STICK_UPDATE',
      payload: { x, y },
    })
  }

  /**
   * Signals the Webview to close the wheel overlay.
   * Does NOT dispose the panel — reuse it next time L2 is held.
   */
  close(cancelled: boolean): void {
    this.panel?.webview.postMessage({
      type: 'WHEEL_CLOSE',
      payload: { cancelled },
    })
    logger.debug(`RadialWheelPanelManager: closed wheel (cancelled=${cancelled})`)
  }

  dispose(): void {
    for (const sub of this.subscriptions) {
      sub.dispose()
    }
    this.subscriptions.length = 0
    this.panel?.dispose()
    this.panel = undefined
    logger.info('RadialWheelPanelManager: disposed')
  }

  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'vibesense.radialWheel',
      'VibeSense Radial Wheel',
      { viewColumn: vscode.ViewColumn.Active, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
      },
    )

    logger.info('RadialWheelPanelManager: panel created')
    this.panel.webview.html = this.getHtml(this.panel.webview)

    // Listen for webview messages (e.g. WHEEL_SEGMENT_SELECTED for haptic tick integration)
    const messageDisposable = this.panel.webview.onDidReceiveMessage((msg: unknown) => {
      if (typeof msg === 'object' && msg !== null && 'type' in msg) {
        const typed = msg as { type: string; payload?: unknown }
        if (typed.type === 'WHEEL_SEGMENT_SELECTED') {
          logger.debug('RadialWheelPanelManager: received WHEEL_SEGMENT_SELECTED', typed.payload)
          // TODO(Story 7.2+): Forward to HapticController for micro-tick haptic event
        }
      }
    })
    this.subscriptions.push(messageDisposable)

    const disposeDisposable = this.panel.onDidDispose(() => {
      logger.info('RadialWheelPanelManager: panel disposed externally')
      this.panel = undefined
    })
    this.subscriptions.push(disposeDisposable)
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'radial-wheel.js'),
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
