#!/usr/bin/env bash
# test-oracle-pr-workflow.sh
#
# BuddyCheck structural verification: the oracle agent must always open/
# update a PR with an acceptance-criteria mapping and embedded run artifacts.
#
# These checks target authored artifacts rather than application runtime —
# the "seams" under test are the two generated documents (the PR template and
# the oracle agent doc) that must contain specific, load-bearing content.
#
# Usage: bash tests/structural/test-oracle-pr-workflow.sh [TARGET_ROOT]
#   TARGET_ROOT defaults to `.` — the root of a repo scaffolded by
#   `npx buddycheck init`.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/structural/lib.sh
source "$HERE/lib.sh"

ROOT="$(cd "${1:-.}" && pwd)"
init_provider_conventions "$ROOT"
TEMPLATE="$ROOT/.github/pull_request_template.md"
ORACLE="$AGENT_DIR/oracle$AGENT_EXT"

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

# --- pull_request_template.md checks ---
[ -f "$TEMPLATE" ]
check "pull_request_template.md exists" $?

if [ -f "$TEMPLATE" ]; then
  grep -qi "Verdict" "$TEMPLATE"
  check "template has a Verdict section" $?

  grep -qi "Acceptance Criterion" "$TEMPLATE" && grep -qi "Affected Code" "$TEMPLATE" \
    && grep -qi "Related Tests" "$TEMPLATE" && grep -qi "Status" "$TEMPLATE"
  check "template has acceptance-criteria mapping table columns" $?

  grep -qi "Summary" "$TEMPLATE"
  check "template has a Summary section" $?

  grep -qi "Recommendations" "$TEMPLATE"
  check "template has a Recommendations section" $?

  grep -qi "progress.txt" "$TEMPLATE" && grep -q "<details>" "$TEMPLATE"
  check "template has a collapsible progress.txt section" $?

  grep -qi "oracle-run.log" "$TEMPLATE"
  check "template has a collapsible oracle run log section" $?

  [ "$(grep -c "<details>" "$TEMPLATE")" -ge 2 ]
  check "template has at least two <details> blocks" $?
fi

# --- oracle.agent.md checks ---
[ -f "$ORACLE" ]
check "oracle.agent.md exists" $?

if [ -f "$ORACLE" ]; then
  grep -qi "pull request" "$ORACLE"
  check "oracle workflow mentions opening a pull request" $?

  grep -q "gh pr create" "$ORACLE" && grep -q "gh pr edit" "$ORACLE"
  check "oracle workflow uses gh pr create and gh pr edit" $?

  grep -qi "regardless of.*verdict\|PASS/FAIL/PARTIAL\|PASS.*FAIL.*PARTIAL" "$ORACLE"
  check "oracle workflow opens PR regardless of verdict" $?

  grep -q "Refs #" "$ORACLE"
  check "oracle workflow references issue with Refs #, not Closes #" $?

  grep -qi "permalink" "$ORACLE"
  check "oracle workflow calls for GitHub permalinks (no inline code)" $?

  grep -qi "idempotent\|already exists" "$ORACLE"
  check "oracle workflow describes idempotent PR creation/update" $?

  grep -qi "\.oracle-run\.log" "$ORACLE"
  check "oracle workflow reads .oracle-run.log" $?

  grep -qi "write target" "$ORACLE"
  check "oracle Rules section documents the PR as a write target" $?

  grep -qi "do not modify.*source code\|not modify any source code" "$ORACLE"
  check "oracle Rules still disallow source code edits" $?

  grep -qi "do not modify \`task.md\`\|not modify \`task.md\`" "$ORACLE"
  check "oracle Rules still disallow task.md edits" $?

  grep -q "buddy-once" "$ORACLE"
  check "oracle doc references the buddy-once loop script" $?

  ! grep -qi "ralph" "$ORACLE"
  check "oracle doc carries no legacy ralph branding" $?
fi

# --- generated loop-script layout checks ---
LOOP="$ROOT/.buddy/buddy-once.sh"

[ -f "$LOOP" ]
check ".buddy/buddy-once.sh exists" $?

if [ -f "$LOOP" ]; then
  [ -x "$LOOP" ]
  check ".buddy/buddy-once.sh is executable" $?

  bash -n "$LOOP" >/dev/null 2>&1
  check ".buddy/buddy-once.sh is syntactically valid bash" $?
fi

for doc in domain issue-tracker sdd-workflow triage-labels; do
  [ -f "$ROOT/.buddy/docs/$doc.md" ]
  check ".buddy/docs/$doc.md exists" $?
done

if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi

exit $fail
