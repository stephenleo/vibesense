import { HidManager, type ControllerEvent } from 'openmicro/controller'

/** Start OpenMicro controller input and return its shutdown hook. */
export function startController(onData: (event: ControllerEvent) => void): () => void {
  const controller = new HidManager()
  controller.on('data', onData)
  controller.start()
  return () => controller.stop()
}
