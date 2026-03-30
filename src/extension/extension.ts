// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 1.5

import * as vscode from 'vscode'
import { logger, disposeLogger } from './logger'

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(_context: vscode.ExtensionContext): void {
  logger.info('VibeSense activating')

  // TODO Story 2.2: wire HidManager here — auto-reconnect lifecycle
  // Placeholder: IPC server in Story 1.3
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  disposeLogger()
  // Cleanup resources — implementation in later stories
}
