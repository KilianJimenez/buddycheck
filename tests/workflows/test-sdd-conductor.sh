#!/usr/bin/env bash
# test-sdd-conductor.sh
#
# Verifies the SDD conductor scaffold (issue #45): a single `sdd-conductor.yml`
# workflow is the sole `issue_comment` entrypoint for `!grill` / `!to-plan` /
# `!to-issues`, its `router` job computes a `command` output from the first
# matching prefix, and `grill.yml` has been converted to a `workflow_call`-only
# reusable workflow invoked by the conductor's `grill` job.
#
# Also verifies issue #46: `to-plan.yml` has likewise been converted to a
# `workflow_call`-only reusable workflow, and the conductor gains a `to-plan`
# job that `uses:` it, gated on the router's `to-plan` command output.
#
# These are the repository's *own* dogfooded automation workflows (not the
# scaffolding templates under templates/, which are covered by
# tests/structural/ instead). GitHub Actions provides no unit-test harness for
# workflow YAML, so the practical seam is static structural checks + YAML
# validity here, plus `actionlint` and one live end-to-end comment trigger
# (tracked outside this repo's automated test run — see issue #36's planning
# comment).
#
# Usage: bash tests/workflows/test-sdd-conductor.sh [REPO_ROOT]
#   REPO_ROOT defaults to the repository root (two levels up from this script).

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${1:-$HERE/../..}" && pwd)"

CONDUCTOR="$ROOT/.github/workflows/sdd-conductor.yml"
GRILL="$ROOT/.github/workflows/grill.yml"
TO_PLAN="$ROOT/.github/workflows/to-plan.yml"

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

validate_yaml() {
  local file="$1"
  if python3 -c "import yaml" >/dev/null 2>&1; then
    python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" "$file" >/dev/null 2>&1
    check "$(basename "$file") is valid YAML" $?
  else
    echo "SKIP: $(basename "$file") YAML validation (python3 + PyYAML unavailable)"
  fi
}

# --- sdd-conductor.yml checks ---
[ -f "$CONDUCTOR" ]
check "sdd-conductor.yml exists" $?

if [ -f "$CONDUCTOR" ]; then
  grep -q "issue_comment:" "$CONDUCTOR"
  check "conductor triggers on issue_comment" $?

  grep -q "types: \[created\]" "$CONDUCTOR"
  check "conductor triggers on comment creation" $?

  grep -q "issues: write" "$CONDUCTOR"
  check "conductor requests issues: write permission" $?

  grep -q "contents: read" "$CONDUCTOR"
  check "conductor requests contents: read permission" $?

  grep -q "router:" "$CONDUCTOR"
  check "conductor defines a router job" $?

  grep -q "github.event.comment.user.login == 'KilianJimenez'" "$CONDUCTOR"
  check "router gates on the exact author login" $?

  grep -q "startsWith(github.event.comment.body, '!grill')" "$CONDUCTOR"
  check "router gates on startsWith('!grill')" $?

  grep -q "startsWith(github.event.comment.body, '!to-plan')" "$CONDUCTOR"
  check "router gates on startsWith('!to-plan')" $?

  grep -q "startsWith(github.event.comment.body, '!to-issues')" "$CONDUCTOR"
  check "router gates on startsWith('!to-issues')" $?

  grep -q "outputs:" "$CONDUCTOR"
  check "router job declares job-level outputs" $?

  grep -Eq 'command: \$\{\{ steps\.[A-Za-z0-9_-]+\.outputs\.command \}\}' "$CONDUCTOR"
  check "router job's command output is wired from a step output" $?

  grep -q "uses: ./.github/workflows/grill.yml" "$CONDUCTOR"
  check "conductor's grill job uses the reusable grill workflow" $?

  grep -q "needs.router.outputs.command == 'grill'" "$CONDUCTOR"
  check "conductor's grill job is gated on the router's command output" $?

  grep -q "issue_number:" "$CONDUCTOR"
  check "conductor passes issue_number to the grill job" $?

  grep -q "COPILOT_CLI_TOKEN:" "$CONDUCTOR"
  check "conductor maps the COPILOT_CLI_TOKEN secret to the grill job" $?

  grep -q "uses: ./.github/workflows/to-plan.yml" "$CONDUCTOR"
  check "conductor's to-plan job uses the reusable to-plan workflow" $?

  grep -q "needs.router.outputs.command == 'to-plan'" "$CONDUCTOR"
  check "conductor's to-plan job is gated on the router's command output" $?

  validate_yaml "$CONDUCTOR"
fi

# --- grill.yml conversion checks ---
[ -f "$GRILL" ]
check "grill.yml still exists" $?

if [ -f "$GRILL" ]; then
  grep -q "workflow_call:" "$GRILL"
  check "grill.yml triggers on workflow_call" $?

  ! grep -q "issue_comment:" "$GRILL"
  check "grill.yml no longer triggers on issue_comment" $?

  grep -q "issue_number:" "$GRILL"
  check "grill.yml declares an issue_number input" $?

  grep -q "required: true" "$GRILL"
  check "grill.yml's issue_number input is required" $?

  grep -q "COPILOT_CLI_TOKEN:" "$GRILL"
  check "grill.yml declares a required COPILOT_CLI_TOKEN secret" $?

  ! grep -q "github.event.comment.user.login == 'KilianJimenez'" "$GRILL"
  check "grill.yml's job-level author/prefix guard is removed" $?

  ! grep -q "startsWith(github.event.comment.body" "$GRILL"
  check "grill.yml no longer checks the comment body prefix" $?

  grep -q "issues: write" "$GRILL"
  check "grill.yml keeps issues: write permission" $?

  grep -q "contents: read" "$GRILL"
  check "grill.yml keeps contents: read permission" $?

  grep -q 'COPILOT_GITHUB_TOKEN: \${{ secrets.COPILOT_CLI_TOKEN }}' "$GRILL"
  check "grill.yml keeps the COPILOT_GITHUB_TOKEN secret mapping" $?

  grep -q "inputs.issue_number" "$GRILL"
  check "grill.yml reads inputs.issue_number instead of the event context" $?

  ! grep -q "github.event.issue.number" "$GRILL"
  check "grill.yml no longer reads github.event.issue.number" $?

  validate_yaml "$GRILL"
fi

# --- to-plan.yml conversion checks ---
[ -f "$TO_PLAN" ]
check "to-plan.yml still exists" $?

if [ -f "$TO_PLAN" ]; then
  grep -q "workflow_call:" "$TO_PLAN"
  check "to-plan.yml triggers on workflow_call" $?

  ! grep -q "issue_comment:" "$TO_PLAN"
  check "to-plan.yml no longer triggers on issue_comment" $?

  grep -q "issue_number:" "$TO_PLAN"
  check "to-plan.yml declares an issue_number input" $?

  grep -q "required: true" "$TO_PLAN"
  check "to-plan.yml's issue_number input is required" $?

  grep -q "COPILOT_CLI_TOKEN:" "$TO_PLAN"
  check "to-plan.yml declares a required COPILOT_CLI_TOKEN secret" $?

  ! grep -q "github.event.comment.user.login == 'KilianJimenez'" "$TO_PLAN"
  check "to-plan.yml's job-level author/prefix guard is removed" $?

  ! grep -q "startsWith(github.event.comment.body" "$TO_PLAN"
  check "to-plan.yml no longer checks the comment body prefix" $?

  grep -q "issues: write" "$TO_PLAN"
  check "to-plan.yml keeps issues: write permission" $?

  grep -q "contents: read" "$TO_PLAN"
  check "to-plan.yml keeps contents: read permission" $?

  grep -q 'COPILOT_GITHUB_TOKEN: \${{ secrets.COPILOT_CLI_TOKEN }}' "$TO_PLAN"
  check "to-plan.yml keeps the COPILOT_GITHUB_TOKEN secret mapping" $?

  grep -q "inputs.issue_number" "$TO_PLAN"
  check "to-plan.yml reads inputs.issue_number instead of the event context" $?

  ! grep -q "github.event.issue.number" "$TO_PLAN"
  check "to-plan.yml no longer reads github.event.issue.number" $?

  validate_yaml "$TO_PLAN"
fi

if [ "$fail" -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
fi

exit $fail
