# Building a VibeSense game — step by step

This is the tutorial companion to the [plugin contract reference](plugin-contract.md). Follow it top to bottom and you'll go from empty directory to a published game other people can `vibesense install`.

The bundled Snake game ([`games/snake/`](../games/snake/)) is the reference implementation for everything below — three files plus a `package.json`, no build step.

## 1. Package layout

A game is an npm package with the VibeSense manifest at its root. Official games are named `@vibesense/game-<id>`; publish yours under your own scope (e.g. `@you/my-game`) — users install it by its full npm name. A minimal web game is four files:

```
my-game/
├── package.json          # any npm name; use your own scope, e.g. @you/my-game
├── vibesense-game.json   # the VibeSense manifest
├── index.html            # your entry page
└── game.js               # your game code
```

`package.json`:

```json
{
  "name": "@you/my-game",
  "version": "1.0.0",
  "description": "My game for VibeSense",
  "license": "Apache-2.0",
  "keywords": ["vibesense", "vibesense-game"],
  "files": ["vibesense-game.json", "index.html", "game.js"]
}
```

`vibesense-game.json`:

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

Rules: `id` is `[a-z0-9-]` and must match the npm package suffix; `entry` is the HTML file the host serves at `/games/<id>/<entry>`; `protocolVersion` is always `1`. Declare `entitlement: "free"` — `"paid"` is reserved for the upcoming marketplace and won't activate yet.

## 2. The runtime contract

Your page runs in a browser tab served by the vibesense host. Everything arrives on one SSE stream:

```js
const events = new EventSource('/events')

let running = false

events.onmessage = (e) => {
  const msg = JSON.parse(e.data)

  if (msg.type === 'state') {
    // 'playing'  → the Claude agent is executing; run your game loop.
    // 'paused'   → Claude needs the user; freeze immediately and visibly.
    running = msg.state === 'playing'
  }

  if (msg.type === 'input' && running) {
    if (msg.kind === 'axis') {
      // msg.axis: 'left_x' | 'left_y', msg.value: -1..1
      steer(msg.axis, msg.value)
    }
    if (msg.kind === 'button') {
      // msg.button: 'r2' | 'l2', msg.pressed: boolean
      if (msg.button === 'r2' && msg.pressed) fire()
    }
  }

  // Other message types ('reload', 'highlight', …) are host-internal — ignore them.
}
```

Two rules matter:

- **Respect `paused` immediately.** When the state flips to `paused`, the user's controller has switched back to driving the terminal. Your game must visibly freeze — stop the loop, dim the canvas, show why.
- **You only get the left stick and R2/L2.** Face buttons, D-pad, and the right stick always belong to the terminal and are never forwarded. Design your controls around that.

Everything must be local: the host serves only your plugin directory, so no CDN scripts or remote assets.

## 3. External games (adapters)

If your "game" is anything that isn't a web page — a Steam game, an emulator — use `kind: "external"`. Instead of an entry page, the manifest declares shell commands the host runs on state transitions:

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

Lifecycle: first transition to playing runs `start`; then `pause`/`resume` on each flip; `stop` when vibesense exits. All commands are optional and run in your plugin directory. External games read the controller themselves (Steam already does) — vibesense only tells them when to run.

## 4. Local development loop

Iterate on the game standalone first: open `index.html` directly in a browser. The `EventSource` will fail to connect — guard for that, or stub `running = true` while developing game logic.

Then test inside vibesense without publishing anything:

```sh
cd my-game
npm pack                                  # → you-my-game-1.0.0.tgz
vibesense install ./you-my-game-1.0.0.tgz
vibesense use my-game
vibesense                                 # start a session; your game runs when the agent does
```

`vibesense install` accepts any npm-installable spec — a published name, a tarball, or a plain directory path. Installed games land under `~/.vibesense/games` and shadow bundled games with the same id. Remove a test install with `vibesense uninstall my-game`.

## 5. Publishing

```sh
npm publish --access public   # scoped packages default to private
```

That's the whole release process. Users then install and activate it:

```sh
vibesense install @you/my-game    # full npm name; bare ids resolve to official @vibesense/game-<id>
vibesense use my-game
```

Discovery is npm keyword search (`npm search vibesense-game`) plus `vibesense games` for what's installed locally — keep the `vibesense-game` keyword in your `package.json`.

**Trust note for your users**: installing a game is installing an npm package, and external games run shell commands by design. Keep your package minimal and auditable — small, unminified sources get installed more.

## 6. Checklist before you publish

- [ ] Package named under your own scope, manifest `id` matches what users will `vibesense use`
- [ ] `vibesense-game.json` at the package root, `protocolVersion: 1`
- [ ] Game visibly freezes on `state: 'paused'`
- [ ] Only left stick + R2/L2 used for input
- [ ] No remote assets — everything served from the package
- [ ] Tarball round-trip tested: `npm pack` → `vibesense install ./<tarball>` → `vibesense use <id>`
