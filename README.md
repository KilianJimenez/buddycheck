# BuddyCheck

BuddyCheck bootstraps a guardrailed AI agent loop and a spec-driven development
(SDD) pipeline into any GitHub repository. Instead of pointing an agent at your
codebase and hoping, you get two cooperating agents with clearly separated
write permissions — a **coder** that implements one issue at a time on its own
branch, and an **oracle** that independently reviews the result, maps it back to
the issue's acceptance criteria and opens a pull request with its verdict — plus
a comment-driven SDD pipeline (`!grill` → `!to-plan` → `!to-issues`) that turns
a rough idea in an issue into a set of reviewed, implementable vertical-slice
issues. Everything runs on GitHub Actions through the GitHub Copilot CLI, and
`npx buddycheck init` scaffolds the whole thing in one guided pass.

## Install

```bash
npm i -D buddycheck
```

## Usage

```bash
npx buddycheck init
```

The guided flow walks through four steps:

1. **Provider** — which agent runtime executes the agents (GitHub Copilot CLI today).
2. **Issue tracker** — where issues and labels live (GitHub today).
3. **Detection** — finds your git repo, GitHub login and `owner/repo` slug (via
   `gh`, falling back to the `origin` remote, falling back to prompting you).
   BuddyCheck can `git init` for you if you are not in a repo yet.
4. **Scaffold** — writes the files below, appends a managed `.gitignore` block,
   creates the labels, and generates `.buddy/SETUP.md` with the remaining
   manual steps.

Existing files are never silently clobbered: identical files are skipped, and
differing files prompt per file (or use `--force` to overwrite everything).
Re-running `init` on the same repo is idempotent.

## What `init` creates

```
.buddy/
├── buddy-once.sh                  # the agent loop driver (executable)
├── docs/
│   ├── domain.md                  # your project's domain notes (edit this)
│   ├── issue-tracker.md           # issue/label conventions
│   ├── sdd-workflow.md            # the !grill/!to-plan/!to-issues contract
│   └── triage-labels.md           # what each triage label means
└── SETUP.md                       # generated: secrets, settings, checklist
AGENTS.md                          # repo-level agent instructions
.github/
├── agents/
│   ├── coder.agent.md
│   ├── oracle.agent.md
│   ├── grill-my-idea.agent.md
│   ├── spec-planner.agent.md
│   └── spec-to-issues.agent.md
├── workflows/
│   ├── buddy-once.yml             # "Buddy - Once" (workflow_dispatch)
│   ├── grill.yml                  # !grill
│   ├── to-plan.yml                # !to-plan
│   └── to-issues.yml              # !to-issues
└── pull_request_template.md       # the oracle's PR report format
.gitignore                         # managed block for agent runtime files
                                   # (.coder-done, .oracle-run.log, task.md, progress.txt)
```

And eight labels in the tracker:

| Label | Purpose |
| --- | --- |
| `needs-triage` | Freshly filed, not yet assessed |
| `needs-info` | Blocked on a human answer |
| `ready-for-agent` | Specified well enough for the coder agent to pick up |
| `ready-for-human` | Needs a human to implement |
| `wontfix` | Closed as out of scope |
| `sdd:grilling` | Idea is being grilled into shape |
| `sdd:planned` | Plan + suggested issues posted, awaiting approval |
| `sdd:issues-created` | Approved plan split into implementation issues |

## How it works

### The agent loop

1. You label an issue `ready-for-agent`.
2. You run the **Buddy - Once** workflow (`workflow_dispatch`), or run
   `bash .buddy/buddy-once.sh` locally.
3. The **coder** agent picks up the issue, creates a `feat/` branch, implements
   it test-first, records progress in `progress.txt`, and signals completion by
   writing `.coder-done`.
4. The **oracle** agent then reviews the work independently — it may not touch
   source code or `task.md`. It maps every acceptance criterion to the affected
   code (via permalinks) and the tests covering it, reaches a
   PASS / PARTIAL / FAIL verdict, comments it on the issue, and opens or updates
   a pull request using the generated PR template with the run artifacts
   (`progress.txt`, `.oracle-run.log`) embedded in collapsible sections.

The PR references the issue with `Refs #n` rather than `Closes #n` — merging is
always a human decision.

### SDD commands on an issue thread

Comment on any issue to move an idea down the pipeline:

| Comment | Agent | Effect | Label after |
| --- | --- | --- | --- |
| `!grill` | `grill-my-idea` | One round of relentless clarifying questions; repeat as needed | `sdd:grilling` |
| `!to-plan` | `spec-planner` | Posts one comment with a plan + suggested issues; creates nothing | `sdd:planned` |
| `!to-issues` | `spec-to-issues` | Creates the vertical-slice issues (`Part of #n`, labeled `ready-for-agent`) and posts a summary | `sdd:issues-created` |

Exactly one `sdd:*` label is present at a time — each command removes the
others. Every agent-authored comment is prefixed with an AI-generated
disclaimer. Commands are **only honored from the owner login you configured
during `init`**; comments from anyone else are ignored by the workflow gate.

## Setup requirements

After `init`, finish the steps in the generated `.buddy/SETUP.md`. In short:

- **Repository secrets**
  - `COPILOT_CLI_TOKEN` — authenticates the GitHub Copilot CLI non-interactively.
  - `GH_PAT` — a classic PAT with `repo` + `workflow` scopes, used by the loop
    to push branches (the default `GITHUB_TOKEN` cannot push workflow files).
- **Repository settings** — Settings → Actions → General: set workflow
  permissions to **Read and write**, and allow GitHub Actions to **create and
  approve pull requests**.
- Fill in `.buddy/docs/domain.md` with your project's context.

## Non-interactive flags

For CI and power users, `init` can run without prompts:

| Flag | Meaning |
| --- | --- |
| `--yes` | Accept all defaults, never prompt |
| `--owner <login>` | Set the gated owner login explicitly |
| `--repo <owner/name>` | Set the repository slug explicitly |
| `--no-labels` | Skip label creation |
| `--force` | Overwrite existing files instead of prompting |
| `--dry-run` | Report what would be written, change nothing |
| `--help`, `--version` | Usage and version |

```bash
npx buddycheck init --yes --owner myuser --repo myuser/myrepo --no-labels
```

## Roadmap

- **Providers** — GitHub Copilot CLI today; additional agent runtimes (e.g.
  Claude Code, with agents mapped to `.claude/agents/`) planned behind the same
  provider interface.
- **Issue trackers** — GitHub today; the tracker interface
  (`detectUser` / `detectRepoSlug` / `ensureRepo` / `createLabels`) is designed
  to accommodate others later.

## Development

```bash
npm ci
npm run build   # tsup → dist/
npm test        # vitest unit tests
npm run lint    # tsc --noEmit
```

`templates/` is the single source of truth for everything `init` writes; the
live `.buddy/` and `.github/` files in this repo are **dogfooded output** —
regenerated by running the freshly built CLI against this repo:

```bash
npm run build && node dist/index.js init
```

Structural tests verify a scaffolded repo's generated layout and can be run
against any target root:

```bash
EXPECTED_OWNER=myuser bash tests/structural/run-against.sh /path/to/repo
```

## Windows

The agent loop driver (`.buddy/buddy-once.sh`) and the structural tests are
bash scripts. On Windows, run them under **Git Bash** or **WSL**. The GitHub
Actions workflows run on `ubuntu-latest` and are unaffected.

## License

MIT
