# 리포트 · 기본 브랜치 커밋 · 이슈 코멘트 · PR

이 문서의 6·7단계는 **필수**다. 조건부가 아니고 사용자가 생략을 요청해도 건너뛰지 않는다.
증거가 기본 브랜치에 없으면 이슈 코멘트의 이미지가 깨지고, 코멘트가 없으면 이슈만 봐서는 무엇이 어떻게 해결됐는지 알 수 없다. 이 스킬군이 존재하는 이유가 그 둘이다.

## 5단계 — comment.md 작성·보강

`.issue/<번호>/evidence/comment.md` 를 만든다. `issue-start` 가 이미 썼으면 최신 증거 기준으로 고친다.

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
| ![주문 목록 - 전](<before mirrorUrl>) | ![주문 목록 - 후](<after mirrorUrl>) |

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

- 이미지는 반드시 `.webp`, 링크는 `![제목](<mirrorUrl>)` 형식.
- 숫자는 우측 정렬하고 변화율을 굵게.
- **악화된 지표를 빼지 않는다.** 못 잰 항목은 빈칸이 아니라 `미측정 (사유)`.
- 이미지 4장 초과면 `<details>` 로 접는다.

## 6단계 — 기본 브랜치에 증거 커밋 [필수]

```bash
node <skill>/scripts/issue-end.mjs commit --issue 59
git push -u origin "$(git branch --show-current)"        # 사용자 확인 후
node <skill>/scripts/issue-end.mjs mirror --issue 59 --push
```

이 단계는 묻지 않지만 **전이 보고로 단계는 밝힌다.** 중간의 `git push` 만 확인받는다.

```text
질문   issue-end 6단계(증거 커밋·푸시)입니다. 작업 브랜치를 origin 에 push 할까요?
```

### issue-start 가 이미 미러했는데 왜 또 하는가

`issue-start` 이후에 수정 커밋이 더 쌓였을 수 있고, 방금 4단계에서 after 를 다시 찍었다. **최신 증거 기준으로 다시 미러해야 코멘트가 실제 최종 상태를 가리킨다.** 내용이 같으면 커밋이 비어 `noChange: true` 로 끝나므로 비용은 없다.

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

### 로컬 기본 브랜치는 뒤처진다

미러는 임시 워크트리에서 `origin/<base>` 로 **직접** push 한다. 사용자의 기본 브랜치 체크아웃은 그 커밋을 모른 채 남는다. 이슈를 여러 번 돌리면 로컬 `main` 이 원격보다 몇 커밋씩 뒤처지고, 그 사이 로컬에 커밋이 하나라도 생기면 갈라져서 `git pull --ff-only` 가 실패한다.

정상 동작이다. 마무리 보고에 한 줄로 알린다.

```text
기본 브랜치 체크아웃에서 `git pull --rebase origin <base>` 로 증거 커밋을 받아가세요.
```

`fallback: true` 면 **그 사실을 코멘트 하단에 명시한다.**

```markdown
> 증거 이미지는 기본 브랜치 보호 정책으로 `evidence/issue-59` 브랜치에 있습니다. 이 브랜치는 삭제하지 마세요.
```

이 브랜치는 어느 단계에서도 정리 대상이 아니다.

## URL 생성

```bash
node <skill>/scripts/issue-end.mjs urls --issue 59 --mirrorRef <mirror 출력의 mirrorRef>
```

`--mirrorRef` 를 반드시 미러 출력값으로 넘긴다. 생략하면 기본 브랜치가 쓰이고, 폴백 상황에서 존재하지 않는 URL 이 만들어진다.

`isPrivate: true` 면 raw URL 은 코멘트에서 렌더링되지 않는다. 커밋은 그대로 두고, 이미지를 이슈 웹 UI 에 드래그해 올린 뒤 그 `user-attachments` URL 을 `comment.md` 에 쓴다.

## 7단계 — 이슈 코멘트 [필수]

`issue-start` 가 이미 같은 이슈에 리포트를 달았을 수 있다. 먼저 확인한다.

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
- `comment.md` 도 증거와 함께 커밋된 상태여야 한다. 6단계가 이미 포함한다.
- **이 단계에서 `comment.md` 를 고치지 않는다.** 고쳐야 할 것이 보이면 5단계로 돌아가 고치고 6단계를 다시 돌린 뒤 여기로 온다.
- 이슈 번호가 확정되지 않았으면 **코멘트하지 않는다.** 남의 이슈에 다는 사고가 난다.

## 8단계 — 렌더링 확인

코멘트 URL 을 사용자에게 보여주고 이미지가 실제로 보이는지 확인받는다. 현재 단계를 함께 적는다.

```text
issue-end 8단계(코멘트 렌더링 확인)입니다. 아래 링크에서 이미지가 보이는지 확인해 주세요.
```

깨졌다면 원인은 셋이다.

1. 미러 push 가 안 됐다 → `mirror` 출력의 `pushed` 확인
2. `--mirrorRef` 를 안 넘겼다 → 폴백인데 기본 브랜치 URL 을 썼다
3. private 저장소다 → 웹 UI 업로드로 전환

## 9단계 — PR 생성

**증거가 없으면 PR 을 만들지 않는다.** 이유를 보고하고 멈춘다.

`context` 의 `openPr` 가 있으면 새로 만들지 않고 그 PR 에 코멘트할지 묻는다.

```bash
BASE=$(node <skill>/scripts/issue-end.mjs context | python3 -c "import json,sys; print(json.load(sys.stdin)['baseBranch'])")
gh pr create --base "$BASE" --head "$(git branch --show-current)" \
  --title "<type>(<scope>): <한 줄 요약>" \
  --body-file .issue/59/evidence/pr-body.md
```

`pr-body.md` 첫 줄에 **`Closes` / `Fixes` / `Resolves` 를 쓰지 않는다.** 그 키워드가 있으면 merge 되는 순간 GitHub 이 이슈를 닫는데, 통합 테스트는 그 뒤에 돌아간다. 검증되지 않은 이슈가 닫혀 버린다.

이슈는 `issue-merge` 가 통합 테스트를 통과시킨 뒤 명시적으로 닫는다. 추적을 잃지 않도록 참조만 남긴다.

```markdown
관련 이슈: #59 (통합 테스트 뒤 close)

## 변경 내용
- <파일 단위 요약>

## 검증
- <실행한 명령과 결과>

## 증거
<이슈 코멘트 URL>
```

PR 생성은 push 와 **따로** 확인받는다. 질문 본문에 현재 단계를 적는다.

```text
질문   issue-end 9단계(PR 생성)입니다. 증거와 코멘트가 모두 올라갔습니다. PR 을 만들까요?
```

## merge 하지 않는다

이 스킬은 `gh pr merge` 를 실행하지 않는다. `--delete-branch` 도 붙이지 않는다.

여러 워크트리를 동시에 굴리는 것이 전제라, 하나를 먼저 merge 하면 나머지의 기준선이 흔들린다. 통합은 모아서 `issue-merge` 가 한다. 사용자가 merge 를 요청하면 `references/next-actions.md` 로 넘어간다.
