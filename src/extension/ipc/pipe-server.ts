// src/extension/ipc/pipe-server.ts
// Named pipe IPC server — accepts Zod-validated JSON payloads and routes to SessionManager
// Story 5.3: IPC channel for Claude Code hooks and vibeSense.notify() API (Epic 6)

import * as net from 'net'
import * as fs from 'fs'
import { VIBESENSE_SOCKET_PATH } from '../../shared/constants'
import type { SessionManager } from '../session/session-manager'
import { logger } from '../logger'
import { handleRawPayload } from './message-handler'

/** Maximum per-connection buffer size (1 MB). Connections exceeding this are dropped. */
const MAX_BUFFER_BYTES = 1_048_576

export class PipeServer {
  private server: net.Server | null = null

  constructor(private readonly sessionManager: SessionManager) {}

  /**
   * Start the IPC server — creates a Unix socket at VIBESENSE_SOCKET_PATH and begins listening.
   * Removes any stale socket file before binding to prevent EADDRINUSE on unclean host restart.
   */
  start(): void {
    if (this.server !== null) {
      logger.warn('IPC: start() called while server is already running — ignoring')
      return
    }

    const server = net.createServer((socket) => {
      let buffer = ''

      socket.on('data', (chunk: Buffer) => {
        try {
          buffer += chunk.toString()

          // Guard against unbounded buffer growth (DoS protection)
          if (buffer.length > MAX_BUFFER_BYTES) {
            logger.warn('IPC: buffer exceeded max size — dropping connection')
            buffer = ''
            socket.destroy()
            return
          }

          const lines = buffer.split('\n')
          buffer = lines.pop() ?? '' // keep incomplete last segment

          for (const line of lines) {
            if (line.trim() === '') {
              continue
            }
            try {
              const parsed: unknown = JSON.parse(line)
              handleRawPayload(parsed, this.sessionManager)
            } catch {
              logger.warn('IPC: malformed JSON on socket', line)
            }
          }
        } catch (err) {
          logger.warn('IPC: data handler error', err)
        }
      })

      socket.on('error', (err) => {
        logger.warn('IPC: socket error', err)
      })
    })

    server.on('error', (err) => {
      logger.error('IPC: server error', err)
    })

    // Cleanup stale socket file before binding — prevents EADDRINUSE on unclean extension host restart
    try {
      if (fs.existsSync(VIBESENSE_SOCKET_PATH)) {
        fs.unlinkSync(VIBESENSE_SOCKET_PATH)
      }
    } catch {
      // ignore — if unlink fails, listen() will surface EADDRINUSE
    }

    server.listen(VIBESENSE_SOCKET_PATH, () => {
      logger.info(`IPC: server listening at ${VIBESENSE_SOCKET_PATH}`)
    })

    this.server = server
  }

  /**
   * Stop the IPC server — closes all connections and removes the socket file.
   */
  stop(): void {
    if (this.server === null) {
      return
    }
    this.server.close()
    this.server = null
    try {
      fs.unlinkSync(VIBESENSE_SOCKET_PATH)
    } catch {
      // already gone — ignore
    }
  }

  /**
   * VSCode Disposable-compatible interface — delegates to stop().
   */
  dispose(): void {
    this.stop()
  }
}

