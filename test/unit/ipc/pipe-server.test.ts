// test/unit/ipc/pipe-server.test.ts
// Unit tests for PipeServer — AC 1, 2, 3
// Tests socket lifecycle, payload routing, and error resilience (NFR-R1)

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'

// ── Mock vscode (required by logger) ─────────────────────────────────────────
vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      dispose: vi.fn(),
      show: vi.fn(),
    })),
  },
}))

// ── Mock fs ───────────────────────────────────────────────────────────────────
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  unlinkSync: vi.fn(),
}))

// ── Mock net ──────────────────────────────────────────────────────────────────
// Controllable fake server and socket for testing socket lifecycle
class MockSocket extends EventEmitter {
  destroy = vi.fn()
}

class MockServer extends EventEmitter {
  listen = vi.fn((_path: string, cb?: () => void) => {
    if (cb !== undefined) {
      cb()
    }
    return this
  })
  close = vi.fn((_cb?: (err?: Error) => void) => {
    return this
  })
  // Stored connection handler so tests can simulate incoming connections
  connectionHandler: ((socket: MockSocket) => void) | undefined
}

let mockServer: MockServer

vi.mock('net', () => ({
  createServer: vi.fn((connectionHandler?: (socket: MockSocket) => void) => {
    mockServer = new MockServer()
    mockServer.connectionHandler = connectionHandler
    return mockServer
  }),
}))

// ── Import after mocks ────────────────────────────────────────────────────────
import * as fs from 'fs'
import * as net from 'net'
import { PipeServer } from '../../../src/extension/ipc/pipe-server'
import { SessionManager } from '../../../src/extension/session/session-manager'
import { VIBESENSE_SOCKET_PATH } from '../../../src/shared/constants'

// ── Helpers ───────────────────────────────────────────────────────────────────

function simulateConnection(): MockSocket {
  const socket = new MockSocket()
  if (mockServer.connectionHandler !== undefined) {
    mockServer.connectionHandler(socket)
  }
  return socket
}

function sendData(socket: MockSocket, data: string): void {
  socket.emit('data', Buffer.from(data))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PipeServer', () => {
  let pipeServer: PipeServer
  let sessionManager: SessionManager

  beforeEach(() => {
    vi.clearAllMocks()
    sessionManager = new SessionManager()
    vi.spyOn(sessionManager, 'handleHookMessage')
    pipeServer = new PipeServer(sessionManager)
  })

  afterEach(() => {
    sessionManager.dispose()
  })

  // ── AC 1: Socket file creation ───────────────────────────────────────────────

  it('start() removes stale socket file when it already exists (AC 1)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)

    pipeServer.start()

    expect(fs.existsSync).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH)
    expect(fs.unlinkSync).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH)
  })

  it('start() does NOT call unlinkSync when socket file does not exist (AC 1)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    pipeServer.start()

    expect(fs.existsSync).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH)
    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('start() calls server.listen with VIBESENSE_SOCKET_PATH (AC 1)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    pipeServer.start()

    expect(net.createServer).toHaveBeenCalled()
    expect(mockServer.listen).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH, expect.any(Function))
  })

  it('start() called twice is a no-op on the second call (double-start guard)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)

    pipeServer.start()
    expect(net.createServer).toHaveBeenCalledTimes(1)

    pipeServer.start()
    // Second call should NOT create a new server
    expect(net.createServer).toHaveBeenCalledTimes(1)
  })

  // ── AC 3: Stop / deactivation ────────────────────────────────────────────────

  it('stop() closes server and removes socket file (AC 3)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()
    vi.clearAllMocks()

    pipeServer.stop()

    expect(mockServer.close).toHaveBeenCalled()
    expect(fs.unlinkSync).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH)
  })

  it('stop() does not throw even when unlink fails (socket already removed)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()
    vi.mocked(fs.unlinkSync).mockImplementation(() => { throw new Error('ENOENT') })

    expect(() => { pipeServer.stop() }).not.toThrow()
  })

  it('stop() is a no-op when server was never started', () => {
    // Do NOT call start() — stop() should not attempt to unlink or close anything
    pipeServer.stop()

    expect(fs.unlinkSync).not.toHaveBeenCalled()
  })

  it('dispose() delegates to stop()', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()
    vi.clearAllMocks()

    pipeServer.dispose()

    expect(mockServer.close).toHaveBeenCalled()
    expect(fs.unlinkSync).toHaveBeenCalledWith(VIBESENSE_SOCKET_PATH)
  })

  // ── AC 2: Valid payload routing ───────────────────────────────────────────────

  it('valid JSON hook payload → sessionManager.handleHookMessage() called (AC 2)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sendData(socket, JSON.stringify({ hook: 'stop', session_id: 'test-session' }) + '\n')

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'stop',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'test-session',
    })
  })

  it('valid post_tool_use hook → sessionManager.handleHookMessage() called (AC 2)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sendData(socket, JSON.stringify({ hook: 'post_tool_use', session_id: 'session-42' }) + '\n')

    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'post_tool_use',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'session-42',
    })
  })

  it('invalid JSON written to socket → handleHookMessage NOT called, no crash (AC 2)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    sendData(socket, 'not-valid-json\n')

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
  })

  it('valid JSON but invalid HookMessage (missing session_id) → handleHookMessage NOT called (AC 2)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    sendData(socket, JSON.stringify({ hook: 'stop' }) + '\n')

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
  })

  it('valid JSON but unknown hook type → handleHookMessage NOT called (AC 2)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    sendData(socket, JSON.stringify({ hook: 'unknown_hook', session_id: 'abc' }) + '\n')

    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
  })

  // ── Framing: partial data buffering ──────────────────────────────────────────

  it('partial data is buffered until newline received before parsing', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const payload = JSON.stringify({ hook: 'stop', session_id: 'partial-session' })

    // Send partial first chunk (no newline) — should NOT parse yet
    sendData(socket, payload.slice(0, 10))
    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()

    // Send remainder with newline — should parse now
    sendData(socket, payload.slice(10) + '\n')
    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({
      hook: 'stop',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      session_id: 'partial-session',
    })
  })

  it('multiple newline-delimited messages in one chunk are all processed', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const msg1 = JSON.stringify({ hook: 'stop', session_id: 's1' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const msg2 = JSON.stringify({ hook: 'post_tool_use', session_id: 's2' })

    sendData(socket, msg1 + '\n' + msg2 + '\n')

    expect(sessionManager.handleHookMessage).toHaveBeenCalledTimes(2)
    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({ hook: 'stop', session_id: 's1' })
    // eslint-disable-next-line @typescript-eslint/naming-convention
    expect(sessionManager.handleHookMessage).toHaveBeenCalledWith({ hook: 'post_tool_use', session_id: 's2' })
  })

  // ── NFR-R1: Exception in data handler does not crash server ──────────────────

  it('exception thrown inside data handler does not crash the server (NFR-R1)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()

    // Make handleHookMessage throw to simulate an unexpected error in routing
    vi.spyOn(sessionManager, 'handleHookMessage').mockImplementationOnce(() => {
      throw new Error('unexpected routing error')
    })

    // This should NOT propagate to the caller
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      sendData(socket, JSON.stringify({ hook: 'stop', session_id: 'crash-test' }) + '\n')
    }).not.toThrow()
  })

  // ── Buffer overflow protection ──────────────────────────────────────────────

  it('connection sending data exceeding max buffer size is destroyed (DoS protection)', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    pipeServer.start()

    const socket = simulateConnection()
    // Send a chunk larger than 1 MB without a newline — triggers buffer overflow guard
    const oversizedChunk = 'x'.repeat(1_048_577)
    sendData(socket, oversizedChunk)

    expect(socket.destroy).toHaveBeenCalled()
    expect(sessionManager.handleHookMessage).not.toHaveBeenCalled()
  })
})
