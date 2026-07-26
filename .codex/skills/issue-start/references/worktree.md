# 브랜치와 워크트리

## 기본 브랜치는 한 번 정해서 재사용한다

`main` 인지 `master` 인지를 매번 다시 알아내지 않는다. 아래 순서로 정한다.

```text
1. --base 인자                        이번 실행에만 적용
2. <repo>/.issue/settings.json        git.baseBranch          ← 이 저장소의 기록. 있으면 여기서 끝
3. origin/HEAD → main → master        실제 저장소에서 판별하고 그 값을 2 에 적어 둔다
4. ~/.issue-plugin/settings.json      git.defaultBaseBranch   ← 사용자 습관. 3 이 실패할 때만
```

**저장소 실제 상태가 사용자 습관보다 우선이다.** 사용자가 평소 `main` 을 쓰더라도 이 저장소가 `master` 면 `master` 를 쓴다. 4번은 원격이 없거나 브랜치가 아직 없어서 3번이 아무것도 못 찾을 때만 쓰인다.

```json
// <repo>/.issue/settings.json — .issue/** 로 무시되므로 커밋되지 않는다
{ "git": { "baseBranch": "main", "detectedAt": "..." } }
```

`detectBase` 가 이 순서를 내장하고 있으므로 4개 스킬 어디서 들어와도 같은 값이 나온다. 직접 `git symbolic-ref` 를 다시 호출하지 않는다.

### 확인과 고정

```bash
node <skill>/scripts/issue-create.mjs base                    # 지금 무엇으로 정해지는지 확인
node <skill>/scripts/issue-create.mjs base --set master       # 이 저장소를 master 로 고정
node <skill>/scripts/issue-create.mjs base --default master   # 사용자 기본값을 master 로 고정
```

출력의 `SOURCE=` 가 어디서 왔는지 알려준다.

```text
project        .issue/settings.json 에 이미 기록돼 있었다
detected       원격에서 판별했고 방금 기록했다
home-default   판별 실패 — 사용자 기본값을 썼다
fallback       판별도 실패, 사용자 기본값도 없다 → DEFAULT_BASE_UNSET=1
```

`DEFAULT_BASE_UNSET=1` 이 뜨면 **딱 한 번** AskUserQuestion 으로 묻고 `base --default` 로 고정한다.

```text
질문   issue-start 5단계(워크트리 생성)입니다. 이 컴퓨터에서는 보통 어떤 브랜치를 기준으로 작업하시나요?
       한 번 정하면 저장소에서 판별이 안 될 때만 씁니다.

1. main (권장)   요즘 대부분의 저장소가 쓰는 이름입니다.
2. master        예전부터 쓰던 저장소가 많다면 이쪽입니다.
```

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
| `children` | `<repo>/.issue/worktrees/<번호>-<slug>` | 프로젝트 안에 모인다. `.issue/**` 로 무시되므로 커밋되지 않는다 |

### 미결정일 때

스크립트가 배치를 못 정하면 이렇게 빠진다.

```text
✗ 워크트리 배치 방식이 결정되지 않았습니다.
WORKTREE_LAYOUT_UNSET=1
WORKTREE_LAYOUT_CHOICES=sibling,children
```

이때 **딱 한 번** AskUserQuestion 으로 묻는다. 질문 본문에 현재 단계를 함께 적는다.

```text
질문   issue-start 5단계(워크트리 생성)입니다.
       워크트리를 어디에 만들까요? 한 번 정하면 이후 계속 이 방식을 씁니다.

1. sibling    ../<repo>-issue-<번호>. 소스 폴더 옆에 나란히 생깁니다.
2. children   <repo>/.issue/worktrees/<번호>-<slug>. 프로젝트 안에 모이고 git 이 무시합니다.
              다만 IDE·파일 감시자·ripgrep 이 중복 트리를 훑을 수 있습니다.
```

답을 받으면 고정한다.

```bash
node -e "import('<skill>/scripts/issue-common.mjs').then(m=>m.setWorktreeLayout('children'))"
```

이후로는 묻지 않는다. 바꾸고 싶으면 사용자가 명시적으로 요청할 때만 다시 설정한다.

**예전 설정에 `nested` 가 들어 있으면** 모르는 값으로 취급되어 위 질문이 다시 뜬다. 같은 뜻이던 이름이 `children` 으로 바뀌었기 때문이다. 사용자에게는 이 사정을 한 줄로만 알리고 넘어간다.

```text
워크트리 배치 이름이 바뀌어서 한 번만 다시 여쭙습니다. 예전의 `nested` 가 지금의 `children` 입니다.
```

### children 안전장치

children 은 워크트리 사본이 부모 저장소 안에 생긴다. `.issue/**` 무시가 깨져 있으면 부모에서 `git add -A` 한 번에 워크트리 전체가 스테이징되는 사고가 난다.

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

`WORKTREE_DISPLAY=` 도 함께 나온다. **사용자에게 경로를 보여줄 때는 이 값을 쓴다.** 배치에 맞는 형태라서 터미널에서 `ctrl+클릭` 으로 열린다. 자세한 이유는 각 SKILL.md 의 `링크와 경로 쓰는 법`.

### 인라인 (스크립트가 없을 때)

```bash
REMOTE=origin
# .issue/settings.json 기록 → origin/HEAD → main → master 순
BASE=$(node -e "import('<skill>/scripts/issue-common.mjs').then(m=>console.log(m.detectBase(process.cwd())))")
git fetch $REMOTE "$BASE" --prune
git worktree list                     # 중복 확인 먼저
git worktree add -b fix/59-tab-active-state ../<repo>-issue-59 "$REMOTE/$BASE"
```

공용 모듈조차 없으면 아래로 떨어진다. 이때도 `main` 을 단정하지 않는다.

```bash
BASE=$(git symbolic-ref --quiet refs/remotes/origin/HEAD | sed 's#refs/remotes/origin/##')
[ -n "$BASE" ] || BASE=$(git show-ref --verify --quiet refs/remotes/origin/main && echo main || echo master)
```

children 으로 만들 때는 `.gitignore` 에 `.issue` 블록이 있는지 먼저 확인한다.

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
