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

Paired verification command:

```bash
git show 3b24068:README.md | rg -n '^<summary><strong>(1|2|3|4|5|14|15|16|17)\\.'
git show 3b24068:README.md | rg -n 'Codex용 설치 프롬프트|Claude Code용 설치 프롬프트|agents   issue-verifier|홈 설치:|프로젝트 설치:|공통 전제와 이슈 백엔드|권장 사용 흐름|단일 작업은|여러 작업은'
git show 3b24068:README.md | rg -c '^<details(?: open)?>$'
git show 3b24068:README.md | rg -c '^</details>$'
git show 3b24068:README.md | rg -c '^```'
```

Paired command result after implementation:

```text
50:1. issue-create
277:2. issue-start
421:3. issue-end
495:4. issue-merge
555:5. visual-companion

Installation/workflow coverage matches: 9
details_open=24
details_close=24
fences=158
```

Issue completion criteria:

- PASS — 빠른 사용 순서에서 issue 워크플로가 visual-companion보다 먼저 나온다.
- PASS — 상세 가이드 1~4번이 네 issue 스킬이고 visual-companion은 5번이다.
- PASS — Codex와 Claude Code용 복사 가능한 설치 프롬프트가 각각 코드 블록에 있다.
- PASS — 두 런타임의 설치 대상 경로가 구분되어 있다.
- PASS — issue-verifier, issue-merge-analyst, issue-merge-critic이 설치 대상에 포함된다.
- PASS — 홈 설치와 프로젝트 설치의 경로와 선택 기준이 설명되어 있다.
- PASS — 네 스킬의 역할과 create → start → end → merge 순서가 설명되어 있다.
- PASS — 단일 작업과 여러 워크트리 사용 예시가 포함된다.
- PASS — 현재 SKILL.md와 대조해 provider, children 배치, 증거 fallback, 상태 전환, PR·merge 설명을 보정했다.
- PASS — 번호가 있는 상세 가이드가 1~17 순서로 이어진다.
- PASS — GitHub Markdown render API와 details·코드 펜스 구조 검사를 통과했다.
- PASS — 구현 커밋 3b24068의 변경 파일은 README.md 하나뿐이다.
