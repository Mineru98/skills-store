# 브랜치와 워크트리

## 배치 방식은 설정으로 고정한다

워크트리가 매번 다른 곳에 생기면 정리도 추적도 안 된다. 그래서 배치 방식을 `~/.issue-plugin/settings.json` 에 한 번만 정해 두고, `issue-create` / `issue-start` / `issue-end` / `issue-merge` 어디서 들어오든 같은 값을 쓴다.

```json
{
  "worktree": { "layout": "sibling", "decidedAt": "..." }
}
```

| layout | 경로 | 성격 |
| --- | --- | --- |
| `sibling` | `<repo 부모>/<repo>-issue-<번호>` | 기존 기본값. 소스 디렉터리에 형제로 쌓인다 |
| `nested` | `<repo>/.issue/worktrees/<번호>-<slug>` | 프로젝트 안에 모인다. `.issue/**` 로 무시되므로 커밋되지 않는다 |

### 미결정일 때

스크립트가 배치를 못 정하면 이렇게 빠진다.

```text
✗ 워크트리 배치 방식이 결정되지 않았습니다.
WORKTREE_LAYOUT_UNSET=1
WORKTREE_LAYOUT_CHOICES=sibling,nested
```

이때 **딱 한 번** AskUserQuestion 으로 묻는다. 질문 본문에 현재 단계를 함께 적는다.

```text
질문   issue-start 5단계(워크트리 생성)입니다.
       워크트리를 어디에 만들까요? 한 번 정하면 이후 계속 이 방식을 씁니다.

1. sibling   ../<repo>-issue-<번호>. 소스 폴더 옆에 나란히 생깁니다.
2. nested    <repo>/.issue/worktrees/<번호>-<slug>. 프로젝트 안에 모이고 git 이 무시합니다.
             다만 IDE·파일 감시자·ripgrep 이 중복 트리를 훑을 수 있습니다.
```

답을 받으면 고정한다.

```bash
node -e "import('<skill>/scripts/issue-common.mjs').then(m=>m.setWorktreeLayout('nested'))"
```

이후로는 묻지 않는다. 바꾸고 싶으면 사용자가 명시적으로 요청할 때만 다시 설정한다.

### nested 안전장치

nested 는 워크트리 사본이 부모 저장소 안에 생긴다. `.issue/**` 무시가 깨져 있으면 부모에서 `git add -A` 한 번에 워크트리 전체가 스테이징되는 사고가 난다.

스크립트가 워크트리를 만들기 전에 `git check-ignore` 로 실제 무시 여부를 확인하고, 안 걸리면 **생성을 중단한다**. 이 오류를 보면 `.gitignore` 의 `.issue` 블록부터 고쳐야 한다.

## 브랜치 이름

```text
<prefix>/<이슈번호>-<영문-slug>      예) fix/59-tab-active-state
```

- **prefix** 는 라벨로 추론한다: `bug|fix`→`fix`, `enhancement|feature|feat`→`feat`, `documentation|docs`→`docs`, `chore|maintenance`→`chore`. 기본값은 `fix`.
- **slug** 는 영문 kebab-case 로 **직접 지어서** `--slug` 로 넘긴다. 한글 제목을 자동 slug 로 만들면 글자가 전부 날아가 `issue-59` 만 남는다.
- 저장소에 기존 컨벤션이 있으면 그쪽을 우선한다.

```bash
git branch -a --sort=-committerdate | head -20   # 기존 컨벤션 확인
```

**브랜치에 이슈 번호는 필수다.** `issue-end` 와 `issue-merge` 가 브랜치 이름에서 이슈를 역추론한다. 숫자 앞은 `/` 나 `_` 여야 인식되므로 `fix/59-login` 은 되고 `fix-59-login` 은 안 된다. (`-` 를 인정하면 `worktree-cc-20260726-044434` 같은 이름에서 엉뚱한 숫자를 이슈로 집는다.)

## 생성

```bash
node <skill>/scripts/issue-start.mjs worktree {issue_number} --slug <영문-slug>
node <skill>/scripts/issue-start.mjs worktree {issue_number} --slug <영문-slug> --dry-run
```

- `--prefix` 로 라벨 추론을 덮어쓴다.
- `--branch` 로 이름 전체를 직접 지정한다.
- `--base <branch>` 로 분기 기준을 고정한다. 기본은 `origin/HEAD` 자동 판별.
- `--layout` 으로 이번 실행만 배치를 강제한다(설정은 바뀌지 않는다).
- `--path` 로 경로를 직접 지정한다. 설정과 다르면 경고가 뜨지만 진행한다.

출력의 `WORKTREE_PATH=` 와 `BRANCH=` 를 다음 단계에 쓴다.

### 인라인 (스크립트가 없을 때)

```bash
REMOTE=origin
BASE=$(git symbolic-ref --quiet refs/remotes/$REMOTE/HEAD | sed "s#refs/remotes/$REMOTE/##")
BASE=${BASE:-main}
git fetch $REMOTE "$BASE" --prune
git worktree list                     # 중복 확인 먼저
git worktree add -b fix/59-tab-active-state ../<repo>-issue-59 "$REMOTE/$BASE"
```

nested 로 만들 때는 `.gitignore` 에 `.issue` 블록이 있는지 먼저 확인한다.

## 주의

- 같은 이슈의 워크트리가 이미 있으면 새로 만들지 않고 그 경로를 쓴다. 스크립트가 알아서 재사용한다.
- 로컬에 같은 이름 브랜치가 있으면 `-b` 없이 `git worktree add <경로> <브랜치>`.
- 경로가 이미 존재하는데 워크트리가 아니면 중단한다. 덮어쓰지 않는다.
- **현재 워크트리에서 브랜치를 갈아타지 않는다.** 다른 이슈 작업이 진행 중일 수 있다.

## 인계

워크트리를 만든 **직후, 파일을 하나도 고치기 전에** before 캡처를 찍는다. 이 순간의 워크트리는 정의상 pure 하다. 이 순서를 놓치면 `issue-end` 가 `pure-tree` 로 되돌려 다시 찍어야 한다.

```text
cd <워크트리 경로>   # 이후 모든 작업은 여기서
```

정리는 `issue-merge` 가 통합 후에 한다. `issue-start` 와 `issue-end` 는 워크트리를 지우지 않는다.
`evidence/issue-<번호>` 브랜치는 증거 URL 이 의존하므로 어느 단계에서도 삭제 대상이 아니다.
