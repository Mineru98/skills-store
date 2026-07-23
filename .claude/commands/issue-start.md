---
description: GitHub 이슈를 이미지까지 분석하고 개선 계획 수립 후 이슈 번호 기반 워크트리를 생성
model: opus
argument-hint: "#<이슈번호> [추가 지시]"
---

`$ARGUMENTS` 에서 이슈 번호를 뽑아(`#59`, `59`, 이슈 URL 모두 허용) 아래 4단계를 **순서대로** 실행하라.
번호를 못 찾으면 AskUserQuestion 으로 이슈 번호를 묻고 중단한다.

전제 조건: 현재 디렉터리가 git 저장소이고 `gh auth status` 가 통과해야 한다. 아니면 그 사실을 먼저 알리고 중단한다.

## 0단계 — 실행 방식 선택

아래 경로 중 존재하는 스크립트가 있으면 그것을 쓴다(권장).

- `.codex/skills/issue-start/scripts/issue-start.mjs`
- `~/.codex/skills/issue-start/scripts/issue-start.mjs`
- 프로젝트 자체 스크립트(예: `scripts/issue-start.mjs`)

```bash
node <스크립트> fetch <번호>
node <스크립트> worktree <번호> --slug <english-slug> [--prefix fix|feat|docs|chore|refactor]
```

없으면 아래 1·4단계의 인라인 절차를 그대로 수행한다. 산출물 위치는 두 방식 모두 `.issue-start/<번호>/` 로 통일한다.

## 1단계 — 이슈 수집

```bash
mkdir -p .issue-start/<번호>/images
gh issue view <번호> --json number,title,state,body,labels,assignees,milestone,comments,url \
  > .issue-start/<번호>/issue.json
```

- 다른 저장소의 이슈면 `--repo <owner>/<name>` 을 붙인다.
- `.issue-start/` 가 `.gitignore` 에 없으면 추가를 제안한다.
- `issue.json` 을 Read 로 **전부 읽는다**.
- 본문과 코멘트에서 이미지 URL을 모두 뽑는다. 마크다운 `![alt](url)` 과 HTML `<img src="url">` 을 **둘 다** 훑고 중복을 제거한다.
- 각 이미지를 내려받는다.

```bash
curl -sSL --max-time 60 -H "Authorization: Bearer $(gh auth token)" \
  -o .issue-start/<번호>/images/image-01.png "<이미지 URL>"
```

  `https://github.com/user-attachments/assets/...` 형태는 인증이 필요하고 S3 서명 URL로 리다이렉트된다.
  curl 은 호스트가 바뀌면 `Authorization` 헤더를 자동으로 떼므로 위 명령이 그대로 동작한다.
  받은 파일이 이미지가 아니면(예: HTML 오류 페이지) 실패로 처리한다.

- 내려받은 이미지를 **하나씩 Read 로 읽어 실제로 본다**. Read 는 이미지를 시각적으로 렌더링하므로,
  스크린샷 속 화면·강조 영역·에러 메시지·UI 상태를 직접 확인하고 분석에 반영한다.
- 다운로드가 실패했으면 실패 사실과 원본 URL을 사용자에게 알린다.
- 본문에 Notion·Figma 등 외부 링크가 있으면 접근 가능한 경우 WebFetch 로 보강하고, 실패하면 링크만 남기고 진행한다.

## 2단계 — 코드베이스 대조 분석

이슈 라벨과 본문 키워드를 근거로 관련 코드를 찾는다. 탐색 범위가 넓으면 Explore 에이전트에 위임한다.

파악해야 할 것:

- 문제가 재현되는 실제 파일·함수·컴포넌트 (`path:line` 형식으로 특정)
- 현재 동작과 이슈가 요구하는 동작의 차이
- 관련 기존 테스트 유무
- 이 이슈와 겹치는 기존 브랜치/PR (`git branch -a`, `gh pr list`)

## 3단계 — 계획 수립

다음을 사용자에게 제시한다.

1. **이슈 요약** — 문제 / 요구사항 / 완료 기준 (이미지에서 읽어낸 내용 포함)
2. **원인 가설** — 근거가 되는 `path:line`
3. **작업 계획** — 순서 있는 변경 목록, 파일 단위
4. **검증 방법** — 저장소의 실제 스크립트를 확인해 명령을 특정한다. 루트 `package.json` 이 스텁이면 워크스페이스별 명령을 찾는다
5. **미해결 질문** — 제품 결정이 필요하면 여기서 AskUserQuestion

계획은 `.issue-start/<번호>/plan.md` 로 저장한다.

## 4단계 — 워크트리 생성

브랜치 slug 는 **영문 kebab-case** 로 직접 정한다. 이슈 제목이 한글이면 자동 slug 를 쓰지 않는다.
prefix 는 라벨로 추론한다(`bug`→fix, `enhancement`→feat, `documentation`→docs, 그 외 fix).
저장소에 기존 브랜치 컨벤션이 있으면 그것을 우선한다.

```bash
BASE=$(git symbolic-ref --quiet refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')
BASE=${BASE:-main}
git fetch origin "$BASE" --prune
git worktree add -b <prefix>/<번호>-<slug> ../<repo>-issue-<번호> "origin/$BASE"
```

- 실행 전에 `git worktree list` 로 같은 브랜치의 워크트리가 이미 있는지 확인한다. 있으면 새로 만들지 않고 그 경로를 알려준다.
- 브랜치가 이미 로컬에 있으면 `-b` 없이 `git worktree add <경로> <브랜치>` 를 쓴다.
- 대상 경로가 이미 존재하면 다른 경로를 제안하고 멈춘다.
- 결과 워크트리 경로와 브랜치 이름을 사용자에게 그대로 보고한다.

## 마무리 보고

- 이슈 요약과 핵심 발견
- 계획 파일 경로, 워크트리 경로, 브랜치 이름
- 다음 단계 안내: `cd <워크트리 경로>` 후 작업

## 금지 사항

- 이 명령은 **분석·계획·워크트리 준비까지만** 한다. 사용자가 명시적으로 요청하지 않는 한 코드를 수정하지 않는다.
- 현재 워크트리에서 브랜치를 갈아타지 않는다.
- 이슈 상태 변경, 코멘트 작성, PR 생성을 하지 않는다.

사용자 인자: $ARGUMENTS
