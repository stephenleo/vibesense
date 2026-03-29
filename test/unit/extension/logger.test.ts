// test/unit/extension/logger.test.ts
// Unit tests for the logger singleton
// The vscode module must be mocked — it is NOT available in unit tests

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the vscode module before any imports that depend on it
const mockAppendLine = vi.fn()
const mockDispose = vi.fn()
const mockShow = vi.fn()

vi.mock('vscode', () => ({
  window: {
    createOutputChannel: vi.fn(() => ({
      appendLine: mockAppendLine,
      dispose: mockDispose,
      show: mockShow,
    })),
  },
}))

// Import AFTER the mock is set up so module init uses the mock
const { logger, disposeLogger } = await import('../../../src/extension/logger')

describe('logger singleton', () => {
  beforeEach(() => {
    mockAppendLine.mockClear()
    mockDispose.mockClear()
    mockShow.mockClear()
  })

  it('logger.info() calls appendLine with [INFO] and message', () => {
    logger.info('hello')
    expect(mockAppendLine).toHaveBeenCalledOnce()
    const line: string = mockAppendLine.mock.calls[0][0]
    expect(line).toContain('[INFO]')
    expect(line).toContain('hello')
  })

  it('logger.warn() calls appendLine with [WARN]', () => {
    logger.warn('caution')
    expect(mockAppendLine).toHaveBeenCalledOnce()
    const line: string = mockAppendLine.mock.calls[0][0]
    expect(line).toContain('[WARN]')
    expect(line).toContain('caution')
  })

  it('logger.error() calls appendLine with [ERROR]', () => {
    logger.error('boom')
    expect(mockAppendLine).toHaveBeenCalledOnce()
    const line: string = mockAppendLine.mock.calls[0][0]
    expect(line).toContain('[ERROR]')
    expect(line).toContain('boom')
  })

  it('logger.info() includes a timestamp in the output', () => {
    logger.info('with timestamp')
    const line: string = mockAppendLine.mock.calls[0][0]
    // ISO timestamp pattern: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(line).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('logger.info() includes extra args in output', () => {
    logger.info('msg', 'extra1', 42)
    const line: string = mockAppendLine.mock.calls[0][0]
    expect(line).toContain('extra1')
    expect(line).toContain('42')
  })

  it('disposeLogger() calls outputChannel.dispose()', () => {
    disposeLogger()
    expect(mockDispose).toHaveBeenCalledOnce()
  })
})
