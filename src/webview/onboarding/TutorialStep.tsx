// src/webview/onboarding/TutorialStep.tsx
// Individual tutorial step component for VibeSense Onboarding

import React from 'react'
import type { ControllerType } from '../../shared/types'
import { ControllerIcon } from '../shared-ui/ControllerIcon'
import type { TutorialStepConfig } from './OnboardingFlow'
import { getExpectedButton } from './OnboardingFlow'

export interface TutorialStepProps {
  step: TutorialStepConfig
  controllerType: ControllerType | null
  isHighlighted: boolean
  onAdvance: () => void
}

export function TutorialStep({
  step,
  controllerType,
  isHighlighted,
  onAdvance,
}: TutorialStepProps): React.ReactElement {
  const expectedButton = getExpectedButton(step, controllerType)

  return (
    <div className="tutorial-step">
      <div
        className={`tutorial-step-icon ${isHighlighted ? 'step-highlighted' : ''}`}
        aria-live="polite"
      >
        {expectedButton !== null && controllerType !== null ? (
          <ControllerIcon
            button={expectedButton}
            controllerType={controllerType}
            size={48}
          />
        ) : (
          // generic-hid or no expected button — render text label
          <span className="tutorial-step-generic-label" aria-hidden="true">
            {expectedButton ?? step.dualsenseButton}
          </span>
        )}
      </div>

      <p className="tutorial-step-instruction" aria-live="polite">
        {step.instruction}
      </p>

      {/* Keyboard-accessible "Next" button for NFR-A1 */}
      <button
        className="tutorial-step-next"
        onClick={onAdvance}
        aria-label="Advance to next step (or press Space/Enter)"
      >
        Next →
      </button>
    </div>
  )
}
