---
name: vibesense-notify
description: Demonstrate VibeSense hardware feedback for deployment events
---

This skill demonstrates how to use the `vibeSense.notify()` API to trigger VibeSense hardware feedback from Claude Code.

## Usage

After a deployment command, call:

```bash
# Deploy success — triple haptic pulse, green LED, success audio
echo '{"event":"deploy_success","haptic":"triple_pulse","led":{"color":"#00ff00"},"audio":"success","priority":"high"}' | nc -U /tmp/vibesense.sock

# Deploy failure — double haptic pulse, red LED, error audio
echo '{"event":"deploy_failure","haptic":"double_pulse","led":{"color":"#ff0000"},"audio":"error","priority":"high"}' | nc -U /tmp/vibesense.sock
```

## API Reference

Write a JSON payload to the VibeSense socket at `/tmp/vibesense.sock`:

| Field | Type | Required | Values |
|-------|------|----------|--------|
| `event` | string | **Yes** | Any string (label for logging) |
| `haptic` | string | No | `single_pulse`, `double_pulse`, `triple_pulse`, `slow_rumble`, `none` |
| `led` | object | No | `{"color": "#rrggbb"}` — 6-digit hex color |
| `audio` | string | No | `success`, `warning`, `error`, `none` |
| `priority` | string | No | `low`, `normal` (default), `high` |

## Example in a Claude Code skill

```bash
echo '{"event":"task_complete","haptic":"single_pulse","audio":"success"}' | nc -U /tmp/vibesense.sock
```
