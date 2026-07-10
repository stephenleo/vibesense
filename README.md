# VibeSense

[![npm](https://img.shields.io/npm/v/%40vibesense%2Fcli)](https://www.npmjs.com/package/@vibesense/cli)

Drive Claude Code with a game controller — and play retro games while the agent works.

`vibesense` wraps the `claude` CLI in a pty and passes its TUI through to your terminal untouched. A game controller (Xbox / DualSense / generic HID) drives everything:

- **Agent waiting on you?** D-pad navigates AskUserQuestion options, A/✕ accepts, B/○ cancels, Y/△ triggers Claude Code's native voice input, right stick scrolls.
- **Agent executing?** A retro alien-defenders game auto-starts in a browser tab — left stick moves, RT/R2 fires. The moment Claude stops or asks a question, the game pauses and the controller flips back to driving the terminal.
- **Want a break?** Menu/Options pauses the game and hands the controller to the terminal; press it again to resume. This manual pause sticks — the agent starting or stopping won't un-pause it.
- **Games are plugins.** Anyone can publish a game as an npm package; official games are `@vibesense/game-<id>`, installed with `vibesense install <id>`.

## How it works

```
controller (node-hid)                                  ← one host per machine
   │
input router ──(agent waiting/idle)──▶ keystrokes ──▶ node-pty ⇄ claude
   │
   └────────(agent executing)──▶ SSE ──▶ browser tab (game canvas)

Claude Code hooks (curl POST) ──▶ http://127.0.0.1:48753 ──▶ agent-state FSM
```

Agent state comes from Claude Code hooks (`UserPromptSubmit`, `Stop`, `Notification`, `PermissionRequest`, `PreToolUse:AskUserQuestion`) installed idempotently into `~/.claude/settings.json`. Multiple Claude sessions share one host, one controller, and one game — the game pauses whenever _any_ session needs your attention.

Terminal buttons and game buttons are disjoint sets, with a 750 ms input guard on every mode flip — mashing fire can never accidentally accept a question.

## Games marketplace

Five games ship built in; browse and install the rest from the catalog at [vibesense.dev/games](https://vibesense.dev/games).

```sh
vibesense games            # list installed games (* = active)
vibesense install <id>     # install @vibesense/game-<id> from npm (tarballs/paths work too)
vibesense use <id>         # switch the active game
vibesense uninstall <id>
```

A game is an npm package `@vibesense/game-<id>` with a `vibesense-game.json` manifest — either a `web` game (canvas page served to the game tab) or an `external` adapter (shell commands on state transitions, e.g. launching/pausing a Steam game). See [docs/plugin-contract.md](docs/plugin-contract.md) to build one. Paid games are a reserved manifest field (`entitlement`) with the activation gate already in place — licensing bolts on later without changing the contract.

> **Trust model**: installing a game is installing an npm package, and `external` games run shell commands by design. Only install games from authors you trust — same judgement as adding any dependency.

## Install

```sh
npm install -g @vibesense/cli    # or: npx @vibesense/cli
```

Requires **Node ≥22**, and is **macOS-first**. The native deps `node-hid` / `node-pty` compile on install, so you'll need build tools (Xcode Command Line Tools on macOS).

## Development

```sh
npm install
npm run dev        # run from source (tsx)
npm run verify     # typecheck + lint + format-check + tests
```
