# issue-end sync-base CLI verification

## Before

`node .codex/skills/issue-end/scripts/issue-end.mjs sync-base` exited with usage text because the command was absent from the CLI dispatcher.

## After

The command exits successfully and reports the main checkout update as JSON:

```json
{
  "ok": true,
  "base": "main",
  "branch": "main",
  "received": 1
}
```

`node --check .codex/skills/issue-end/scripts/issue-end.mjs` also succeeds.
