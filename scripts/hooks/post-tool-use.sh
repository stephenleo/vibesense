#!/bin/bash
# Claude Code PostToolUse hook for VibeSense
PAYLOAD=$(cat /dev/stdin)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id')
echo "{\"hook\":\"post_tool_use\",\"session_id\":\"$SESSION_ID\"}" | nc -U /tmp/vibesense.sock
