// test/unit/ipc/notify-dispatcher.test.ts
// Unit tests for NotifyDispatcher — routes validated vibeSense.notify() payloads to HAL
// Story 6.4: AC1 (full payload), AC5 (missing optional fields), per-channel independence

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

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

// ── Import after mocks ────────────────────────────────────────────────────────
import { NotifyDispatcher } from '../../../src/extension/ipc/notify-dispatcher'
import type { ControllerHAL } from '../../../src/extension/hid/hal'
import type { NotifyMessage } from '../../../src/shared/messages'

// ── HAL mock factory ──────────────────────────────────────────────────────────
function makeMockHal(): ControllerHAL {
  return {
    controllerType: 'dualsense',
    on: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setHaptic: vi.fn(),
    setLED: vi.fn(),
    playAudio: vi.fn(),
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotifyDispatcher', () => {
  let mockHal: ControllerHAL
  let dispatcher: NotifyDispatcher

  beforeEach(() => {
    vi.clearAllMocks()
    mockHal = makeMockHal()
    dispatcher = new NotifyDispatcher(() => mockHal)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // Test 1: Full payload dispatches all three channels
  it('full payload dispatches all three channels', () => {
    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'triple_pulse',
      led: { color: '#00ff00' },
      audio: 'success',
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.setHaptic).toHaveBeenCalledOnce()
    expect(mockHal.setHaptic).toHaveBeenCalledWith('triple_pulse')
    expect(mockHal.setLED).toHaveBeenCalledOnce()
    expect(mockHal.setLED).toHaveBeenCalledWith('#00ff00')
    expect(mockHal.playAudio).toHaveBeenCalledOnce()
    expect(mockHal.playAudio).toHaveBeenCalledWith('success')
  })

  // Test 2: Haptic-only payload skips LED and audio
  it('haptic-only payload skips LED and audio', () => {
    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'single_pulse',
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.setHaptic).toHaveBeenCalledOnce()
    expect(mockHal.setHaptic).toHaveBeenCalledWith('single_pulse')
    expect(mockHal.setLED).not.toHaveBeenCalled()
    expect(mockHal.playAudio).not.toHaveBeenCalled()
  })

  // Test 3: LED-only payload skips haptic and audio
  it('LED-only payload skips haptic and audio', () => {
    const msg: NotifyMessage = {
      event: 'x',
      led: { color: '#ff0000' },
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.setLED).toHaveBeenCalledOnce()
    expect(mockHal.setLED).toHaveBeenCalledWith('#ff0000')
    expect(mockHal.setHaptic).not.toHaveBeenCalled()
    expect(mockHal.playAudio).not.toHaveBeenCalled()
  })

  // Test 4: Audio-only payload skips haptic and LED
  it('audio-only payload skips haptic and LED', () => {
    const msg: NotifyMessage = {
      event: 'x',
      audio: 'warning',
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.playAudio).toHaveBeenCalledOnce()
    expect(mockHal.playAudio).toHaveBeenCalledWith('warning')
    expect(mockHal.setHaptic).not.toHaveBeenCalled()
    expect(mockHal.setLED).not.toHaveBeenCalled()
  })

  // Test 5: haptic:'none' does not call setHaptic
  it('haptic "none" does not call setHaptic', () => {
    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'none',
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.setHaptic).not.toHaveBeenCalled()
  })

  // Test 6: audio:'none' does not call playAudio
  it('audio "none" does not call playAudio', () => {
    const msg: NotifyMessage = {
      event: 'x',
      audio: 'none',
      priority: 'normal',
    }

    dispatcher.dispatch(msg)

    expect(mockHal.playAudio).not.toHaveBeenCalled()
  })

  // Test 7: No HAL (null) — payload discarded without error
  it('no HAL — payload discarded without error', () => {
    dispatcher = new NotifyDispatcher(() => null)

    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'single_pulse',
      led: { color: '#00ff00' },
      audio: 'success',
      priority: 'normal',
    }

    expect(() => dispatcher.dispatch(msg)).not.toThrow()
    expect(mockHal.setHaptic).not.toHaveBeenCalled()
    expect(mockHal.setLED).not.toHaveBeenCalled()
    expect(mockHal.playAudio).not.toHaveBeenCalled()
  })

  // Test 8: setHaptic throws — error caught, LED still fires
  it('setHaptic throws — error caught, LED still fires', () => {
    vi.mocked(mockHal.setHaptic).mockImplementationOnce(() => {
      throw new Error('haptic failure')
    })

    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'triple_pulse',
      led: { color: '#00ff00' },
      audio: 'success',
      priority: 'normal',
    }

    expect(() => dispatcher.dispatch(msg)).not.toThrow()
    expect(mockHal.setLED).toHaveBeenCalledWith('#00ff00')
    expect(mockHal.playAudio).toHaveBeenCalledWith('success')
  })

  // Test 9: setLED throws — audio still fires
  it('setLED throws — audio still fires', () => {
    vi.mocked(mockHal.setLED).mockImplementationOnce(() => {
      throw new Error('LED failure')
    })

    const msg: NotifyMessage = {
      event: 'x',
      haptic: 'single_pulse',
      led: { color: '#ff0000' },
      audio: 'error',
      priority: 'normal',
    }

    expect(() => dispatcher.dispatch(msg)).not.toThrow()
    expect(mockHal.setHaptic).toHaveBeenCalledWith('single_pulse')
    expect(mockHal.playAudio).toHaveBeenCalledWith('error')
  })

  // Test 10: Empty event string is valid
  it('empty event string is valid and dispatches without error', () => {
    const msg: NotifyMessage = {
      event: '',
      haptic: 'single_pulse',
      priority: 'normal',
    }

    expect(() => dispatcher.dispatch(msg)).not.toThrow()
    expect(mockHal.setHaptic).toHaveBeenCalledWith('single_pulse')
  })
})
