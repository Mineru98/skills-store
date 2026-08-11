# Issue graph V2 verification

Run from the issue #78 worktree on 2026-08-12.

```text
$ node .codex/skills/issue-todo/scripts/issue-todo.mjs sync
SYNCED=39
EDGES=5
AUTO_EDGES=5
DECISION_EDGES=0
SNAPSHOT_STATUS=complete
CYCLE=

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs validate
VALID=0
PROBLEMS=2
dangling: #73 -> #2

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs plan --json
READY_NUMBERS=
exit=2 (fail closed: dangling edge)

$ node .codex/skills/issue-todo/scripts/issue-todo.mjs next
NEXT_ISSUE=
exit=2 (fail closed: dangling edge)
```

`scripts/test-issue-graph-v2.mjs` covers deterministic digest, symmetric
`relates-to` normalization, approved duplicate provenance, snapshot fail-close,
parent hierarchy cycles, and duplicate decision bands. `scripts/test-issue-create.sh`
and `scripts/check-shared.sh` pass.

The live repository contains an existing body reference from #73 to absent #2.
V2 retains the reference and refuses scheduling instead of silently dropping it.
