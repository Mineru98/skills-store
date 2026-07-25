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

`--label` 은 생략하지 않는다. 붙일 라벨을 정하지 못했으면 등록 전에 `references/label-audit.md` 로 돌아간다.
등록 직후 `unlabeled` 로 기존 이슈의 라벨도 점검한다.

## 산출물

```text
.issue-start/<번호>/request.md    원본 요청 + 이슈 링크
```

`issue-start` 가 같은 디렉터리를 쓰기 때문에 4단계 대조 분석에서 이 파일을 바로 읽는다.
`.issue-start/` 가 `.gitignore` 에 없으면 스크립트가 경고한다. 추가를 제안한다(커밋 대상이 아니다).

## 인라인 방식 (스크립트가 없을 때)

```bash
gh issue create --title "<제목>" --body-file /tmp/issue-draft.md --label bug
# 출력 URL 끝의 숫자가 이슈 번호

mkdir -p .issue-start/<번호>
cp /tmp/issue-draft.md .issue-start/<번호>/request.md
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
