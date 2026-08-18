#!/usr/bin/env bash
# test-tech-debt-scout-workflow.sh
#
# BuddyCheck structural verification: the weekly tech-debt scout must trigger
# on a `schedule` cron of `0 19 * * 5` (Fri 19:00 UTC) and on manual
# `workflow_dispatch`, run a dedicated `tech-debt-scout` agent that scans the
# whole repo (source, ADRs, CONTEXT.md, READMEs), considers only
# critical/high-severity debt, picks exactly one item by a fixed type order,
# skips filing if it's already tracked under an open `tech-debt:*` issue, and
# either files exactly one issue labelled `needs-triage` + `tech-debt:<type>`
# (no `sdd:*`, not `ready-for-agent`) or prints
# "No major issues found at the moment." and exits clean.
#
# These checks target authored artifacts rather than application runtime —
# the "seams" under test are the generated workflow (trigger/permissions) and
# the tech-debt-scout agent doc, which must contain specific, load-bearing
# content. The agent's judgement (which debt is "major") is intentionally not
# asserted here — only the wiring.
#
# Usage: bash tests/structural/test-tech-debt-scout-workflow.sh [TARGET_ROOT]
#   TARGET_ROOT defaults to `.` — the root of a repo scaffolded by
#   `npx buddycheck init`.
#   Set EXPECTED_OWNER to additionally assert the exact gated login (unused
#   here since this workflow is not comment-gated, kept for parity with the
#   other structural scripts).

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/structural/lib.sh
source "$HERE/lib.sh"

ROOT="$(cd "${1:-.}" && pwd)"
init_provider_conventions "$ROOT"
WORKFLOW="$ROOT/.github/workflows/tech-debt-scout.yml"
AGENT="$AGENT_DIR/tech-debt-scout$AGENT_EXT"

fail=0

check() {
  local desc="$1"
  local result="$2"
  if [ "$result" -eq 0 ]; then
    echo "PASS: $desc"
  else
    echo "FAIL: $desc"
    fail=1
  fi
}

# --- tech-debt-scout.yml checks ---
[ -f "$WORKFLOW" ]
check "tech-debt-scout.yml exists" $?

if [ -f "$WORKFLOW" ]; then
  grep -q "schedule:" "$WORKFLOW"
  check "workflow triggers on schedule" $?

  grep -q "cron: '0 19 \* \* 5'" "$WORKFLOW"
  check "workflow schedules Fri 19:00 UTC (cron 0 19 * * 5)" $?

  grep -q "workflow_dispatch:" "$WORKFLOW"
  check "workflow triggers on workflow_dispatch" $?

  grep -q "issues: write" "$WORKFLOW"
  check "workflow requests issues: write permission" $?

  grep -q "contents: read" "$WORKFLOW"
  check "workflow requests contents: read permission" $?

  grep -q "$CLI_TOKEN_SECRET" "$WORKFLOW"
  check "workflow uses $CLI_TOKEN_SECRET secret" $?

  check_agent_invocation "$WORKFLOW" "tech-debt-scout"
  check "workflow invokes the tech-debt-scout agent" $?

  if python3 -c "import yaml" >/dev/null 2>&1; then
    python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$WORKFLOW" >/dev/null 2>&1
    check "workflow is valid YAML" $?
  else
    echo "SKIP: workflow YAML validation (python3 + PyYAML unavailable)"
  fi
fi

# --- tech-debt-scout agent doc checks ---
[ -f "$AGENT" ]
check "tech-debt-scout agent doc exists" $?

if [ -f "$AGENT" ]; then
  check_agent_frontmatter_name "$AGENT" "tech-debt-scout"
  check "agent frontmatter declares name: tech-debt-scout" $?

  grep -qi "critical" "$AGENT" && grep -qi "high.severity\|high severity" "$AGENT"
  check "agent doc restricts to critical/high severity debt" $?

  grep -qi "architectural.*code.*documentation.*devops.*process.*security\|architectural → code → documentation → devops → process → security\|architectural.*code.*document.*devops.*process.*security" "$AGENT"
  check "agent doc encodes the fixed type tie-break order" $?

  grep -qi "tech-debt:" "$AGENT"
  check "agent doc references tech-debt:<type> labels" $?

  grep -qi "needs-triage" "$AGENT"
  check "agent doc applies the needs-triage label" $?

  grep -qi "no sdd\|not.*sdd:\|does not.*sdd" "$AGENT"
  check "agent doc excludes sdd:* labels from filed issues" $?

  grep -qi "not ready-for-agent\|no.*ready-for-agent" "$AGENT"
  check "agent doc excludes ready-for-agent from filed issues" $?

  grep -qi "already tracked\|dedup\|skip filing" "$AGENT"
  check "agent doc dedups against already-tracked tech-debt issues" $?

  # The dedup query must match issues carrying ANY tech-debt:* label, not ALL
  # of them. `gh issue list --label a --label b` ANDs the flags together, so a
  # dedup command that chains multiple `--label "tech-debt:..."` flags on one
  # `gh issue list` invocation is a real idempotency bug, not just prose noise.
  ! grep -Eq '(--label "tech-debt:[^"]+"[[:space:]]+){2,}' "$AGENT"
  check "agent doc dedup query does not AND-combine multiple tech-debt: labels" $?

  grep -qi 'starting with.*tech-debt:\|starts with "tech-debt:"\|prefix.*tech-debt\|any label matching\|label.*startswith.*tech-debt' "$AGENT"
  check "agent doc dedup query explains matching ANY tech-debt: label by prefix" $?

  grep -qi "exactly one issue\|one issue per run\|hard cap" "$AGENT"
  check "agent doc caps filing at exactly one issue per run" $?

  grep -q "No major issues found at the moment." "$AGENT"
  check "agent doc prints the empty-run message" $?
fi

if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi

exit $fail
