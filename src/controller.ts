import { HidManager, type ControllerEvent } from 'openmicro/controller'

/** Start OpenMicro controller input and return its shutdown hook. */
export function startController(
  onData: (event: ControllerEvent) => void,
  releaseInput: () => void = () => {},
): () => void {
  const controller = new HidManager()
  controller.on('data', (event) => {
    if (event.kind === 'disconnected') releaseInput()
    onData(event)
  })
  controller.start()
  return () => {
    releaseInput()
    controller.stop()
  }
}
