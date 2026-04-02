// test/unit/extension/telemetry/telemetry.test.ts
// Unit tests for TelemetryCollector — Story 11.1 (AC1–AC3, FR44, FR46, NFR-S4)
// All VSCode APIs and logger mocked; no real VSCode process spawned.

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
import { TelemetryCollector } from '../../../../src/extension/telemetry/telemetry'
import { TELEMETRY_QUEUE_KEY } from '../../../../src/shared/constants'
import type * as vscode from 'vscode'
import type { SessionRecord } from '../../../../src/shared/types'
import { logger } from '../../../../src/extension/logger'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(): vscode.Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as vscode.Memento & { _store: Map<string, unknown> }
}

function makeConfig(optedIn: boolean): vscode.WorkspaceConfiguration {
  return {
    get: vi.fn((key: string) => {
      if (key === 'telemetry.enabled') return optedIn
      return undefined
    }),
    has: vi.fn(() => false),
    inspect: vi.fn(() => undefined),
    update: vi.fn(),
  } as unknown as vscode.WorkspaceConfiguration
}

function makeSessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    sessionId: 'session-12345',
    startedAt: 1000000,
    endedAt: 1003600000,
    controllerActions: 42,
    keyboardActions: 5,
    ratio: 0.89,
    controllerOnly: false,
    ...overrides,
  }
}

// ── Tests: isOptedIn() ────────────────────────────────────────────────────────

describe('TelemetryCollector — isOptedIn()', () => {
  it('returns false by default when setting is not set', () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)
    expect(collector.isOptedIn()).toBe(false)
  })

  it('returns false when telemetry.enabled is explicitly false', () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)
    expect(collector.isOptedIn()).toBe(false)
  })

  it('returns true when telemetry.enabled is true', () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)
    expect(collector.isOptedIn()).toBe(true)
  })

  it('returns false when config.get() throws (defensive fallback)', () => {
    const globalState = makeGlobalState()
    const config = {
      get: vi.fn(() => { throw new Error('config error') }),
      has: vi.fn(),
      inspect: vi.fn(),
      update: vi.fn(),
    } as unknown as vscode.WorkspaceConfiguration
    const collector = new TelemetryCollector(globalState, () => config)
    expect(collector.isOptedIn()).toBe(false)
    expect(logger.error).toHaveBeenCalledWith(
      'TelemetryCollector: failed to read opt-in setting',
      expect.any(Error),
    )
  })
})

// ── Tests: collectSession() no-op when opted out ──────────────────────────────

describe('TelemetryCollector — collectSession() no-op when opted out (AC1, FR44)', () => {
  it('does not enqueue any payload when opted out', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: ['radialWheel'],
      controllerType: 'dualsense',
    })

    expect(globalState.update).not.toHaveBeenCalled()
  })

  it('does not log a payload when opted out', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: null,
    })

    // Should not have logged any payload info (only possible queue-related logs are absent)
    const loggerInfo = vi.mocked(logger.info)
    const payloadLogCalls = loggerInfo.mock.calls.filter(
      (args) => String(args[0]).includes('TelemetryCollector: payload'),
    )
    expect(payloadLogCalls).toHaveLength(0)
  })

  it('queue remains empty when opted out', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: 'xbox',
    })

    const queue = collector.getQueue()
    expect(queue).toHaveLength(0)
  })
})

// ── Tests: collectSession() payload correctness when opted in ─────────────────

describe('TelemetryCollector — collectSession() payload correctness (AC1, AC2)', () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear()
  })

  it('enqueues a payload when opted in', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: ['radialWheel', 'miniGame'],
      controllerType: 'dualsense',
    })

    const queue = collector.getQueue()
    expect(queue).toHaveLength(1)
  })

  it('payload has correct version field', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)
    const record = makeSessionRecord()

    await collector.collectSession(record, {
      featuresActive: [],
      controllerType: null,
    })

    const queue = collector.getQueue()
    expect(queue[0].version).toBe('1.0')
  })

  it('payload timestamp equals record.endedAt', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)
    const record = makeSessionRecord({ endedAt: 9999999 })

    await collector.collectSession(record, { featuresActive: [], controllerType: null })

    const queue = collector.getQueue()
    expect(queue[0].timestamp).toBe(9999999)
  })

  it('payload controllerOnly matches record.controllerOnly', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ controllerOnly: true }), {
      featuresActive: [],
      controllerType: null,
    })

    expect(collector.getQueue()[0].controllerOnly).toBe(true)
  })

  it('payload controllerActionRatio matches record.ratio', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ ratio: 0.75 }), {
      featuresActive: [],
      controllerType: null,
    })

    expect(collector.getQueue()[0].controllerActionRatio).toBeCloseTo(0.75)
  })

  it('payload featuresActive matches context.featuresActive', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: ['radialWheel', 'sessionSwitch', 'hud'],
      controllerType: null,
    })

    expect(collector.getQueue()[0].featuresActive).toEqual(['radialWheel', 'sessionSwitch', 'hud'])
  })

  it('payload sessionDurationMs is endedAt - startedAt', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(
      makeSessionRecord({ startedAt: 1000000, endedAt: 1005000 }),
      { featuresActive: [], controllerType: null },
    )

    expect(collector.getQueue()[0].sessionDurationMs).toBe(5000)
  })

  it('payload agentInteractionCount equals record.controllerActions', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ controllerActions: 77 }), {
      featuresActive: [],
      controllerType: null,
    })

    expect(collector.getQueue()[0].agentInteractionCount).toBe(77)
  })

  it('payload controllerType matches context.controllerType', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: 'xbox',
    })

    expect(collector.getQueue()[0].controllerType).toBe('xbox')
  })

  it('payload controllerType is null when no controller was connected', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: null,
    })

    expect(collector.getQueue()[0].controllerType).toBeNull()
  })

  it('payload platform is a non-empty string', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: null,
    })

    expect(typeof collector.getQueue()[0].platform).toBe('string')
    expect(collector.getQueue()[0].platform.length).toBeGreaterThan(0)
  })
})

// ── Tests: PII exclusion (FR46) ───────────────────────────────────────────────

describe('TelemetryCollector — PII exclusion (FR46, AC1)', () => {
  it('payload does not contain sessionId (not needed, potentially correlatable)', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ sessionId: 'session-user-12345' }), {
      featuresActive: [],
      controllerType: null,
    })

    const payload = collector.getQueue()[0]
    expect(Object.keys(payload)).not.toContain('sessionId')
  })

  it('payload does not contain keyboardActions count', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ keyboardActions: 500 }), {
      featuresActive: [],
      controllerType: null,
    })

    const payload = collector.getQueue()[0]
    expect(Object.keys(payload)).not.toContain('keyboardActions')
  })

  it('payload does not contain startedAt (reduces correlation risk)', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(
      makeSessionRecord({ startedAt: 9876543210, endedAt: 9876544210 }),
      { featuresActive: [], controllerType: null },
    )

    const queue = collector.getQueue()
    expect(queue).toHaveLength(1)
    const payload = queue[0]
    expect(Object.keys(payload)).not.toContain('startedAt')
  })

  it('featuresActive contains only internal feature names — no user-entered strings', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    // Internal feature names (these come from recordFeatureUsed() — never from user input)
    const internalFeatures = ['radialWheel', 'miniGame', 'sessionSwitch', 'hud', 'quicksave']

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: internalFeatures,
      controllerType: 'dualsense',
    })

    // Verify all features are from the known safe list (internal identifiers only)
    const payload = collector.getQueue()[0]
    for (const feature of payload.featuresActive) {
      expect(internalFeatures).toContain(feature)
    }
  })
})

// ── Tests: Inspectability (NFR-S4, AC2) ───────────────────────────────────────

describe('TelemetryCollector — payload inspectability (NFR-S4, AC2)', () => {
  beforeEach(() => {
    vi.mocked(logger.info).mockClear()
  })

  it('logs the exact JSON payload when opted in', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)
    const record = makeSessionRecord({ controllerActions: 10, ratio: 0.5 })

    await collector.collectSession(record, {
      featuresActive: ['radialWheel'],
      controllerType: 'dualsense',
    })

    const logCalls = vi.mocked(logger.info).mock.calls
    const payloadLog = logCalls.find((args) => String(args[0]).startsWith('TelemetryCollector: payload'))
    expect(payloadLog).toBeDefined()

    // Verify it's valid JSON
    const jsonStr = String(payloadLog![0]).replace('TelemetryCollector: payload — ', '')
    expect(() => JSON.parse(jsonStr)).not.toThrow()

    const parsed = JSON.parse(jsonStr)
    expect(parsed.version).toBe('1.0')
    expect(parsed.controllerActionRatio).toBeCloseTo(0.5)
    expect(parsed.agentInteractionCount).toBe(10)
  })

  it('does not log any payload when opted out', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(false)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: null,
    })

    const logCalls = vi.mocked(logger.info).mock.calls
    const payloadLog = logCalls.find((args) => String(args[0]).startsWith('TelemetryCollector: payload'))
    expect(payloadLog).toBeUndefined()
  })
})

// ── Tests: Queue management ───────────────────────────────────────────────────

describe('TelemetryCollector — queue management', () => {
  it('accumulates multiple payloads in the queue', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord({ endedAt: 1001000, sessionId: 's1' }), {
      featuresActive: [],
      controllerType: null,
    })
    await collector.collectSession(makeSessionRecord({ endedAt: 1002000, sessionId: 's2' }), {
      featuresActive: [],
      controllerType: 'xbox',
    })

    expect(collector.getQueue()).toHaveLength(2)
  })

  it('clearQueue() empties the queue', async () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), {
      featuresActive: [],
      controllerType: null,
    })

    expect(collector.getQueue()).toHaveLength(1)

    await collector.clearQueue()
    expect(collector.getQueue()).toHaveLength(0)
  })

  it('getQueue() returns empty array when no payloads queued', () => {
    const globalState = makeGlobalState()
    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    expect(collector.getQueue()).toEqual([])
  })

  it('getQueue() handles corrupted globalState data gracefully', () => {
    const globalState = makeGlobalState()
    globalState._store.set(TELEMETRY_QUEUE_KEY, { invalid: 'data' })

    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    expect(collector.getQueue()).toEqual([])
  })
})

// ── Tests: Error resilience (NFR-R1) ─────────────────────────────────────────

describe('TelemetryCollector — error resilience (NFR-R1)', () => {
  it('does not throw when globalState.update() rejects', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))

    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await expect(
      collector.collectSession(makeSessionRecord(), { featuresActive: [], controllerType: null }),
    ).resolves.toBeUndefined()
  })

  it('logs error when collectSession fails internally', async () => {
    vi.mocked(logger.error).mockClear()
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))

    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await collector.collectSession(makeSessionRecord(), { featuresActive: [], controllerType: null })

    expect(logger.error).toHaveBeenCalledWith(
      'TelemetryCollector: collectSession failed',
      expect.any(Error),
    )
  })

  it('does not throw when clearQueue() fails', async () => {
    const globalState = makeGlobalState()
    ;(globalState.update as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'))

    const config = makeConfig(true)
    const collector = new TelemetryCollector(globalState, () => config)

    await expect(collector.clearQueue()).resolves.toBeUndefined()
  })
})
