#!/usr/bin/env bash
# lib.sh
#
# Shared provider-detection and convention helpers for the BuddyCheck
# structural test suite. Sourced by each test-*.sh script (and by
# run-against.sh for its summary header) so the checks can assert against the
# right on-disk shape for whichever provider scaffolded the target repo,
# instead of hard-coding Copilot-only conventions.
#
# Conventions that differ between providers:
#   - Where agent docs live and what they're named (Copilot:
#     .github/agents/<name>.agent.md; Opencode: .opencode/agent/<name>.md).
#   - The repository secret used to authenticate the provider CLI (Copilot:
#     COPILOT_CLI_TOKEN; Opencode: ANTHROPIC_API_KEY).
#   - How an agent declares its own name in frontmatter (Copilot: an explicit
#     `name: <agent>` field; Opencode: the file's basename *is* the agent
#     name, declared via a `description:` field instead).
#   - How a workflow invokes the CLI to run a named agent (Copilot: a single
#     `--agent=<name>` flag; Opencode: `opencode run --agent <name> --auto`).

# detect_provider ROOT
# Prints "opencode" or "copilot" based on the scaffolded agent-file layout.
detect_provider() {
  local root="$1"
  if [ -d "$root/.opencode/agent" ]; then
    echo "opencode"
  else
    echo "copilot"
  fi
}

# init_provider_conventions ROOT
# Sets the global PROVIDER, AGENT_DIR, AGENT_EXT and CLI_TOKEN_SECRET
# variables for the rest of the calling script to use.
# shellcheck disable=SC2034 # these globals are consumed by the sourcing script
init_provider_conventions() {
  local root="$1"
  PROVIDER="$(detect_provider "$root")"
  if [ "$PROVIDER" = "opencode" ]; then
    AGENT_DIR="$root/.opencode/agent"
    AGENT_EXT=".md"
    CLI_TOKEN_SECRET="ANTHROPIC_API_KEY"
  else
    AGENT_DIR="$root/.github/agents"
    AGENT_EXT=".agent.md"
    CLI_TOKEN_SECRET="COPILOT_CLI_TOKEN"
  fi
}

# check_agent_frontmatter_name FILE NAME
# Asserts the agent doc declares the given agent name via the provider's
# frontmatter convention. Requires init_provider_conventions to have run.
check_agent_frontmatter_name() {
  local file="$1" name="$2"
  if [ "$PROVIDER" = "opencode" ]; then
    [ "$(basename "$file" "$AGENT_EXT")" = "$name" ] && grep -q "^description:" "$file"
  else
    grep -q "^name: $name" "$file"
  fi
}

# check_agent_invocation WORKFLOW NAME
# Asserts the workflow invokes the given agent using the provider's CLI
# invocation syntax. Requires init_provider_conventions to have run.
check_agent_invocation() {
  local workflow="$1" name="$2"
  if [ "$PROVIDER" = "opencode" ]; then
    grep -q -- "--agent $name" "$workflow" && grep -q -- "--auto" "$workflow"
  else
    grep -q -- "--agent=$name" "$workflow"
  fi
}
