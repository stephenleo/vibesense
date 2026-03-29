// src/extension/logger.ts
// Logger singleton — all extension host logging through this module
// Uses vscode.window.createOutputChannel('VibeSense') — created once at module init

import * as vscode from 'vscode'

// Module-level singleton: created at import time, reused everywhere
const outputChannel = vscode.window.createOutputChannel('VibeSense')
let disposed = false

function formatMessage(level: string, message: string, args: unknown[]): string {
  const timestamp = new Date().toISOString()
  const suffix = args.length > 0 ? ' ' + args.map(String).join(' ') : ''
  return `[${level}] ${timestamp} ${message}${suffix}`
}

/**
 * Write a formatted log line to the VibeSense output channel.
 * NFR-R1: logger must never throw — last-resort fallback only.
 */
function log(level: string, message: string, args: unknown[]): void {
  if (disposed) {
    return
  }
  try {
    outputChannel.appendLine(formatMessage(level, message, args))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[VibeSense logger fallback]', e)
  }
}

export const logger = {
  info(message: string, ...args: unknown[]): void {
    log('INFO', message, args)
  },

  warn(message: string, ...args: unknown[]): void {
    log('WARN', message, args)
  },

  error(message: string, ...args: unknown[]): void {
    log('ERROR', message, args)
  },
}

/**
 * Dispose the output channel. Call in extension deactivate().
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function disposeLogger(): void {
  if (disposed) {
    return
  }
  disposed = true
  outputChannel.dispose()
}
