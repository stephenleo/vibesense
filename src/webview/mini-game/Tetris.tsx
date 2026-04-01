// src/webview/mini-game/Tetris.tsx
// Tetris game logic component for VibeSense Mini-Game (Story 8.3)
// Uses requestAnimationFrame game loop with delta-time accumulation
// Renders directly onto the canvas ref passed from GameCanvas
// Game state stored in useRef to survive pause/resume (AC3)

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
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  // O — yellow
  [[0, 0], [0, 1], [1, 0], [1, 1]],
  // T — purple
  [[0, 1], [1, 0], [1, 1], [1, 2]],
  // S — green
  [[0, 1], [0, 2], [1, 0], [1, 1]],
  // Z — red
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  // J — blue
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  // L — orange
  [[0, 2], [1, 0], [1, 1], [1, 2]],
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

function spawnPieceForRef(): Piece {
  const idx = Math.floor(Math.random() * PIECES.length)
  const template = PIECES[idx]
  const startCol = Math.floor((COLS - 4) / 2)
  return {
    cells: template.map(([r, c]) => ({ row: r, col: c + startCol })),
    colorIndex: idx,
  }
}

export function Tetris({ canvasRef, gameInput, running, onInputConsumed }: TetrisProps): null {
  const gameInputRef = useRef<GameInputAction | null>(gameInput)
  const onInputConsumedRef = useRef(onInputConsumed)
  const runningRef = useRef<boolean>(running)

  // Persistent game state (survives pause/resume via useRef — AC3)
  const boardRef = useRef<number[][]>(Array.from({ length: ROWS }, () => new Array(COLS).fill(0)))
  const activePieceRef = useRef<Piece>(spawnPieceForRef())
  const scoreRef = useRef(0)
  const levelRef = useRef(1)
  const linesClearedRef = useRef(0)
  const lastTickRef = useRef(0)

  // Sync refs so game loop always sees latest values without re-creating RAF
  useEffect(() => { gameInputRef.current = gameInput }, [gameInput])
  useEffect(() => { onInputConsumedRef.current = onInputConsumed }, [onInputConsumed])
  useEffect(() => { runningRef.current = running }, [running])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId: number

    function tickInterval(): number {
      return Math.max(100, 800 - (levelRef.current - 1) * 50)
    }

    function isValid(cells: Point[]): boolean {
      const board = boardRef.current
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
      const board = boardRef.current
      for (const { row, col } of piece.cells) {
        board[row][col] = piece.colorIndex + 1
      }
    }

    function clearLines(): number {
      const board = boardRef.current
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
      return (base[Math.min(n, 4)] ?? 800) * levelRef.current
    }

    function ghostCells(piece: Piece): Point[] {
      let ghost = { ...piece, cells: piece.cells.map(c => ({ ...c })) }
      // Drop ghost down row by row until it would collide (max ROWS iterations)
      for (let i = 0; i < ROWS; i++) {
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
      const board = boardRef.current
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
      ctx!.fillText(`Score: ${scoreRef.current}  Level: ${levelRef.current}`, 8, 20)
    }

    function lockAndSpawn(): void {
      lockPiece(activePieceRef.current)
      const cleared = clearLines()
      if (cleared > 0) {
        scoreRef.current += scoreForLines(cleared)
        linesClearedRef.current += cleared
        levelRef.current = Math.floor(linesClearedRef.current / 10) + 1
      }
      const newPiece = spawnPieceForRef()
      if (!isValid(newPiece.cells)) {
        // Game over — reset board
        boardRef.current = Array.from({ length: ROWS }, () => new Array(COLS).fill(0))
        scoreRef.current = 0
        levelRef.current = 1
        linesClearedRef.current = 0
        activePieceRef.current = spawnPieceForRef()
      } else {
        activePieceRef.current = newPiece
      }
    }

    function processInput(): void {
      const input = gameInputRef.current
      if (!input) return
      onInputConsumedRef.current()  // clear input immediately

      const piece = activePieceRef.current
      if (input === 'left') {
        const moved = piece.cells.map(c => ({ row: c.row, col: c.col - 1 }))
        if (isValid(moved)) activePieceRef.current = { ...piece, cells: moved }
      } else if (input === 'right') {
        const moved = piece.cells.map(c => ({ row: c.row, col: c.col + 1 }))
        if (isValid(moved)) activePieceRef.current = { ...piece, cells: moved }
      } else if (input === 'down') {
        const moved = piece.cells.map(c => ({ row: c.row + 1, col: c.col }))
        if (isValid(moved)) {
          activePieceRef.current = { ...piece, cells: moved }
        } else {
          lockAndSpawn()
        }
      } else if (input === 'rotate') {
        activePieceRef.current = rotatePiece(piece)
      }
    }

    function tick(): void {
      const piece = activePieceRef.current
      const moved = piece.cells.map(c => ({ row: c.row + 1, col: c.col }))
      if (isValid(moved)) {
        activePieceRef.current = { ...piece, cells: moved }
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
      if (timestamp - lastTickRef.current >= tickInterval()) {
        tick()
        lastTickRef.current = timestamp
      }

      drawBoard(cs)
      const ghost = ghostCells(activePieceRef.current)
      drawPiece(ghost, PIECE_COLORS[activePieceRef.current.colorIndex], GHOST_ALPHA, cs)
      drawPiece(activePieceRef.current.cells, PIECE_COLORS[activePieceRef.current.colorIndex], 1.0, cs)
      drawScore()

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [canvasRef])  // no 'running' dep — RAF loop runs continuously, checks runningRef (AC3)

  return null
}
