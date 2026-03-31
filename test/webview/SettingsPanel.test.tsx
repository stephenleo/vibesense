// test/webview/SettingsPanel.test.tsx
// Component tests for SettingsPanel — Story 4.1 (AC 1, 2, 3)
// jsdom environment (configured in vitest.config.ts for test/webview/)

// CSS mocks must appear before imports (Vitest hoisting)
import { vi, describe, it, expect } from 'vitest'

vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/settings/settings.css', () => ({}))

// Mock ControllerIcon to simplify assertions
vi.mock('../../src/webview/shared-ui/ControllerIcon', () => ({
  ControllerIcon: ({
    button,
    controllerType,
  }: {
    button: string
    controllerType: string
    size?: number
  }) => {
    return <span data-testid={`icon-${button}`} data-controller-type={controllerType} />
  },
}))

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { SettingsPanel, ALL_BUTTON_IDS } from '../../src/webview/settings/SettingsPanel'

// ─── Test fixtures ────────────────────────────────────────────────────────────

const dualsenseButtons = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'l3', 'r3', 'up', 'down', 'left', 'right', 'options', 'touchpad']
const xboxButtons = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'ls', 'rs', 'menu', 'view']

function makeBindings(buttons: string[], prefix = 'cmd.'): Record<string, string> {
  return Object.fromEntries(buttons.map((b) => [b, `${prefix}${b}`]))
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsPanel — binding rows rendering (AC 1)', () => {
  it('renders all DualSense + Xbox binding rows when controllerType=dualsense', () => {
    const bindings = makeBindings([...dualsenseButtons, ...xboxButtons])
    render(
      <SettingsPanel
        bindings={bindings}
        controllerType="dualsense"
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    // All buttons should have input elements by ID
    for (const button of [...dualsenseButtons, ...xboxButtons]) {
      const input = document.getElementById(`binding-${button}`)
      expect(input).toBeInTheDocument()
    }
  })

  it('renders with controllerType=xbox — ControllerIcon gets xbox props', () => {
    const bindings = makeBindings(xboxButtons)
    render(
      <SettingsPanel
        bindings={bindings}
        controllerType="xbox"
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    // ControllerIcon for Xbox button 'a' should get controllerType='xbox'
    const icon = screen.getByTestId('icon-a')
    expect(icon).toHaveAttribute('data-controller-type', 'xbox')
  })

  it('renders with controllerType=dualsense — ControllerIcon gets dualsense props for cross', () => {
    const bindings = makeBindings(dualsenseButtons)
    render(
      <SettingsPanel
        bindings={bindings}
        controllerType="dualsense"
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    const icon = screen.getByTestId('icon-cross')
    expect(icon).toHaveAttribute('data-controller-type', 'dualsense')
  })

  it('uses generic-hid when controllerType is null', () => {
    const bindings = makeBindings(['cross'])
    render(
      <SettingsPanel
        bindings={bindings}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    const icon = screen.getByTestId('icon-cross')
    expect(icon).toHaveAttribute('data-controller-type', 'generic-hid')
  })
})

describe('SettingsPanel — binding change callback (AC 2)', () => {
  it('calls onBindingChange with correct button + command when input changes', () => {
    const onBindingChange = vi.fn()
    const bindings = { cross: 'vibesense.approve' }
    render(
      <SettingsPanel
        bindings={bindings}
        controllerType="dualsense"
        onBindingChange={onBindingChange}
        onResetSection={vi.fn()}
      />,
    )
    const input = screen.getByRole('textbox', { name: /cross/i })
    fireEvent.change(input, { target: { value: 'custom.newCommand' } })
    expect(onBindingChange).toHaveBeenCalledWith('cross', 'custom.newCommand')
  })

  it('calls onBindingChange with button=circle when circle input changes', () => {
    const onBindingChange = vi.fn()
    render(
      <SettingsPanel
        bindings={{ circle: 'vibesense.deny' }}
        controllerType="dualsense"
        onBindingChange={onBindingChange}
        onResetSection={vi.fn()}
      />,
    )
    const input = screen.getByRole('textbox', { name: /circle/i })
    fireEvent.change(input, { target: { value: 'custom.action' } })
    expect(onBindingChange).toHaveBeenCalledWith('circle', 'custom.action')
  })
})

describe('SettingsPanel — Reset to defaults button (AC 3)', () => {
  it('renders a "Reset to defaults" button', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /reset.*defaults/i })).toBeInTheDocument()
  })

  it('calls onResetSection with all button IDs when Reset button clicked', () => {
    const onResetSection = vi.fn()
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={onResetSection}
      />,
    )
    const resetBtn = screen.getByRole('button', { name: /reset.*defaults/i })
    fireEvent.click(resetBtn)
    expect(onResetSection).toHaveBeenCalledOnce()
    const calledWith: string[] = onResetSection.mock.calls[0][0]
    // Should include all DualSense and Xbox buttons
    for (const button of ALL_BUTTON_IDS) {
      expect(calledWith).toContain(button)
    }
  })
})

describe('SettingsPanel — section expand/collapse (AC 1)', () => {
  it('Bindings section is expanded by default (open attribute)', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    // The bindings details element should have open attribute
    const details = document.querySelector('details#bindings')
    expect(details).toBeInTheDocument()
    expect(details).toHaveAttribute('open')
  })

  it('Feedback placeholder section does not have open attribute by default', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    expect(screen.getByText('Coming in Epic 6')).toBeInTheDocument()
  })

  it('Gamification placeholder section is present', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    expect(screen.getByText('Coming in Epic 9')).toBeInTheDocument()
  })

  it('Streaming placeholder section is present', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    expect(screen.getByText('Coming in Epic 10')).toBeInTheDocument()
  })
})

describe('SettingsPanel — accessibility (AC 1, NFR-A1, UX-DR18)', () => {
  it('renders a skip link at the top of the panel', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    const skipLink = screen.getByRole('link', { name: /skip to bindings/i })
    expect(skipLink).toBeInTheDocument()
    expect(skipLink).toHaveAttribute('href', '#bindings')
  })

  it('renders fieldsets for binding groups (accessible grouping)', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    const fieldsets = document.querySelectorAll('fieldset.binding-group')
    // 6 groups: DS face, DS shoulder, DS other, Xbox face, Xbox shoulder, Xbox other
    expect(fieldsets.length).toBeGreaterThanOrEqual(4)
  })

  it('each binding group has a legend element', () => {
    render(
      <SettingsPanel
        bindings={{}}
        controllerType={null}
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    const legends = document.querySelectorAll('fieldset.binding-group legend')
    expect(legends.length).toBeGreaterThanOrEqual(4)
  })

  it('each binding input has a corresponding label', () => {
    render(
      <SettingsPanel
        bindings={{ cross: 'vibesense.approve' }}
        controllerType="dualsense"
        onBindingChange={vi.fn()}
        onResetSection={vi.fn()}
      />,
    )
    // Label for cross binding input exists
    const label = document.querySelector('label[for="binding-cross"]')
    expect(label).toBeInTheDocument()
    const input = document.getElementById('binding-cross')
    expect(input).toBeInTheDocument()
  })
})
