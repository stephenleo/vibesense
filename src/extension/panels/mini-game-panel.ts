// src/extension/panels/mini-game-panel.ts
// Host-side WebviewPanel manager for the VibeSense Mini-Game (Story 8.1)
// Pattern: follows HudPanelManager — lazy panel creation, postMessage-only communication
// FR30: auto-launch countdown; FR34: manual toggle; AC1–AC4 wired here

import * as vscode from 'vscode'
import { logger } from '../logger'

export class MiniGamePanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private countdownTimer: ReturnType<typeof setTimeout> | undefined
  private lastRightX = 0
  private lastRightY = 0

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * Called when AggregateGameState transitions to PLAY (i.e., processing began).
   * Starts the configurable countdown; if still PLAY when it fires, opens the game.
   * Cancels any existing countdown first (prevents double-timers).
   */
  startCountdown(): void {
    this.cancelCountdown()
    const delayMs = this.getAutoLaunchDelayMs()
    if (delayMs === 0) {
      logger.info('MiniGamePanelManager: auto-launch disabled (delay=0)')
      return
    }
    this.countdownTimer = setTimeout(() => {
      this.countdownTimer = undefined
      try {
        this.open()
        logger.info('MiniGamePanelManager: auto-launched after countdown')
      } catch (err) {
        logger.error('MiniGamePanelManager: auto-launch failed', err)
      }
    }, delayMs)
    logger.info(`MiniGamePanelManager: countdown started (${delayMs}ms)`)
  }

  /**
   * Cancel any pending countdown (called when AggregateGameState transitions to PAUSE).
   */
  cancelCountdown(): void {
    if (this.countdownTimer !== undefined) {
      clearTimeout(this.countdownTimer)
      this.countdownTimer = undefined
      logger.info('MiniGamePanelManager: countdown cancelled')
    }
  }

  /**
   * Pause the running game — sends GAME_PAUSE to webview (FR31, AC1).
   * No-op if panel is not open. Called by aggregateGameStateChanged → PAUSE.
   */
  pauseGame(): void {
    if (!this.panel) return
    this.panel.webview.postMessage({ type: 'GAME_PAUSE', payload: {} }).then(
      undefined,
      (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_PAUSE failed', err),
    )
    logger.info('MiniGamePanelManager: game paused')
  }

  /**
   * Resume the paused game — sends GAME_RESUME to webview (FR32, AC2).
   * No-op if panel is not open. Called by aggregateGameStateChanged → PLAY (only if game was open).
   */
  resumeGame(): void {
    if (!this.panel) return
    this.panel.webview.postMessage({ type: 'GAME_RESUME', payload: {} }).then(
      undefined,
      (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_RESUME failed', err),
    )
    logger.info('MiniGamePanelManager: game resumed')
  }

  /**
   * Open the GameWindow panel. Creates it on first call.
   * Posts GAME_START to the webview after panel is ready.
   */
  open(): void {
    try {
      if (!this.panel) {
        this.createPanel()
      }
      this.panel?.reveal(vscode.ViewColumn.Two, /* preserveFocus */ true)
      this.panel?.webview.postMessage({ type: 'GAME_START', payload: {} }).then(
        undefined,
        (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_START failed', err),
      )
      logger.info('MiniGamePanelManager: opened')
    } catch (err) {
      logger.error('MiniGamePanelManager: open failed', err)
      // NFR-R1: never propagate to VSCode process
    }
  }

  /**
   * Manually toggle the game panel (FR34 — vibesense.toggleGame command).
   * Opens if closed; disposes if open.
   */
  toggle(): void {
    try {
      if (this.panel) {
        this.panel.dispose()
        // panel ref cleared in onDidDispose handler
      } else {
        this.open()
      }
    } catch (err) {
      logger.error('MiniGamePanelManager: toggle failed', err)
      // NFR-R1: never propagate to VSCode process
    }
  }

  /**
   * Send right-stick axis update to the game webview (AC2).
   * Caches last right_x and right_y values for combined direction calculation.
   * Only sends when panel is open.
   */
  updateAxis(axis: 'right_x' | 'right_y', value: number): void {
    if (axis === 'right_x') this.lastRightX = value
    else this.lastRightY = value
    this.panel?.webview.postMessage({
      type: 'GAME_STICK_UPDATE',
      payload: { x: this.lastRightX, y: this.lastRightY },
    }).then(
      undefined,
      (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_STICK_UPDATE failed', err),
    )
  }

  /** Returns true if the game panel is currently open */
  isOpen(): boolean {
    return this.panel !== undefined
  }

  dispose(): void {
    this.cancelCountdown()
    this.panel?.dispose()
    this.panel = undefined
    logger.info('MiniGamePanelManager: disposed')
  }

  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'vibesense.miniGamePanel',
      'VibeSense \u00b7 Game',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,  // AC3: state survives dock/undock
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
      },
    )
    this.panel.webview.html = this.getHtml(this.panel.webview)
    this.panel.onDidDispose(() => {
      logger.info('MiniGamePanelManager: panel disposed externally')
      this.panel = undefined
    })
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'mini-game.js'),
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

  private getAutoLaunchDelayMs(): number {
    const config = vscode.workspace.getConfiguration('vibesense')
    const seconds = config.get<number>('gameAutoLaunchDelay') ?? 5
    return Math.max(0, seconds) * 1000
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
