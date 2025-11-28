#!/bin/bash
# Log agent tool activity with timestamp
# Usage: log-activity.sh <agent-name>

AGENT_NAME="${1:-unknown}"

# Read the hook event from stdin
read -r HOOK_EVENT

# Extract cwd and tool name from hook event
CWD=$(echo "$HOOK_EVENT" | grep -o '"cwd":"[^"]*"' | cut -d'"' -f4)
TOOL_NAME=$(echo "$HOOK_EVENT" | grep -o '"tool_name":"[^"]*"' | cut -d'"' -f4)

LOG_FILE="$CWD/.kiro/logs/activity-log"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append to log
echo "$TIMESTAMP|$AGENT_NAME|$TOOL_NAME" >> "$LOG_FILE"
