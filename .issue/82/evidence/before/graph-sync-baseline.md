# Before: issue graph sync

- `.codex/skills/issue-graph-sync/` does not exist.
- `issue-create`, `issue-start`, `issue-end`, and `issue-merge` do not name or invoke a shared graph-sync skill.
- `.issue/graph.json` is absent, so an optional graph synchronization must not create or block an existing workflow.
- `issue-todo` V2 defines GitHub as the graph source of truth and `.issue/graph.json` as a regenerated cache.
