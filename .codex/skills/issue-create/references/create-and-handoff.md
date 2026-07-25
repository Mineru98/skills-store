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

`request.md` 와 `plan.md` 는 무시되고, 나중에 `issue-start` 가 만드는 `.issue/<번호>/evidence/` 만 커밋된다. 이슈 코멘트의 이미지가 raw URL 로 렌더링되려면 증거는 커밋돼야 하기 때문이다.

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
나중에        번호와 `/issue-start #<번호>` 만 안내하고 종료
```

"바로 착수" 를 고르면 `issue-start` 는 방금 만든 이슈를 `gh` 로 다시 받아온다.
초안 내용을 대화 컨텍스트에서 재사용하지 않고, 실제 등록된 본문을 기준으로 분석하게 둔다.

## 실패 처리

- `gh issue create` 실패(권한·라벨 없음 등) → 실패 원문을 보여주고 초안 파일 경로를 알린다. 재시도는 라벨을 뺀 상태로 한 번만.
- 저장소에 이슈가 비활성화되어 있으면 초안만 남기고 종료한다.
