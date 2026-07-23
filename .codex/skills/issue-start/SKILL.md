---
name: issue-start
description: GitHub 이슈 번호를 받아 gh로 이슈 본문·코멘트·이미지를 수집하고, 코드베이스와 대조해 상세 분석과 개선 계획을 세운 뒤 이슈 번호 기반 브랜치와 워크트리를 자동 생성합니다.
---

$ARGUMENTS: 이슈 번호 (`#59`, `59`, 이슈 URL 모두 허용) + 선택적 추가 지시

`$ARGUMENTS`에서 이슈 번호를 뽑아 아래 4단계를 **순서대로** 실행해줘.
번호를 못 찾으면 사용자에게 이슈 번호를 묻고 중단해.

전제: 현재 디렉터리가 git 저장소이고 `gh auth status`가 통과해야 한다. 아니면 그 사실을 먼저 알리고 중단해.

## 1단계 — 이슈 수집

```bash
node .codex/skills/issue-start/scripts/issue-start.mjs fetch <번호>
```

- 스킬을 홈(`~/.codex`)에 설치했다면 그 경로의 스크립트를 쓴다.
- 다른 저장소의 이슈면 `--repo <owner>/<name>`을 붙인다.
- 산출물 기본 위치는 `.issue-start/<번호>/`다. `--out <dir>`로 바꿀 수 있다.
- `.issue-start/`가 `.gitignore`에 없으면 추가를 제안한다.

출력 마지막의 `ISSUE_DIR` / `IMAGE_FILES` / `SUGGESTED_PREFIX`를 기억해.

- `<ISSUE_DIR>/issue.md`를 **전부 읽는다**. 스크립트 요약 출력만 믿지 않는다.
- `IMAGE_FILES`의 이미지를 **하나씩 실제로 열어본다**. 스크린샷 속 화면, 강조 영역, 에러 메시지, UI 상태를 분석에 반영한다.
  이미지 입력을 지원하지 않는 환경이면 파일 경로를 사용자에게 알리고 내용을 확인해 달라고 요청한다.
- 이미지 다운로드가 실패했으면 실패 사실과 원본 URL을 알린다.
- 본문에 Notion, Figma 등 외부 링크가 있으면 접근 가능한 경우 보강하고, 실패하면 링크만 남기고 진행한다.

## 2단계 — 코드베이스 대조 분석

이슈 라벨과 본문 키워드를 근거로 관련 코드를 찾는다.

파악할 것:

- 문제가 재현되는 실제 파일, 함수, 컴포넌트
- 현재 동작과 이슈가 요구하는 동작의 차이
- 관련 기존 테스트 유무
- 겹치는 기존 브랜치나 PR (`git branch -a`, `gh pr list`)

## 3단계 — 계획 수립

다음을 사용자에게 제시한다.

1. **이슈 요약** - 문제, 요구사항, 완료 기준. 이미지에서 읽어낸 내용 포함
2. **원인 가설** - 근거가 되는 파일과 위치
3. **작업 계획** - 순서 있는 변경 목록, 파일 단위
4. **검증 방법** - 저장소의 실제 스크립트를 확인해서 명령을 특정한다. 루트 `package.json`이 스텁이면 워크스페이스별 명령을 찾는다
5. **미해결 질문** - 제품 결정이 필요한 항목

계획은 `<ISSUE_DIR>/plan.md`로 저장한다.

## 4단계 — 워크트리 생성

브랜치 slug는 **영문 kebab-case**로 직접 정한다. 이슈 제목이 한글이면 자동 slug를 쓰지 않는다.

```bash
node .codex/skills/issue-start/scripts/issue-start.mjs worktree <번호> --slug <english-slug> [--prefix fix|feat|docs|chore|refactor]
```

- `--prefix` 생략 시 라벨로 추론한다. `bug`→fix, `enhancement`→feat, `documentation`→docs, 그 외 fix
- 분기 기준은 `origin/HEAD`로 자동 판별한다. `--base <branch>`로 고정할 수 있다
- 워크트리는 형제 디렉터리 `<repo>-issue-<번호>`에 만든다. `--path <dir>`로 바꿀 수 있다
- 같은 브랜치의 워크트리가 이미 있으면 새로 만들지 않고 그 경로를 알려준다
- 먼저 `--dry-run`으로 브랜치명과 경로를 보여주고 진행해도 된다
- 출력의 `WORKTREE_PATH` / `BRANCH`를 사용자에게 그대로 보고한다

## 마무리 보고

- 이슈 요약과 핵심 발견
- 계획 파일 경로, 워크트리 경로, 브랜치 이름
- 다음 단계 안내: `cd <WORKTREE_PATH>` 후 작업

## 하지 않는 일

- 코드 수정. 이 스킬은 분석, 계획, 워크트리 준비까지만 한다. 사용자가 명시적으로 요청하면 그때 구현한다
- `git worktree add`나 `git checkout -b` 직접 실행. 경로와 분기 기준을 통일하려고 스크립트를 쓴다
- 현재 워크트리에서 브랜치 갈아타기
- 이슈 상태 변경, 코멘트 작성, PR 생성
