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
where the issue sits in the SDD flow. See `docs/agents/triage-labels.md` for
this repo's general label-vocabulary conventions; `sdd:*` labels follow the
same "one label, exact string" style.

## Trigger guard: exact login + `startsWith`

To fire, a comment must satisfy **both**:

1. **Exact author match** — the comment author's login must be exactly
   `KilianJimenez` (no fuzzy matching, no org/team membership check).
2. **Prefix match** — the comment body must **start with** the command
   (`!grill`, `!to-plan`, or `!to-issues`), not merely contain it anywhere.

This combination also prevents the bot's own output comments from
re-triggering a command: the bot's comments are not authored by
`KilianJimenez`, and even if they were, they don't start with a trigger
command string.

## Required secret: `COPILOT_CLI_TOKEN`

SDD command workflows authenticate the `copilot` CLI the same way
`ralph-once.yml` does:

- Repository secret `COPILOT_CLI_TOKEN` holds a GitHub Copilot CLI auth
  token (personal access token or Copilot token).
- It is exposed to the job as the `COPILOT_GITHUB_TOKEN` environment
  variable.
- The default `GITHUB_TOKEN` is still used for `gh`/GraphQL operations
  (reading the triggering comment, posting the result comment, managing
  `sdd:*` labels, creating issues) and does not need to be set manually.
