# 전후 증거와 이슈 리포트

변경 전후를 남들이 눈으로 비교할 수 있게 만들고, 이슈에 렌더링되는 리포트로 붙이는 단계다.

## 왜 이 순서인가

GitHub 이슈 코멘트의 이미지는 **커밋된 파일의 raw URL** 을 가리킨다. 작업 브랜치 URL 은 브랜치를 지우는 순간 깨진다. 그래서 순서가 이렇게 고정된다.

```text
증거 커밋(작업 브랜치) → 브랜치 push → 기본 브랜치에 미러 커밋·push → URL 생성 → 이슈 코멘트
```

미러가 먼저 가야 코멘트를 다는 시점에 이미지가 이미 기본 브랜치에 있다. 순서를 뒤집으면 코멘트에 깨진 이미지가 박힌다.

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

## 6. URL 생성

```bash
node <skill>/scripts/issue-start.mjs evidence-urls {issue_number} --mirrorRef <위 출력의 mirrorRef>
```

`--mirrorRef` 를 반드시 미러 출력값으로 넘긴다. 기본값을 그대로 쓰면 폴백 상황에서 잘못된 URL 이 만들어진다.

`isPrivate: true` 면 raw URL 은 코멘트에서 렌더링되지 않는다. 이때는 커밋은 유지한 채 이미지를 이슈 웹 UI 에 드래그해 올리고 그 `user-attachments` URL 을 쓴다.

## 7. 이슈 코멘트

`comment.md` 를 만들고 파일로 넘긴다. 인라인 문자열로 넘기지 않는다.

```bash
gh issue comment {issue_number} --body-file .issue/{issue_number}/evidence/comment.md
```

### 프론트엔드 형식

이미지는 반드시 `.webp`, 링크는 **기본 브랜치 기준 raw URL** 이다.

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

코멘트 URL 을 사용자에게 보여주고 **이미지가 실제로 렌더링되는지** 확인받는다. 현재 단계를 함께 적는다.

```text
issue-start 11단계(이슈 리포트 코멘트)입니다. 아래 링크에서 이미지가 보이는지 확인해 주세요.
```

깨졌다면 원인은 셋 중 하나다.

1. 미러 push 가 안 됐다 → `evidence-mirror` 출력의 `pushed` 확인
2. `--mirrorRef` 를 안 넘겼다 → 폴백 브랜치인데 기본 브랜치 URL 을 썼다
3. private 저장소다 → 웹 UI 업로드로 전환

수정은 `gh issue comment {issue_number} --edit-last --body-file ...` 으로 한다.
