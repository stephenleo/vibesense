// Agent state tracking. Each agent session (keyed by hook session_id) has a
// tiny FSM fed by hook events; the aggregate across all sessions drives the
// single game and controller routing. Pure — no I/O.

export type AgentState = 'executing' | 'waiting' | 'idle'

/** Map a supported lifecycle hook event name to the state it implies. */
export function stateForHookEvent(event: string): AgentState | null {
  switch (event) {
    case 'UserPromptSubmit':
    case 'PostToolUse': // a tool finished — covers resuming after question answers / permission grants
      return 'executing'
    case 'Stop':
    case 'SubagentStop':
      return 'idle'
    case 'Notification':
    case 'PermissionRequest':
    case 'PreToolUse': // installed with matcher AskUserQuestion only
      return 'waiting'
    default:
      return null // unknown/future events never break the FSM (keyed on names only)
  }
}

export interface Aggregate {
  /** True when the game should be running: someone is executing, nobody needs the user. */
  playing: boolean
  /** Session that most recently started waiting — terminal input routes here. */
  focusSessionId: string | null
}

export interface SessionApplyOptions {
  /** Allow Stop to focus this session when no session is waiting or executing. */
  focusOnStop?: boolean
}

export class SessionTracker {
  private sessions = new Map<
    string,
    { state: AgentState; transitionedAt: number; focusOnStop: boolean }
  >()
  private clock = 0

  /** Apply a hook event for a session. Returns true if the aggregate may have changed. */
  apply(sessionId: string, event: string, options: SessionApplyOptions = {}): boolean {
    if (event === 'SessionEnd') {
      return this.sessions.delete(sessionId)
    }
    const state = stateForHookEvent(event)
    if (!state) return false
    this.sessions.set(sessionId, {
      state,
      transitionedAt: ++this.clock,
      focusOnStop: options.focusOnStop === true,
    })
    return true
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  aggregate(): Aggregate {
    let waiting: { id: string; since: number } | null = null
    let idle: { id: string; since: number } | null = null
    let anyExecuting = false
    for (const [id, s] of this.sessions) {
      if (s.state === 'waiting' && (!waiting || s.transitionedAt > waiting.since)) {
        waiting = { id, since: s.transitionedAt }
      }
      if (s.state === 'idle' && s.focusOnStop && (!idle || s.transitionedAt > idle.since)) {
        idle = { id, since: s.transitionedAt }
      }
      if (s.state === 'executing') anyExecuting = true
    }
    return {
      playing: !waiting && anyExecuting,
      focusSessionId: waiting?.id ?? (anyExecuting ? null : idle?.id) ?? null,
    }
  }
}

/**
 * Play/pause decision: agent-driven by default, with a manual override (Menu
 * button) that forces the opposite of the current effective state. The next
 * agent playing-transition clears the override — by construction the override
 * is the state the agent is about to catch up to, so clearing is seamless, and
 * a stale force-play can never eat a permission prompt.
 */
export class PauseGate {
  private agentPlaying = false
  private override: 'play' | 'pause' | null

  constructor(forcePlay = false) {
    this.override = forcePlay ? 'play' : null
  }

  shouldPlay(): boolean {
    return this.override ? this.override === 'play' : this.agentPlaying
  }

  /** Feed the agent aggregate; a playing-transition clears any manual override. */
  onAgent(playing: boolean): void {
    if (playing !== this.agentPlaying) this.override = null
    this.agentPlaying = playing
  }

  /** Menu button: force the opposite of whatever is effective right now. */
  toggle(): void {
    this.override = this.shouldPlay() ? 'pause' : 'play'
  }
}
