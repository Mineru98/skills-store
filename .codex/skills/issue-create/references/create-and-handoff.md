# 등록과 인계

## 스크립트 방식 (권장)

초안을 임시 파일로 저장한 뒤 등록한다.

```bash
node <skill>/scripts/issue-create.mjs create \
  --title "탭 활성 상태가 새로고침 후 초기화됨" \
  --body-file /tmp/issue-draft.md \
  --label bug

# 확인만: --dry-run
# 다른 저장소: --repo <owner>/<name>
# 원본 요청을 따로 남길 때: --request-file /tmp/user-request.md
```

출력 마지막의 `ISSUE_NUMBER` / `ISSUE_URL` / `NEXT` 를 그대로 보고에 쓴다.

`--label` 은 생략할 수 없다. **스크립트가 막는다** — 라벨 없이 `create` 를 부르면 exit 2 로 빠지고 이슈를 만들지 않는다.

```text
✗ --label 이 하나 이상 필요하다. 라벨 없는 이슈는 만들지 않는다.
```

붙일 라벨을 정하지 못했으면 등록 전에 `references/label-audit.md` 로 돌아간다. 저장소에 쓸 라벨이 하나도 없으면 `ensure-label` 로 만들되 **사용자 승인을 먼저 받는다.**

`--no-label` 이라는 탈출구가 있지만, 규칙을 의도적으로 벗어날 때만 쓰고 그 사유를 보고에 남긴다. 모델이 라벨을 고르기 귀찮아서 쓰는 용도가 아니다.
등록 직후 `unlabeled` 로 기존 이슈의 라벨도 점검한다.

## 여러 건 등록

`create` 는 이슈 하나만 만든다. **항목마다 따로 호출한다.**

```bash
node <skill>/scripts/issue-create.mjs create \
  --title "대시보드 기간 필터 추가" --body-file /tmp/draft-1.md \
  --request-file /tmp/request-1.md --label enhancement

node <skill>/scripts/issue-create.mjs create \
  --title "주문 목록 빈 렌더링 수정" --body-file /tmp/draft-2.md \
  --request-file /tmp/request-2.md --label bug

node <skill>/scripts/issue-create.mjs create \
  --title "레거시 export 스크립트 제거" --body-file /tmp/draft-3.md \
  --request-file /tmp/request-3.md --label chore
```

규칙은 셋이다.

- **실패해도 멈추지 않는다.** 한 건이 실패하면 그 항목만 접고 다음 항목으로 간다. 첫 실패로 나머지를 날리지 않는다.
- **결과는 마지막에 한 번 모아 보고한다.** 항목마다 성공 로그를 늘어놓지 않는다. 실패한 항목은 초안 파일 경로를 남긴다.
- `.gitignore` 블록 추가 메시지는 **첫 호출에서만** 나온다. 두 번째부터 조용한 것이 정상이다.

`--request-file` 에 넣을 내용은 `issue-draft.md` 의 "원본 요청 기록" 규약을 따른다.
항목이 하나뿐이면 이 절은 무시하고 위의 단건 절차를 그대로 쓴다.

## 산출물

```text
.issue/<번호>/request.md    원본 요청 + 이슈 링크
```

`issue-start` 가 같은 디렉터리를 쓰기 때문에 4단계 대조 분석에서 이 파일을 바로 읽는다.

`create` 는 `.gitignore` 에 `.issue` 블록이 없으면 **직접 추가한다.** 경고만 하고 넘어가지 않는다.

```gitignore
# issue-* workspace — evidence only stays committed so issue comments render
.issue/**
!.issue/*/
!.issue/*/evidence/
!.issue/*/evidence/**
.issue/**/.auth.json
.issue/**/storage-state.json
```

`request.md` 와 `plan.md` 는 무시되고, 나중에 `issue-start` 가 만드는 `.issue/<번호>/evidence/` 만 커밋된다.
증거 원본을 보존하기 위해 공개 범위와 무관하게 커밋한다. 이슈 코멘트의 인라인 이미지는
공개 저장소면 미러 raw URL, 비공개 저장소면 이슈 웹 UI 의 `user-attachments` URL 을 쓴다.
`issue-start` 는 게시 뒤 실제 렌더링까지 확인해야 한다.

## 인라인 방식 (스크립트가 없을 때)

```bash
gh issue create --title "<제목>" --body-file /tmp/issue-draft.md --label bug
# 출력 URL 끝의 숫자가 이슈 번호

mkdir -p .issue/<번호>
cp /tmp/issue-draft.md .issue/<번호>/request.md
# 위 .gitignore 블록도 직접 추가한다
```

## 인계

등록 직후 AskUserQuestion 으로 묻는다.

```text
바로 착수     issue-start 를 #<번호> 로 이어서 실행 (워크트리까지 생성)
나중에        번호와 `$issue-start #<번호>` 만 안내하고 종료
```

"바로 착수" 를 고르면 `issue-start` 는 방금 만든 이슈를 `gh` 로 다시 받아온다.
초안 내용을 대화 컨텍스트에서 재사용하지 않고, 실제 등록된 본문을 기준으로 분석하게 둔다.

이슈를 보여줄 때는 `ISSUE_URL` 로 링크를 만든다.

```text
등록됨   [#59 탭 활성 상태가 새로고침 후 초기화됨](https://github.com/owner/repo/issues/59)
```

### 여러 건일 때

**첫 번호로만 이어간다.** 나머지는 번호와 명령만 안내한다.

```text
바로 착수     issue-start 를 #61 로 실행. #62, #63 은 나중에
나중에        세 번호와 명령만 안내하고 종료
```

여러 이슈를 한 세션에서 동시에 착수하지 않는다. `issue-start` 는 이슈마다 워크트리를 파므로
동시에 굴리면 어느 워크트리에서 편집 중인지 잃는다. 병렬로 굴리고 싶으면 세션을 나눠
`issue-start` 를 각각 부르고, 마지막에 `issue-merge` 로 한 번에 통합한다.

## DAG 배선 (issue-todo 사용 시)

`.issue/graph.json` 이 있으면(issue-todo 사용 중) 새로 만든 이슈의 노드는 `status:open` 자동 부착이
`setTrackerStatus` 를 지나며 그래프에 자동 등록된다. **분할 때 확정한 의존은 그때만 알 수 있으므로**
버리지 말고 엣지로 남긴다. 본문에 `depends on #N` 을 적으면 `issue-todo sync` 가 자동 감지하고,
즉시 걸려면 아래로 근거와 함께 남긴다.

```bash
node <issue-todo>/scripts/issue-todo.mjs link <새 이슈> <선행 이슈> --why "<왜 막히는지>"
```

예: API 이슈 #71 이 UI 이슈 #72 의 선행이면 `link 72 71 --why "72 는 71 의 API 계약이 필요"`.

## 실패 처리

- `gh issue create` 실패(권한·라벨 없음 등) → 실패 원문을 보여주고 초안 파일 경로를 알린다. 재시도는 라벨을 뺀 상태로 한 번만.
- 저장소에 이슈가 비활성화되어 있으면 초안만 남기고 종료한다.
- 여러 건 중 일부만 실패했으면 성공한 번호는 그대로 살리고, 실패한 항목만 마무리 보고의 `실패` 줄에 초안 경로와 함께 남긴다. 이미 만든 이슈를 되돌리지 않는다.
