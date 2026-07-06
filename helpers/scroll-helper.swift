// Smooth-scroll helper: reads integer pixel deltas from stdin (one per line)
// and posts real scroll-wheel events. Bytes written to the pty reach claude,
// not the terminal emulator's scrollback — only OS-level wheel events scroll
// the actual viewport smoothly. Requires Accessibility permission for the
// terminal app (same grant the previous osascript approach needed).
//
// Compiled on demand by src/scroll.ts:
//   swiftc -O -o ~/.vibesense/scroll-helper helpers/scroll-helper.swift

import CoreGraphics
import Foundation

while let line = readLine() {
    guard let delta = Int32(line.trimmingCharacters(in: .whitespaces)), delta != 0 else { continue }
    if let event = CGEvent(
        scrollWheelEvent2Source: nil, units: .pixel,
        wheelCount: 1, wheel1: delta, wheel2: 0, wheel3: 0
    ) {
        event.post(tap: .cghidEventTap)
    }
}
