# Story 8.4: Game State Persistence & Session Continuity

**Status:** review
**Epic:** 8 — Idle Mini-Games (Wait-Time Transformation)
**Story ID:** 8.4
**Story Key:** 8-4-game-state-persistence-session-continuity
**Created:** 2026-04-01

---

## Story

As a vibe coder,
I want my mini-game score and progress level to persist across VSCode restarts, and game state to survive panel dock/undock operations,
so that I never lose my game progress between coding sessions.

---

## Acceptance Criteria

**AC1 — High score persists across VSCode restarts (Snake):**
Given a Snake game is in progress with a score of 450,
When VSCode is closed and reopened,
Then the high score is preserved in `ExtensionContext.globalState`,
And the game starts fresh (not mid-game) but the high score leaderboard is intact.

**AC2 — High score persists across VSCode restarts (Tetris):**
Given a Tetris game is in progress with a score and level,
When VSCode is closed and reopened,
Then the Tetris high score is preserved in `ExtensionContext.globalState`,
And the game starts fresh but the high score is shown in the score overlay.

**AC3 — Game state survives dock/undock (no reset on window move):**
Given the GameWindow is docked in the bottom panel,
When the user drags it out to a separate monitor (or re-docks it),
Then the game continues without a reset,
And the canvas re-scales to fill the new window dimensions.

**AC4 — High score displayed in score overlay:**
Given a Snake or Tetris game is running,
When the score overlay renders,
Then it shows both the current session score AND the all-time high score (e.g., `Score: 120  Best: 450`).

**AC5 — High score sent to webview on game start:**
Given the GameWindow opens,
When `GAME_START` is posted to the webview,
Then a `GAME_HIGH_SCORE` message is also sent with `{ snake: number, tetris: number }`,
And the webview renders the loaded high scores immediately.

**AC6 — Webview reports new high scores to host:**
Given the current session score exceeds the stored high score,
When the game ends (snake collision or tetris game over),
Then the webview sends a `GAME_SCORE_UPDATE` webview → host message with `{ game: 'snake' | 'tetris', score: number }`,
And the host persists the new high score to `ExtensionContext.globalState`.

---

## Tasks / Subtasks

- [x] Task 1: Add new messages to `src/shared/messages.ts` (AC5, AC6)
  - [x] 1.1 Add `GAME_HIGH_SCORE` host→webview message: `{ snake: number, tetris: number }`
  - [x] 1.2 Add `GAME_SCORE_UPDATE` webview→host message: `{ game: 'snake' | 'tetris', score: number }`

- [x] Task 2: Add `GameHighScoreStore` to `src/extension/panels/` (AC1, AC2, AC6)
  - [x] 2.1 Create `src/extension/panels/game-high-score-store.ts`
  - [x] 2.2 Implement `getHighScore(game)`, `updateHighScore(game, score)` — backed by `ExtensionContext.globalState`
  - [x] 2.3 Use globalState keys `vibesense.gameHighScore.snake` and `vibesense.gameHighScore.tetris`

- [x] Task 3: Extend `MiniGamePanelManager` (AC5, AC6)
  - [x] 3.1 Accept `GameHighScoreStore` in constructor (or pass globalState directly)
  - [x] 3.2 In `open()`: after posting `GAME_START`, post `GAME_HIGH_SCORE` with stored scores
  - [x] 3.3 In `handleWebviewMessage()`: handle `GAME_SCORE_UPDATE` → call `store.updateHighScore()`
  - [x] 3.4 Set up `panel.webview.onDidReceiveMessage` in `createPanel()` to route webview→host messages

- [x] Task 4: Extend `GameCanvas.tsx` in the webview (AC4, AC5, AC6)
  - [x] 4.1 Add `highScores: { snake: number, tetris: number }` to `GameState`
  - [x] 4.2 Add `SET_HIGH_SCORES` action to `GameAction` union and `gameReducer`
  - [x] 4.3 Handle `GAME_HIGH_SCORE` in host message handler → dispatch `SET_HIGH_SCORES`
  - [x] 4.4 Pass `highScore` prop down to `Snake` and `Tetris` components

- [x] Task 5: Extend `Snake.tsx` to track and report high score (AC4, AC6)
  - [x] 5.1 Accept `highScore: number` and `onNewHighScore: (score: number) => void` props
  - [x] 5.2 On game-over (self collision): compare `score` with `highScore`; if greater, call `onNewHighScore(score)`
  - [x] 5.3 Display `Score: X  Best: Y` in the score overlay (top-left canvas)

- [x] Task 6: Extend `Tetris.tsx` to track and report high score (AC4, AC6)
  - [x] 6.1 Accept `highScore: number` and `onNewHighScore: (score: number) => void` props
  - [x] 6.2 On game-over (new piece spawns at occupied cells): compare and call `onNewHighScore` if exceeded
  - [x] 6.3 Display `Score: X  Best: Y` in the score overlay

- [x] Task 7: Wire `GAME_SCORE_UPDATE` from webview to VSCode host (AC6)
  - [x] 7.1 In `GameCanvas.tsx`: when `onNewHighScore` fires, call `vscodeApi.postMessage({ type: 'GAME_SCORE_UPDATE', payload: { game, score } })`
  - [x] 7.2 Ensure `acquireVsCodeApi()` is called once (check existing pattern in `index.tsx`)

- [x] Task 8: Verify dock/undock works without additional changes (AC3)
  - [x] 8.1 `retainContextWhenHidden: true` is already set in Story 8.1 — confirmed still present in `createPanel()`
  - [x] 8.2 Canvas resize handler already in `GameCanvas.tsx` via `window.addEventListener('resize', onResize)` — confirmed still present

- [x] Task 9: Write tests
  - [x] 9.1 Unit test `GameHighScoreStore`: getHighScore returns 0 when key absent; updateHighScore persists value
  - [x] 9.2 Unit test `MiniGamePanelManager`: `open()` posts `GAME_HIGH_SCORE` after `GAME_START`; incoming `GAME_SCORE_UPDATE` triggers store update
  - [x] 9.3 Webview test `GameCanvas.test.tsx`: `GAME_HIGH_SCORE` message dispatches `SET_HIGH_SCORES`
  - [x] 9.4 Webview test `GameCanvas.test.tsx`: canvas re-scales on resize (AC3 dock/undock verification)

---

## Dev Notes

### What This Story Builds

Story 8.4 adds two capabilities:

1. **High score persistence across VSCode restarts** — uses `ExtensionContext.globalState` (same pattern as `ModeManager` and `RadialWheelDispatchTracker`). The host stores high scores; on panel open, it sends `GAME_HIGH_SCORE` to the webview. When the webview detects a new high score (game-over), it sends `GAME_SCORE_UPDATE` back to the host.

2. **Dock/undock continuity** — already handled by `retainContextWhenHidden: true` (Story 8.1) and the `window resize` handler (Story 8.1). This story must verify these are intact and write the AC3 test. **No new implementation needed for dock/undock** — just verification and documentation.

### Architecture Compliance

- **Storage API:** Use `ExtensionContext.globalState` for cross-session data. Key pattern: `vibesense.gameHighScore.snake` and `vibesense.gameHighScore.tetris` — consistent with the established prefix convention (`vibesense.*`). [Source: `_bmad-output/planning-artifacts/architecture.md#Data Architecture`]
- **Message pattern:** New messages must be added to `src/shared/messages.ts` using `z.discriminatedUnion` — add to `HostMessageSchema` (host→webview) and `WebviewMessageSchema` (webview→host) respectively. [Source: existing `messages.ts` structure]
- **NFR-R1 (never throw):** All `globalState.update()` calls must be wrapped in try/catch with `logger.error` on failure — same pattern as `RadialWheelDispatchTracker.increment()`.
- **Panel postMessage errors:** All `panel.webview.postMessage()` calls use `.then(undefined, err => logger.error(...))` pattern — do NOT change this pattern. [Source: `mini-game-panel.ts`]
- **`retainContextWhenHidden: true`** is already set in `createPanel()` in `mini-game-panel.ts`. This is what enables dock/undock continuity (canvas state preserved in webview memory). Do NOT remove it.

### Critical File Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/messages.ts` | EXTEND | Add `GAME_HIGH_SCORE` (host→webview) and `GAME_SCORE_UPDATE` (webview→host) |
| `src/extension/panels/game-high-score-store.ts` | CREATE | Encapsulates globalState read/write for high scores |
| `src/extension/panels/mini-game-panel.ts` | EXTEND | Post `GAME_HIGH_SCORE` on open; handle `GAME_SCORE_UPDATE` from webview |
| `src/webview/mini-game/GameCanvas.tsx` | EXTEND | Handle `GAME_HIGH_SCORE` message; pass highScore to game components; post `GAME_SCORE_UPDATE` |
| `src/webview/mini-game/Snake.tsx` | EXTEND | Accept `highScore` + `onNewHighScore` props; display Best score; fire callback on game-over |
| `src/webview/mini-game/Tetris.tsx` | EXTEND | Accept `highScore` + `onNewHighScore` props; display Best score; fire callback on game-over |
| `test/unit/extension/mini-game-panel.test.ts` | EXTEND | Add Story 8.4 persistence tests |
| `test/webview/GameCanvas.test.tsx` | EXTEND | Add `GAME_HIGH_SCORE` message handling test |

### New Messages to Add to `src/shared/messages.ts`

Add to `HostMessageSchema` (after `GAME_INPUT` — Story 8.3 block), with comment `// Story 8.4: Score persistence messages`:

```typescript
// Story 8.4: Score persistence messages
z.object({
  type: z.literal('GAME_HIGH_SCORE'),
  payload: z.object({
    snake: z.number().int().nonnegative(),
    tetris: z.number().int().nonnegative(),
  }),
}),
```

Add to `WebviewMessageSchema` (after existing entries), with comment `// Story 8.4: Score persistence — webview reports new high score to host`:

```typescript
// Story 8.4: Score persistence — webview reports new high score to host
z.object({
  type: z.literal('GAME_SCORE_UPDATE'),
  payload: z.object({
    game: z.enum(['snake', 'tetris']),
    score: z.number().int().nonnegative(),
  }),
}),
```

### `GameHighScoreStore` — Full Implementation

Create `src/extension/panels/game-high-score-store.ts`:

```typescript
// src/extension/panels/game-high-score-store.ts
// Persists mini-game high scores in ExtensionContext.globalState (Story 8.4)
// Pattern: mirrors RadialWheelDispatchTracker — globalState.get with default 0, update with try/catch

import * as vscode from 'vscode'
import { logger } from '../logger'

/* eslint-disable @typescript-eslint/naming-convention */
const KEYS = {
  snake: 'vibesense.gameHighScore.snake',
  tetris: 'vibesense.gameHighScore.tetris',
} as const
/* eslint-enable @typescript-eslint/naming-convention */

export type GameType = 'snake' | 'tetris'

export class GameHighScoreStore {
  constructor(private readonly globalState: vscode.Memento) {}

  /** Returns stored high score for the given game. Returns 0 if never set. Never throws. */
  getHighScore(game: GameType): number {
    return this.globalState.get<number>(KEYS[game]) ?? 0
  }

  /**
   * Persists a new high score for the given game.
   * Only writes if score > current stored value (idempotent on re-open).
   * Never throws (NFR-R1).
   */
  async updateHighScore(game: GameType, score: number): Promise<void> {
    try {
      const current = this.getHighScore(game)
      if (score > current) {
        await this.globalState.update(KEYS[game], score)
        logger.info(`GameHighScoreStore: new ${game} high score: ${score}`)
      }
    } catch (err) {
      logger.error('GameHighScoreStore: failed to persist high score', err)
    }
  }
}
```

### `MiniGamePanelManager` Extensions

**Constructor:** Accept `GameHighScoreStore` as second parameter:

```typescript
constructor(
  private readonly context: vscode.ExtensionContext,
  private readonly highScoreStore: GameHighScoreStore,
) {}
```

**`open()` method:** After posting `GAME_SET_MODE`, post `GAME_HIGH_SCORE`:

```typescript
this.panel?.webview.postMessage({
  type: 'GAME_HIGH_SCORE',
  payload: {
    snake: this.highScoreStore.getHighScore('snake'),
    tetris: this.highScoreStore.getHighScore('tetris'),
  },
}).then(undefined, (err: unknown) => logger.error('MiniGamePanelManager: postMessage GAME_HIGH_SCORE failed', err))
```

**`createPanel()` method:** Wire up `panel.webview.onDidReceiveMessage` to handle `GAME_SCORE_UPDATE`:

```typescript
this.panel.webview.onDidReceiveMessage(
  (raw: unknown) => {
    const msg = parseWebviewMessage(raw)
    if (!msg) return
    if (msg.type === 'GAME_SCORE_UPDATE') {
      void this.highScoreStore.updateHighScore(msg.payload.game, msg.payload.score)
    }
  },
  undefined,
  this.context.subscriptions,
)
```

Import `parseWebviewMessage` at the top of `mini-game-panel.ts`:

```typescript
import { parseWebviewMessage } from '../../shared/messages'
```

**`extension.ts` — update construction site:**

Find the line where `MiniGamePanelManager` is constructed and update it:

```typescript
const highScoreStore = new GameHighScoreStore(context.globalState)
const miniGamePanelManager = new MiniGamePanelManager(context, highScoreStore)
```

Import: `import { GameHighScoreStore } from './panels/game-high-score-store'`

### `GameCanvas.tsx` Extensions

**`GameState` interface:** Add `highScores`:

```typescript
interface GameState {
  running: boolean
  direction: Direction
  gameMode: 'snake' | 'tetris'
  gameInput: GameInputAction | null
  highScores: { snake: number; tetris: number }  // Story 8.4
}
```

**`GameAction` union:** Add:

```typescript
| { type: 'SET_HIGH_SCORES'; snake: number; tetris: number }  // Story 8.4
```

**`gameReducer`:** Add case:

```typescript
case 'SET_HIGH_SCORES':
  return { ...state, highScores: { snake: action.snake, tetris: action.tetris } }
```

**Initial state:**

```typescript
{
  running: false,
  direction: 'right',
  gameMode: 'snake',
  gameInput: null,
  highScores: { snake: 0, tetris: 0 },  // Story 8.4
}
```

**Host message handler:** Add handler for `GAME_HIGH_SCORE`:

```typescript
} else if (msg.type === 'GAME_HIGH_SCORE') {
  dispatch({ type: 'SET_HIGH_SCORES', snake: msg.payload.snake, tetris: msg.payload.tetris })
}
```

**`vscodeApi`:** Acquire once at module level (check if already present in `index.tsx` — if not, add in `GameCanvas.tsx`):

```typescript
// Acquire once — must not be called more than once per webview lifetime
const vscodeApi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null
```

**`onNewHighScore` callback:** Define in `GameCanvas`:

```typescript
const handleNewHighScore = useCallback((game: 'snake' | 'tetris') => (score: number) => {
  vscodeApi?.postMessage({ type: 'GAME_SCORE_UPDATE', payload: { game, score } })
}, [])
```

**JSX:** Pass `highScore` and `onNewHighScore` to game components:

```tsx
{state.running && state.gameMode === 'snake' && (
  <Snake
    canvasRef={canvasRef}
    direction={state.direction}
    running={state.running}
    highScore={state.highScores.snake}
    onNewHighScore={handleNewHighScore('snake')}
  />
)}
{state.running && state.gameMode === 'tetris' && (
  <Tetris
    canvasRef={canvasRef}
    gameInput={state.gameInput}
    running={state.running}
    onInputConsumed={() => dispatch({ type: 'CLEAR_INPUT' })}
    highScore={state.highScores.tetris}
    onNewHighScore={handleNewHighScore('tetris')}
  />
)}
```

### `Snake.tsx` Extensions

**Props:** Add `highScore: number` and `onNewHighScore: (score: number) => void`:

```typescript
interface SnakeProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  direction: Direction
  running: boolean
  highScore: number           // Story 8.4
  onNewHighScore: (score: number) => void  // Story 8.4
}
```

**Sync new props to refs** (same pattern as `directionRef` / `runningRef`):

```typescript
const highScoreRef = useRef<number>(highScore)
const onNewHighScoreRef = useRef(onNewHighScore)
useEffect(() => { highScoreRef.current = highScore }, [highScore])
useEffect(() => { onNewHighScoreRef.current = onNewHighScore }, [onNewHighScore])
```

**On game-over** (self-collision in `tick()`): fire callback if score exceeded:

```typescript
// Self collision
if (snake.some(s => s.x === next.x && s.y === next.y)) {
  // Story 8.4: report new high score before reset
  if (score > highScoreRef.current) {
    onNewHighScoreRef.current(score)
  }
  // Game over — reset
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
  food = randomFood(snake)
  score = 0
  pendingDirection = 'right'
  return
}
```

**Score overlay in `draw()`:** Update to show Best:

```typescript
ctx!.fillStyle = SCORE_COLOR
ctx!.font = `bold 14px Inter, system-ui, sans-serif`
ctx!.fillText(`Score: ${score}  Best: ${highScoreRef.current}`, 8, 20)
```

### `Tetris.tsx` Extensions

**Props:** Add same `highScore` and `onNewHighScore`:

```typescript
interface TetrisProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  gameInput: GameInputAction | null
  running: boolean
  onInputConsumed: () => void
  highScore: number           // Story 8.4
  onNewHighScore: (score: number) => void  // Story 8.4
}
```

**Sync new props to refs** (same pattern as existing refs in Tetris):

```typescript
const highScoreRef = useRef<number>(highScore)
const onNewHighScoreRef = useRef(onNewHighScore)
useEffect(() => { highScoreRef.current = highScore }, [highScore])
useEffect(() => { onNewHighScoreRef.current = onNewHighScore }, [onNewHighScore])
```

**On game-over** (new piece spawn blocked): fire callback:

```typescript
// Game over: spawned piece immediately collides
if (!isValid(currentPiece.cells)) {
  // Story 8.4: report new high score before reset
  if (score > highScoreRef.current) {
    onNewHighScoreRef.current(score)
  }
  // Reset board
  board.forEach(row => row.fill(0))
  score = 0
  level = 1
  linesCleared = 0
  currentPiece = spawnPiece()
  return
}
```

**Score overlay in `drawScore()`:** Update to show Best:

```typescript
ctx!.fillStyle = SCORE_COLOR
ctx!.font = `bold 14px Inter, system-ui, sans-serif`
ctx!.fillText(`Score: ${score}  Best: ${highScoreRef.current}`, 8, 20)
ctx!.fillText(`Level: ${level}`, 8, 40)
```

### Dock/Undock — Verification Only

`retainContextWhenHidden: true` is already in `createPanel()` in `mini-game-panel.ts` (line 237). The canvas resize handler is already in `GameCanvas.tsx` (lines 86-91). **No implementation needed** for AC3 — just verify both are still present and write the verification test.

### `acquireVsCodeApi` — Important Detail

Check `src/webview/mini-game/index.tsx` — if `acquireVsCodeApi` is already called there, pass the api instance down to `GameCanvas` or use a shared module. Do NOT call `acquireVsCodeApi()` more than once per webview lifetime (VSCode throws on second call).

If it's not used yet in the mini-game bundle: declare the global type in `GameCanvas.tsx`:

```typescript
declare function acquireVsCodeApi(): { postMessage: (msg: unknown) => void }
const vscodeApi = acquireVsCodeApi()
```

### Testing Patterns

Follow existing test structure from `test/unit/extension/mini-game-panel.test.ts` (vi.hoisted mock state, vi.mock vscode, makeContext() helper).

**`GameHighScoreStore` unit test** (`test/unit/extension/game-high-score-store.test.ts`):

```typescript
// Mock globalState as a simple Map
function makeGlobalState(): vscode.Memento {
  const store = new Map<string, unknown>()
  return {
    get: (key: string, defaultValue?: unknown) => store.get(key) ?? defaultValue,
    update: vi.fn(async (key: string, value: unknown) => { store.set(key, value) }),
    keys: () => [],
    setKeysForSync: () => {},
  } as unknown as vscode.Memento
}
```

Test: `getHighScore` returns 0 when not set; `updateHighScore` persists only when `score > current`; errors are swallowed (NFR-R1).

**`MiniGamePanelManager` — extend existing test file:**

Update `makeContext()` to include a mock `globalState` and pass a `GameHighScoreStore` instance. Add tests:
- `open()` posts `GAME_HIGH_SCORE` message with `{ snake: 0, tetris: 0 }` (initial state)
- `GAME_SCORE_UPDATE` received via `onDidReceiveMessage` triggers `store.updateHighScore`

**Mock for `onDidReceiveMessage`** — add to `createWebviewPanel` mock:

```typescript
let msgListener: ((raw: unknown) => void) | undefined
// ...in panel:
webview: {
  onDidReceiveMessage: vi.fn((listener: (raw: unknown) => void) => {
    msgListener = listener
    return { dispose: vi.fn() }
  }),
  // ...
}
// expose for tests:
getMsgListener: () => msgListener,
```

### Vitest Config & Module Resolution

Tests live in `test/unit/extension/` (for host-side) and `test/webview/` (for webview components). The existing `vitest.config.ts` already handles both. No new config changes needed.

### Project Context

- Extension: TypeScript + VSCode API. Webview: React + TypeScript (TSX), webpack bundle.
- All messages validated with Zod at parse time — `parseHostMessage` / `parseWebviewMessage` return `null` on unknown types (safe).
- `logger` is a singleton imported from `../logger` in extension code.
- `NFR-R1`: Extension must never throw unhandled errors that crash VSCode — all async operations use `.catch` or `try/catch`.

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

Implementation complete (2026-04-01). All 6 acceptance criteria satisfied:
- AC1/AC2: High scores for both Snake and Tetris persist via `ExtensionContext.globalState` with keys `vibesense.gameHighScore.snake` and `vibesense.gameHighScore.tetris`. New `GameHighScoreStore` class encapsulates all persistence logic with NFR-R1 error handling.
- AC3: Dock/undock continuity confirmed — `retainContextWhenHidden: true` already in `createPanel()` and canvas resize handler already in `GameCanvas.tsx`. No new code needed for this criterion.
- AC4: Score overlays updated: Snake shows `Score: X  Best: Y`; Tetris shows `Score: X  Best: Y` + `Level: Z`.
- AC5: `MiniGamePanelManager.open()` sends `GAME_HIGH_SCORE` message immediately after `GAME_SET_MODE` so webview displays correct high scores from the first frame.
- AC6: Webview sends `GAME_SCORE_UPDATE` via `vscodeApi.postMessage()` on game-over; host handles it in `onDidReceiveMessage` and persists only if new score > current high score (idempotent).

Tests added: 20 new tests across 3 test files (857 total, up from 837). TypeScript passes with `tsconfig.webview.json` and `tsconfig.node.json`. No regressions.

### File List

| File | Action |
|------|--------|
| `src/shared/messages.ts` | Modified — added `GAME_HIGH_SCORE` (host→webview) and `GAME_SCORE_UPDATE` (webview→host) |
| `src/extension/panels/game-high-score-store.ts` | Created — `GameHighScoreStore` class with `getHighScore()` and `updateHighScore()` backed by `globalState` |
| `src/extension/panels/mini-game-panel.ts` | Modified — added `GameHighScoreStore` constructor param, `GAME_HIGH_SCORE` postMessage in `open()`, `onDidReceiveMessage` handler for `GAME_SCORE_UPDATE` |
| `src/extension/extension.ts` | Modified — instantiate `GameHighScoreStore`, pass to `MiniGamePanelManager`, import `GameHighScoreStore` |
| `src/webview/mini-game/GameCanvas.tsx` | Modified — added `acquireVsCodeApi` IIFE, `highScores` state, `SET_HIGH_SCORES` action, `GAME_HIGH_SCORE` handler, `handleNewHighScore` callback passed to Snake/Tetris |
| `src/webview/mini-game/Snake.tsx` | Modified — added `highScore` + `onNewHighScore` props with ref sync, game-over high score check, updated score overlay |
| `src/webview/mini-game/Tetris.tsx` | Modified — added `highScore` + `onNewHighScore` props with ref sync, game-over high score check in `lockAndSpawn()`, updated `drawScore()` overlay |
| `test/unit/extension/game-high-score-store.test.ts` | Created — 8 unit tests for `GameHighScoreStore` |
| `test/unit/extension/mini-game-panel.test.ts` | Modified — updated mock to include `onDidReceiveMessage`, added `makeGlobalState` + `makeHighScoreStore` helpers, 5 new Story 8.4 persistence tests |
| `test/webview/GameCanvas.test.tsx` | Modified — updated Snake prop calls to include `highScore`/`onNewHighScore`, added 4 new Story 8.4 tests |
| `test/webview/Tetris.test.tsx` | Modified — updated all Tetris prop calls to include `highScore`/`onNewHighScore` |
| `_bmad-output/implementation-artifacts/8-4-game-state-persistence-session-continuity.md` | Created — this story file |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Modified — status updated to `review` |
