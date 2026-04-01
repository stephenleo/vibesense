// src/extension/panels/mini-game-panel.ts
// Host-side WebviewPanel manager for the VibeSense Mini-Game (Story 8.1)
// Pattern: follows HudPanelManager — lazy panel creation, postMessage-only communication
// FR30: auto-launch countdown; FR34: manual toggle; AC1–AC4 wired here
// Extended in Story 8.3: game mode selection, left-stick routing, D-pad/button routing

import * as vscode from 'vscode'
import { logger } from '../logger'
import { parseWebviewMessage } from '../../shared/messages'
import type { GameHighScoreStore } from './game-high-score-store'

export class MiniGamePanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private countdownTimer: ReturnType<typeof setTimeout> | undefined
  private lastRightX = 0
  private lastRightY = 0
  // Story 8.3: left-stick state and debounce
  private lastLeftX = 0
  private lastLeftY = 0
  private leftAxisDebounceTimer: ReturnType<typeof setTimeout> | undefined

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly highScoreStore: GameHighScoreStore,
  ) {}

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
   * Story 8.3: Also posts GAME_SET_MODE to deliver active game mode (AC1, AC4).
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
      // Story 8.3: Send mode immediately after GAME_START so webview knows which game to render
      this.panel?.webview.postMessage({
        type: 'GAME_SET_MODE',
        payload: { mode: this.getActiveGameMode() },
      }).then(undefined, (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_SET_MODE failed', err))
      // Story 8.4: Send persisted high scores so webview can display them immediately (AC5)
      this.panel?.webview.postMessage({
        type: 'GAME_HIGH_SCORE',
        payload: {
          snake: this.highScoreStore.getHighScore('snake'),
          tetris: this.highScoreStore.getHighScore('tetris'),
        },
      }).then(undefined, (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_HIGH_SCORE failed', err))
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

  /**
   * Story 8.3: Route left-stick axis events to the active game as GAME_INPUT (AC2).
   * Caches last_x/last_y; applies 100ms debounce to prevent input flooding (~10 moves/sec max).
   */
  updateLeftAxis(axis: 'left_x' | 'left_y', value: number): void {
    if (axis === 'left_x') this.lastLeftX = value
    else this.lastLeftY = value

    // Determine action from dominant axis
    const ax = Math.abs(this.lastLeftX)
    const ay = Math.abs(this.lastLeftY)
    const THRESHOLD = 0.5
    let action: 'left' | 'right' | 'down' | null = null

    if (ax > THRESHOLD || ay > THRESHOLD) {
      if (ay > ax) {
        if (this.lastLeftY > 0) action = 'down'
        // up direction: no Tetris action (no 'up' in Tetris)
      } else {
        action = this.lastLeftX > 0 ? 'right' : 'left'
      }
    }

    if (action && !this.leftAxisDebounceTimer) {
      this.sendGameInput(action, 'axis')
      this.leftAxisDebounceTimer = setTimeout(() => {
        this.leftAxisDebounceTimer = undefined
      }, 100)
    }
  }

  /**
   * Story 8.3: Route D-pad and face button presses to GAME_INPUT (AC2).
   * D-pad left/right/down → piece movement; square/x/r3 → clockwise rotation.
   * Button releases (pressed=false) are ignored.
   */
  notifyButton(button: string, pressed: boolean): void {
    if (!pressed || !this.panel) return
    const dpadMap: Record<string, 'left' | 'right' | 'down'> = {
      left: 'left', right: 'right', down: 'down',
    }
    // Square (DualSense) / X (Xbox) = rotate
    const rotateButtons = new Set(['square', 'x', 'r3'])
    if (dpadMap[button] !== undefined) {
      this.sendGameInput(dpadMap[button], 'button')
    } else if (rotateButtons.has(button)) {
      this.sendGameInput('rotate', 'button')
    }
  }

  /** Returns true if the game panel is currently open */
  isOpen(): boolean {
    return this.panel !== undefined
  }

  dispose(): void {
    this.cancelCountdown()
    if (this.leftAxisDebounceTimer !== undefined) {
      clearTimeout(this.leftAxisDebounceTimer)
      this.leftAxisDebounceTimer = undefined
    }
    this.panel?.dispose()
    this.panel = undefined
    logger.info('MiniGamePanelManager: disposed')
  }

  /** Story 8.3: Read active game mode from VSCode settings */
  private getActiveGameMode(): 'snake' | 'tetris' {
    const config = vscode.workspace.getConfiguration('vibesense')
    return config.get<'snake' | 'tetris'>('idleGame') ?? 'snake'
  }

  /** Story 8.3: Send GAME_INPUT message to the game webview */
  private sendGameInput(action: 'left' | 'right' | 'down' | 'rotate', source: 'button' | 'axis'): void {
    this.panel?.webview.postMessage({ type: 'GAME_INPUT', payload: { action, source } }).then(
      undefined,
      (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_INPUT failed', err),
    )
  }

  private createPanel(): void {
    // Story 8.3: dynamic panel title based on selected game mode
    const title = this.getActiveGameMode() === 'tetris'
      ? 'VibeSense \u00b7 Tetris'
      : 'VibeSense \u00b7 Game'
    this.panel = vscode.window.createWebviewPanel(
      'vibesense.miniGamePanel',
      title,
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
    // Story 8.4: Handle GAME_SCORE_UPDATE from webview — persist new high scores (AC6)
    this.panel.webview.onDidReceiveMessage(
      (raw: unknown) => {
        const msg = parseWebviewMessage(raw)
        if (!msg) return
        if (msg.type === 'GAME_SCORE_UPDATE') {
          void this.highScoreStore.updateHighScore(msg.payload.game, msg.payload.score)
        }
      },
      undefined,
      this.context.subscriptions,
    )
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
