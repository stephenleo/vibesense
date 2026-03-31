// src/extension/input/binding-loader.ts
// Loads per-workspace binding profile from .vscode/vibesense.json

import * as fs from 'node:fs'
import * as path from 'node:path'
import { z } from 'zod'
import { logger } from '../logger'
import { CLAUDE_CODE_DEFAULT_BINDINGS, type BindingMap } from './default-bindings'
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

const VibeProfileSchema = z.object({
  profile: z.string().optional(),
  bindings: z.record(z.string(), z.string().min(1)).optional(),
  radialWheel: z
    .object({
      segments: z.array(z.string()),
    })
    .optional(),
})

/**
 * Load binding profile from <workspaceRoot>/.vscode/vibesense.json.
 * Falls back to CLAUDE_CODE_DEFAULT_BINDINGS on any error (NFR-R1 — never throw).
 */
export function loadBindings(workspaceRoot: string): BindingMap {
  const profilePath = path.join(workspaceRoot, '.vscode', 'vibesense.json')
  try {
    const raw = fs.readFileSync(profilePath, 'utf-8')
    const json: unknown = JSON.parse(raw)
    const result = VibeProfileSchema.safeParse(json)
    if (!result.success) {
      logger.warn('BindingLoader: invalid vibesense.json schema — using defaults')
      return CLAUDE_CODE_DEFAULT_BINDINGS
    }
    const { bindings, profile } = result.data
    logger.info(`BindingLoader: loaded profile '${profile ?? 'unnamed'}' from ${profilePath}`)
    if (!bindings) return CLAUDE_CODE_DEFAULT_BINDINGS
    const validBindings: BindingMap = {}
    for (const [key, value] of Object.entries(bindings)) {
      if (VALID_BUTTON_IDS.has(key)) {
        validBindings[key as ButtonId] = value
      } else {
        logger.warn(`BindingLoader: unknown button id '${key}' in vibesense.json — skipped`)
      }
    }
    return { ...CLAUDE_CODE_DEFAULT_BINDINGS, ...validBindings }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File not found is normal — use defaults silently
      logger.info('BindingLoader: no vibesense.json found — using claude-code defaults')
    } else {
      logger.warn('BindingLoader: error reading vibesense.json — using defaults', err)
    }
    return CLAUDE_CODE_DEFAULT_BINDINGS
  }
}
