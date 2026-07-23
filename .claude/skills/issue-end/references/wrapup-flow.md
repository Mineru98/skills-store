# 마무리 절차 — 코멘트 · PR · merge · 정리

각 단계는 **직전 단계가 끝난 뒤에** 확인을 받는다. 미리 묶어서 승인받지 않는다.

## 1. 이슈 코멘트 등록

본문을 파일로 만들어 붙인다. 인라인 문자열은 마크다운이 깨지기 쉽다.

```bash
node <skill>/scripts/issue-end.mjs urls --issue 59   # URL 확보
# 초안을 .issue-evidence/59/comment.md 로 작성
gh issue comment 59 --body-file .issue-evidence/59/comment.md
```

- 다른 저장소면 `--repo <owner>/<name>` 을 붙인다.
- 코멘트 본문 초안은 등록 전에 사용자에게 그대로 보여준다.
- `comment.md` 도 증거와 함께 커밋한다. 나중에 어떤 근거로 닫았는지 남는다.

## 2. 링크 반환 후 확인

```bash
gh issue view 59 --json url --jq .url
```

사용자에게 링크를 주고 다음을 확인해 달라고 요청한다.

- 이미지가 실제로 렌더링되는가
- 표 수치와 설명이 맞는가
- 빠진 케이스가 있는가

여기서 수정 요청이 오면 코멘트를 수정한다.

```bash
gh issue comment --edit-last --body-file .issue-evidence/59/comment.md 59
```

이미지가 깨졌다면 원인은 대개 셋 중 하나다. push 안 됨 / private 저장소 / 경로 오타.
`evidence-commit.md` 의 해당 절로 돌아간다.

## 3. PR 생성 (확인 필요)

문제 없다는 답을 받은 뒤에 묻는다.

```bash
BASE=<baseBranch>
gh pr create --base "$BASE" --head "$(git branch --show-current)" \
  --title "<타입>(<범위>): <한 줄 요약>" \
  --body-file .issue-evidence/59/pr-body.md
```

PR 본문은 이슈 코멘트를 재사용하되 첫 줄에 이슈 연결을 넣는다.

```markdown
Closes #59

<이슈 코멘트 본문>
```

`context` 출력에 `openPr` 가 이미 있으면 새로 만들지 않고 그 PR 에 코멘트를 추가할지 확인한다.

## 4. merge (확인 필요)

PR 링크를 주고 확인을 받은 뒤에만 실행한다.

```bash
gh pr checks <번호>            # CI 상태 먼저 확인
gh pr merge <번호> --squash    # merge 방식은 저장소 관례를 따른다
```

- CI 가 실패 중이면 merge 를 제안하지 않는다. 실패 내용을 먼저 보고한다.
- merge 방식(`--squash` / `--merge` / `--rebase`)은 최근 머지 커밋 형태를 보고 맞춘다.
- `--delete-branch` 는 자동으로 붙이지 않는다. 브랜치 삭제는 5단계에서 따로 확인한다.
  증거 URL 이 브랜치에 의존하므로 미러가 끝났는지 먼저 확인한다.

## 5. 브랜치·워크트리 정리 (확인 필요)

```bash
git worktree list                       # 대상 경로 확인
cd <메인 저장소 경로>
git worktree remove <워크트리 경로>
git branch -d <브랜치>
git push origin --delete <브랜치>       # 원격도 지울지 별도 확인
```

주의:

- 정리 전에 워크트리에 커밋되지 않은 변경이 없는지 확인한다(`git -C <경로> status --porcelain`).
- `evidence/issue-<n>` 브랜치는 **삭제 대상이 아니다**. 이 브랜치를 지우면 코멘트 이미지가 깨진다.
- 미러가 기본 브랜치로 들어갔다면 작업 브랜치는 지워도 이미지가 살아 있다. 그 사실을 알려준다.
- 현재 셸이 그 워크트리 안이면 먼저 메인 저장소로 이동해야 한다.

## 6. 종료 보고

마지막에 다음을 한 번에 정리해 보고한다.

```text
이슈        #59 <제목> · <링크>
코멘트      <코멘트 링크>
증거        before/after N장 (webp) 또는 성능 비교표
커밋        <작업 브랜치 커밋 해시> / 미러: <mirrorRef>
PR          #123 <링크> · 상태
정리        워크트리 제거 여부, 남긴 브랜치
남은 일     사용자가 직접 해야 할 것
```

건너뛴 단계가 있으면 왜 건너뛰었는지 한 줄로 남긴다.
