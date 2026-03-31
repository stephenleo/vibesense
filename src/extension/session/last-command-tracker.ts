// src/extension/session/last-command-tracker.ts
// Tracks the last command sent per session — Story 5.5 (AC 2)
// VSCode's extension API does NOT expose terminal input events,
// so this tracker only records commands explicitly sent by VibeSense.

export class LastCommandTracker {
  private commands: Map<string, string> = new Map()

  /**
   * Store the last command sent for a session.
   */
  setLastCommand(sessionId: string, command: string): void {
    this.commands.set(sessionId, command)
  }

  /**
   * Retrieve the last command stored for a session.
   * Returns undefined if no command has been recorded.
   */
  getLastCommand(sessionId: string): string | undefined {
    return this.commands.get(sessionId)
  }

  /**
   * Remove the stored command for a session (call on session end).
   */
  clearSession(sessionId: string): void {
    this.commands.delete(sessionId)
  }

  /**
   * Clear all tracked commands and release resources.
   */
  dispose(): void {
    this.commands.clear()
  }
}
