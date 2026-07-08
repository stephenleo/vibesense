# VibeSense

**Drive Claude Code with a game controller — and play retro games while the agent works.**

```sh
npm install -g vibesense
```

VibeSense wraps the `claude` CLI in a pty and hands your game controller both jobs:

- **Agent waiting on you?** The controller drives the terminal — D-pad picks options, A/✕ accepts, Y/△ triggers voice input.
- **Agent executing?** A retro game auto-starts in a browser tab. The moment Claude needs you, the game freezes and the controller flips back to the terminal.
- **Games are plugins.** Seven retro games ship built in; anyone can publish more as npm packages.

Requires Node ≥ 22 and a controller (Xbox / DualSense / generic HID). macOS-first.

## Build a game

Games are tiny npm packages — a manifest, an HTML page, no build step.

- [Building a VibeSense game](building-a-game.html) — step-by-step tutorial, empty directory to published package
- [Plugin contract reference](plugin-contract.html) — the manifest and runtime contract, protocol v1

## Links

- [npm package](https://www.npmjs.com/package/vibesense)
- [GitHub](https://github.com/stephenleo/vibesense)
