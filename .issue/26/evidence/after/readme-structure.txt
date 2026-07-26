Issue #26 after evidence

Implementation commit: 3b24068
Changed implementation files: README.md only

Detailed guide order after implementation:
- 1. issue-create (line 50)
- 2. issue-start (line 277)
- 3. issue-end (line 421)
- 4. issue-merge (line 495)
- 5. visual-companion (line 555)

Installation and workflow coverage:
- A copy-ready Codex installation prompt starts at line 71.
- A copy-ready Claude Code installation prompt starts at line 98.
- Both prompts include issue-create, issue-start, issue-end, issue-merge.
- Both prompts include issue-verifier, issue-merge-analyst, issue-merge-critic.
- Home and project installation choices are documented.
- git, Node 18+, curl, gh, frontend capture tools, GitHub/Jira behavior, and gh-setup fallback are documented.
- Single-issue and multi-worktree flows are documented.

Consistency corrections made while comparing current skills:
- `nested` worktree layout was replaced with `children`.
- issue-start provider collection now covers GitHub and Jira.
- evidence branch fallback is documented.
- issue-end no longer recommends an automatic `Closes #N` keyword.
- status transitions and per-PR merge approval match current skill rules.

Validation:
- git diff --check: PASS
- GitHub Markdown render API: PASS (79,802 bytes of HTML)
- numbered summaries: 1 through 17 in order
- details tags: 24 open / 24 close
- Markdown fences: 158 (balanced)
- referenced skill and agent paths: all present
- implementation scope: README.md only

Evidence type:
- Text evidence is used because this issue changes documentation only. Browser images and bounding boxes would not prove the Markdown structure or prompt contents more reliably.
