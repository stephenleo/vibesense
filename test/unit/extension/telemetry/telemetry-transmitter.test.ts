// test/unit/extension/telemetry/telemetry-transmitter.test.ts
// Unit tests for TelemetryTransmitter — Story 11.3 (AC1–AC4)
// All VSCode APIs, fetch, and logger mocked; no real network calls made.

import { vi, describe, it, expect, beforeEach } from 'vitest'

// ── Mock logger ───────────────────────────────────────────────────────────────
vi.mock('../../../../src/extension/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Mock vscode ───────────────────────────────────────────────────────────────
vi.mock('vscode', () => ({}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { TelemetryTransmitter } from '../../../../src/extension/telemetry/telemetry-transmitter'
import { logger } from '../../../../src/extension/logger'
import type { TelemetryPayload } from '../../../../src/extension/telemetry/telemetry-schema'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Minimal TelemetryCollector mock to isolate TelemetryTransmitter.
 * Avoids importing the real TelemetryCollector so tests are unit-isolated.
 *
 * @param queuedPayloads - Payloads to return from getQueue()
 * @param optedIn - Simulates isOptedIn() return value (default: true)
 */
function makeCollector(queuedPayloads: TelemetryPayload[] = [], optedIn = true) {
  return {
    isOptedIn: vi.fn(() => optedIn),
    getQueue: vi.fn(() => queuedPayloads),
    clearQueue: vi.fn(async () => { /* no-op */ }),
  }
}

/** Factory for a minimal valid TelemetryPayload */
function makePayload(overrides: Partial<TelemetryPayload> = {}): TelemetryPayload {
  return {
    version: '1.0',
    timestamp: 1700000000000,
    controllerOnly: false,
    controllerActionRatio: 0.75,
    featuresActive: ['radialWheel'],
    sessionDurationMs: 60000,
    agentInteractionCount: 10,
    controllerType: 'dualsense',
    platform: 'darwin',
    ...overrides,
  }
}

/** Create a mock Response with given status */
function makeFetchResponse(status: number, ok?: boolean) {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
  } as Response
}

// ── Tests: No-op when backend disabled (AC4) ──────────────────────────────────

describe('TelemetryTransmitter — no-op when backend disabled (AC4)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not call fetch when TELEMETRY_BACKEND_ENABLED is false (MVP default)', async () => {
    // No options passed — uses module default (false)
    const collector = makeCollector([makePayload()])
    const transmitter = new TelemetryTransmitter(collector as never)

    await transmitter.flushQueue()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('logs a debug message when backend is disabled', async () => {
    const collector = makeCollector([makePayload()])
    const transmitter = new TelemetryTransmitter(collector as never)

    await transmitter.flushQueue()

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('stub guard active'),
    )
  })

  it('does not clear the queue when backend is disabled', async () => {
    const collector = makeCollector([makePayload()])
    const transmitter = new TelemetryTransmitter(collector as never)

    await transmitter.flushQueue()

    expect(collector.clearQueue).not.toHaveBeenCalled()
  })
})

// ── Tests: No-op when queue is empty ─────────────────────────────────────────

describe('TelemetryTransmitter — no-op when queue is empty', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not call fetch when queue is empty', async () => {
    const collector = makeCollector([])
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not call clearQueue when queue is empty', async () => {
    const collector = makeCollector([])
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(collector.clearQueue).not.toHaveBeenCalled()
  })
})

// ── Tests: Successful transmission (AC1, AC3) ─────────────────────────────────

describe('TelemetryTransmitter — successful transmission (AC1, AC3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends POST request to TELEMETRY_INGEST_URL with correct JSON body', async () => {
    const payloads = [makePayload()]
    const collector = makeCollector(payloads)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(200)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(fetch).toHaveBeenCalledWith(
      'https://telemetry.vibesense.dev/ingest',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payloads),
      }),
    )
  })

  it('sends correct Content-Type header (application/json)', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(200)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('clears queue after successful 2xx transmission (AC3)', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(200)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(collector.clearQueue).toHaveBeenCalledTimes(1)
  })

  it('logs the number of payloads being flushed', async () => {
    const payloads = [makePayload(), makePayload({ timestamp: 1700000001000 })]
    const collector = makeCollector(payloads)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(200)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('2 payload'),
    )
  })
})

// ── Tests: Retry behaviour (AC2) ─────────────────────────────────────────────

describe('TelemetryTransmitter — exponential backoff retry (AC2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retries on non-2xx response', async () => {
    const collector = makeCollector([makePayload()])
    // Fail once with 500, then succeed
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(makeFetchResponse(500))
      .mockResolvedValue(makeFetchResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()
    await flushPromise

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries on network error (fetch throws)', async () => {
    const collector = makeCollector([makePayload()])
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue(makeFetchResponse(200))
    vi.stubGlobal('fetch', mockFetch)

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()
    await flushPromise

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('retries up to 5 times total before giving up', async () => {
    const collector = makeCollector([makePayload()])
    // Always fail — should attempt initial + 5 retries = 6 total calls
    const mockFetch = vi.fn().mockResolvedValue(makeFetchResponse(503))
    vi.stubGlobal('fetch', mockFetch)

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()
    await flushPromise

    // attempt 0 + 5 retries = 6 calls
    expect(mockFetch).toHaveBeenCalledTimes(6)
  })

  it('does NOT clear queue when all retries are exhausted', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(500)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()
    await flushPromise

    expect(collector.clearQueue).not.toHaveBeenCalled()
  })

  it('logs error when all retries exhausted', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(500)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()
    await flushPromise

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('all retries exhausted'),
    )
  })
})

// ── Tests: Error resilience (NFR-R1) ─────────────────────────────────────────

describe('TelemetryTransmitter — error resilience (NFR-R1)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not throw when all retries are exhausted (NFR-R1)', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeFetchResponse(500)))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()

    await expect(flushPromise).resolves.toBeUndefined()
  })

  it('does not throw when collector.getQueue() throws', async () => {
    const collector = {
      getQueue: vi.fn(() => { throw new Error('storage error') }),
      clearQueue: vi.fn(),
    }
    vi.stubGlobal('fetch', vi.fn())

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    await expect(transmitter.flushQueue()).resolves.toBeUndefined()
  })

  it('does not throw when fetch throws on every attempt', async () => {
    const collector = makeCollector([makePayload()])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network failure')))

    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })
    const flushPromise = transmitter.flushQueue()
    await vi.runAllTimersAsync()

    await expect(flushPromise).resolves.toBeUndefined()
  })
})

// ── Tests: Opt-out clears transmission (FR44/FR45) ───────────────────────────

describe('TelemetryTransmitter — opt-out clears transmission (FR44/FR45)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('does not call fetch when user is not opted in at flush time', async () => {
    // User had queued payloads while opted in, but opted out before flush
    const collector = makeCollector([makePayload()], false)
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('clears the queue when user is not opted in at flush time', async () => {
    // Queue must be cleared so previously-collected data is not transmitted later
    const collector = makeCollector([makePayload(), makePayload({ timestamp: 1700000001000 })], false)
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(collector.clearQueue).toHaveBeenCalledTimes(1)
  })

  it('logs a debug message when flush is skipped due to opt-out', async () => {
    const collector = makeCollector([makePayload()], false)
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await transmitter.flushQueue()

    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('not opted in'),
    )
  })

  it('does not throw when opt-out clears the queue (NFR-R1)', async () => {
    const collector = makeCollector([makePayload()], false)
    const transmitter = new TelemetryTransmitter(collector as never, { backendEnabled: true })

    await expect(transmitter.flushQueue()).resolves.toBeUndefined()
  })
})
