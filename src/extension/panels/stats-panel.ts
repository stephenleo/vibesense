// src/extension/panels/stats-panel.ts
// Host-side WebviewPanel manager for the VibeSense Stats Dashboard (Story 9.2)
// Pattern: follows HudPanelManager — lazy panel creation, postMessage-only communication
// FR42, FR43; UX-DR10 (StatsCard)

import * as vscode from 'vscode'
import { logger } from '../logger'
import { SESSION_HISTORY_KEY } from '../stats/session-ratio-tracker'
import { SessionHistorySchema } from '../stats/session-record-schema'
import type { SessionRecord } from '../../shared/types'

export class StatsPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly globalState: vscode.Memento,
  ) {}

  /**
   * Open the stats panel. Creates it on first call.
   * Posts STATS_LOADED to the webview after panel is ready.
   * Never throws (NFR-R1).
   */
  open(): void {
    try {
      if (!this.panel) {
        this.createPanel()
      }
      this.panel?.reveal(vscode.ViewColumn.One, /* preserveFocus */ false)
      this.sendStats()
      logger.info('StatsPanelManager: opened')
    } catch (err) {
      logger.error('StatsPanelManager: open() failed', err)
      // NFR-R1: never propagate to VSCode process
    }
  }

  dispose(): void {
    this.panel?.dispose()
    this.panel = undefined
    logger.info('StatsPanelManager: disposed')
  }

  /**
   * Compute streak: consecutive calendar days ending today (UTC) with ≥1 session.
   * Returns 0 if today has no sessions (streak breaks if today is empty).
   * Exposed for testability.
   */
  computeStreak(sessions: SessionRecord[]): number {
    if (sessions.length === 0) return 0

    const DAY_MS = 86_400_000

    // Build a Set of calendar-day timestamps (UTC midnight)
    const days = new Set<number>()
    for (const s of sessions) {
      const d = new Date(s.startedAt)
      // Normalize to UTC midnight
      const dayTs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      days.add(dayTs)
    }

    // Walk backwards from today's UTC midnight
    const now = new Date()
    let todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

    let streak = 0
    while (days.has(todayStart)) {
      streak++
      todayStart -= DAY_MS
    }
    return streak
  }

  private sendStats(): void {
    try {
      const raw = this.globalState.get<unknown>(SESSION_HISTORY_KEY)
      const parseResult = SessionHistorySchema.safeParse(raw ?? [])
      const sessions: SessionRecord[] = parseResult.success ? parseResult.data : []
      const streak = this.computeStreak(sessions)
      this.panel?.webview.postMessage({
        type: 'STATS_LOADED',
        payload: { sessions, streak },
      }).then(
        undefined,
        (err: unknown) => logger.error('StatsPanelManager: postMessage STATS_LOADED failed', err),
      )
    } catch (err) {
      logger.error('StatsPanelManager: sendStats() failed', err)
    }
  }

  private createPanel(): void {
    this.panel = vscode.window.createWebviewPanel(
      'vibesense.statsPanel',
      'VibeSense \u00b7 Stats',
      { viewColumn: vscode.ViewColumn.One, preserveFocus: false },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
      },
    )
    this.panel.webview.html = this.getHtml(this.panel.webview)
    this.panel.onDidDispose(() => {
      logger.info('StatsPanelManager: panel disposed externally')
      this.panel = undefined
    })
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'stats.js'),
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
