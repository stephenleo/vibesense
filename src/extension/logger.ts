// src/extension/logger.ts
// Logger singleton — all extension host logging through this module
// Uses vscode.window.createOutputChannel('VibeSense') — created once at module init

import * as vscode from 'vscode'

// Module-level singleton: created at import time, reused everywhere
const outputChannel = vscode.window.createOutputChannel('VibeSense')

function formatMessage(level: string, message: string, args: unknown[]): string {
  const timestamp = new Date().toISOString()
  const suffix = args.length > 0 ? ' ' + args.map(String).join(' ') : ''
  return `[${level}] ${timestamp} ${message}${suffix}`
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    try {
      outputChannel.appendLine(formatMessage('INFO', message, args))
    } catch (e) {
      // NFR-R1: logger must never throw — last-resort fallback only
      // eslint-disable-next-line no-console
      console.error('[VibeSense logger fallback]', e)
    }
  },

  warn(message: string, ...args: unknown[]): void {
    try {
      outputChannel.appendLine(formatMessage('WARN', message, args))
    } catch (e) {
      // NFR-R1: logger must never throw — last-resort fallback only
      // eslint-disable-next-line no-console
      console.error('[VibeSense logger fallback]', e)
    }
  },

  error(message: string, ...args: unknown[]): void {
    try {
      outputChannel.appendLine(formatMessage('ERROR', message, args))
    } catch (e) {
      // NFR-R1: logger must never throw — last-resort fallback only
      // eslint-disable-next-line no-console
      console.error('[VibeSense logger fallback]', e)
    }
  },
}

/**
 * Dispose the output channel. Call in extension deactivate().
 */
export function disposeLogger(): void {
  outputChannel.dispose()
}
