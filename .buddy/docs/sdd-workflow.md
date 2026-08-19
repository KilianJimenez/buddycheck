# Spec-Driven Development (SDD) Workflow

A comment-driven workflow for shaping an idea into a plan and then into
buildable issues, all on the same GitHub issue thread.

## The three trigger commands

Each command is a comment on an idea/spec issue. Each produces its output as
a new, async comment on that same issue (posted by the bot once the run
finishes) — it does not edit the issue body or close/open issues itself.

| Command      | What it produces                                              |
| ------------ | -------------------------------------------------------------- |
| `!grill`     | A grilling pass on the idea: clarifying questions, sharpened scope, open assumptions surfaced as a comment. |
| `!to-plan`   | A plan comment: a concrete plan plus a set of suggested follow-up issues (not yet created). |
| `!to-issues` | The suggested issues from the plan are actually created as separate GitHub issues; a comment links them from the original thread. |

## Label flow: exactly one `sdd:` state

The idea/spec issue carries **exactly one** `sdd:` status label at a time,
tracking where it sits in the flow:

| Label                 | Meaning                                              | Set when             |
| ---------------------- | ----------------------------------------------------- | --------------------- |
| `sdd:grilling`         | Idea is being grilled/shaped                          | `!grill` is active     |
| `sdd:planned`          | Plan + suggested issues have been drafted             | `!to-plan` has run     |
| `sdd:issues-created`   | Slice issues have been created from the plan          | `!to-issues` has run   |

When a later stage's label is applied, remove the previous stage's `sdd:`
label so only one is present — the label is the at-a-glance indicator of
where the issue sits in the SDD flow. See `.buddy/docs/triage-labels.md` for
this repo's general label-vocabulary conventions; `sdd:*` labels follow the
same "one label, exact string" style.

## A single entrypoint: `sdd-conductor.yml`

`.github/workflows/sdd-conductor.yml` is the **sole** `issue_comment`
listener for all three SDD commands. It does not implement any command
itself; instead its `router` job inspects the triggering comment and, based
on the first matching prefix, invokes exactly one of three reusable
(`workflow_call`) workflows via `uses:`:

| Prefix       | Reusable workflow invoked |
| ------------ | -------------------------- |
| `!grill`     | `.github/workflows/grill.yml`     |
| `!to-plan`   | `.github/workflows/to-plan.yml`   |
| `!to-issues` | `.github/workflows/to-issues.yml` |

`grill.yml`, `to-plan.yml`, and `to-issues.yml` are **`workflow_call`-only**:
they declare `on: workflow_call` and have no `issue_comment` trigger of their
own, so they cannot run from a direct comment — they only run when called by
the conductor. If a comment's author or prefix doesn't match anything (see
the guard below), no job's `if` condition is satisfied and the run is a
**silent no-op**: no jobs execute, no comment is posted, no label changes.
This also covers unrecognized `!`-prefixes (e.g. a typo like `!gril` or an
unrelated `!` comment) — they simply don't match any `startsWith` check and
nothing happens.

## Trigger guard: exact login + `startsWith`

The exact-author + prefix guard lives **solely** in the conductor's `router`
job — the three reusable workflows have no guard of their own and trust the
conductor to have already checked it. To fire, a comment must satisfy
**both**:

1. **Exact author match** — the comment author's login must be exactly
   `KilianJimenez` (no fuzzy matching, no org/team membership check).
2. **Prefix match** — the comment body must **start with** the command
   (`!grill`, `!to-plan`, or `!to-issues`), not merely contain it anywhere.

This combination also prevents the bot's own output comments from
re-triggering a command: the bot's comments are not authored by
`KilianJimenez`, and even if they were, they don't start with a trigger
command string.

Once the `router` job determines which command matched, it passes the
triggering issue's number (`github.event.issue.number`) to the selected
reusable workflow as its `issue_number` input; the reusable workflow's
`workflow_call` block accepts no other way of learning which issue to
operate on.

## Required secrets: `COPILOT_CLI_TOKEN` and `GH_PAT`

SDD command workflows authenticate the same way `buddy-once.yml` does. The
conductor forwards both secrets to whichever reusable workflow it calls; the
reusable workflows do not read secrets directly from repository settings.

- Repository secret `COPILOT_CLI_TOKEN` holds a GitHub Copilot CLI auth
  token (personal access token or Copilot token). It is threaded from the
  conductor to the callee's `secrets:` block and exposed to the job as the
  `COPILOT_GITHUB_TOKEN` environment variable.
- Repository secret `GH_PAT` holds a classic Personal Access Token with
  `repo` + `workflow` scopes. It is threaded the same way and used for
  `gh`/GraphQL operations (reading the triggering comment, posting the
  result comment, managing `sdd:*` labels, creating issues) that the
  default `GITHUB_TOKEN` can't perform.
