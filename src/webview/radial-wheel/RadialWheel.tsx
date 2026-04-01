// src/webview/radial-wheel/RadialWheel.tsx
// Top-level radial wheel app component (Story 7.1)

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
 * Top-level radial wheel React app.
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

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

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
  }, [handleStickUpdate, handleClose])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (previewTimerRef.current !== undefined) {
        clearTimeout(previewTimerRef.current)
      }
      if (closeTimerRef.current !== undefined) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  if (wheelState === 'closed') {
    return null
  }

  // Determine which segments to display for the active wheel
  const activeSegments = activeWheel === 'l2' ? l2Segments : r2Segments

  // Preview text: show label of preview segment
  const previewSegment =
    previewIndex >= 0 ? activeSegments.find((s) => s.index === previewIndex) : undefined

  const containerClass = [
    'radial-wheel',
    wheelState === 'closing' ? 'radial-wheel--closing' : 'radial-wheel--open',
  ].join(' ')

  return (
    <div className={containerClass}>
      <svg
        className="radial-wheel__svg"
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        role="menu"
        aria-label="Radial wheel"
      >
        {activeSegments.map((seg) => (
          <WheelSegment
            key={seg.index}
            index={seg.index}
            label={seg.label}
            promptText={seg.promptText}
            isActive={seg.index === selectedIndex}
            isPreview={seg.index === previewIndex}
            centerX={CENTER}
            centerY={CENTER}
            radius={WHEEL_RADIUS}
          />
        ))}
      </svg>
      {previewSegment && (
        <div className="radial-wheel__preview" aria-live="polite">
          {previewSegment.promptText ?? previewSegment.label}
        </div>
      )}
    </div>
  )
}
