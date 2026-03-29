// src/extension/extension.ts
// VibeSense extension entry point
// Full implementation across Stories 1.2 – 1.5

import * as vscode from 'vscode'

/**
 * Called when the extension is activated.
 * Activation is lazy: triggered by onStartupFinished or HID events (FR51).
 */
export function activate(_context: vscode.ExtensionContext): void {
  // TODO Story 1.5: Replace with logger singleton using vscode.window.createOutputChannel('VibeSense')
  // eslint-disable-next-line no-console
  console.log('VibeSense activating')

  // Placeholder: full HID setup in Story 1.2
  // Placeholder: IPC server in Story 1.3
  // Placeholder: status bar in Story 1.5
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
  // Cleanup resources — implementation in later stories
}
