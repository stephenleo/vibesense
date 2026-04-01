# Story 8.3: Tetris Game Mode

**Status:** done
**Epic:** 8 — Idle Mini-Games (Wait-Time Transformation)
**Story ID:** 8.3
**Story Key:** 8-3-tetris-game-mode
**Created:** 2026-04-01

---

## User Story

As a vibe coder,
I want Tetris as an alternative idle game option, selectable from VSCode Settings or via controller toggle,
So that I have variety during longer AI processing sessions and am not limited to one game.

---

## Acceptance Criteria (BDD)

**AC1 — Tetris launches when selected in VSCode Settings:**
Given the user has set `vibesense.idleGame` to `"tetris"` in VSCode Settings,
When an agent session enters `processing` and the countdown completes,
Then the Tetris game launches in the GameWindow instead of Snake,
And the panel title updates to `"VibeSense · Tetris"` (middle dot U+00B7).

**AC2 — Controller input moves and rotates pieces:**
Given Tetris is running,
When the left analog stick or D-pad is moved left/right,
Then the active piece moves left or right by one column per input trigger (debounced at ~100ms),
And when the left stick or D-pad is pushed down, the piece soft-drops (accelerates fall),
And when the right analog stick is pushed left/right or the `square`/`x` button is pressed,
Then the piece rotates 90° clockwise.

**AC3 — Board state preserved across auto-pause/resume:**
Given the game auto-pauses (Story 8.2 `GAME_PAUSE` message arrives),
When Tetris resumes (`GAME_RESUME` message arrives),
Then the current Tetris board state is fully preserved — piece positions, active piece, score, and level.

**AC4 — Switching game mode mid-session:**
Given the user changes `vibesense.idleGame` to `"snake"` (or `"tetris"`) while a game is running,
When the next `GAME_START` message is received (either manually via `vibesense.toggleGame` or on next auto-launch),
Then the newly selected game type launches,
And the panel title updates accordingly.

---

## Requirements

**FR30** — Mini-game system: Tetris respects the same auto-launch countdown (`vibesense.gameAutoLaunchDelay`) and `AggregateGameState` wiring as Snake.
**UX-DR7** — GameWindow spec: Tab label switches to `"VibeSense · Tetris"` when Tetris is active; Canvas fills available space; `devicePixelRatio` scaling; score overlay at top-left.

---

## Developer Context

### What This Story Builds

This story adds `Tetris.tsx` — a self-contained Tetris game component — to the already-existing mini-game bundle. It introduces a `vibesense.idleGame` VSCode setting (`"snake"` | `"tetris"`, default `"snake"`) and extends `MiniGamePanelManager` + `GameCanvas` to select which game renders at runtime.

**Do NOT change the core infrastructure** (WebviewPanel creation, countdown logic, `GAME_START`/`GAME_PAUSE`/`GAME_RESUME` message flow). Story 8.1 established the full contract — this story adds one new game within that contract.

---

### Files to CREATE

1. **`src/webview/mini-game/Tetris.tsx`** — Tetris game logic component. Mirror `Snake.tsx` in structure: accepts `canvasRef`, `direction`, `rotating`, and `running` props; uses `requestAnimationFrame` game loop; renders directly onto the canvas ref; returns `null` from React (canvas-only render).

---

### Files to EXTEND

2. **`src/shared/messages.ts`** — Add `GAME_SET_MODE` host → webview message (delivers `mode: 'snake' | 'tetris'` to the webview when the setting changes or when a game starts). Add comment `// Story 8.3: Game mode selection`. Also add `GAME_INPUT` host → webview message for D-pad/left-stick button events routed to the active game (see details below).

3. **`src/webview/mini-game/GameCanvas.tsx`** — Extend to:
   - Receive `GAME_SET_MODE` message and store `gameMode: 'snake' | 'tetris'` in reducer state.
   - Receive `GAME_INPUT` message (left-stick direction, rotate button).
   - Render `<Tetris>` instead of `<Snake>` when `gameMode === 'tetris'` and `running === true`.
   - Keep all existing Snake routing (right-stick `GAME_STICK_UPDATE`) unchanged.
   - Update panel title via a `GAME_TITLE_UPDATE` webview → host message (optional enhancement — see notes).

4. **`src/extension/panels/mini-game-panel.ts`** — Extend to:
   - Read `vibesense.idleGame` setting and send `GAME_SET_MODE` to the webview on `open()`.
   - Route left-stick (`left_x`/`left_y`) axis events and D-pad button events to the webview as `GAME_INPUT` messages when the game panel is open.
   - Update panel title string when Tetris mode is active: `'VibeSense \u00b7 Tetris'` vs `'VibeSense \u00b7 Game'`.

5. **`src/extension/extension.ts`** — Extend `attachInputListeners` to also route:
   - Left-stick `left_x`/`left_y` axis events → `miniGamePanelManager.updateLeftAxis(axis, value)`.
   - D-pad button events (`up`, `down`, `left`, `right`) → `miniGamePanelManager.notifyButton(button, pressed)`.
   - Square/X rotate buttons → `miniGamePanelManager.notifyButton(button, pressed)`.

6. **`package.json`** — Add `vibesense.idleGame` configuration setting.

---

### New Messages to Add to `src/shared/messages.ts`

Add after the existing Story 8.1 game messages, with comment `// Story 8.3: Game mode and input messages`:

```typescript
// Story 8.3: Game mode and input messages
z.object({
  type: z.literal('GAME_SET_MODE'),
  payload: z.object({
    mode: z.enum(['snake', 'tetris']),
  }),
}),
z.object({
  type: z.literal('GAME_INPUT'),
  payload: z.object({
    // 'left'/'right'/'down' for piece movement; 'rotate' for clockwise rotation
    action: z.enum(['left', 'right', 'down', 'rotate']),
    // 'press' = D-pad or button pressed; 'axis' = stick threshold crossed
    source: z.enum(['button', 'axis']),
  }),
}),
```

No `WebviewMessage` additions needed in this story.

---

### `package.json` — Add `vibesense.idleGame` Setting

Add to `contributes.configuration.properties` (after `vibesense.gameAutoLaunchDelay`):

```json
"vibesense.idleGame": {
  "type": "string",
  "enum": ["snake", "tetris"],
  "enumDescriptions": [
    "Classic Snake game controlled with the right analog stick",
    "Tetris game controlled with the left analog stick / D-pad and rotate button"
  ],
  "default": "snake",
  "description": "Which mini-game to launch during AI agent processing wait time.",
  "order": 7
}
```

---

### `src/extension/panels/mini-game-panel.ts` — Extensions

**Add new private fields:**

```typescript
private lastLeftX = 0
private lastLeftY = 0
private leftAxisDebounceTimer: ReturnType<typeof setTimeout> | undefined
```

**Add `getActiveGameMode()` private method:**

```typescript
private getActiveGameMode(): 'snake' | 'tetris' {
  const config = vscode.workspace.getConfiguration('vibesense')
  return config.get<'snake' | 'tetris'>('idleGame') ?? 'snake'
}
```

**Update `open()` method** — after posting `GAME_START`, immediately post `GAME_SET_MODE`:

```typescript
this.panel?.webview.postMessage({
  type: 'GAME_SET_MODE',
  payload: { mode: this.getActiveGameMode() },
}).then(undefined, (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_SET_MODE failed', err))
```

**Update `createPanel()` private method** — set panel title dynamically:

```typescript
const title = this.getActiveGameMode() === 'tetris'
  ? 'VibeSense \u00b7 Tetris'
  : 'VibeSense \u00b7 Game'
```

Pass `title` to `vscode.window.createWebviewPanel()` second argument.

**Add `updateLeftAxis()` method** — routes left-stick axis to `GAME_INPUT` with debounce (100ms per direction trigger to prevent flooding):

```typescript
updateLeftAxis(axis: 'left_x' | 'left_y', value: number): void {
  if (axis === 'left_x') this.lastLeftX = value
  else this.lastLeftY = value

  // Determine action from dominant axis
  const ax = Math.abs(this.lastLeftX)
  const ay = Math.abs(this.lastLeftY)
  const THRESHOLD = 0.5
  let action: 'left' | 'right' | 'down' | null = null

  if (ax > THRESHOLD || ay > THRESHOLD) {
    if (ay > ax) {
      if (this.lastLeftY > 0) action = 'down'
      // up direction: no Tetris action (no 'up' in Tetris)
    } else {
      action = this.lastLeftX > 0 ? 'right' : 'left'
    }
  }

  if (action && !this.leftAxisDebounceTimer) {
    this.sendGameInput(action, 'axis')
    this.leftAxisDebounceTimer = setTimeout(() => {
      this.leftAxisDebounceTimer = undefined
    }, 100)
  }
}
```

**Add `notifyButton()` method** — routes D-pad and rotate button presses:

```typescript
notifyButton(button: string, pressed: boolean): void {
  if (!pressed || !this.panel) return
  const dpadMap: Record<string, 'left' | 'right' | 'down'> = {
    left: 'left', right: 'right', down: 'down',
  }
  // Square (DualSense) / X (Xbox) = rotate
  const rotateButtons = new Set(['square', 'x', 'r3'])
  if (dpadMap[button] !== undefined) {
    this.sendGameInput(dpadMap[button], 'button')
  } else if (rotateButtons.has(button)) {
    this.sendGameInput('rotate', 'button')
  }
}
```

**Add `sendGameInput()` private helper:**

```typescript
private sendGameInput(action: 'left' | 'right' | 'down' | 'rotate', source: 'button' | 'axis'): void {
  this.panel?.webview.postMessage({ type: 'GAME_INPUT', payload: { action, source } }).then(
    undefined,
    (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_INPUT failed', err),
  )
}
```

---

### `src/webview/mini-game/GameCanvas.tsx` — Extensions

**Extend `GameState` interface:**

```typescript
interface GameState {
  running: boolean
  direction: Direction           // right-stick direction (Snake)
  gameMode: 'snake' | 'tetris'  // active game mode
  gameInput: GameInputAction | null  // latest Tetris input action
}

type GameInputAction = 'left' | 'right' | 'down' | 'rotate'
```

**Extend `GameAction` union:**

```typescript
type GameAction =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SET_DIRECTION'; direction: Direction }
  | { type: 'SET_MODE'; mode: 'snake' | 'tetris' }
  | { type: 'GAME_INPUT'; action: GameInputAction }
  | { type: 'CLEAR_INPUT' }
```

**Extend `gameReducer`:**

```typescript
case 'SET_MODE':
  return { ...state, gameMode: action.mode }
case 'GAME_INPUT':
  return { ...state, gameInput: action.action }
case 'CLEAR_INPUT':
  return { ...state, gameInput: null }
```

Update initial state: `{ running: false, direction: 'right', gameMode: 'snake', gameInput: null }`.

**Extend host message handler** in the `useEffect`:

```typescript
} else if (msg.type === 'GAME_SET_MODE') {
  dispatch({ type: 'SET_MODE', mode: msg.payload.mode })
} else if (msg.type === 'GAME_INPUT') {
  dispatch({ type: 'GAME_INPUT', action: msg.payload.action as GameInputAction })
}
```

**Extend JSX return** to render Tetris instead of Snake when mode is `'tetris'`:

```tsx
return (
  <div className="game-container">
    <canvas ref={canvasRef} className="game-canvas" />
    {state.running && state.gameMode === 'snake' && (
      <Snake canvasRef={canvasRef} direction={state.direction} running={state.running} />
    )}
    {state.running && state.gameMode === 'tetris' && (
      <Tetris
        canvasRef={canvasRef}
        gameInput={state.gameInput}
        running={state.running}
        onInputConsumed={() => dispatch({ type: 'CLEAR_INPUT' })}
      />
    )}
  </div>
)
```

Import `Tetris` at top of file:

```typescript
import { Tetris } from './Tetris'
```

---

### `src/webview/mini-game/Tetris.tsx` — Full Implementation

**Design spec:**
- Grid: 10 columns × 20 rows (standard Tetris)
- Tick/fall rate: 800ms at level 1; decreases by 50ms per level (min 100ms)
- Level up: every 10 lines cleared
- Score: 100 × level per single line; 300 × level for double; 500 × level for triple; 800 × level for Tetris (4 lines)
- Colors: use VOID theme tokens where possible

```tsx
// src/webview/mini-game/Tetris.tsx
// Tetris game logic component for VibeSense Mini-Game (Story 8.3)
// Uses requestAnimationFrame game loop with delta-time accumulation
// Renders directly onto the canvas ref passed from GameCanvas

import React, { useEffect, useRef } from 'react'

export type GameInputAction = 'left' | 'right' | 'down' | 'rotate'

interface TetrisProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  gameInput: GameInputAction | null
  running: boolean
  onInputConsumed: () => void
}

const COLS = 10
const ROWS = 20
const BG_COLOR = '#0E0E1C'       // --vs-surface
const GRID_COLOR = '#1A1A2E'     // subtle grid lines
const SCORE_COLOR = '#FFFFFF'
const GHOST_ALPHA = 0.25         // ghost piece opacity

// Tetrominoes — each is an array of 4 [row, col] offsets from pivot
const PIECES: number[][][] = [
  // I — cyan
  [[0,0],[0,1],[0,2],[0,3]],
  // O — yellow
  [[0,0],[0,1],[1,0],[1,1]],
  // T — purple
  [[0,1],[1,0],[1,1],[1,2]],
  // S — green
  [[0,1],[0,2],[1,0],[1,1]],
  // Z — red
  [[0,0],[0,1],[1,1],[1,2]],
  // J — blue
  [[0,0],[1,0],[1,1],[1,2]],
  // L — orange
  [[0,2],[1,0],[1,1],[1,2]],
]

const PIECE_COLORS = [
  '#00C8FF',  // I — cyan (--vs-accent)
  '#FFE000',  // O — yellow
  '#9B4DCA',  // T — purple
  '#00E676',  // S — green
  '#FF3D3D',  // Z — red
  '#4D8BFF',  // J — blue
  '#FFB800',  // L — amber (--vs-amber)
]

interface Point { row: number; col: number }

interface Piece {
  cells: Point[]
  colorIndex: number
}

export function Tetris({ canvasRef, gameInput, running, onInputConsumed }: TetrisProps): null {
  const gameInputRef = useRef<GameInputAction | null>(gameInput)
  const onInputConsumedRef = useRef(onInputConsumed)
  const runningRef = useRef<boolean>(running)

  // Sync refs so game loop always sees latest values without re-creating RAF
  useEffect(() => { gameInputRef.current = gameInput }, [gameInput])
  useEffect(() => { onInputConsumedRef.current = onInputConsumed }, [onInputConsumed])
  useEffect(() => { runningRef.current = running }, [running])

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Board: 0 = empty, >0 = color index + 1
    const board: number[][] = Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
    let score = 0
    let level = 1
    let linesCleared = 0
    let lastTick = 0
    let rafId: number

    function tickInterval(): number {
      return Math.max(100, 800 - (level - 1) * 50)
    }

    function spawnPiece(): Piece {
      const idx = Math.floor(Math.random() * PIECES.length)
      const template = PIECES[idx]
      // Spawn centered at top of board
      const startCol = Math.floor((COLS - 4) / 2)
      return {
        cells: template.map(([r, c]) => ({ row: r, col: c + startCol })),
        colorIndex: idx,
      }
    }

    function isValid(cells: Point[]): boolean {
      return cells.every(({ row, col }) =>
        row >= 0 && row < ROWS && col >= 0 && col < COLS && board[row][col] === 0,
      )
    }

    function rotatePiece(piece: Piece): Piece {
      // Rotate 90° clockwise around centroid of bounding box
      const minRow = Math.min(...piece.cells.map(c => c.row))
      const maxRow = Math.max(...piece.cells.map(c => c.row))
      const minCol = Math.min(...piece.cells.map(c => c.col))
      const maxCol = Math.max(...piece.cells.map(c => c.col))
      const pivotRow = (minRow + maxRow) / 2
      const pivotCol = (minCol + maxCol) / 2
      const rotated: Point[] = piece.cells.map(({ row, col }) => ({
        row: Math.round(pivotRow + (col - pivotCol)),
        col: Math.round(pivotCol - (row - pivotRow)),
      }))
      // Wall kick: shift into bounds if needed
      const minC = Math.min(...rotated.map(c => c.col))
      const maxC = Math.max(...rotated.map(c => c.col))
      let colOffset = 0
      if (minC < 0) colOffset = -minC
      if (maxC >= COLS) colOffset = COLS - 1 - maxC
      const kicked = rotated.map(p => ({ ...p, col: p.col + colOffset }))
      if (!isValid(kicked)) return piece  // rotation failed — keep original
      return { ...piece, cells: kicked }
    }

    function lockPiece(piece: Piece): void {
      for (const { row, col } of piece.cells) {
        board[row][col] = piece.colorIndex + 1
      }
    }

    function clearLines(): number {
      let cleared = 0
      for (let r = ROWS - 1; r >= 0; r--) {
        if (board[r].every(cell => cell !== 0)) {
          board.splice(r, 1)
          board.unshift(new Array(COLS).fill(0))
          cleared++
          r++  // re-check same row index after splice
        }
      }
      return cleared
    }

    function scoreForLines(n: number): number {
      const base = [0, 100, 300, 500, 800]
      return (base[Math.min(n, 4)] ?? 800) * level
    }

    function ghostCells(piece: Piece): Point[] {
      let ghost = { ...piece, cells: piece.cells.map(c => ({ ...c })) }
      while (true) {
        const moved = ghost.cells.map(c => ({ row: c.row + 1, col: c.col }))
        if (!isValid(moved)) break
        ghost = { ...ghost, cells: moved }
      }
      return ghost.cells
    }

    function cellSize(): number {
      return canvas!.getBoundingClientRect().width / COLS
    }

    function drawBoard(cs: number): void {
      // Background
      ctx!.fillStyle = BG_COLOR
      ctx!.fillRect(0, 0, canvas!.getBoundingClientRect().width, canvas!.getBoundingClientRect().height)

      // Grid lines
      ctx!.strokeStyle = GRID_COLOR
      ctx!.lineWidth = 0.5
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx!.strokeRect(c * cs, r * cs, cs, cs)
        }
      }

      // Locked cells
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (board[r][c] !== 0) {
            ctx!.fillStyle = PIECE_COLORS[board[r][c] - 1]
            ctx!.fillRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2)
          }
        }
      }
    }

    function drawPiece(cells: Point[], color: string, alpha: number, cs: number): void {
      ctx!.globalAlpha = alpha
      ctx!.fillStyle = color
      for (const { row, col } of cells) {
        ctx!.fillRect(col * cs + 1, row * cs + 1, cs - 2, cs - 2)
      }
      ctx!.globalAlpha = 1.0
    }

    function drawScore(): void {
      ctx!.fillStyle = SCORE_COLOR
      ctx!.font = `bold 14px Inter, system-ui, sans-serif`
      ctx!.fillText(`Score: ${score}  Level: ${level}`, 8, 20)
    }

    let activePiece = spawnPiece()
    let gameOver = false

    // Game over check: if newly spawned piece overlaps locked cells
    if (!isValid(activePiece.cells)) {
      gameOver = true
    }

    function processInput(): void {
      const input = gameInputRef.current
      if (!input) return
      onInputConsumedRef.current()  // clear input immediately

      if (input === 'left') {
        const moved = activePiece.cells.map(c => ({ row: c.row, col: c.col - 1 }))
        if (isValid(moved)) activePiece = { ...activePiece, cells: moved }
      } else if (input === 'right') {
        const moved = activePiece.cells.map(c => ({ row: c.row, col: c.col + 1 }))
        if (isValid(moved)) activePiece = { ...activePiece, cells: moved }
      } else if (input === 'down') {
        const moved = activePiece.cells.map(c => ({ row: c.row + 1, col: c.col }))
        if (isValid(moved)) {
          activePiece = { ...activePiece, cells: moved }
        } else {
          // Same as a natural lock
          lockAndSpawn()
        }
      } else if (input === 'rotate') {
        activePiece = rotatePiece(activePiece)
      }
    }

    function lockAndSpawn(): void {
      lockPiece(activePiece)
      const cleared = clearLines()
      if (cleared > 0) {
        score += scoreForLines(cleared)
        linesCleared += cleared
        level = Math.floor(linesCleared / 10) + 1
      }
      activePiece = spawnPiece()
      if (!isValid(activePiece.cells)) {
        // Game over
        gameOver = true
        // Reset
        for (let r = 0; r < ROWS; r++) board[r].fill(0)
        score = 0
        level = 1
        linesCleared = 0
        activePiece = spawnPiece()
        gameOver = false
      }
    }

    function tick(): void {
      // Try to move piece down one row
      const moved = activePiece.cells.map(c => ({ row: c.row + 1, col: c.col }))
      if (isValid(moved)) {
        activePiece = { ...activePiece, cells: moved }
      } else {
        lockAndSpawn()
      }
    }

    function loop(timestamp: number): void {
      if (!runningRef.current) {
        rafId = requestAnimationFrame(loop)
        return
      }

      processInput()

      const cs = cellSize()
      if (timestamp - lastTick >= tickInterval()) {
        if (!gameOver) tick()
        lastTick = timestamp
      }

      drawBoard(cs)
      const ghost = ghostCells(activePiece)
      drawPiece(ghost, PIECE_COLORS[activePiece.colorIndex], GHOST_ALPHA, cs)
      drawPiece(activePiece.cells, PIECE_COLORS[activePiece.colorIndex], 1.0, cs)
      drawScore()

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [running, canvasRef])  // re-mount when running flips to true (same pattern as Snake)

  return null
}
```

---

### `src/extension/extension.ts` — Extend `attachInputListeners`

Find the existing `attachInputListeners` function. Add left-stick axis routing and D-pad/rotate button routing alongside the existing right-stick routing:

```typescript
// Story 8.3: Route left-stick and D-pad inputs to Tetris when game panel is open
if (event.kind === 'axis' && (event.axis === 'left_x' || event.axis === 'left_y')) {
  if (miniGamePanelManager.isOpen()) {
    miniGamePanelManager.updateLeftAxis(event.axis, event.value)
  }
}
if (event.kind === 'button') {
  if (miniGamePanelManager.isOpen()) {
    miniGamePanelManager.notifyButton(event.button, event.pressed)
  }
}
```

**IMPORTANT:** These routing calls are independent of the input router and radial wheel controller. D-pad buttons (`up`, `down`, `left`, `right`) are also used by other subsystems (session switching uses L1/R1, not D-pad, so no conflict). The `square`/`x`/`r3` rotate buttons are not currently mapped to any other game-active command.

**Where to add:** Inside the existing `driver.on('data', ...)` callback in `attachInputListeners`, alongside the existing right-stick axis check (lines ~344-349 in the current file).

---

## Architecture Constraints (MUST Follow)

1. **Messages first** — Add `GAME_SET_MODE` and `GAME_INPUT` to `src/shared/messages.ts` before implementing anything else.

2. **Tetris renders to canvas, returns null from React** — follow `Snake.tsx` exactly. `Tetris` is NOT a visual React component; it manages the RAF loop and renders to canvas only.

3. **No new WebviewPanel or webpack entry** — Tetris renders inside the existing `mini-game` bundle. `index.tsx` → `GameCanvas.tsx` → `Tetris.tsx` as conditional child. No changes to `webpack.config.js`.

4. **`retainContextWhenHidden: true`** is already set in `MiniGamePanelManager.createPanel()` — do NOT change it. React state survives `GAME_PAUSE` because of this. The Tetris `useEffect` re-runs only when `running` flips to `true`.

5. **State preservation on pause** — Tetris board state is local to the `useEffect` closure. When `running` flips to `false` via `GAME_PAUSE`, the RAF loop stalls (checks `runningRef.current`). Board state variables (`board`, `activePiece`, `score`, `level`) stay in the closure. When `running` flips to `true` via `GAME_RESUME`, the `useEffect` re-runs with `running=true` — this RE-CREATES the game loop from scratch! To preserve state across pause/resume, Tetris must store board state in `useRef` (not plain `let` variables), or the `useEffect` dependency array should NOT include `running`. **Correct approach:** same as Snake — use `useRef` for game state and `runningRef` for the `running` flag; keep RAF running continuously, just skip `tick()` + draw when `!runningRef.current`.

6. **Left-stick debounce** — Without debouncing, a held stick generates continuous axis events at ~60Hz. 100ms debounce gives ~10 moves/sec max, which is appropriate for Tetris.

7. **Panel title** — `MiniGamePanelManager.createPanel()` must set the panel title dynamically based on `vibesense.idleGame` at creation time. If the user changes the setting and re-opens, the new title is picked up on next `createPanel()` call.

8. **D-pad routing does NOT conflict** — D-pad buttons are not bound to any other command by default (not in `inputRouter`). Binding customization (Epic 4) allows users to remap them, but the game-panel routing is a direct intercept independent of the command dispatcher.

9. **No `console.log`** — use `logger` singleton.

10. **All async `postMessage` calls** must chain `.then(undefined, errHandler)` — same pattern as `open()` in `mini-game-panel.ts`.

11. **Tests in `test/` directory** — never co-located with source.

---

## Testing Requirements

**Test file:** `test/webview/Tetris.test.tsx`

**Setup:** Vitest + jsdom. Same mock setup as `GameCanvas.test.tsx`:

```typescript
vi.mock('../../src/webview/shared-ui/tokens.css', () => ({}))
vi.mock('../../src/webview/mini-game/mini-game.css', () => ({}))

const mockCtx = {
  fillRect: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillText: vi.fn(),
  scale: vi.fn(), beginPath: vi.fn(), strokeRect: vi.fn(),
  globalAlpha: 1.0, lineWidth: 1, strokeStyle: '', fillStyle: '',
}
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as unknown as typeof HTMLCanvasElement.prototype.getContext

let rafIdCounter = 0
globalThis.requestAnimationFrame = vi.fn((_cb: FrameRequestCallback) => ++rafIdCounter) as unknown as typeof requestAnimationFrame
globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame
```

**Required test cases (minimum 10):**

1. **Tetris renders null** — `<Tetris>` component returns null (no DOM output)
2. **Tetris does not throw on mount (running=true)** — renders without error with valid canvasRef
3. **Tetris does not throw on mount (running=false)** — renders without error when not running
4. **`onInputConsumed` called on 'left' input** — gameInput='left' → callback fires
5. **`onInputConsumed` called on 'right' input**
6. **`onInputConsumed` called on 'down' input**
7. **`onInputConsumed` called on 'rotate' input**
8. **`onInputConsumed` NOT called when gameInput=null** — no spurious callbacks
9. **GameCanvas renders Tetris when mode='tetris' and running** — dispatch `GAME_START` + `GAME_SET_MODE {mode: 'tetris'}` → Tetris renders
10. **GameCanvas renders Snake when mode='snake' and running** — default behavior unchanged
11. **GameCanvas handles GAME_INPUT message without throwing** — dispatch `GAME_INPUT {action: 'left', source: 'button'}`
12. **GameCanvas handles GAME_SET_MODE message without throwing** — dispatch `GAME_SET_MODE {mode: 'tetris'}`
13. **GameCanvas switches from Tetris to Snake on mode change** — dispatch mode='tetris' then mode='snake'

**Test for `MiniGamePanelManager.notifyButton` (optional but recommended):**

`test/unit/panels/mini-game-panel.test.ts` — extend existing test file to verify:
- `notifyButton('left', true)` sends `GAME_INPUT {action: 'left', source: 'button'}`
- `notifyButton('square', true)` sends `GAME_INPUT {action: 'rotate', source: 'button'}`
- `notifyButton('up', true)` sends nothing (no Tetris action for up D-pad)
- `notifyButton('left', false)` sends nothing (button release ignored)

---

## Previous Story Intelligence

### From Story 8.1 (MiniGamePanelManager + GameCanvas) — direct foundation:

- `MiniGamePanelManager.updateAxis()` is the exact template for `updateLeftAxis()` — same caching + batching pattern.
- The `Snake.tsx` `useEffect` pattern is the exact template for `Tetris.tsx` — RAF with `runningRef`, `useEffect` dep on `[running, canvasRef]`, cleanup via `cancelAnimationFrame`.
- **CRITICAL: Snake returns null from React** — Tetris must do the same.
- `parseHostMessage()` is the only way to handle host messages in the webview — do NOT manually parse `event.data`.
- `retainContextWhenHidden: true` prevents React state loss on dock/undock — already set.
- Story 8.1 Review finding: the `useEffect` re-runs when `running` flips to `true` — this means Tetris state variables MUST be in `useRef` if you want state to persist across pause/resume (unlike Snake which resets on each game over naturally). The board state approach shown above uses closure variables because the effect re-creates on each `running=true` flip — **this means pause/resume will RESET the board.** To truly preserve state per AC3, use `useRef` for `board`, `activePiece`, `score`, `level`, `linesCleared` at the component level, outside the `useEffect`.

**Revised Tetris.tsx state approach to satisfy AC3:**

```tsx
export function Tetris({ canvasRef, gameInput, running, onInputConsumed }: TetrisProps): null {
  const gameInputRef = useRef<GameInputAction | null>(gameInput)
  const onInputConsumedRef = useRef(onInputConsumed)
  const runningRef = useRef<boolean>(running)

  // Persistent game state (survives pause/resume via useRef)
  const boardRef = useRef<number[][]>(Array.from({ length: ROWS }, () => new Array(COLS).fill(0)))
  const activePieceRef = useRef<Piece>(spawnPieceForRef())
  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const linesClearedRef = useRef(0)
  const lastTickRef = useRef(0)

  // ... RAF loop reads from refs instead of closure variables
}
```

This allows the `useEffect` to be `useEffect(() => { ... }, [canvasRef])` with **no** `running` in the dep array — the RAF loop runs continuously and checks `runningRef.current`. This is cleaner and avoids the state reset issue.

### From Story 6.2/7.3 — `postMessage` error handling pattern:
- All `postMessage` calls must chain `.then(undefined, errFn)` — already in existing methods; follow the exact same pattern.

### From Story 7.4 — axis event handling:
- `AxisId` type is `'left_x' | 'left_y' | 'right_x' | 'right_y' | 'l2' | 'r2'` — left stick uses `left_x`/`left_y`.
- Axis values arrive as separate events per axis — need to cache both for combined direction, same as right stick.

---

## Git Intelligence

Recent commits:
- `93c2ce8` — story-8-1 Snake game merged (direct foundation for all Tetris changes)
- `d680521` — story-7-4 radial wheel label fading
- `04f96c0` — story-7-3 HUD overlay (template for MiniGamePanelManager)

**Files this story creates (no conflict risk — new):**
- `src/webview/mini-game/Tetris.tsx` — NEW
- `test/webview/Tetris.test.tsx` — NEW

**Files extended (risk: merge conflicts with story 8.2 if run in parallel):**
- `src/shared/messages.ts` — add 2 messages after existing Story 8.1 game messages
- `src/extension/panels/mini-game-panel.ts` — add methods + extend `open()` and `createPanel()`
- `src/webview/mini-game/GameCanvas.tsx` — extend state, reducer, message handler, JSX
- `src/extension/extension.ts` — add left-stick + button routing in `attachInputListeners`
- `package.json` — add `vibesense.idleGame` config

**Story 8.2 parallel run note:** Story 8.2 also modifies `extension.ts` (add `miniGamePanelManager.pause()`/`resume()` calls to `aggregateGameStateChanged` handler) and `mini-game-panel.ts`. If 8.2 and 8.3 are merged in any order, there WILL be conflicts in these files. Resolve by combining both changes — they are non-overlapping logic blocks.

---

## UX Reference (VOID Theme)

From **UX-DR7** and story context:
- Tetris tab label: `"VibeSense · Tetris"` (exact string, with middle dot `·` U+00B7)
- Snake tab label: `"VibeSense · Game"` (unchanged from Story 8.1)
- Canvas fills available space: `min(100vw, 100vh)` capped at 600px (already in `mini-game.css` — no change)
- Score overlay: `"Score: {n}  Level: {n}"` at top-left `(8, 20)` CSS pixels, same style as Snake
- Ghost piece: 25% opacity version of active piece projected to landing row
- Background: `#0E0E1C` (`--vs-surface`)
- Grid lines: `#1A1A2E` (subtle, 0.5px stroke)
- Piece colors follow standard Tetris conventions (I=cyan, O=yellow, T=purple, S=green, Z=red, J=blue, L=amber)

---

## Definition of Done

- [x] `src/shared/messages.ts` extended with `GAME_SET_MODE` and `GAME_INPUT` host messages (comment: Story 8.3)
- [x] `src/webview/mini-game/Tetris.tsx` created: RAF game loop, 10×20 grid, all 7 tetrominoes, wall kick on rotate, ghost piece, score/level rendering, state preserved across pause (useRef pattern)
- [x] `src/webview/mini-game/GameCanvas.tsx` extended: `gameMode` + `gameInput` state, `SET_MODE`/`GAME_INPUT`/`CLEAR_INPUT` actions, conditional Tetris render
- [x] `src/extension/panels/mini-game-panel.ts` extended: `updateLeftAxis()`, `notifyButton()`, `sendGameInput()`, `getActiveGameMode()`, dynamic panel title, `GAME_SET_MODE` posted on `open()`
- [x] `src/extension/extension.ts` extended: left-stick axis routing + button routing in `attachInputListeners`
- [x] `package.json` extended: `vibesense.idleGame` enum setting added
- [x] `test/webview/Tetris.test.tsx` created: 15 tests covering AC1–AC4
- [x] AC1 verified: `vibesense.idleGame='tetris'` → Tetris launches, panel title is "VibeSense · Tetris"
- [x] AC2 verified: left stick moves pieces left/right/down; square/x rotates; debounce prevents flooding
- [x] AC3 verified: board state preserved across `GAME_PAUSE` + `GAME_RESUME` (useRef approach — persistent refs, RAF loops continuously)
- [x] AC4 verified: setting change takes effect on next `GAME_START` (mode read from config in `open()` → `getActiveGameMode()`)
- [x] All existing tests pass (`npm run test`) — no regressions (830 tests, 46 files)
- [x] `npm run lint` and `npm run typecheck` pass with no errors
- [x] Story status updated to `done` after code review passes

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Fixed `while (true)` in `ghostCells()` → replaced with `for (let i = 0; i < ROWS; i++)` to satisfy ESLint `no-constant-condition` rule.

### Completion Notes List

- Implemented full Tetris game as `Tetris.tsx` — 10×20 grid, 7 tetrominoes with PIECE_COLORS, wall-kick rotation, ghost piece (25% alpha), score/level overlay at top-left.
- Used `useRef` for all game state (board, activePiece, score, level, linesCleared, lastTick) and a single continuous RAF loop that checks `runningRef.current` — ensures board state survives GAME_PAUSE/GAME_RESUME (AC3).
- Extended `GameCanvas.tsx` with `gameMode`/`gameInput` reducer state, three new actions (`SET_MODE`, `GAME_INPUT`, `CLEAR_INPUT`), and conditional rendering of `<Tetris>` vs `<Snake>`.
- Extended `MiniGamePanelManager` with `updateLeftAxis()` (100ms debounce, dominant-axis logic), `notifyButton()` (D-pad + square/x/r3 → rotate), `sendGameInput()` helper, `getActiveGameMode()`, and dynamic panel title in `createPanel()`.
- Extended `extension.ts` `attachInputListeners` to route left-stick axis events and all button events to `miniGamePanelManager` when panel is open.
- Added `vibesense.idleGame` enum setting to `package.json` with `order: 7` after `gameAutoLaunchDelay`.
- 15 tests in `test/webview/Tetris.test.tsx` covering all ACs — 830 total tests pass, 0 regressions.

### File List

- `src/shared/messages.ts` (modified)
- `src/webview/mini-game/Tetris.tsx` (created)
- `src/webview/mini-game/GameCanvas.tsx` (modified)
- `src/extension/panels/mini-game-panel.ts` (modified)
- `src/extension/extension.ts` (modified)
- `package.json` (modified)
- `test/webview/Tetris.test.tsx` (created)
- `_bmad-output/implementation-artifacts/8-3-tetris-game-mode.md` (modified — status, DoD, Dev Agent Record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status → review)

### Change Log

- 2026-04-01: Implemented Story 8.3 — Tetris game mode with controller input routing, game mode selection setting, and board state preservation across pause/resume.
- 2026-04-01: Code review passed (claude-opus-4-6). 2 patches applied: removed unnecessary `as GameInputAction` type assertion in GameCanvas.tsx; fixed misleading comment in messages.ts ('press' -> 'button'). 10 findings dismissed as noise/false positives.
