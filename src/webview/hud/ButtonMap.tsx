// src/webview/hud/ButtonMap.tsx
// Renders the button-map grid using ControllerIcon glyphs (Story 7.3)

import React from 'react'
import { ControllerIcon } from '../shared-ui/ControllerIcon'
import type { ControllerType, ButtonId } from '../../shared/types'

// GUIDED_MODE_BUTTON_IDS as a plain array for webview use.
// Cannot import from src/extension/ — architecture boundary rule.
// IMPORTANT: Keep in sync with src/extension/input/default-bindings.ts GUIDED_MODE_BUTTON_IDS
const GUIDED_BUTTONS: ButtonId[] = ['cross', 'circle', 'l1', 'r1', 'a', 'b', 'lb', 'rb']

/** Maps a VSCode command ID to a short human-readable label */
function commandToLabel(command: string): string {
  /* eslint-disable @typescript-eslint/naming-convention */
  const LABELS: Record<string, string> = {
    'vibesense.approve': 'Approve',
    'vibesense.deny': 'Deny',
    'vibesense.openTerminal': 'Terminal',
    'vibesense.openRadialWheel': 'Smart Wheel',
    'vibesense.openQuickPanel': 'Personal Wheel',
    'vibesense.switchSessionPrev': 'Prev Session',
    'vibesense.switchSessionNext': 'Next Session',
    'vibesense.openSettings': 'Settings',
    'vibesense.voicePtt': 'Voice PTT',
    'vibesense.toggleHud': 'Toggle HUD',
    'workbench.action.terminal.focus': 'Focus Term',
    'workbench.action.terminal.scrollUp': 'Scroll Up',
    'workbench.action.terminal.scrollDown': 'Scroll Down',
    'workbench.action.navigateBack': 'Back',
    'workbench.action.navigateForward': 'Forward',
  }
  /* eslint-enable @typescript-eslint/naming-convention */
  return LABELS[command] ?? command.split('.').pop() ?? command
}

interface ButtonMapProps {
  bindings: Record<string, string>
  controllerType: ControllerType | null
  mode: 'guided' | 'full'
  pressedButtons?: Map<string, number>  // Story 10.2: optional — Map<buttonId, pressCounter> for animation re-trigger
}

export function ButtonMap({ bindings, controllerType, mode, pressedButtons }: ButtonMapProps): React.ReactElement {
  // Null controllerType falls back to generic-hid for ControllerIcon rendering
  const resolvedControllerType: ControllerType = controllerType ?? 'generic-hid'
  const entries = Object.entries(bindings) as [ButtonId, string][]
  const filtered =
    mode === 'guided' ? entries.filter(([btn]) => GUIDED_BUTTONS.includes(btn)) : entries

  if (filtered.length === 0) {
    return <p className="hud-empty">No bindings configured</p>
  }

  return (
    <ul className="hud-binding-list" role="list">
      {filtered.map(([button, command]) => (
        <li key={pressedButtons?.has(button) ? `${button}-${pressedButtons.get(button)}` : button} className={`hud-binding-row${pressedButtons?.has(button) ? ' streaming-button-pressed' : ''}`}>
          <span className="hud-icon"><ControllerIcon button={button} controllerType={resolvedControllerType} size={20} /></span>
          <span className="hud-binding-label">{commandToLabel(command)}</span>
        </li>
      ))}
    </ul>
  )
}
