// Spawns `claude` under a pty and passes the TUI through untouched: user
// keyboard → pty, pty output → stdout, window resizes forwarded. Controller
// keystrokes are just extra writes into the same pty.

import * as pty from 'node-pty'
import { logger } from './logger.js'

export class ClaudePty {
  private proc: pty.IPty

  constructor(args: string[], onExit: (code: number) => void) {
    this.proc = pty.spawn('claude', args, {
      name: process.env.TERM ?? 'xterm-256color',
      cols: process.stdout.columns,
      rows: process.stdout.rows,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    })

    this.proc.onData((data) => process.stdout.write(data))
    this.proc.onExit(({ exitCode }) => onExit(exitCode))

    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.on('data', (data: Buffer) => this.proc.write(data.toString('utf8')))

    process.stdout.on('resize', () => {
      try {
        this.proc.resize(process.stdout.columns, process.stdout.rows)
      } catch (err) {
        logger.warn('pty resize failed', err)
      }
    })
  }

  write(data: string): void {
    this.proc.write(data)
  }

  dispose(): void {
    if (process.stdin.isTTY) process.stdin.setRawMode(false)
    process.stdin.pause()
    try {
      this.proc.kill()
    } catch {
      // already dead
    }
  }
}
