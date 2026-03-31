// src/extension/input/profile-writer.ts
// Writes .vscode/vibesense.json on first activation — never overwrites user customizations

import * as fs from 'node:fs'
import * as path from 'node:path'
import { logger } from '../logger'
import type { VibeProfile } from './profile-schema'

/**
 * Ensures .vscode/vibesense.json exists in the workspace.
 * If the file already exists, returns immediately (never overwrites user customizations).
 * Wraps all FS operations in try/catch — never throws (NFR-R1).
 */
export function ensureWorkspaceProfile(workspaceRoot: string, defaultProfile: VibeProfile): void {
  try {
    const vscodePath = path.join(workspaceRoot, '.vscode')
    const profilePath = path.join(vscodePath, 'vibesense.json')

    // Never overwrite existing customizations
    if (fs.existsSync(profilePath)) {
      return
    }

    // Create .vscode/ directory if needed
    if (!fs.existsSync(vscodePath)) {
      fs.mkdirSync(vscodePath, { recursive: true })
    }

    fs.writeFileSync(profilePath, JSON.stringify(defaultProfile, null, 2) + '\n', 'utf-8')
    logger.info('ProfileWriter: created .vscode/vibesense.json with default profile')
  } catch (err) {
    logger.warn('ProfileWriter: failed to write .vscode/vibesense.json', err)
    // NFR-R1: never throw — extension continues with in-memory defaults
  }
}
