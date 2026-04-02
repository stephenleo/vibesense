// test/unit/extension/telemetry/consent-prompt.test.ts
// Unit tests for showTelemetryConsentPrompt — Story 11.2 (AC1–AC3)
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
// vi.mock factories are hoisted to the top of the file, so variables declared
// outside cannot be referenced here. Instead we define the spies inside the
// factory and expose them via the mock module.
vi.mock('vscode', () => ({
  window: {
    showInformationMessage: vi.fn(),
  },
  workspace: {
    getConfiguration: vi.fn(),
  },
  ConfigurationTarget: {
    Global: 1,
  },
}))

// ── Imports after mocks ───────────────────────────────────────────────────────
import { showTelemetryConsentPrompt } from '../../../../src/extension/panels/consent-prompt'
import { TELEMETRY_CONSENT_SHOWN_KEY } from '../../../../src/shared/constants'
import * as vscode from 'vscode'
import type { ExtensionContext, Memento } from 'vscode'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGlobalState(initialConsent?: boolean): Memento & { _store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  if (initialConsent !== undefined) {
    store.set(TELEMETRY_CONSENT_SHOWN_KEY, initialConsent)
  }
  return {
    _store: store,
    get: <T>(key: string, defaultValue?: T): T =>
      (store.has(key) ? (store.get(key) as T) : (defaultValue as T)),
    update: vi.fn(async (key: string, value: unknown) => {
      store.set(key, value)
    }),
    keys: (): readonly string[] => [],
    setKeysForSync: vi.fn(),
  } as unknown as Memento & { _store: Map<string, unknown> }
}

function makeContext(globalState: Memento): ExtensionContext {
  return { globalState } as unknown as ExtensionContext
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('showTelemetryConsentPrompt', () => {
  let mockShowInformationMessage: ReturnType<typeof vi.fn>
  let mockGetConfiguration: ReturnType<typeof vi.fn>
  let mockUpdate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockShowInformationMessage = vi.mocked(vscode.window.showInformationMessage)
    mockGetConfiguration = vi.mocked(vscode.workspace.getConfiguration)
    mockUpdate = vi.fn().mockResolvedValue(undefined)
    mockGetConfiguration.mockReturnValue({ update: mockUpdate })
  })

  it('shows prompt if consent not yet shown', async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue('No thanks')

    await showTelemetryConsentPrompt(context)

    expect(mockShowInformationMessage).toHaveBeenCalledOnce()
    expect(mockShowInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('Help improve VibeSense?'),
      'Enable anonymous analytics',
      'No thanks',
    )
  })

  it('does NOT show prompt if consent already shown', async () => {
    const globalState = makeGlobalState(true)
    const context = makeContext(globalState)

    await showTelemetryConsentPrompt(context)

    expect(mockShowInformationMessage).not.toHaveBeenCalled()
  })

  it("enables telemetry when user selects 'Enable anonymous analytics'", async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue('Enable anonymous analytics')

    await showTelemetryConsentPrompt(context)

    expect(mockGetConfiguration).toHaveBeenCalledWith('vibesense')
    expect(mockUpdate).toHaveBeenCalledWith('telemetry.enabled', true, 1 /* ConfigurationTarget.Global */)
  })

  it("does NOT change telemetry setting when user selects 'No thanks'", async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue('No thanks')

    await showTelemetryConsentPrompt(context)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('does NOT change telemetry setting when notification is dismissed (undefined return)', async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue(undefined)

    await showTelemetryConsentPrompt(context)

    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('marks consent as shown regardless of user choice (Enable)', async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue('Enable anonymous analytics')

    await showTelemetryConsentPrompt(context)

    expect(globalState.update).toHaveBeenCalledWith(TELEMETRY_CONSENT_SHOWN_KEY, true)
  })

  it("marks consent as shown when user selects 'No thanks'", async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue('No thanks')

    await showTelemetryConsentPrompt(context)

    expect(globalState.update).toHaveBeenCalledWith(TELEMETRY_CONSENT_SHOWN_KEY, true)
  })

  it('marks consent as shown when dismissed (undefined return from showInformationMessage)', async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockResolvedValue(undefined)

    await showTelemetryConsentPrompt(context)

    expect(globalState.update).toHaveBeenCalledWith(TELEMETRY_CONSENT_SHOWN_KEY, true)
  })

  it('does not throw on error', async () => {
    const globalState = makeGlobalState()
    const context = makeContext(globalState)
    mockShowInformationMessage.mockRejectedValue(new Error('vscode API failure'))

    // Should not throw — NFR-R1
    await expect(showTelemetryConsentPrompt(context)).resolves.toBeUndefined()
  })
})
