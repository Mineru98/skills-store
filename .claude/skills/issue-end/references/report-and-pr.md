# 게시 상태 확인 · 조건부 보강 · PR

`issue-start`가 증거와 리포트를 먼저 게시하고 사람의 검토·승인을 기다린다.
`issue-end`는 `context`의 `evidencePublished`를 확인한다. `true`면 게시를 반복하지 않고 PR 준비로 넘어간다.
`false`면 아래 5~8단계로 누락·변경 내용을 보강하고 재게시한 뒤 PR을 만든다.

## 5단계 — comment.md 작성·보강

`evidencePublished: false`일 때만 `.issue/<번호>/evidence/comment.md` 를 최신 증거 기준으로 고친다.
`true`면 승인된 게시본을 바꾸지 않는다.

**여기서 리포트를 완전히 확정한다.** 재확인 결과·검증 요약·주의사항까지 이 단계에서 다 쓴다.
6단계 이후에 `comment.md` 를 한 글자라도 고치면 기본 브랜치 사본이 낡아서 이슈 코멘트와 어긋난다.
이미 고쳤다면 6단계를 다시 돌려야 한다.

### 프론트엔드

```markdown
## 작업 요약

<무엇을 왜 바꿨는지 3줄 이내>

## 변경 전후

| 전 | 후 |
| --- | --- |
| ![주문 목록 - 전](<before inlineUrl>) | ![주문 목록 - 후](<after inlineUrl>) |

빨간 박스가 변경 구간입니다. 상태 배지의 색과 라벨이 바뀌었습니다.

## 변경 파일

- `src/features/orders/OrderRow.tsx` — 상태 매핑 수정

## 검증

- `yarn lint` / `yarn type-check` / `yarn build` 통과
- 1440x900 · 390x844 양쪽 확인

## 남은 이슈

- <없으면 "없음">
```

### 백엔드

```markdown
## 성능 비교

| 지표 | 전 | 후 | 변화 |
| --- | ---: | ---: | ---: |
| p95 (ms) | 1,240 | 180 | **-85%** |
| 쿼리 수 | 41 | 3 | **-93%** |
| 메모리 (MB) | 210 | 215 | +2% |

측정: `oha -n 200 -c 10`, 3회 중앙값. 원본은 `.issue/59/evidence/`.
```

규칙:

- HTML `<img>`는 과거 입력을 읽을 때만 허용한다. 새 이미지는 반드시 설명이 있는 `![제목](<직접 이미지 URL>)` 형식으로 쓴다.
- bare 이미지 URL, 일반 링크로 감싼 이미지, blob 페이지, 빈 설명을 쓰지 않는다.
- 인라인 이미지에는 `urls` 출력의 `inlineUrl` 만 쓴다. `inlineUrl` 이 `null`(= private)이면 이미지를 아직 쓸 수 없다. 7.5단계로 간다.
- private 저장소에서 raw URL 을 남기려면 이미지가 아닌 보조 링크 `[파일명](<auxUrl>)` 로만 쓴다.
- 증거 이미지는 반드시 `.webp`.
- 숫자는 우측 정렬하고 변화율을 굵게.
- **악화된 지표를 빼지 않는다.** 못 잰 항목은 빈칸이 아니라 `미측정 (사유)`.
- 이미지 4장 초과면 `<details>` 로 접는다.

## 6단계 — 게시 상태 확인·필요 시 재게시

먼저 `context` 결과를 따른다.

```text
evidencePublished: true   게시본과 로컬 증거가 같다. commit/mirror/comment를 반복하지 않는다.
evidencePublished: false  누락되거나 바뀐 파일을 아래 절차로 재게시한다.
```

### Confluence 게시

`docs.type: "confluence"`이면 `commit`이 최신 `comment.md`와 webp 증거를 같은 이슈의 Confluence 페이지로 갱신합니다. 페이지 URL은 `comment.md`에 기록되어 이후 GitHub 이슈 코멘트와 PR 본문에서 그대로 쓸 수 있습니다.

Confluence 설정·권한·네트워크 오류는 경고로만 출력합니다. 증거 커밋과 PR 준비는 계속해야 합니다.

작업 브랜치 push는 증거 미러와 별도로 AskUserQuestion으로 확인받는다.

```text
질문: issue-end 6단계(증거 커밋·푸시)입니다. 작업 브랜치를 origin 에 push 할까요?
- push 한다 (권장)  증거 미러와 이슈 코멘트를 이어서 준비합니다
- 지금은 보류한다   로컬 증거 커밋만 유지하고 멈춥니다
```

```bash
node <skill>/scripts/issue-end.mjs report-check --issue 59
node <skill>/scripts/issue-end.mjs commit --issue 59
git push -u origin "$(git branch --show-current)"        # 사용자 확인 후
node <skill>/scripts/issue-end.mjs mirror --issue 59 --push
```

### 언제 다시 미러하는가

`issue-start` 이후 로컬 증거가 바뀌어 `evidencePublished: false`가 된 경우에만 다시 미러한다.
같은 내용을 확인 목적으로 반복 게시하지 않는다.

### 동작

`mirror` 는 임시 detached 워크트리에서 기본 브랜치 사본을 만들고 증거만 담은 커밋을 얹은 뒤 push 한다. **현재 워크트리는 건드리지 않는다.** 브랜치를 갈아타지 않고도 "기본 브랜치에서 작업"이 되는 이유다.

출력을 반드시 확인한다.

```json
{ "base": "main", "mirrorRef": "main", "pushed": true, "fallback": false }
```

| 필드 | 의미 |
| --- | --- |
| `pushed: false` | push 가 안 됐다. 이 상태로 코멘트하면 이미지가 깨진다. 원인을 해결하고 다시 |
| `fallback: true` | 기본 브랜치가 보호돼 `evidence/issue-<번호>` 로 밀렸다. `mirrorRef` 가 그 브랜치다 |
| `noChange: true` | 이미 같은 증거가 올라가 있다. 정상 |

`fallback: true` 면 **그 사실을 코멘트 하단에 명시한다.**

```markdown
> 증거 이미지는 기본 브랜치 보호 정책으로 `evidence/issue-59` 브랜치에 있습니다. 이 브랜치는 삭제하지 마세요.
```

이 브랜치는 어느 단계에서도 정리 대상이 아니다.

## 7단계 — 메인 체크아웃 최신화

미러는 임시 워크트리에서 `origin/<base>` 로 **곧장** push 한다. 사용자의 메인 폴더(기본 브랜치가 걸린 주 체크아웃)는 그 커밋을 모른 채 남는다. 이슈를 여러 번 돌리면 로컬이 몇 커밋씩 뒤처지고, 그 사이 로컬 커밋이 하나라도 생기면 갈라져서 나중에 받아오기가 실패한다.

재게시로 미러 push를 수행한 경우에만 받아온다.

```bash
node <skill>/scripts/issue-end.mjs sync-base
```

안전할 때만 받아온다. 이 명령은 **브랜치를 갈아타지 않고, 임의로 치워두지 않으며, 실패하면 원래 상태로 되돌린다.** 흐름을 막는 단계가 아니라서 어떤 경우에도 그냥 넘어간다.

### 출력

```json
{ "ok": true, "base": "main", "branch": "main", "received": 3 }
```

| 필드 | 의미 |
| --- | --- |
| `ok: true` | 받아왔다. `received` 가 새로 온 커밋 수 (0 이면 이미 최신) |
| `skipped` | 안전하지 않아 건너뛰었다. 아래 표대로 AskUserQuestion 으로 사용자에게 묻는다 |
| `dirtyPaths` | 무엇이 막았는지. `skipped: "dirty"` 일 때 나온다 |
| `discarded` | 받아올 내용과 같아서 알아서 정리한 파일들 |
| `restored` | 실패 후 원래 상태로 되돌렸는지 (`conflict` / `error` 일 때만 나온다) |

### 우리가 만든 파일은 알아서 정리한다

이 스킬군은 `.gitignore` 에 `.issue` 블록을 넣고 증거를 쌓은 뒤, **바로 그 둘을 미러 커밋으로 올린다.** 그래서 첫 실행부터 "저장 안 된 변경이 있다"로 막히는데, 실제로는 받아올 내용과 같은 파일이다.

내용이 글자 하나까지 같으면 치우고 받아온다(`discarded` 에 남는다). **한 글자라도 다르면 손대지 않는다** — 사용자의 작업일 수 있기 때문이다. 그때 `dirtyPaths` 에 그 경로가 담긴다.

### 건너뛴 이유별 대응

`skipped` 가 있으면 **문제 보고 형식 다섯 줄**로 알리고 AskUserQuestion 으로 함께 정한다. 전문 용어를 그대로 쓰지 않는다.

#### `dirty` — 저장 안 된 변경이 있다

```text
상황      증거 이미지는 이미 기본 브랜치에 올렸습니다.
문제      메인 폴더에 아직 저장하지 않은 변경이 있어서 최신 내용을 받아오지 못했습니다.
          막은 파일: <dirtyPaths 목록>
멀쩡한 것  코드 변경, 커밋, 이슈 코멘트는 모두 정상입니다. 잃은 것은 없습니다.
원인      받아오기는 폴더가 깨끗할 때만 안전해서 일부러 멈췄습니다.

질문: issue-end 7단계(메인 체크아웃 최신화)입니다. 메인 폴더를 최신으로 맞출까요?
- 잠시 치워두고 받아오기 (권장)   변경을 잠깐 보관했다가 받아온 뒤 그대로 되돌려 놓습니다.
- 지금은 그냥 두기               나중에 직접 받아오시면 됩니다. 지금 작업에는 영향이 없습니다.
- 무엇이 바뀌었는지 먼저 보기      목록을 보여드리고 다시 여쭙겠습니다.
```

"잠시 치워두고 받아오기" 를 고르면 이 순서로 한다. 되돌리기까지 끝내야 완료다.

```bash
git -C <메인 경로> stash push -u -m "issue-sync"
node <skill>/scripts/issue-end.mjs sync-base
git -C <메인 경로> stash pop
```

`stash pop` 이 충돌하면 **그 사실을 즉시 알린다.** 사용자의 변경이 stash 에 남아 있다는 것과 꺼내는 명령을 함께 준다.

#### `conflict` — 내용이 갈라졌다

```text
문제      내 컴퓨터의 기본 브랜치와 서버의 기본 브랜치가 서로 다른 방향으로 갈라졌습니다.
멀쩡한 것  이미 원래 상태로 되돌려 놨습니다. 망가진 것은 없습니다.

질문: issue-end 7단계(메인 체크아웃 최신화)입니다. 어떻게 할까요?
- 갈라진 부분 같이 보기 (권장)   어떤 커밋이 서로 다른지 보여드리고 정리 방법을 정합니다.
- 서버 것으로 맞추기            내 컴퓨터에만 있는 커밋이 사라집니다. 목록을 먼저 보여드립니다.
- 지금은 그냥 두기              나중에 정리하셔도 됩니다.
```

**"서버 것으로 맞추기" 는 되돌릴 수 없다.** 사라질 커밋 목록을 먼저 보여주고 AskUserQuestion 으로 한 번 더 확인받는다. 출력의 `localOnly` 가 그 목록이다.

```bash
git -C <메인 경로> log --oneline origin/<base>..HEAD    # 사라질 커밋
```

AskUserQuestion 으로 확인을 받은 뒤에만 실행한다. 확인 없이 `reset --hard` 를 돌리지 않는다.

#### `other-branch` — 메인 폴더가 다른 브랜치에 있다

```text
문제      메인 폴더가 <브랜치> 에 있어서 기본 브랜치를 받아오지 않았습니다.
멀쩡한 것  그 폴더의 작업은 그대로입니다. 건드리지 않았습니다.

질문: issue-end 7단계(메인 체크아웃 최신화)입니다. 어떻게 할까요?
- 지금은 그냥 두기 (권장)   그 폴더에서 다른 작업이 진행 중일 수 있습니다.
- 기본 브랜치로 옮긴 뒤 받아오기   그 폴더의 현재 작업을 잠시 떠납니다.
```

기본값은 "그냥 두기" 다. **사용자 확인 없이 브랜치를 갈아타지 않는다.**

#### `error` — 받아오기 자체가 실패했다

네트워크나 권한 문제다. 원문 오류는 `reason` 에 들어 있다.

```text
질문: issue-end 7단계(메인 체크아웃 최신화)입니다. 다시 시도할까요?
- 한 번 더 시도 (권장)
- 지금은 그냥 두기
- 무슨 오류인지 보기
```

#### `no-main-checkout` — 메인 폴더를 못 찾았다

드문 경우다. 사실만 한 줄 알리고 넘어간다. 이 단계 때문에 마무리를 멈추지 않는다.

### 마무리 보고에 결과를 남긴다

안내가 아니라 **결과**를 적는다. 무엇을 했는지 사용자가 알아야 한다.

```text
동기화    기본 브랜치 최신화 완료 (3 커밋 받음)
동기화    이미 최신이었습니다
동기화    건너뜀 — 메인 폴더에 저장 안 된 변경이 있습니다. 나중에 `git pull --rebase origin main`
```

## URL 생성

```bash
node <skill>/scripts/issue-end.mjs urls --issue 59 --mirrorRef <mirror 출력의 mirrorRef>
```

`--mirrorRef` 를 반드시 미러 출력값으로 넘긴다. 생략하면 기본 브랜치가 쓰이고, 폴백 상황에서 존재하지 않는 URL 이 만들어진다.

출력의 `renderMode` 로 갈린다.

```text
renderMode: "raw"            public 저장소. images[].inlineUrl 을 그대로 ![](...) 에 쓴다.
renderMode: "auto-upload"    private 저장소. gh-attach 확장이 모든 이미지를 자동 업로드했다.
                             images[].inlineUrl 이 이미 채워져 있으니 그대로 쓴다. 7.5단계는 건너뛴다.
renderMode: "manual-upload"  private 저장소. 일부·전부가 자동 업로드에 실패했다. inlineUrl 이
                             null 인 이미지만 7.5단계로 간다(images[].autoUploadError 에 사유).
```

## 7.5단계 — private 저장소 이미지 업로드 (renderMode 가 `manual-upload` 이고 inlineUrl 이 비어 있는 이미지만)

`urls` 는 private 저장소마다 `gh attach upload`(`sudosubin/gh-attach` 확장, `gh-setup` 이 자동 설치한다)로
이미지별 자동 업로드를 먼저 시도한다. 성공한 이미지는 `inlineUrl` 이 이미 채워져 있으므로 이 단계를
건너뛴다. **저장소 파일 URL(raw/blob/release) 로는 애초에 인라인 렌더링이 불가능하니 그쪽으로 우회를
시도하지 않는다** — GitHub 이 `raw.githubusercontent.com` 과 `github.com/<owner>/<repo>/raw/...` 응답을
`Sec-Fetch-Site` 로 가르기 때문이다. 주소창으로 열면 서명 토큰이 붙어 보이지만 코멘트의 `<img>` 요청에는
붙지 않아 항상 깨진다. release 자산도 같다. **주소창에서 열린다는 사실은 렌더링 근거가 아니다.**

자동 업로드가 실패한 이미지(로컬에 github.com 로그인 브라우저가 없거나 gh-attach 미설치인 경우)만
사람이 한 번 올려야 한다. **이 단계를 브라우저 자동화(클릭·드래그 스크립팅)로 대신하려 하지 않는다.**
아래를 그대로 질문한다.

```text
질문: issue-end 7.5단계(private 이미지 업로드)입니다. 이 저장소는 private 이고, 아래 이미지는
gh-attach 자동 업로드가 실패했습니다(<images[].autoUploadError>).
아래 파일을 이슈 코멘트 입력창에 끌어다 놓고, 생성된 user-attachments URL 을 알려주세요.

  업로드할 곳: <urls 출력의 uploadUrl>
  파일:
    - <inlineUrl 이 null 인 images[].localPath 만 before/after 순서로 나열>

- 업로드 URL 을 입력함     받은 URL 로 comment.md 를 채우고 이어서 진행합니다
- 이미지 없이 진행         이미지를 빼고 텍스트 증거와 보조 링크만으로 리포트를 만듭니다
```

받은 URL 을 `comment.md` 의 `![설명](...)` 에 넣고 `report-check` 를 다시 돌린다.
"이미지 없이 진행" 을 고르면 `![](...)` 를 모두 지우고 `[<파일명>](<auxUrl>)` 보조 링크로 바꾼다.
보조 링크는 검증기가 통과시킨다. 이미지 문법으로 남은 raw URL 만 막는다.

```bash
node <skill>/scripts/issue-end.mjs report-check --issue 59
# exit 0  통과
# exit 5  리포트 문법 문제 → 5단계로 돌아간다
# exit 6  private 업로드 미완 → 이 단계를 다시 한다
```

## 8단계 — 리포트 코멘트 확인·필요 시 갱신

`issue-start` 가 남긴 리포트를 먼저 확인한다. `evidencePublished: true`면 그대로 유지한다.
6단계에서 재게시했을 때만 기존 코멘트를 갱신한다.

```bash
gh issue view 59 --json comments \
  --jq '.comments[] | select(.author.login == "'"$(gh api user --jq .login)"'") | .url'
```

| 상황 | 명령 |
| --- | --- |
| 내가 단 리포트 코멘트가 이미 있다 | `gh issue comment 59 --edit-last --body-file .issue/59/evidence/comment.md` |
| 없다 | `gh issue comment 59 --body-file .issue/59/evidence/comment.md` |

**같은 내용을 새 코멘트로 또 달지 않는다.** `issue-start` → `issue-end` 를 이어서 돌리면 거의 항상 이미 있는 상태이고, 중복 코멘트는 이슈를 읽기 어렵게 만든다.

- 인라인 문자열(`--body "..."`)로 넘기지 않는다. 줄바꿈과 마크다운이 깨진다.
- 코멘트 직전에 `report-check`를 다시 실행한다. 실패하면 게시하지 않고 5단계로 돌아간다.
- `comment.md` 도 증거와 함께 커밋된 상태여야 한다. 6단계가 이미 포함한다.
- **이 단계에서 `comment.md` 를 고치지 않는다.** 고쳐야 할 것이 보이면 5단계로 돌아가 고치고 6단계를 다시 돌린 뒤 여기로 온다.
- 이슈 번호가 확정되지 않았으면 **코멘트하지 않는다.** 남의 이슈에 다는 사고가 난다.

## 9단계 — 검토 승인 확인

`issue-start` 13단계에서 사용자가 “검토 승인하고 PR 만들기”를 선택해 인계됐는지 확인한다.
그 선택으로 인계됐다면 다시 묻지 않는다. 직접 `issue-end`를 호출해 승인 여부가 불명확할 때만
코멘트 URL을 보여주고 아래 질문을 한다. 승인 전에는 PR을 만들지 않는다.

```text
질문: issue-end 9단계(검토 승인 확인)입니다. 게시된 리포트대로 PR을 만들어도 될까요?
- 승인하고 PR 준비 (권장)   10단계 PR 생성으로 넘어갑니다
- 수정이 더 필요함          issue-start 작업으로 돌아가 after와 리포트를 보강합니다
```

리포트가 깨져 승인을 못 받았다면 원인은 셋이다.

1. 미러 push 가 안 됐다 → `mirror` 출력의 `pushed` 확인
2. `--mirrorRef` 를 안 넘겼다 → 폴백인데 기본 브랜치 URL 을 썼다
3. private 저장소인데 raw URL 을 이미지로 썼다 → 7.5단계로 돌아간다

## 10단계 — PR 생성

**증거가 없으면 PR 을 만들지 않는다.** 이유를 보고하고 멈춘다.

`context` 의 `openPr` 가 있으면 새로 만들지 않고 그 PR 에 코멘트할지 AskUserQuestion 으로 묻는다.

```text
질문: issue-end 10단계(PR 생성)입니다. 이 브랜치로 이미 열린 PR #<n> 이 있습니다. 어떻게 할까요?
- 기존 PR 에 코멘트 (권장)   증거 링크를 코멘트로 추가합니다
- 기존 PR 본문 갱신          본문을 이번 내용으로 다시 씁니다
- 아무것도 하지 않음         PR 은 그대로 두고 마무리합니다
```

```bash
BASE=$(node <skill>/scripts/issue-end.mjs context | python3 -c "import json,sys; print(json.load(sys.stdin)['baseBranch'])")
gh pr create --base "$BASE" --head "$(git branch --show-current)" \
  --title "<type>(<scope>): <한 줄 요약>" \
  --body-file .issue/59/evidence/pr-body.md
```

PR 생성에 성공하면 **곧바로** 진행 상태를 옮긴다. 이 저장소에서 유일하게 수동으로 불러야 하는 상태 전환이다.

```bash
node <skill>/scripts/issue-end.mjs status 59 review
```

`STATUS=status:review` / `CHANGED=1` 을 확인한다. `STATUS_FAILED=1` 이면 흐름은 계속하되 마무리 보고에 적는다.

`pr-body.md` 첫 줄에 **`Closes` / `Fixes` / `Resolves` 를 쓰지 않는다.** 그 키워드가 있으면 merge 되는 순간 GitHub 이 이슈를 닫는데, 통합 테스트는 그 뒤에 돌아간다. 검증되지 않은 이슈가 닫혀 버린다.

이슈는 `issue-merge` 가 통합 테스트를 통과시킨 뒤 명시적으로 닫는다. 추적을 잃지 않도록 참조만 남긴다.

```markdown
관련 이슈: [#59 탭 활성 상태가 새로고침 후 초기화됨](https://github.com/owner/repo/issues/59) (통합 테스트 뒤 close)

## 변경 내용
- <파일 단위 요약>

## 검증
- <실행한 명령과 결과>

## 증거
[전후 리포트 보기](https://github.com/owner/repo/issues/59#issuecomment-123)
```

이슈 참조는 `#59` 만 적어도 GitHub 이 알아서 링크로 만들지만, **제목까지 붙인 링크**로 쓰면 PR 목록에서 무엇을 고치는 PR 인지 바로 읽힌다.

PR 생성은 push 와 **따로** AskUserQuestion 으로 확인받는다. 두 결정을 한 질문에 묶지 않는다.

```text
질문: issue-end 10단계(PR 생성)입니다. PR 을 만들까요?
- 만든다 (권장)   위 본문으로 PR 을 엽니다. merge 는 하지 않습니다
- 초안으로 만든다  draft PR 로 열어 리뷰 요청을 미룹니다
- 만들지 않는다    push 까지만 하고 끝냅니다
```

## merge 하지 않는다

이 스킬은 `gh pr merge` 를 실행하지 않는다. `--delete-branch` 도 붙이지 않는다.

여러 워크트리를 동시에 굴리는 것이 전제라, 하나를 먼저 merge 하면 나머지의 기준선이 흔들린다. 통합은 모아서 `issue-merge` 가 한다. 사용자가 merge 를 요청하면 `references/next-actions.md` 로 넘어간다.
