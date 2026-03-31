// src/extension/input/profile-manager.ts
// Reads and writes global VibeSense settings via VSCode configuration API.
// Settings declared in package.json contributes.configuration are automatically
// synced across devices by VSCode Settings Sync — no VibeSense sync logic needed.

import * as vscode from 'vscode'
import { logger } from '../logger'

/** Namespace for all VibeSense VSCode configuration settings */
const CONFIG_SECTION = 'vibesense'

/**
 * Provides a clean API for reading and writing global VibeSense settings
 * via `vscode.workspace.getConfiguration('vibesense')`.
 *
 * Settings written here are automatically synced by VSCode Settings Sync
 * across all devices where the user is signed in.
 *
 * Per-project binding profiles live in `.vscode/vibesense.json` — not here.
 */
export class ProfileManager {
  /**
   * Returns the name of the currently active binding profile.
   * Falls back to `"claude-code-default"` if the setting is not configured.
   */
  getActiveProfileName(): string {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<string>('activeProfile') ?? 'claude-code-default'
  }

  /**
   * Persists the active profile name to global VSCode configuration.
   * Uses ConfigurationTarget.Global so the value is user-scoped and eligible
   * for VSCode Settings Sync.
   *
   * Never throws — errors are caught and logged (NFR-R1).
   */
  async setActiveProfileName(name: string): Promise<void> {
    try {
      const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
      await config.update('activeProfile', name, vscode.ConfigurationTarget.Global)
    } catch (err) {
      logger.error('ProfileManager: failed to update activeProfile setting', err)
    }
  }

  /**
   * Returns whether "Full Mode" is enabled.
   * When `false` (the default), only essential bindings are exposed (Guided Mode).
   * When `true`, all bindings are active.
   * Falls back to `false` if the setting is not configured.
   */
  getFullMode(): boolean {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<boolean>('fullMode') ?? false
  }

  /**
   * Returns whether the battery warning status bar indicator is enabled.
   * Falls back to `true` if the setting is not configured.
   */
  getBatteryWarningEnabled(): boolean {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION)
    return config.get<boolean>('enableBatteryWarning') ?? true
  }
}
