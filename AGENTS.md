## Agent conventions

### Issue tracker

Issues live in GitHub Issues (`KilianJimenez/buddycheck`); external PRs are not a triage surface. See `.buddy/docs/issue-tracker.md`.

### Triage labels

Default label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `.buddy/docs/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the repo root. See `.buddy/docs/domain.md`.

### Spec-Driven Development (SDD)

Comment-driven workflow (`!grill`, `!to-plan`, `!to-issues`) with `sdd:grilling` / `sdd:planned` / `sdd:issues-created` status labels. See `.buddy/docs/sdd-workflow.md`.

### The BuddyCheck loop

`.buddy/buddy-once.sh` picks the highest-priority `ready-for-agent` issue, hands it to the `coder` agent, then gates the `oracle` agent on the `.coder-done` sentinel. The oracle always opens or updates a pull request for the branch.
