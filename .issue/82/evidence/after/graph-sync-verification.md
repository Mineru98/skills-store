# After: issue graph sync

- `issue-graph-sync` has valid skill metadata and a concrete invocation contract.
- `issue-create` invokes it after a successful `status:open` transition.
- `issue-start` invokes it after successful `status:plan` and `status:in-process` transitions.
- `issue-end` invokes it after a successful `status:review` transition.
- `issue-merge` invokes it after a successful `status:close` transition.
- The contract skips synchronization when `.issue/graph.json` is absent and never creates or blocks a graph-enabled workflow.
- `node .codex/skills/issue-todo/scripts/issue-todo.mjs --help` accepts `sync --state all`.
- `quick_validate.py .codex/skills/issue-graph-sync` reports `Skill is valid!`.
