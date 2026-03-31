// src/extension/panels/settings-panel.ts
// Extension host panel manager for the VibeSense Settings Webview

import * as vscode from 'vscode'
import { logger } from '../logger'
import { parseWebviewMessage } from '../../shared/messages'
import type { ControllerType } from '../../shared/types'
import type { SettingsBridge } from '../input/settings-bridge'
import type { InputRouter } from '../input/input-router'

export class SettingsPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined
  private readonly subscriptions: vscode.Disposable[] = []
  private currentControllerType: ControllerType | null = null

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly settingsBridge: SettingsBridge,
    private readonly inputRouter: InputRouter,
  ) {}

  /**
   * Creates or reveals the VibeSense Settings panel.
   * Opens to the right of the active editor (ViewColumn.Beside).
   */
  open(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside)
      return
    }

    this.panel = vscode.window.createWebviewPanel(
      'vibesense.settings',
      'VibeSense Settings',
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')],
      },
    )

    logger.info('SettingsPanelManager: panel created')

    this.panel.webview.html = this.getHtml(this.panel.webview)

    // Handle messages from the webview
    const msgDisposable = this.panel.webview.onDidReceiveMessage((raw) => {
      const msg = parseWebviewMessage(raw)
      if (!msg) return

      if (msg.type === 'SETTINGS_REQUEST_LOAD') {
        this.sendCurrentState()
      } else if (msg.type === 'SETTINGS_BINDING_CHANGED') {
        try {
          const { button, command } = msg.payload
          this.settingsBridge.writeBindingToProfile(button as import('../../shared/types').ButtonId, command)
          const freshBindings = this.settingsBridge.readBindingsFromSettings()
          this.inputRouter.reloadBindings(freshBindings)
          this.panel?.webview.postMessage({
            type: 'SETTINGS_BINDING_APPLIED',
            payload: { button, command },
          })
          logger.info(`SettingsPanelManager: binding changed ${button} → ${command}`)
        } catch (err) {
          logger.error('SettingsPanelManager: error handling SETTINGS_BINDING_CHANGED', err)
        }
      } else if (msg.type === 'SETTINGS_RESET_SECTION') {
        try {
          const { buttons } = msg.payload
          this.settingsBridge.resetSectionToDefaults(buttons as import('../../shared/types').ButtonId[])
          const freshBindings = this.settingsBridge.readBindingsFromSettings()
          this.inputRouter.reloadBindings(freshBindings)
          // Re-send current state so webview reflects the reset
          this.sendCurrentState()
          logger.info(`SettingsPanelManager: section reset for ${buttons.length} button(s)`)
        } catch (err) {
          logger.error('SettingsPanelManager: error handling SETTINGS_RESET_SECTION', err)
        }
      }
    })
    this.subscriptions.push(msgDisposable)

    const disposeDisposable = this.panel.onDidDispose(() => {
      logger.info('SettingsPanelManager: panel disposed')
      this.panel = undefined
    })
    this.subscriptions.push(disposeDisposable)
  }

  /**
   * Notifies the settings webview that a controller was connected so glyphs update.
   * No-op if the panel is not currently visible.
   */
  notifyControllerConnected(controllerType: ControllerType): void {
    this.currentControllerType = controllerType
    if (this.panel) {
      this.panel.webview.postMessage({
        type: 'CONTROLLER_CONNECTED',
        payload: { controllerType },
      })
      logger.info('SettingsPanelManager: controller connected', controllerType)
    }
  }

  dispose(): void {
    for (const sub of this.subscriptions) {
      sub.dispose()
    }
    this.subscriptions.length = 0
    this.panel?.dispose()
    this.panel = undefined
    logger.info('SettingsPanelManager: disposed')
  }

  /** Sends SETTINGS_LOADED with current bindings and controller type to the webview. */
  private sendCurrentState(): void {
    try {
      const bindings = this.settingsBridge.readBindingsFromSettings()
      // Convert BindingMap (Partial<Record<ButtonId, string>>) to Record<string, string>
      const bindingsRecord: Record<string, string> = {}
      for (const [key, value] of Object.entries(bindings)) {
        if (value !== undefined) {
          bindingsRecord[key] = value
        }
      }
      this.panel?.webview.postMessage({
        type: 'SETTINGS_LOADED',
        payload: { bindings: bindingsRecord, controllerType: this.currentControllerType },
      })
    } catch (err) {
      logger.error('SettingsPanelManager: error sending current state', err)
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce()
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', 'settings.js'),
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
