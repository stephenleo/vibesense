import type { ControllerEvent } from 'openmicro/controller'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const controller = vi.hoisted(() => ({
  listener: null as ((event: ControllerEvent) => void) | null,
  start: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('openmicro/controller', () => ({
  HidManager: class {
    on(_event: 'data', listener: (event: ControllerEvent) => void): void {
      controller.listener = listener
    }

    start(): void {
      controller.start()
    }

    stop(): void {
      controller.stop()
    }
  },
}))

import { startController } from '../src/controller.js'

describe('OpenMicro controller integration', () => {
  beforeEach(() => {
    controller.listener = null
    controller.start.mockClear()
    controller.stop.mockClear()
  })

  it('starts input, forwards events, and stops on cleanup', () => {
    const events: ControllerEvent[] = []
    const releaseInput = vi.fn()
    const stop = startController((event) => events.push(event), releaseInput)
    const event: ControllerEvent = { kind: 'button', button: 'south', pressed: true }
    const disconnected: ControllerEvent = { kind: 'disconnected' }

    controller.listener!(event)
    controller.listener!(disconnected)
    stop()

    expect(controller.start).toHaveBeenCalledOnce()
    expect(events).toEqual([event, disconnected])
    expect(releaseInput).toHaveBeenCalledTimes(2)
    expect(controller.stop).toHaveBeenCalledOnce()
  })
})
