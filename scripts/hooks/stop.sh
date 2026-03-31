#!/bin/bash
# Claude Code Stop hook for VibeSense
PAYLOAD=$(cat /dev/stdin)
SESSION_ID=$(echo "$PAYLOAD" | jq -r '.session_id')
echo "{\"hook\":\"stop\",\"session_id\":\"$SESSION_ID\"}" | nc -U /tmp/vibesense.sock
