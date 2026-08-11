# Issue graph V2 verification

Run from the issue #78 worktree on 2026-08-12.

```text
$ node .codex/skills/issue-todo/scripts/issue-todo.mjs sync
SYNCED=40
EDGES=5
AUTO_EDGES=5
DECISION_EDGES=0
RESOLVED_REFERENCES=1
UNRESOLVED_REFERENCES=
SNAPSHOT_STATUS=complete
CYCLE=

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs validate
VALID=1
PROBLEMS=0

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs plan --json
ready=[3]
inProgress=[78]

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs next
NEXT_ISSUE=3
```

`scripts/test-issue-graph-v2.mjs` covers deterministic digest, symmetric
`relates-to` normalization, approved duplicate provenance, snapshot fail-close,
parent hierarchy cycles, and duplicate decision bands. `scripts/test-issue-create.sh`
and `scripts/check-shared.sh` pass.

The live repository's #73 references #2, which is a merged pull request excluded from
`gh issue list`. V2 resolves that GitHub item individually, records its provenance, and
uses its merged state as a closed prerequisite.
