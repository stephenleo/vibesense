// src/extension/input/settings-bridge.ts
// Bridges VSCode settings API ↔ binding profile (.vscode/vibesense.json)

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as vscode from 'vscode'
import { logger } from '../logger'
import { CLAUDE_CODE_DEFAULT_BINDINGS, type BindingMap } from './default-bindings'
import { VibeProfileSchema } from './profile-schema'
import type { ButtonId } from '../../shared/types'

/** Set of valid ButtonId values for binding key validation */
const VALID_BUTTON_IDS = new Set<string>([
  'cross', 'circle', 'square', 'triangle',
  'l1', 'r1', 'l2', 'r2', 'l3', 'r3',
  'up', 'down', 'left', 'right',
  'options', 'touchpad',
  'a', 'b', 'x', 'y',
  'lb', 'rb', 'lt', 'rt', 'ls', 'rs',
  'menu', 'view',
])

/**
 * Bridges the VSCode settings API and the .vscode/vibesense.json profile file.
 *
 * Responsibilities:
 * - Read bindings from VSCode configuration API
 * - Watch for configuration changes and notify callers
 * - Write individual binding changes atomically to .vscode/vibesense.json
 * - Reset sections to factory defaults
 */
export class SettingsBridge {
  constructor(private readonly workspaceRoot: string) {}

  /**
   * Reads all vibesense.binding.* settings from the VSCode configuration API
   * and returns a BindingMap. Falls back to CLAUDE_CODE_DEFAULT_BINDINGS on any error.
   */
  readBindingsFromSettings(): BindingMap {
    try {
      const config = vscode.workspace.getConfiguration('vibesense')
      const result: BindingMap = { ...CLAUDE_CODE_DEFAULT_BINDINGS }

      for (const buttonId of VALID_BUTTON_IDS) {
        const value = config.get<string>(`binding.${buttonId}`)
        if (value !== undefined && value !== '') {
          result[buttonId as ButtonId] = value
        }
      }

      return result
    } catch (err) {
      logger.warn('SettingsBridge: failed to read settings — using defaults', err)
      return CLAUDE_CODE_DEFAULT_BINDINGS
    }
  }

  /**
   * Watches for VSCode configuration changes in the vibesense section.
   * Calls onChange with a fresh BindingMap whenever settings change.
   * Returns a Disposable that should be pushed to context.subscriptions.
   */
  watchSettings(onChange: (bindings: BindingMap) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('vibesense')) {
        const newBindings = this.readBindingsFromSettings()
        onChange(newBindings)
        logger.info('SettingsBridge: configuration changed — bindings reloaded')
      }
    })
  }

  /**
   * Atomically writes a single binding change to .vscode/vibesense.json.
   * Reads the existing profile, merges the change, writes .tmp then renames.
   * Never throws (NFR-R1).
   */
  writeBindingToProfile(button: ButtonId, command: string): void {
    const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
    const tmpPath = profilePath + '.tmp'
    try {
      const existing = this.readExistingProfile(profilePath)
      const updated = {
        ...existing,
        bindings: { ...existing.bindings, [button]: command },
      }
      const vscodePath = path.join(this.workspaceRoot, '.vscode')
      if (!fs.existsSync(vscodePath)) {
        fs.mkdirSync(vscodePath, { recursive: true })
      }
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
      fs.renameSync(tmpPath, profilePath)
      logger.info(`SettingsBridge: binding ${button} → ${command} written to vibesense.json`)
    } catch (err) {
      logger.warn('SettingsBridge: failed to write vibesense.json', err)
      // NFR-R1: never throw
    }
  }

  /**
   * Resets the specified buttons to CLAUDE_CODE_DEFAULT_BINDINGS values and
   * writes the result to .vscode/vibesense.json. Also clears corresponding
   * VSCode settings to undefined so the Settings UI reverts to defaults.
   * Never throws (NFR-R1).
   */
  resetSectionToDefaults(buttons: ButtonId[]): void {
    const profilePath = path.join(this.workspaceRoot, '.vscode', 'vibesense.json')
    const tmpPath = profilePath + '.tmp'
    try {
      const existing = this.readExistingProfile(profilePath)
      const mergedBindings = { ...existing.bindings }

      for (const button of buttons) {
        const defaultCommand = CLAUDE_CODE_DEFAULT_BINDINGS[button]
        if (defaultCommand !== undefined) {
          mergedBindings[button] = defaultCommand
        } else {
          delete mergedBindings[button]
        }
      }

      const updated = { ...existing, bindings: mergedBindings }
      const vscodePath = path.join(this.workspaceRoot, '.vscode')
      if (!fs.existsSync(vscodePath)) {
        fs.mkdirSync(vscodePath, { recursive: true })
      }
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
      fs.renameSync(tmpPath, profilePath)
      logger.info(`SettingsBridge: reset ${buttons.length} button(s) to defaults in vibesense.json`)
    } catch (err) {
      logger.warn('SettingsBridge: failed to reset vibesense.json to defaults', err)
      // NFR-R1: never throw
    }

    // Clear VSCode Settings UI values back to defaults (undefined = use package.json default)
    try {
      const config = vscode.workspace.getConfiguration('vibesense')
      for (const button of buttons) {
        void Promise.resolve(
          config.update(`binding.${button}`, undefined, vscode.ConfigurationTarget.Workspace)
        ).then(undefined, (err: unknown) => {
          logger.warn(`SettingsBridge: failed to clear setting for button ${button}`, err)
        })
      }
    } catch (err) {
      logger.warn('SettingsBridge: failed to clear VSCode settings', err)
      // NFR-R1: never throw
    }
  }

  /**
   * Reads and validates the existing .vscode/vibesense.json profile.
   * Returns an empty profile on any error (file not found, invalid JSON, schema mismatch).
   */
  private readExistingProfile(profilePath: string): { profile?: string; bindings?: Record<string, string>; radialWheel?: { segments: string[] } } {
    try {
      const raw = fs.readFileSync(profilePath, 'utf-8')
      const json: unknown = JSON.parse(raw)
      const result = VibeProfileSchema.safeParse(json)
      if (result.success) {
        return result.data
      }
      logger.warn('SettingsBridge: invalid vibesense.json schema — starting fresh merge')
      return {}
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('SettingsBridge: could not read vibesense.json — starting fresh merge', err)
      }
      return {}
    }
  }
}
