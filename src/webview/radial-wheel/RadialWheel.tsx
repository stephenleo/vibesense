// src/webview/radial-wheel/RadialWheel.tsx
// Top-level radial wheel app component (Story 7.1 / Story 7.2 dual-layer)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { WheelSegment } from './WheelSegment'
import { parseHostMessage } from '../../shared/messages'
import { computeWheelSegmentIndex } from '../../shared/constants'
import type { WheelSegmentDef } from '../../shared/types'

// VSCode acquireVsCodeApi is injected by the Webview host
declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void }
const vscodeApi = ((): { postMessage: (msg: unknown) => void } => {
  try {
    return acquireVsCodeApi()
  } catch {
    // In tests, acquireVsCodeApi is not available — use window.postMessage as fallback
    return {
      postMessage: (msg: unknown) => {
        window.postMessage(msg, '*')
      },
    }
  }
})()

type WheelState = 'closed' | 'open' | 'closing'

const SVG_SIZE = 400
const CENTER = SVG_SIZE / 2
const WHEEL_RADIUS = 170

/**
 * Top-level radial wheel React app (Story 7.2 — Dual Layered Wheel).
 *
 * Renders both L2 Smart Wheel and R2 Personal Wheel simultaneously.
 * The active wheel is centered (full size, full opacity); the inactive wheel is
 * offset, scaled down, and blurred (UX-DR1 dual layered wheel spec).
 *
 * Listens to HostMessages from the extension host and renders the wheel overlay.
 * Emits WHEEL_SEGMENT_SELECTED messages for haptic tick events when selection changes.
 * The extension host owns dispatch logic — this component only renders and notifies.
 */
export function RadialWheelApp(): React.ReactElement | null {
  const [wheelState, setWheelState] = useState<WheelState>('closed')
  const [activeWheel, setActiveWheel] = useState<'l2' | 'r2'>('l2')
  const [l2Segments, setL2Segments] = useState<WheelSegmentDef[]>([])
  const [r2Segments, setR2Segments] = useState<WheelSegmentDef[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [previewIndex, setPreviewIndex] = useState(-1)
  const [isSwapping, setIsSwapping] = useState(false)

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Notify host when segment selection changes (for haptic tick)
  const notifySegmentSelected = useCallback((index: number) => {
    if (index >= 0) {
      vscodeApi.postMessage({
        type: 'WHEEL_SEGMENT_SELECTED',
        payload: { segmentIndex: index },
      })
    }
  }, [])

  // Handle WHEEL_STICK_UPDATE — compute selected segment and schedule preview
  const handleStickUpdate = useCallback(
    (x: number, y: number) => {
      const newIndex = computeWheelSegmentIndex(x, y)
      setSelectedIndex((prev) => {
        if (newIndex !== prev) {
          notifySegmentSelected(newIndex)
          return newIndex
        }
        return prev
      })

      // Clear existing preview timer
      if (previewTimerRef.current !== undefined) {
        clearTimeout(previewTimerRef.current)
        previewTimerRef.current = undefined
      }

      if (newIndex >= 0) {
        // Schedule preview text after 200ms hold
        previewTimerRef.current = setTimeout(() => {
          setPreviewIndex(newIndex)
          previewTimerRef.current = undefined
        }, 200)
      } else {
        setPreviewIndex(-1)
      }
    },
    [notifySegmentSelected],
  )

  // Handle WHEEL_CLOSE — animate close then remove from DOM
  const handleClose = useCallback(() => {
    setWheelState('closing')
    if (closeTimerRef.current !== undefined) {
      clearTimeout(closeTimerRef.current)
    }
    closeTimerRef.current = setTimeout(() => {
      setWheelState('closed')
      setSelectedIndex(-1)
      setPreviewIndex(-1)
      closeTimerRef.current = undefined
    }, 120)
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent): void => {
      const msg = parseHostMessage(event.data)
      if (!msg) return

      if (msg.type === 'WHEEL_OPEN') {
        // Clear any ongoing close animation
        if (closeTimerRef.current !== undefined) {
          clearTimeout(closeTimerRef.current)
          closeTimerRef.current = undefined
        }
        if (previewTimerRef.current !== undefined) {
          clearTimeout(previewTimerRef.current)
          previewTimerRef.current = undefined
        }

        // Detect trigger swap: wheel already open and activeWheel changed
        if (wheelState === 'open' && msg.payload.activeWheel !== activeWheel) {
          // This is a trigger swap — apply swap transition class for ~50ms
          if (swapTimerRef.current !== undefined) {
            clearTimeout(swapTimerRef.current)
          }
          setIsSwapping(true)
          swapTimerRef.current = setTimeout(() => {
            setIsSwapping(false)
            swapTimerRef.current = undefined
          }, 50)
        } else {
          setIsSwapping(false)
        }

        setActiveWheel(msg.payload.activeWheel)
        setL2Segments(msg.payload.l2Segments)
        setR2Segments(msg.payload.r2Segments)
        setSelectedIndex(-1)
        setPreviewIndex(-1)
        setWheelState('open')
      } else if (msg.type === 'WHEEL_STICK_UPDATE') {
        handleStickUpdate(msg.payload.x, msg.payload.y)
      } else if (msg.type === 'WHEEL_CLOSE') {
        handleClose()
      }
    }

    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
    }
  }, [wheelState, activeWheel, handleStickUpdate, handleClose])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== undefined) {
        clearTimeout(previewTimerRef.current)
      }
      if (closeTimerRef.current !== undefined) {
        clearTimeout(closeTimerRef.current)
      }
      if (swapTimerRef.current !== undefined) {
        clearTimeout(swapTimerRef.current)
      }
    }
  }, [])

  if (wheelState === 'closed') {
    return null
  }

  const isL2Active = activeWheel === 'l2'

  // Preview text: show for active wheel's selected segment only
  const activeSegments = isL2Active ? l2Segments : r2Segments
  const previewSegment = previewIndex >= 0 ? activeSegments.find((s) => s.index === previewIndex) : undefined

  const containerClass = [
    'radial-wheel',
    wheelState === 'closing' ? 'radial-wheel--closing' : 'radial-wheel--open',
    isSwapping ? 'radial-wheel--swapping' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const l2WheelClass = [
    'radial-wheel__wheel',
    'radial-wheel__wheel--l2',
    isL2Active ? 'radial-wheel__wheel--active' : 'radial-wheel__wheel--inactive',
  ].join(' ')

  const r2WheelClass = [
    'radial-wheel__wheel',
    'radial-wheel__wheel--r2',
    !isL2Active ? 'radial-wheel__wheel--active' : 'radial-wheel__wheel--inactive',
  ].join(' ')

  return (
    <div className={containerClass}>
      <div className="radial-wheel__stage">
        {/* L2 Smart Wheel */}
        <div className={l2WheelClass}>
          <svg
            className="radial-wheel__svg"
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            role="menu"
            aria-label="L2 Smart wheel"
          >
            {l2Segments.map((seg) => (
              <WheelSegment
                key={seg.index}
                index={seg.index}
                label={seg.label}
                promptText={seg.promptText}
                isActive={isL2Active && seg.index === selectedIndex}
                isPreview={isL2Active && seg.index === previewIndex}
                centerX={CENTER}
                centerY={CENTER}
                radius={WHEEL_RADIUS}
              />
            ))}
          </svg>
        </div>

        {/* R2 Personal Wheel */}
        <div className={r2WheelClass}>
          <svg
            className="radial-wheel__svg"
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            role="menu"
            aria-label="R2 Personal wheel"
          >
            {r2Segments.map((seg) => (
              <WheelSegment
                key={seg.index}
                index={seg.index}
                label={seg.label}
                promptText={seg.promptText}
                isActive={!isL2Active && seg.index === selectedIndex}
                isPreview={!isL2Active && seg.index === previewIndex}
                centerX={CENTER}
                centerY={CENTER}
                radius={WHEEL_RADIUS}
              />
            ))}
          </svg>
        </div>
      </div>

      {previewSegment && (
        <div className="radial-wheel__preview" aria-live="polite">
          {previewSegment.promptText ?? previewSegment.label}
        </div>
      )}
    </div>
  )
}
