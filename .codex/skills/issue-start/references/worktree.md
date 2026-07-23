# 브랜치와 워크트리 생성

## 브랜치 이름

- slug 는 **영문 kebab-case** 로 직접 정한다. 이슈 제목이 한글이면 자동 slug 를 쓰지 않는다.
- prefix 는 라벨로 추론한다. `bug`→fix, `enhancement`→feat, `documentation`→docs, `chore`→chore, 그 외 fix.
- 저장소에 기존 브랜치 컨벤션이 있으면 그것을 우선한다.

```bash
git branch -a --sort=-committerdate | head -20   # 기존 컨벤션 확인
```

형식: `<prefix>/<번호>-<slug>` 예) `fix/59-tab-active-state`

## 스크립트 방식 (권장)

```bash
node <skill>/scripts/issue-start.mjs worktree 59 --slug tab-active-state --prefix fix
node <skill>/scripts/issue-start.mjs worktree 59 --slug tab-active-state --dry-run
```

- `--prefix` 생략 시 라벨로 추론
- 분기 기준은 `origin/HEAD` 자동 판별. `--base <branch>` 로 고정 가능
- 워크트리는 형제 디렉터리 `<repo>-issue-<번호>`. `--path <dir>` 로 변경 가능
- 같은 브랜치의 워크트리가 이미 있으면 새로 만들지 않고 경로를 알려준다
- 출력의 `WORKTREE_PATH` / `BRANCH` 를 그대로 보고한다

## 인라인 방식

```bash
BASE=$(git symbolic-ref --quiet refs/remotes/origin/HEAD | sed 's|refs/remotes/origin/||')
BASE=${BASE:-main}
git fetch origin "$BASE" --prune
git worktree list                     # 중복 확인 먼저
git worktree add -b fix/59-tab-active-state ../<repo>-issue-59 "origin/$BASE"
```

## 주의

- 실행 전에 `git worktree list` 로 같은 브랜치의 워크트리가 있는지 확인한다. 있으면 그 경로를 알려주고 새로 만들지 않는다.
- 브랜치가 이미 로컬에 있으면 `-b` 없이 `git worktree add <경로> <브랜치>`.
- 대상 경로가 이미 존재하면 다른 경로를 제안하고 멈춘다.
- 현재 워크트리에서 브랜치를 갈아타지 않는다.

## 인계

보고 마지막 줄에 다음을 넣는다.

```text
cd <워크트리 경로>   # 작업 시작
# 작업이 끝나면 같은 위치에서 issue-end 실행
```

`issue-end` 는 브랜치 이름의 숫자로 이슈 번호를 추론한다. 그래서 브랜치에 이슈 번호를 반드시 넣는다.
