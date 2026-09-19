#!/bin/bash

set -euo pipefail

# BuddyCheck — one pass of the guarded agent loop (coder → oracle).
#
# Select the highest-priority open issue (label `ready-for-agent`, lowest
# issue number first — oldest first).
issue=$(gh issue list \
  --state open \
  --label ready-for-agent \
  --json number,title,body,labels \
  --jq 'sort_by(.number) | .[0]')

if [ -z "$issue" ] || [ "$issue" = "null" ]; then
  echo "No eligible issue (label 'ready-for-agent', state open). Exiting."
  exit 0
fi

number=$(echo "$issue" | jq -r '.number')
title=$(echo "$issue" | jq -r '.title')
labels=$(echo "$issue" | jq -r '[.labels[].name] | join(", ")')
body=$(echo "$issue" | jq -r '.body')

cat > task.md <<EOF
# #${number}: ${title}

**Labels:** ${labels}

${body}
EOF

touch progress.txt

# Step 1 — coder: implement the selected issue on a feature branch. The coder
# agent signals completion by creating the `.coder-done` sentinel file as its
# last action (see .opencode/agent/coder.md).
opencode run \
  --agent coder \
  --auto \
  "Follow strictly the steps of this custom agent. Do not skip any of them." \
  || echo "coder agent exited non-zero; continuing to oracle gate." >&2

# Step 2 — oracle: review the coder's work and always open/update a PR.
#
# This is invoked here as an explicit foreground step so it runs reliably in
# CI, and to avoid running as a backgrounded process that would be killed
# when the workflow job ends.
SENTINEL=".coder-done"

if [ ! -f "$SENTINEL" ]; then
  echo "No '$SENTINEL' sentinel — coder did not finish a task. Skipping oracle."
  exit 0
fi

# Consume the sentinel so oracle runs exactly once per coder completion.
rm -f "$SENTINEL"

# Run oracle in the foreground, teeing its output to .oracle-run.log so the
# agent can embed the run log in the pull request it opens/updates.
opencode run \
  --agent oracle \
  --auto \
  "Follow strictly the steps of this custom agent. Do not skip any of them." \
  2>&1 | tee .oracle-run.log
