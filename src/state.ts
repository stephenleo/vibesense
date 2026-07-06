// Agent state tracking. Each Claude session (keyed by hook session_id) has a
// tiny FSM fed by hook events; the aggregate across all sessions drives the
// single game and controller routing. Pure — no I/O.

export type AgentState = 'executing' | 'waiting' | 'idle'

/** Map a Claude Code hook event name to the state it implies. */
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

export class SessionTracker {
  private sessions = new Map<string, { state: AgentState; waitingSince: number }>()
  private clock = 0

  /** Apply a hook event for a session. Returns true if the aggregate may have changed. */
  apply(sessionId: string, event: string): boolean {
    if (event === 'SessionEnd') {
      return this.sessions.delete(sessionId)
    }
    const state = stateForHookEvent(event)
    if (!state) return false
    const existing = this.sessions.get(sessionId)
    this.sessions.set(sessionId, {
      state,
      waitingSince: state === 'waiting' ? ++this.clock : (existing?.waitingSince ?? 0),
    })
    return true
  }

  remove(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  aggregate(): Aggregate {
    let focus: { id: string; since: number } | null = null
    let anyExecuting = false
    for (const [id, s] of this.sessions) {
      if (s.state === 'waiting' && (!focus || s.waitingSince > focus.since)) {
        focus = { id, since: s.waitingSince }
      }
      if (s.state === 'executing') anyExecuting = true
    }
    return {
      playing: !focus && anyExecuting,
      focusSessionId: focus?.id ?? null,
    }
  }
}
