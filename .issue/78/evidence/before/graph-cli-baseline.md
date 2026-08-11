# #78 before — V1 graph CLI baseline

Command: `node .codex/skills/issue-todo/scripts/issue-todo.mjs validate`

```text
VALID=1
PROBLEMS=0
```

Command: `node .codex/skills/issue-todo/scripts/issue-todo.mjs plan --json`

```text
그래프가 비어 있다. 먼저 `sync` 를 실행하라.
READY_NUMBERS=
```

Observed implementation boundary:

- `GRAPH_VERSION` is `1`.
- `blocks` participates in ordering with `depends-on`.
- nodes do not retain issue-body provenance, semantic fields, or decision records.
