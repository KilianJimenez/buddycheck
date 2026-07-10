#!/bin/bash

set -euo pipefail

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

copilot \
  --agent=coder \
  --allow-all-tools \
  -p "@task.md @progress.txt 1. Read the task and progress file. 2. Implement the task. 3. Commit your changes. 4. Update progress.txt with what you did. ONLY DO ONE TASK AT A TIME."
