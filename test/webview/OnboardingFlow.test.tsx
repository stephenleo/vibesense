// test/webview/OnboardingFlow.test.tsx
// Component tests for OnboardingFlow — Story 4.4 (AC 1, 2, 3, 5)
// jsdom environment (configured in vitest.config.ts for test/webview/)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/onboarding/onboarding.css', () => ({}))

// Mock ControllerIcon to simplify assertions
vi.mock('../../src/webview/shared-ui/ControllerIcon', () => ({
  ControllerIcon: ({
    button,
    controllerType,
    size,
  }: {
    button: string
    controllerType: string
    size?: number
  }) => {
    return (
      <span
        data-testid={`icon-${button}`}
        data-controller-type={controllerType}
        data-size={size}
      />
    )
  },
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { OnboardingFlow } from '../../src/webview/onboarding/OnboardingFlow'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OnboardingFlow — section 1 content (AC 1)', () => {
  it('renders section 1 content on step 0', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    // Section progress should show 1/3
    expect(screen.getByText(/section 1\/3/i)).toBeInTheDocument()
    // Step 0 instruction
    expect(screen.getByText(/Press Cross\/A to Approve/i)).toBeInTheDocument()
    // DualSense icon for 'cross'
    const icon = screen.getByTestId('icon-cross')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('data-controller-type', 'dualsense')
  })

  it('renders correct icon size of 48 for step icon', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    const icon = screen.getByTestId('icon-cross')
    expect(icon).toHaveAttribute('data-size', '48')
  })
})

describe('OnboardingFlow — section 2 content (AC 1)', () => {
  it('renders section 2 content on step 2', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={2}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    // Section progress should show 2/3
    expect(screen.getByText(/section 2\/3/i)).toBeInTheDocument()
    // Step 2 instruction
    expect(screen.getByText(/Hold L2\/LT to open the Radial Wheel/i)).toBeInTheDocument()
    // DualSense icon for 'l2'
    const icon = screen.getByTestId('icon-l2')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('data-controller-type', 'dualsense')
  })

  it('renders Xbox icons on step 2 with xbox controller', () => {
    render(
      <OnboardingFlow
        controllerType="xbox"
        currentStep={2}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    // Xbox icon for 'lt'
    const icon = screen.getByTestId('icon-lt')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveAttribute('data-controller-type', 'xbox')
  })
})

describe('OnboardingFlow — section 3 content (AC 1)', () => {
  it('renders section 3 content on step 4', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={4}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    // Section progress should show 3/3
    expect(screen.getByText(/section 3\/3/i)).toBeInTheDocument()
    // Step 4 instruction
    expect(screen.getByText(/Press L1\/LB to switch to previous session/i)).toBeInTheDocument()
    // DualSense icon for 'l1'
    const icon = screen.getByTestId('icon-l1')
    expect(icon).toBeInTheDocument()
  })
})

describe('OnboardingFlow — keyboard Next button (AC 5)', () => {
  it('calls onStepAdvance when keyboard "Next" button is clicked', () => {
    const onStepAdvance = vi.fn()
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton={null}
        onStepAdvance={onStepAdvance}
      />,
    )
    const nextBtn = screen.getByRole('button', { name: /advance to next step/i })
    fireEvent.click(nextBtn)
    expect(onStepAdvance).toHaveBeenCalledOnce()
  })

  it('renders keyboard hint text', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    expect(screen.getByText(/or press Space\/Enter/i)).toBeInTheDocument()
  })
})

describe('OnboardingFlow — button highlight (AC 2)', () => {
  it('applies step-highlighted class when isHighlighted=true (pressedButton matches expected)', () => {
    const { container } = render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton="cross"
        onStepAdvance={vi.fn()}
      />,
    )
    // pressedButton 'cross' matches step 0 dualsense button 'cross'
    const iconWrapper = container.querySelector('.step-highlighted')
    expect(iconWrapper).toBeInTheDocument()
  })

  it('does not apply step-highlighted class when pressedButton does not match', () => {
    const { container } = render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton="circle"
        onStepAdvance={vi.fn()}
      />,
    )
    // pressedButton 'circle' does not match step 0 expected 'cross'
    const iconWrapper = container.querySelector('.step-highlighted')
    expect(iconWrapper).not.toBeInTheDocument()
  })

  it('does not apply step-highlighted class when pressedButton is null', () => {
    const { container } = render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={0}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    const iconWrapper = container.querySelector('.step-highlighted')
    expect(iconWrapper).not.toBeInTheDocument()
  })
})

describe('OnboardingFlow — complete state (AC 3)', () => {
  it('renders complete state when currentStep >= 6', () => {
    render(
      <OnboardingFlow
        controllerType="dualsense"
        currentStep={6}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    expect(screen.getByText('Complete!')).toBeInTheDocument()
    expect(screen.getByText(/Full mode unlocked/i)).toBeInTheDocument()
  })
})

describe('OnboardingFlow — generic-hid fallback (AC 5)', () => {
  it('renders text label instead of controller icon for generic-hid controller', () => {
    render(
      <OnboardingFlow
        controllerType={null}
        currentStep={0}
        pressedButton={null}
        onStepAdvance={vi.fn()}
      />,
    )
    // ControllerIcon should NOT be rendered for generic-hid
    expect(screen.queryByTestId('icon-cross')).not.toBeInTheDocument()
    // Generic label should be shown
    expect(screen.getByText('cross')).toBeInTheDocument()
  })
})
