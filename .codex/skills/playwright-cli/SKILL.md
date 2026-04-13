---
name: playwright-cli
description: Use when browser automation, web testing, screenshots, form filling, scraping, or page interaction is needed. Prefer Codex Playwright browser tools for navigation, clicking, typing, screenshots, tabs, and waiting. Fall back to the local `playwright-cli` command when CLI-based browser control or artifact files are specifically useful.
---

# Playwright CLI

Use this skill for browser automation tasks.

## Tool choice

Prefer Codex Playwright browser tools in this environment:

- Navigate with the browser navigation tool.
- Inspect pages with accessibility snapshots before interacting.
- Use click, type, fill, select, upload, drag, hover, keypress, wait, tab, screenshot, and evaluate tools directly.

Use the local `playwright-cli` command only when one of these is true:

- The user explicitly wants `playwright-cli`.
- A CLI artifact such as a snapshot file, PDF, video, trace, or saved browser state is part of the task.
- A shell-scriptable workflow is more efficient than repeated tool calls.

## Default workflow

1. Open or navigate the page.
2. Capture a browser snapshot and identify target refs.
3. Interact with the page using the browser tools.
4. Wait for the expected state change.
5. Capture a final snapshot or screenshot when verification matters.

## CLI fallback

If using the CLI, prefer the globally installed `playwright-cli`. If that fails, try `npx playwright-cli`.

Common commands:

```bash
playwright-cli open https://example.com
playwright-cli snapshot
playwright-cli click e3
playwright-cli fill e5 "user@example.com"
playwright-cli press Enter
playwright-cli screenshot --filename=page.png
playwright-cli close
```

## Notes

- Snapshot refs such as `e3` are session-specific. Refresh them after navigation or major DOM changes.
- Prefer snapshots over screenshots for interaction planning.
- Close sessions you no longer need.

## References

Read only the specific reference file needed for the task:

- `references/session-management.md` for named sessions and persistent profiles.
- `references/storage-state.md` for cookies and storage state workflows.
- `references/request-mocking.md` for routing and mock responses.
- `references/running-code.md` for advanced Playwright code execution.
- `references/tracing.md` for traces.
- `references/video-recording.md` for video capture.
- `references/test-generation.md` for generating tests from browser flows.
