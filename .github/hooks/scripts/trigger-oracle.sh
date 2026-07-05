#!/usr/bin/env bash
# trigger-oracle.sh
# Called by the agentStop hook. Launches the oracle agent in a new copilot
# session when the .coder-done sentinel file is present.

set -euo pipefail

SENTINEL=".coder-done"

# The hook receives a JSON payload on stdin — read but ignore it.
INPUT=$(cat)

# Only proceed if the coder sentinel exists.
if [ ! -f "$SENTINEL" ]; then
  exit 0
fi

# Remove the sentinel so oracle is only triggered once.
rm -f "$SENTINEL"

# Launch oracle as a background non-interactive copilot session.
# Output is appended to a log file in case of debugging needs.
copilot \
  --agent=oracle \
  --allow-all-tools \
  -p "@PRD.md @progress.txt Review the current branch changes against PRD.md requirements and append your oracle review to progress.txt" \
  >> .oracle-run.log 2>&1 &

echo "Oracle agent launched (PID $!)." >&2
