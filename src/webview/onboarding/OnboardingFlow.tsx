// src/webview/onboarding/OnboardingFlow.tsx
// Main tutorial flow component for VibeSense Onboarding

import React from 'react'
import type { ControllerType, ButtonId } from '../../shared/types'
import { TutorialStep } from './TutorialStep'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TutorialStepConfig {
  section: 1 | 2 | 3
  instruction: string
  dualsenseButton: ButtonId
  xboxButton: ButtonId
}

// ─── Tutorial Step Definitions ────────────────────────────────────────────────

export const TUTORIAL_STEPS: TutorialStepConfig[] = [
  // Section 1 — Face Buttons
  {
    section: 1,
    instruction: 'Press Cross/A to Approve',
    dualsenseButton: 'cross',
    xboxButton: 'a',
  },
  {
    section: 1,
    instruction: 'Press Circle/B to Deny',
    dualsenseButton: 'circle',
    xboxButton: 'b',
  },
  // Section 2 — L2/R2 Wheels
  {
    section: 2,
    instruction: 'Hold L2/LT to open the Radial Wheel',
    dualsenseButton: 'l2',
    xboxButton: 'lt',
  },
  {
    section: 2,
    instruction: 'Hold R2/RT to open the Quick Panel',
    dualsenseButton: 'r2',
    xboxButton: 'rt',
  },
  // Section 3 — Session Switching
  {
    section: 3,
    instruction: 'Press L1/LB to switch to previous session',
    dualsenseButton: 'l1',
    xboxButton: 'lb',
  },
  {
    section: 3,
    instruction: 'Press R1/RB to switch to next session',
    dualsenseButton: 'r1',
    xboxButton: 'rb',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getExpectedButton(
  step: TutorialStepConfig,
  controllerType: ControllerType | null,
): ButtonId | null {
  if (controllerType === 'dualsense') return step.dualsenseButton
  if (controllerType === 'xbox') return step.xboxButton
  return null // generic-hid — keyboard-only fallback
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface OnboardingFlowProps {
  controllerType: ControllerType | null
  currentStep: number
  pressedButton: string | null
  onStepAdvance: () => void
}

export function OnboardingFlow({
  controllerType,
  currentStep,
  pressedButton,
  onStepAdvance,
}: OnboardingFlowProps): React.ReactElement {
  const TOTAL_STEPS = TUTORIAL_STEPS.length
  const isComplete = currentStep >= TOTAL_STEPS

  if (isComplete) {
    return (
      <div className="onboarding-container">
        <div className="onboarding-complete" role="status" aria-live="polite">
          <h1 className="onboarding-complete-title">Complete!</h1>
          <p className="onboarding-complete-message">
            Full mode unlocked. Welcome to VibeSense!
          </p>
        </div>
      </div>
    )
  }

  const step = TUTORIAL_STEPS[currentStep]
  const currentSection = step.section
  const expectedButton = getExpectedButton(step, controllerType)
  const isHighlighted = pressedButton !== null && pressedButton === expectedButton

  // Section progress: 1/3, 2/3, 3/3 based on currentStep
  const sectionLabel = `${currentSection}/3`

  return (
    <div className="onboarding-container">
      <div className="onboarding-header">
        <h1 className="onboarding-title">VibeSense Setup</h1>
        <div className="onboarding-progress" aria-label={`Section ${sectionLabel}`}>
          <span className="onboarding-section-label">Section {sectionLabel}</span>
          <div className="onboarding-progress-bar">
            {[1, 2, 3].map((section) => (
              <div
                key={section}
                className={`onboarding-progress-segment ${section <= currentSection ? 'active' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="onboarding-step-area" aria-live="polite">
        <TutorialStep
          step={step}
          controllerType={controllerType}
          isHighlighted={isHighlighted}
          onAdvance={onStepAdvance}
        />
      </div>

      <p className="onboarding-keyboard-hint">or press Space/Enter</p>
    </div>
  )
}
