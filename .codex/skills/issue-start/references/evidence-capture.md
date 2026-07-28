# 전후 증거와 이슈 리포트

변경 전후를 남들이 눈으로 비교할 수 있게 만들고, 이슈에 렌더링되는 리포트로 붙이는 단계다.

## 왜 이 순서인가

공개 저장소의 GitHub 이슈 코멘트는 커밋된 파일의 raw URL 을 쓸 수 있다. 비공개 저장소의
raw URL 은 인증이 필요한 탓에 코멘트에서 렌더링되지 않으므로 이슈 웹 UI 에 업로드한
`user-attachments` URL 을 써야 한다. 어느 쪽이든 증거 원본은 먼저 커밋·푸시해 보존한다.

```text
증거 커밋(작업 브랜치) → 브랜치 push → 기본 브랜치에 미러 커밋·push → 공개 범위 확인
  공개 저장소   → 미러 raw URL 생성
  비공개 저장소 → 이슈 웹 UI 업로드로 user-attachments URL 생성
→ report-check → 이슈 코멘트 → 실제 렌더링 확인
```

공개 저장소는 미러가 먼저 가야 코멘트를 다는 시점에 이미지가 이미 존재한다. 비공개 저장소도
미러 커밋은 감사 가능한 증거 원본으로 유지하되, 코멘트의 인라인 이미지는 `user-attachments`를 쓴다.

## 저장 위치

```text
.issue/<번호>/evidence/
├── before/          변경 전 캡처 또는 측정 원본
├── after/           변경 후 캡처 또는 측정 원본
└── comment.md       이슈에 붙일 리포트 본문
```

`.issue/**` 는 무시되지만 `evidence/**` 만 예외로 커밋된다. 그래도 커밋은 항상 `-f` 로 한다.

```bash
node <skill>/scripts/issue-start.mjs evidence-init {issue_number}
```

## 1. before — 워크트리를 만든 직후

**파일을 하나도 고치기 전에** 찍는다. 이때가 pure 상태다. 이 순서를 놓치면 `issue-end` 가 `pure-tree` 로 되돌려 다시 찍어야 하고, 그건 의존성 재설치와 서버 재기동을 동반한다.

이슈에 첨부된 스크린샷이 같은 화면·같은 상태를 담고 있으면 `.issue/<번호>/images/` 의 파일을 before 로 재사용해도 된다. 단 뷰포트 폭이 다르면 비교가 성립하지 않으니 직접 찍는 쪽이 낫다.

## 2. 프론트엔드 — webp 캡처

### 개발 서버 확인

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000
```

포트가 다른 프로세스에 점유돼 있으면 `kill-process` 스킬로 정리한다.

### 캡처

```bash
node <skill>/scripts/capture.mjs \
  --url http://localhost:3000/orders \
  --out .issue/59/evidence/before/orders.webp \
  --width 1440 --height 900 --full \
  --wait "text=주문 목록" \
  --box ".order-row:first-child .status" --box-label "상태 배지"
```

| 옵션 | 뜻 |
| --- | --- |
| `--width/--height` | 뷰포트. 기본 1440x900. 모바일 이슈면 390x844 도 추가 |
| `--full` | 전체 페이지 |
| `--wait <sel>` | 해당 셀렉터가 보일 때까지 대기 |
| `--delay <ms>` | 추가 대기. 애니메이션이 있으면 늘린다 |
| `--quality <n>` | webp 품질. 기본 82 |
| `--storage <file>` | 로그인 상태 재사용 |

**before 와 after 는 URL·상태·뷰포트·파일명을 같게 맞춘다.** 파일명이 같아야 코멘트 표에서 짝이 맞는다.

### 바운딩 박스는 필수다

after 캡처에는 **변경 구간을 가리키는 `--box` 를 최소 하나** 넣는다. before 에도 **같은 셀렉터로 같은 위치에** 그린다. 그래야 "여기가 이렇게 바뀌었다"가 한눈에 읽힌다.

```bash
# before / after 양쪽에 동일하게
--box ".order-row:first-child .status" --box-label "상태 배지"
--box "#summary" --box-label "합계 표시"
```

- `--box-rect x,y,w,h` — 셀렉터로 잡히지 않는 영역을 문서 좌표로 지정
- `--box-color <css>` — 기본 `#ff2d55`
- `--box-pad <px>` — 기본 4

셀렉터를 못 찾으면 경고만 내고 캡처는 성공한다. 출력의 `boxes.missed` 를 확인해서 빈 채로 넘어가지 않는다.

박스를 그릴 수 없는 이유가 있으면(예: 변경이 화면 전체에 퍼짐) 그 이유를 코멘트에 한 줄로 쓴다. 조용히 생략하지 않는다.

### 로그인이 필요한 화면

```bash
npx playwright open --save-storage=.issue/59/evidence/.auth.json http://localhost:3000/login
node <skill>/scripts/capture.mjs --storage .issue/59/evidence/.auth.json ...
```

`.auth.json` 은 `.gitignore` 블록이 따로 막는다. 커밋되지 않는지 확인한다.

### webp 변환

`sharp` → `cwebp` → `ffmpeg` 순으로 사용 가능한 것을 쓴다. 셋 다 없으면 png 로 떨어지고 그 사실이 출력에 나온다. **증거는 webp 여야 하므로** png 로 떨어졌으면 변환 도구를 설치하고 다시 찍는다.

박스는 sharp 합성이 아니라 브라우저 DOM 오버레이로 그리므로, 변환 폴백 경로에서도 박스는 남는다.

## 3. 백엔드 — 측정 비교

캡처 대신 수치를 남긴다. `plan.md` 의 증거 계획에 적어 둔 지표와 명령을 그대로 쓴다.

```bash
oha -n 200 -c 10 http://localhost:8080/api/orders | tee .issue/59/evidence/before/bench.txt
psql -c "EXPLAIN (ANALYZE, BUFFERS) SELECT ..." | tee .issue/59/evidence/before/explain.txt
```

- 3회 측정의 중앙값을 쓴다. 1회 측정은 근거가 되지 않는다.
- 원본 출력을 파일로 남긴다. 요약만 적으면 검증할 수 없다.
- **악화된 지표를 숨기지 않는다.** 못 잰 항목은 빈칸이 아니라 `미측정 (사유)` 로 적는다.

## 4. 문서·설정만 바뀐 경우

캡처도 측정도 의미가 없으면 생략하되, `comment.md` 에 **왜 생략했는지와 변경 근거**를 글로 남긴다. 증거 없이 조용히 넘어가지 않는다.

## 5. 커밋과 미러

### Confluence 게시

`~/.issue/settings.json`의 `docs.type: "confluence"`가 켜져 있으면 `evidence-commit`은 `comment.md`와 webp 증거를 같은 Confluence 페이지에 게시합니다. 같은 이슈는 기존 페이지를 version 갱신으로 재사용하며, 성공한 URL은 `comment.md`의 Confluence 항목에 자동 기록됩니다.

설정에는 `baseUrl`, `spaceKey`, `parentPageId`, `email`, `tokenEnv`가 필요합니다. 토큰 값은 환경변수에만 둡니다. Confluence 게시 실패는 경고일 뿐 증거 커밋·GitHub 코멘트 흐름을 막지 않습니다.

```bash
node <skill>/scripts/issue-start.mjs evidence-commit {issue_number}
git push -u origin "$(git branch --show-current)"
node <skill>/scripts/issue-start.mjs evidence-mirror {issue_number} --push
```

`evidence-mirror` 는 임시 detached 워크트리에서 기본 브랜치 사본을 만들고 증거만 담은 커밋을 얹는다. **현재 워크트리는 건드리지 않는다.**

출력을 확인한다.

```json
{ "base": "main", "mirrorRef": "main", "pushed": true, "fallback": false }
```

- `fallback: true` 면 기본 브랜치가 보호돼 있어 `evidence/issue-<번호>` 로 밀린 것이다. 이미지 URL 기준이 기본 브랜치가 아니므로 **그 사실을 코멘트에 명시한다.** 이 브랜치는 삭제 대상이 아니다.
- `noChange: true` 면 이미 같은 증거가 올라가 있다는 뜻이다. 정상이다.

## 6. 공개 범위 확인과 URL 생성

먼저 저장소 공개 범위를 확인한다.

```bash
gh repo view --json visibility --jq .visibility
```

```bash
node <skill>/scripts/issue-start.mjs evidence-urls {issue_number} --mirrorRef <위 출력의 mirrorRef>
```

`--mirrorRef` 를 반드시 미러 출력값으로 넘긴다. 기본값을 그대로 쓰면 폴백 상황에서 잘못된 URL 이 만들어진다.

출력의 `isPrivate` 와 `gh repo view` 결과가 다르면 안전한 쪽인 비공개 저장소 절차를 따른다.

```text
PUBLIC / isPrivate:false   images[].mirrorUrl 을 사용
PRIVATE / isPrivate:true   mirrorUrl 을 새 이미지 링크로 쓰지 않음
                           이슈 웹 UI 에 webp 를 드래그해 올리고
                           생성된 https://github.com/user-attachments/assets/... URL 을 사용
```

비공개 저장소에서도 커밋과 미러는 유지한다. 다만 raw/blob/release URL 은 보조 링크로만 남길 수 있고
`![설명](...)` 안에는 `user-attachments` 직접 이미지 URL 만 넣는다.

## 7. 이슈 코멘트

`comment.md` 를 만들고 파일로 넘긴다. 인라인 문자열로 넘기지 않는다.

기존 이슈의 HTML `<img>`는 입력 호환 목적으로 읽을 수 있지만 새 리포트에는 쓰지 않는다.
모든 새 이미지는 설명이 있는 `![설명](직접 이미지 링크)`로 작성한다.
bare 이미지 URL, 일반 링크로 감싼 이미지, blob 페이지, 빈 설명은 허용하지 않는다.
비공개 저장소에서는 raw/blob/release URL 대신 이슈 웹 UI에 올린 `user-attachments` URL을 쓴다.

게시 전에 반드시 기계 검사를 통과시킨다. `evidence-commit`도 같은 검사를 다시 실행한다.

```bash
node <skill>/scripts/issue-start.mjs report-check {issue_number}
```

```bash
gh issue comment {issue_number} --body-file .issue/{issue_number}/evidence/comment.md
```

### 프론트엔드 형식

이미지는 반드시 `.webp`다. 공개 저장소는 기본 브랜치 기준 raw URL, 비공개 저장소는
이슈 웹 UI에서 생성한 `user-attachments` URL 을 쓴다.

```markdown
## 작업 요약

<무엇을 왜 바꿨는지 3줄 이내>

## 변경 전후

| 전 | 후 |
| --- | --- |
| ![주문 목록 - 전](<before mirrorUrl>) | ![주문 목록 - 후](<after mirrorUrl>) |

빨간 박스가 변경 구간입니다. 상태 배지의 색과 라벨이 바뀌었습니다.

## 변경 파일

- `src/features/orders/OrderRow.tsx` — 상태 매핑 수정
- `src/shared/status.ts` — 매핑 테이블 추가

## 검증

- `yarn lint` / `yarn type-check` / `yarn build` 통과
- 1440x900 · 390x844 양쪽 확인

## 남은 이슈

- <없으면 "없음">
```

### 백엔드 형식

```markdown
## 성능 비교

| 지표 | 전 | 후 | 변화 |
| --- | ---: | ---: | ---: |
| p95 (ms) | 1,240 | 180 | **-85%** |
| 쿼리 수 | 41 | 3 | **-93%** |
| 메모리 (MB) | 210 | 215 | +2% |

측정: `oha -n 200 -c 10`, 3회 중앙값. 원본은 `.issue/59/evidence/`.
```

### 규칙

- 표의 숫자는 우측 정렬하고 변화율을 굵게 쓴다.
- 측정하지 않은 항목은 빈칸이 아니라 `미측정 (사유)`.
- 이미지가 4장을 넘으면 `<details>` 로 접는다.
- webp 는 장당 500KB, 총합 5MB 를 넘기지 않는다. 넘으면 `--quality 70` 이나 `--width` 축소로 다시 찍는다.
- 동영상은 커밋하지 않는다.

## 8. 확인

코멘트 URL 을 열어 **이미지가 실제로 렌더링되는지** 확인한다. 로그인된 브라우저를 사용할 수
없으면 코멘트 URL 을 사용자에게 보여주고 AskUserQuestion 으로 확인받는다.
렌더링 확인은 게시 성공 확인이다. 구현 결과의 검토·승인은 13단계에서 별도로 받으며,
승인 전에는 `issue-end` 로 넘어가지 않는다.

```text
질문: issue-start 11단계(이슈 리포트 코멘트)입니다. 이슈 코멘트의 이미지가 잘 보이나요?
- 잘 보인다 (권장 경로)   이대로 issue-end 로 넘어갑니다
- 깨져 보인다             아래 원인 셋을 순서대로 확인해 고칩니다
```

깨졌다면 원인은 셋 중 하나다.

1. 미러 push 가 안 됐다 → `evidence-mirror` 출력의 `pushed` 확인
2. `--mirrorRef` 를 안 넘겼다 → 폴백 브랜치인데 기본 브랜치 URL 을 썼다
3. private 저장소다 → 웹 UI 업로드로 전환

수정은 `gh issue comment {issue_number} --edit-last --body-file ...` 으로 한다.

## 9. 메인 체크아웃 최신화

미러는 임시 워크트리에서 `origin/<base>` 로 **곧장** push 한다. 사용자의 메인 폴더(기본 브랜치가 걸린 주 체크아웃)는 그 커밋을 모른 채 남는다. 이슈를 여러 번 돌리면 로컬이 몇 커밋씩 뒤처지고, 그 사이 로컬 커밋이 하나라도 생기면 갈라져서 나중에 받아오기가 실패한다.

그래서 미러 push 직후에 받아온다.

```bash
node <skill>/scripts/issue-start.mjs sync-base
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

질문: issue-start 12단계(메인 체크아웃 최신화)입니다. 메인 폴더를 최신으로 맞출까요?
- 잠시 치워두고 받아오기 (권장)   변경을 잠깐 보관했다가 받아온 뒤 그대로 되돌려 놓습니다.
- 지금은 그냥 두기               나중에 직접 받아오시면 됩니다. 지금 작업에는 영향이 없습니다.
- 무엇이 바뀌었는지 먼저 보기      목록을 보여드리고 다시 여쭙겠습니다.
```

"잠시 치워두고 받아오기" 를 고르면 이 순서로 한다. 되돌리기까지 끝내야 완료다.

```bash
git -C <메인 경로> stash push -u -m "issue-sync"
node <skill>/scripts/issue-start.mjs sync-base
git -C <메인 경로> stash pop
```

`stash pop` 이 충돌하면 **그 사실을 즉시 알린다.** 사용자의 변경이 stash 에 남아 있다는 것과 꺼내는 명령을 함께 준다.

#### `conflict` — 내용이 갈라졌다

```text
문제      내 컴퓨터의 기본 브랜치와 서버의 기본 브랜치가 서로 다른 방향으로 갈라졌습니다.
멀쩡한 것  이미 원래 상태로 되돌려 놨습니다. 망가진 것은 없습니다.

질문: issue-start 12단계(메인 체크아웃 최신화)입니다. 어떻게 할까요?
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

질문: issue-start 12단계(메인 체크아웃 최신화)입니다. 어떻게 할까요?
- 지금은 그냥 두기 (권장)   그 폴더에서 다른 작업이 진행 중일 수 있습니다.
- 기본 브랜치로 옮긴 뒤 받아오기   그 폴더의 현재 작업을 잠시 떠납니다.
```

기본값은 "그냥 두기" 다. **사용자 확인 없이 브랜치를 갈아타지 않는다.**

#### `error` — 받아오기 자체가 실패했다

네트워크나 권한 문제다. 원문 오류는 `reason` 에 들어 있다.

```text
질문: issue-start 12단계(메인 체크아웃 최신화)입니다. 다시 시도할까요?
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
