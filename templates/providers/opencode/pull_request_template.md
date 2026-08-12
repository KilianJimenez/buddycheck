<!--
  This template is populated by the oracle agent after it reviews a coder
  branch against a GitHub issue. It is opened/updated regardless of verdict
  (PASS / FAIL / PARTIAL) so there is always a visible PR review surface.

  Affected Code / Related Tests must always be clickable GitHub permalinks
  (https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<start>-L<end>) —
  never inline code snippets.
-->

## Verdict

<!-- One of: PASS | FAIL | PARTIAL -->

**Verdict:** <PASS | FAIL | PARTIAL>

Refs #<n>

## Acceptance Criteria Mapping

| Acceptance Criterion | Affected Code | Related Tests | Status |
| --- | --- | --- | --- |
| <criterion text> | [permalink](https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<start>-L<end>) | [permalink](https://github.com/<owner>/<repo>/blob/<sha>/<path>#L<start>-L<end>) | ✅/❌/⚠️ |

## Summary

<2–4 sentences summarising the overall quality and completeness of the implementation.>

## Recommendations

<Bullet list of concrete next steps if verdict is FAIL or PARTIAL, otherwise "None".>

<details>
<summary>progress.txt</summary>

```
<full contents of progress.txt>
```

</details>

<details>
<summary>Oracle run log (.oracle-run.log)</summary>

```
<full contents of .oracle-run.log>
```

</details>
