// src/webview/settings/SettingsPanel.tsx
// Main Settings UI component for VibeSense controller binding customization

import React from 'react'
import type { ButtonId, ControllerType } from '../../shared/types'
import { ControllerIcon } from '../shared-ui/ControllerIcon'

// All DualSense buttons in display order
const DUALSENSE_FACE_BUTTONS: ButtonId[] = ['cross', 'circle', 'square', 'triangle']
const DUALSENSE_SHOULDER_TRIGGER: ButtonId[] = ['l1', 'r1', 'l2', 'r2']
const DUALSENSE_OTHER: ButtonId[] = ['l3', 'r3', 'up', 'down', 'left', 'right', 'options', 'touchpad']

// All Xbox buttons in display order
const XBOX_FACE_BUTTONS: ButtonId[] = ['a', 'b', 'x', 'y']
const XBOX_SHOULDER_TRIGGER: ButtonId[] = ['lb', 'rb', 'lt', 'rt']
const XBOX_OTHER: ButtonId[] = ['ls', 'rs', 'menu', 'view']

// All buttons combined for reset
export const ALL_BUTTON_IDS: ButtonId[] = [
  ...DUALSENSE_FACE_BUTTONS,
  ...DUALSENSE_SHOULDER_TRIGGER,
  ...DUALSENSE_OTHER,
  ...XBOX_FACE_BUTTONS,
  ...XBOX_SHOULDER_TRIGGER,
  ...XBOX_OTHER,
]

/** Human-readable button names for aria labels and display */
const BUTTON_NAMES: Record<ButtonId, string> = {
  cross: 'Cross (✕)',
  circle: 'Circle (○)',
  square: 'Square (□)',
  triangle: 'Triangle (△)',
  l1: 'L1',
  r1: 'R1',
  l2: 'L2',
  r2: 'R2',
  l3: 'L3',
  r3: 'R3',
  up: 'D-Pad Up',
  down: 'D-Pad Down',
  left: 'D-Pad Left',
  right: 'D-Pad Right',
  options: 'Options',
  touchpad: 'Touchpad',
  a: 'A',
  b: 'B',
  x: 'X',
  y: 'Y',
  lb: 'LB',
  rb: 'RB',
  lt: 'LT',
  rt: 'RT',
  ls: 'LS',
  rs: 'RS',
  menu: 'Menu',
  view: 'View',
}

export interface SettingsPanelProps {
  bindings: Record<string, string>
  controllerType: ControllerType | null
  onBindingChange: (button: string, command: string) => void
  onResetSection: (buttons: string[]) => void
}

interface BindingRowProps {
  button: ButtonId
  controllerType: ControllerType | null
  currentCommand: string
  onBindingChange: (button: string, command: string) => void
}

function BindingRow({ button, controllerType, currentCommand, onBindingChange }: BindingRowProps): React.ReactElement {
  const inputId = `binding-${button}`
  const resolvedControllerType = controllerType ?? 'generic-hid'

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    onBindingChange(button, e.target.value)
  }

  return (
    <div className="binding-row">
      <div className="binding-row__glyph">
        <ControllerIcon button={button} controllerType={resolvedControllerType} size={24} />
      </div>
      <label className="binding-row__label" htmlFor={inputId}>
        {BUTTON_NAMES[button]}
      </label>
      <input
        id={inputId}
        className="binding-row__input"
        type="text"
        value={currentCommand}
        onChange={handleChange}
        placeholder="VSCode command ID"
        aria-label={`Binding for ${BUTTON_NAMES[button]}`}
      />
    </div>
  )
}

interface BindingGroupProps {
  legend: string
  buttons: ButtonId[]
  bindings: Record<string, string>
  controllerType: ControllerType | null
  onBindingChange: (button: string, command: string) => void
}

function BindingGroup({ legend, buttons, bindings, controllerType, onBindingChange }: BindingGroupProps): React.ReactElement {
  return (
    <fieldset className="binding-group">
      <legend>{legend}</legend>
      {buttons.map((button) => (
        <BindingRow
          key={button}
          button={button}
          controllerType={controllerType}
          currentCommand={bindings[button] ?? ''}
          onBindingChange={onBindingChange}
        />
      ))}
    </fieldset>
  )
}

export function SettingsPanel({
  bindings,
  controllerType,
  onBindingChange,
  onResetSection,
}: SettingsPanelProps): React.ReactElement {
  function handleResetAll(): void {
    onResetSection(ALL_BUTTON_IDS)
  }

  return (
    <div className="settings-panel">
      {/* Skip link for keyboard navigation (UX-DR18, NFR-A1) */}
      <a href="#bindings" className="skip-link">
        Skip to bindings
      </a>

      {/* Status region for save confirmations (UX-DR18) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="settings-status" />

      {/* Bindings section — expanded by default */}
      <details className="settings-section" open id="bindings">
        <summary>Bindings</summary>
        <div className="settings-section__body">
          <BindingGroup
            legend="DualSense Face Buttons"
            buttons={DUALSENSE_FACE_BUTTONS}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <BindingGroup
            legend="DualSense Shoulders &amp; Triggers"
            buttons={DUALSENSE_SHOULDER_TRIGGER}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <BindingGroup
            legend="DualSense Other"
            buttons={DUALSENSE_OTHER}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <BindingGroup
            legend="Xbox Face Buttons"
            buttons={XBOX_FACE_BUTTONS}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <BindingGroup
            legend="Xbox Shoulders &amp; Triggers"
            buttons={XBOX_SHOULDER_TRIGGER}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <BindingGroup
            legend="Xbox Other"
            buttons={XBOX_OTHER}
            bindings={bindings}
            controllerType={controllerType}
            onBindingChange={onBindingChange}
          />
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetAll}
            aria-label="Reset all bindings to factory defaults"
          >
            Reset to defaults
          </button>
        </div>
      </details>

      {/* Placeholder sections — collapsed by default */}
      <details className="settings-section">
        <summary>Feedback</summary>
        <div className="settings-section__body">
          <p className="settings-placeholder">Coming in Epic 6</p>
        </div>
      </details>

      <details className="settings-section">
        <summary>Gamification</summary>
        <div className="settings-section__body">
          <p className="settings-placeholder">Coming in Epic 9</p>
        </div>
      </details>

      <details className="settings-section">
        <summary>Streaming</summary>
        <div className="settings-section__body">
          <p className="settings-placeholder">Coming in Epic 10</p>
        </div>
      </details>
    </div>
  )
}
