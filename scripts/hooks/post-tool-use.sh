#!/bin/bash
# Claude Code PostToolUse hook for VibeSense
# Reads JSON payload from stdin, extracts session_id, sends to VibeSense socket.
# Failures are non-fatal — Claude Code ignores non-zero exit from hooks.
set -euo pipefail
PAYLOAD=$(cat /dev/stdin)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id')
echo "{\"hook\":\"post_tool_use\",\"session_id\":\"$SESSION_ID\"}" | nc -w 1 -U /tmp/vibesense.sock || true
