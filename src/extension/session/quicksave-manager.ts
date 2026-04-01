// src/extension/session/quicksave-manager.ts
// Persists session quicksave snapshot in ExtensionContext.globalState (Story 9.6)

import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import type { QuickSaveState } from '../../shared/types'
import { QUICKSAVE_KEY } from '../../shared/constants'
import type { SessionManager } from './session-manager'
import { logger } from '../logger'

export class QuickSaveManager {
  constructor(
    private readonly globalState: vscode.Memento,
    private readonly sessionManager: SessionManager,
    private readonly workspaceRoot: string,
  ) {}

  /**
   * Snapshot current session state and persist to globalState.
   * Reads terminal names, session IDs, and R2 segments directly from .vscode/vibesense.json.
   * Never throws (NFR-R1).
   */
  async save(): Promise<void> {
    try {
      const terminalNames = vscode.window.terminals.map((t) => t.name)
      const sessionIds = Array.from(this.sessionManager.getSessions().keys())

      // Read R2 segment prompts directly from profile file (avoid dispatchTracker dependency)
      let r2Segments: string[] = []
      const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
      try {
        const raw = fs.readFileSync(profilePath, 'utf-8')
        const parsed = JSON.parse(raw) as Record<string, unknown>
        const rw = parsed['radialWheel'] as Record<string, unknown> | undefined
        if (Array.isArray(rw?.['segments'])) {
          r2Segments = rw['segments'] as string[]
        }
      } catch {
        // ENOENT or parse error — default to empty segments
      }

      const state: QuickSaveState = { terminalNames, sessionIds, r2Segments }
      await this.globalState.update(QUICKSAVE_KEY, state)
      logger.info(
        `QuickSaveManager: saved ${terminalNames.length} terminals, ${sessionIds.length} sessions`,
      )
    } catch (err) {
      logger.error('QuickSaveManager: save() failed', err)
    }
  }

  /**
   * Load persisted quicksave state.
   * Returns null if no snapshot exists or on error (NFR-R1).
   */
  load(): QuickSaveState | null {
    try {
      return this.globalState.get<QuickSaveState>(QUICKSAVE_KEY) ?? null
    } catch (err) {
      logger.error('QuickSaveManager: load() failed', err)
      return null
    }
  }

  /**
   * Restore terminals and radial wheel config from saved state.
   * Never throws (NFR-R1). Clears the snapshot after restore.
   */
  async restore(state: QuickSaveState): Promise<void> {
    try {
      // Re-create terminals by name
      for (const name of state.terminalNames) {
        vscode.window.createTerminal({ name })
      }
      // Write R2 segments back to .vscode/vibesense.json
      if (state.r2Segments.length > 0) {
        await this.updateVibeProfileSegments(state.r2Segments)
      }
      logger.info(`QuickSaveManager: restored ${state.terminalNames.length} terminals`)
    } catch (err) {
      logger.error('QuickSaveManager: restore() failed', err)
    } finally {
      await this.clear()
    }
  }

  /**
   * Clear the persisted quicksave snapshot.
   * Never throws (NFR-R1).
   */
  async clear(): Promise<void> {
    try {
      await this.globalState.update(QUICKSAVE_KEY, undefined)
      logger.info('QuickSaveManager: cleared quicksave state')
    } catch (err) {
      logger.error('QuickSaveManager: clear() failed', err)
    }
  }

  /** Write R2 segments array to .vscode/vibesense.json radialWheel.segments field. */
  private async updateVibeProfileSegments(segments: string[]): Promise<void> {
    const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
    let json: Record<string, unknown> = {}
    if (fs.existsSync(profilePath)) {
      json = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as Record<string, unknown>
    }
    const radialWheel = (json['radialWheel'] as Record<string, unknown> | undefined) ?? {}
    json['radialWheel'] = { ...radialWheel, segments }
    fs.writeFileSync(profilePath, JSON.stringify(json, null, 2), 'utf-8')
  }
}
