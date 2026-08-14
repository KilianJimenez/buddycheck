#!/usr/bin/env bash
# run-against.sh
#
# Runs every BuddyCheck structural test in this directory against a target
# repository root and aggregates the results.
#
# Usage: bash tests/structural/run-against.sh [TARGET_ROOT]
#   TARGET_ROOT defaults to `.` — the root of a repo scaffolded by
#   `npx buddycheck init`.
#   Set EXPECTED_OWNER to additionally assert the exact gated login in the
#   generated workflows.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=tests/structural/lib.sh
source "$HERE/lib.sh"
TARGET="${1:-.}"

if [ ! -d "$TARGET" ]; then
  echo "run-against.sh: target root not found: $TARGET" >&2
  exit 2
fi

TARGET="$(cd "$TARGET" && pwd)"

echo "Running BuddyCheck structural tests against: $TARGET"
echo "Detected provider: $(detect_provider "$TARGET")"
if [ -n "${EXPECTED_OWNER:-}" ]; then
  echo "Expected owner login: $EXPECTED_OWNER"
fi
echo

overall=0
passed=()
failed=()

for script in "$HERE"/test-*.sh; do
  [ -f "$script" ] || continue
  name="$(basename "$script")"
  echo "=== $name ==="
  bash "$script" "$TARGET"
  status=$?
  echo
  if [ "$status" -eq 0 ]; then
    passed+=("$name")
  else
    failed+=("$name")
    overall=1
  fi
done

echo "=== Summary ==="
echo "Suites passed: ${#passed[@]}"
for name in "${passed[@]:-}"; do
  [ -n "$name" ] && echo "  PASS: $name"
done
echo "Suites failed: ${#failed[@]}"
for name in "${failed[@]:-}"; do
  [ -n "$name" ] && echo "  FAIL: $name"
done

if [ "$overall" -eq 0 ]; then
  echo "All structural suites passed."
else
  echo "Some structural suites failed."
fi

exit $overall
