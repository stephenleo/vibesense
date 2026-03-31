// test/webview/ControllerIcon.test.tsx
// Component tests for ControllerIcon using Vitest + @testing-library/react (jsdom)
import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { ControllerIcon } from '../../src/webview/shared-ui/ControllerIcon'

describe('ControllerIcon — DualSense', () => {
  it('renders Cross glyph ✕ with aria-label containing "DualSense cross"', () => {
    render(<ControllerIcon button="cross" controllerType="dualsense" />)
    const img = screen.getByRole('img', { name: /DualSense cross/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('✕')
  })

  it('renders Circle glyph ○', () => {
    render(<ControllerIcon button="circle" controllerType="dualsense" />)
    const img = screen.getByRole('img', { name: /DualSense circle/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('○')
  })

  it('renders Square glyph □', () => {
    render(<ControllerIcon button="square" controllerType="dualsense" />)
    const img = screen.getByRole('img', { name: /DualSense square/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('□')
  })

  it('renders Triangle glyph △', () => {
    render(<ControllerIcon button="triangle" controllerType="dualsense" />)
    const img = screen.getByRole('img', { name: /DualSense triangle/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('△')
  })

  it('Cross never renders a generic glyph — UX-DR2', () => {
    render(<ControllerIcon button="cross" controllerType="dualsense" />)
    const img = screen.getByRole('img', { name: /DualSense cross/i })
    // Should contain the specific PS5 glyph, NOT a generic fallback like the button id "cross"
    expect(img.textContent).toContain('✕')
    expect(img.textContent).not.toBe('cross')
  })
})

describe('ControllerIcon — Xbox', () => {
  it('renders A glyph', () => {
    render(<ControllerIcon button="a" controllerType="xbox" />)
    const img = screen.getByRole('img', { name: /Xbox a/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('A')
  })

  it('renders B glyph', () => {
    render(<ControllerIcon button="b" controllerType="xbox" />)
    const img = screen.getByRole('img', { name: /Xbox b/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('B')
  })

  it('renders X glyph', () => {
    render(<ControllerIcon button="x" controllerType="xbox" />)
    const img = screen.getByRole('img', { name: /Xbox x/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('X')
  })

  it('renders Y glyph', () => {
    render(<ControllerIcon button="y" controllerType="xbox" />)
    const img = screen.getByRole('img', { name: /Xbox y/i })
    expect(img).toBeInTheDocument()
    expect(img.textContent).toContain('Y')
  })
})

describe('ControllerIcon — generic-hid', () => {
  it('renders button name as text label (no PS or Xbox-specific glyph)', () => {
    render(<ControllerIcon button="cross" controllerType="generic-hid" />)
    const img = screen.getByRole('img', { name: /Controller cross/i })
    expect(img).toBeInTheDocument()
    // generic-hid falls back to BUTTON_LABELS or button id — cross has no BUTTON_LABELS entry
    // so it renders "cross" (the button id), not the PS5 glyph ✕
    expect(img.textContent).not.toContain('✕')
    expect(img.textContent).not.toContain('○')
  })
})

describe('ControllerIcon — size prop', () => {
  it('sets rendered width and height to default 20 when size not provided', () => {
    const { container } = render(<ControllerIcon button="cross" controllerType="dualsense" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '20')
    expect(svg).toHaveAttribute('height', '20')
  })

  it('sets rendered width and height to provided size', () => {
    const { container } = render(<ControllerIcon button="cross" controllerType="dualsense" size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })
})
