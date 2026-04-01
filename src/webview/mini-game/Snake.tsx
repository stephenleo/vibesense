// src/webview/mini-game/Snake.tsx
// Snake game logic component for VibeSense Mini-Game (Story 8.1)
// Uses requestAnimationFrame for game loop with delta-time accumulation
// Renders directly onto the canvas ref passed from GameCanvas

import React, { useEffect, useRef } from 'react'
import type { Direction } from './GameCanvas'

const GRID_SIZE = 20        // cells in each dimension
const TICK_MS = 150         // ms between game ticks
const SNAKE_COLOR = '#00C8FF'    // --vs-accent
const FOOD_COLOR = '#FFB800'     // amber
const BG_COLOR = '#0E0E1C'       // --vs-surface
const SCORE_COLOR = '#FFFFFF'

interface Point { x: number; y: number }

interface SnakeProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  direction: Direction
  running: boolean
}

export function Snake({ canvasRef, direction, running }: SnakeProps): null {
  const directionRef = useRef<Direction>(direction)
  const runningRef = useRef<boolean>(running)

  // Sync refs so game loop always sees latest value without re-creating RAF
  useEffect(() => { directionRef.current = direction }, [direction])
  useEffect(() => { runningRef.current = running }, [running])

  useEffect(() => {
    if (!running) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Game state
    let snake: Point[] = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
    let food: Point = randomFood(snake)
    let score = 0
    let lastTick = 0
    let pendingDirection: Direction = directionRef.current
    let rafId: number

    function randomFood(body: Point[]): Point {
      let p: Point
      do {
        p = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) }
      } while (body.some(s => s.x === p.x && s.y === p.y))
      return p
    }

    function cellSize(): number {
      // Use CSS pixel dimensions (canvas.getBoundingClientRect)
      return canvas!.getBoundingClientRect().width / GRID_SIZE
    }

    function draw() {
      const cs = cellSize()
      const w = canvas!.getBoundingClientRect().width
      const h = canvas!.getBoundingClientRect().height

      // Clear
      ctx!.fillStyle = BG_COLOR
      ctx!.fillRect(0, 0, w, h)

      // Snake
      ctx!.fillStyle = SNAKE_COLOR
      for (const seg of snake) {
        ctx!.fillRect(seg.x * cs + 1, seg.y * cs + 1, cs - 2, cs - 2)
      }

      // Food
      ctx!.fillStyle = FOOD_COLOR
      ctx!.beginPath()
      ctx!.arc(food.x * cs + cs / 2, food.y * cs + cs / 2, cs / 2 - 2, 0, Math.PI * 2)
      ctx!.fill()

      // Score
      ctx!.fillStyle = SCORE_COLOR
      ctx!.font = `bold 14px Inter, system-ui, sans-serif`
      ctx!.fillText(`Score: ${score}`, 8, 20)
    }

    function applyDirection(pending: Direction, current: Direction): Direction {
      // No-reverse rule
      const opposites: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' }
      return opposites[current] === pending ? current : pending
    }

    function tick() {
      const d = applyDirection(directionRef.current, pendingDirection)
      pendingDirection = d

      const head = snake[0]
      const next: Point = {
        x: (head.x + (d === 'right' ? 1 : d === 'left' ? -1 : 0) + GRID_SIZE) % GRID_SIZE,
        y: (head.y + (d === 'down' ? 1 : d === 'up' ? -1 : 0) + GRID_SIZE) % GRID_SIZE,
      }

      // Self collision
      if (snake.some(s => s.x === next.x && s.y === next.y)) {
        // Game over — reset
        snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]
        food = randomFood(snake)
        score = 0
        pendingDirection = 'right'
        return
      }

      snake.unshift(next)

      if (next.x === food.x && next.y === food.y) {
        score += 10
        food = randomFood(snake)
      } else {
        snake.pop()
      }
    }

    function loop(timestamp: number) {
      if (!runningRef.current) {
        rafId = requestAnimationFrame(loop)
        return
      }
      if (timestamp - lastTick >= TICK_MS) {
        tick()
        lastTick = timestamp
      }
      draw()
      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [running, canvasRef])  // re-mount if running flips to true

  return null
}
