# VibeSense game plugin contract (protocol v1)

> New to this? Start with the step-by-step tutorial: [Building a VibeSense game](building-a-game.md).

A VibeSense game is anything that can start when the Claude agent begins executing and pause when it stops or needs the user. Two kinds exist under one contract:

- **`web`** — a static web page (canvas game) served by the vibesense host and shown in a browser tab.
- **`external`** — an adapter for anything else (a Steam game, an emulator, a Roblox launcher): shell commands run on state transitions. No JS runtime required.

## Manifest

Every plugin has a `vibesense-game.json` at its root:

```json
{
  "id": "my-game",
  "name": "My Game",
  "version": "1.0.0",
  "protocolVersion": 1,
  "kind": "web",
  "entry": "index.html",
  "entitlement": "free"
}
```

| Field             | Notes                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `[a-z0-9-]`, unique; also the npm package suffix.                                                                                                                     |
| `protocolVersion` | Always `1` for now.                                                                                                                                                   |
| `kind`            | `"web"` or `"external"`.                                                                                                                                              |
| `entry`           | `web` only: the HTML file to open, served at `/games/<id>/<entry>`.                                                                                                   |
| `commands`        | `external` only: `{ "start", "pause", "resume", "stop" }` — shell commands run in the plugin dir on state transitions. All optional; omitted transitions are skipped. |
| `entitlement`     | `"free"` or `"paid"`. Paid is a reserved stub: activation is blocked until licensing ships, so the field can be used today without a payment system.                  |

## Runtime contract — `web` games

Your page is served by the vibesense host and receives everything over one SSE stream:

```js
const events = new EventSource('/events')
events.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  // { type: 'state', state: 'playing' | 'paused' }
  //   playing → the agent is executing; run your game loop.
  //   paused  → Claude needs the user; freeze and show why.
  // { type: 'input', kind: 'button', button: 'r2'|'l2', pressed: boolean }
  // { type: 'input', kind: 'axis', axis: 'left_x'|'left_y', value: -1..1 }
}
```

Rules:

- **Respect `paused` immediately** — the user's controller has flipped back to driving the terminal; your game must visibly freeze.
- Game-mode input is only the left stick and R2/L2. Face buttons, D-pad, and the right stick belong to the terminal and will never be forwarded.
- No build step is required or expected: plain HTML + JS served as-is. Everything must be local (the host serves only your plugin directory).

## Runtime contract — `external` games

The host runs your manifest's shell commands (in your plugin directory):

- first transition to playing → `start`
- playing → paused → `pause`
- paused → playing → `resume`
- vibesense exits → `stop`

An adapter for a Steam game can be as small as:

```json
{
  "id": "my-steam-adapter",
  "name": "My Steam Game",
  "version": "1.0.0",
  "protocolVersion": 1,
  "kind": "external",
  "commands": {
    "start": "open steam://run/12345",
    "pause": "osascript pause.scpt",
    "resume": "osascript resume.scpt"
  },
  "entitlement": "free"
}
```

Note: external games own their controller input themselves (Steam already reads your gamepad); vibesense only tells them when to run.

## Publishing to the marketplace

The marketplace is npm:

1. Put `vibesense-game.json` at the package root. Official games are named `@vibesense/game-<id>`; name yours under your own scope (e.g. `@you/my-game`) and keep the `vibesense-game` keyword.
2. `npm publish --access public`.
3. Users install official games with `vibesense install <id>`, community games with their full npm name (`vibesense install @you/my-game`), and activate with `vibesense use <id>`.

Discovery: `npm search vibesense-game` or `vibesense games` for what's installed locally. Test unpublished games with `vibesense install ./my-game.tgz` (any npm-installable spec works).

**Trust model**: installing a game is installing an npm package — it can run code (external games run shell commands by design). Install games you trust, same as any dependency.
