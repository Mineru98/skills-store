Issue #26 before evidence

Document: README.md
Captured before implementation on docs/26-readme-issue-workflow-guide.

Current introduction:
- The first recommended skill is visual-companion.
- The issue workflow appears as item 10 in the quick-use list.

Current detailed-guide order:
- 1. visual-companion (line 50 before implementation)
- 14. issue-create (line 592 before implementation)
- 15. issue-start (line 725 before implementation)
- 16. issue-end (line 869 before implementation)
- 17. issue-merge (line 943 before implementation)

Existing related content:
- issue-verifier is described inside issue-create.
- issue-merge-analyst and issue-merge-critic are described inside issue-merge.
- Common prerequisites and GitHub/Jira behavior are described in lower sections.

Missing or failing criteria:
- The issue workflow does not precede visual-companion.
- There is no single copy-ready AI prompt that installs all four issue skills and all three required agents.
- Installation location choices are not presented together with that prompt.

Evidence type:
- Text evidence is used because this issue changes documentation only; a browser screenshot or performance measurement would not prove the requested Markdown content more reliably.

Paired verification command:

```bash
git show 3b24068^:README.md | rg -n '^<summary><strong>(1|2|3|4|5|14|15|16|17)\\.'
git show 3b24068^:README.md | rg -n 'Codex용 설치 프롬프트|Claude Code용 설치 프롬프트|agents   issue-verifier|홈 설치:|프로젝트 설치:|공통 전제와 이슈 백엔드|권장 사용 흐름|단일 작업은|여러 작업은'
git show 3b24068^:README.md | rg -c '^<details(?: open)?>$'
git show 3b24068^:README.md | rg -c '^</details>$'
git show 3b24068^:README.md | rg -c '^```'
```

Paired command result before implementation:

```text
50:1. visual-companion
101:2. kill-process
136:3. install-skill
175:4. migrate-skill-agent
220:5. irasutoya-search
592:14. issue-create
725:15. issue-start
869:16. issue-end
943:17. issue-merge

Installation/workflow coverage matches: 0
details_open=24
details_close=24
fences=150
```
