# vibeSense.notify() API Reference

Send a JSON payload to the VibeSense Unix socket to trigger hardware feedback
on your connected DualSense controller.

## Endpoint

```
/tmp/vibesense.sock
```

## Payload Schema

```json
{
  "event": "string (required)",
  "haptic": "single_pulse | double_pulse | triple_pulse | slow_rumble | none (optional)",
  "led": { "color": "#rrggbb" },
  "audio": "success | warning | error | none (optional)",
  "priority": "low | normal | high (default: normal)"
}
```

## Quick Start

```bash
echo '{"event":"deploy_success","haptic":"triple_pulse","led":{"color":"#00ff00"},"audio":"success","priority":"high"}' | nc -U /tmp/vibesense.sock
```

## Field Reference

### `event` (required, string)
A label for the event. Used in VibeSense extension logs. Has no effect on hardware routing.

### `haptic` (optional)
Haptic pattern to fire on the DualSense:
- `single_pulse` — brief single tap
- `double_pulse` — two quick taps
- `triple_pulse` — three quick taps
- `slow_rumble` — sustained low rumble
- `none` — no haptic output

### `led` (optional)
LED/lightbar color: `{ "color": "#rrggbb" }`. Must be a valid 6-digit hex color.

### `audio` (optional)
Audio tone via DualSense speaker:
- `success` — positive completion sound
- `warning` — attention alert
- `error` — error sound
- `none` — no audio output

### `priority` (optional, default: `normal`)
Reserved for Do Not Disturb mode (Story 6.5). Currently all priorities execute.

## Error Handling

Invalid payloads are rejected and logged in the VibeSense output channel. No partial execution occurs — either all valid fields execute, or none do.
