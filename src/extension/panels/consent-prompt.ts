// src/extension/panels/consent-prompt.ts
// Telemetry consent prompt helper — Story 11.2
// UI concern (VSCode notification), placed in panels/ so it can be imported freely
// by both extension.ts and onboarding-panel.ts (ESLint telemetry isolation rule applies to src/extension/telemetry/ only)

import * as vscode from 'vscode'
import { logger } from '../logger'
import { TELEMETRY_CONSENT_SHOWN_KEY } from '../../shared/constants'

/**
 * Shows a one-time telemetry consent notification after onboarding completes.
 *
 * - Checks globalState to ensure the prompt is only ever shown once (AC3).
 * - If user selects 'Enable anonymous analytics', writes `vibesense.telemetry.enabled = true`
 *   to Global config target (AC1, AC2).
 * - If user selects 'No thanks' or dismisses the notification, no setting write is needed
 *   because `vibesense.telemetry.enabled` defaults to `false` (AC1).
 * - Marks consent as shown regardless of the user's choice (AC3).
 * - Never throws (NFR-R1 pattern).
 */
export async function showTelemetryConsentPrompt(context: vscode.ExtensionContext): Promise<void> {
  try {
    // AC3: Only show the prompt once
    const alreadyShown = context.globalState.get<boolean>(TELEMETRY_CONSENT_SHOWN_KEY) === true
    if (alreadyShown) {
      return
    }

    const message =
      'Help improve VibeSense? We collect: session completion flag, controller action ratio, active features, session duration, agent interaction count, controller type, platform. Never: keystrokes, file names, terminal content, or any identifiable data. Change any time in Settings.'

    const selection = await vscode.window.showInformationMessage(
      message,
      'Enable anonymous analytics',
      'No thanks',
    )

    if (selection === 'Enable anonymous analytics') {
      // AC1, AC2: Write opt-in — Global target so it applies across all workspaces
      await vscode.workspace
        .getConfiguration('vibesense')
        .update('telemetry.enabled', true, vscode.ConfigurationTarget.Global)
      logger.info('showTelemetryConsentPrompt: user opted in to telemetry')
    } else {
      // 'No thanks' or dismissed (undefined) — no write needed; default is false
      logger.info(`showTelemetryConsentPrompt: user declined or dismissed (selection=${String(selection)})`)
    }

    // AC3: Mark consent as shown regardless of choice (including dismiss)
    await context.globalState.update(TELEMETRY_CONSENT_SHOWN_KEY, true)
    logger.info('showTelemetryConsentPrompt: consent prompt marked as shown')
  } catch (err) {
    // NFR-R1: never rethrow
    logger.error('showTelemetryConsentPrompt: unexpected error', err)
  }
}
