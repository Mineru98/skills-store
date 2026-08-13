# 다음 행동

PR 까지 끝났으면 사용자가 다음에 무엇을 할지 고르게 한다. 여기서 흐름이 끊기면 워크트리만 쌓인다.

## 선택지 (순서 고정)

AskUserQuestion 으로 제시한다. 순서를 바꾸지 않는다. 새 작업을 이어가는 쪽이 기본값이다.
질문 본문에 현재 단계를 함께 적는다 — 여기가 이 스킬의 마지막 단계라는 사실 자체가 사용자에게 필요한 정보다.

```text
질문   issue-end 11단계(다음 행동 선택)입니다. PR 까지 끝났습니다. 다음으로 무엇을 할까요?

1. 다른 이슈 착수 (권장)   등록된 열린 이슈 중 하나를 골라 /issue-start
2. 워크트리 전부 merge     지금까지 쌓인 워크트리를 모아 /issue-merge
3. 새 이슈 등록            /issue-create
4. 종료                    여기서 마친다
```

선택지를 제시하기 전에 재료를 모아 함께 보여준다.

```bash
gh issue list --state open --limit 10 --json number,title,url,labels
git worktree list
```

- 남은 열린 이슈가 하나도 없으면 1번(다른 이슈 착수)을 선택지에서 빼고 3번을 권장으로 올린다. 다른 이슈 착수는 남은 열린 이슈가 있을 때만 제안한다.
- 워크트리가 이 작업 하나뿐이면 2번 설명에 "현재 1개"라고 적는다.

이슈·PR 은 `[설명](링크)` 형식으로, 워크트리 경로는 `context` 출력의 `worktrees[].display` 값으로 보여준다. 세부는 SKILL.md 의 `링크와 경로 쓰는 법`.

## 1번 — 다른 이슈 착수

이슈 목록을 번호·제목·라벨로 보여주고 고르게 한 뒤 `/issue-start <번호>` 로 넘긴다.

현재 워크트리에서 그대로 시작하지 않는다. `issue-start` 가 새 워크트리를 만든다.

## 2번 — merge

`issue-merge` 로 위임한다. **이 스킬이 직접 merge 하지 않는다.**

```text
/issue-merge
```

넘길 때 아래를 함께 전달한다.

- 방금 만든 PR 번호와 이슈 번호
- `git worktree list` 결과
- 기본 브랜치 이름

`issue-merge` 가 없으면 설치한다.

```bash
sh <migrate-skill-agent>/scripts/migrate-skill-agent.sh \
  --skill issue-merge --target home --link --clone --flavor <claude|codex>
```

설치도 안 되면 merge 를 대신 수행하지 말고, 사용자에게 직접 `gh pr merge` 를 실행하라고 안내한다. 통합 검증 절차 없이 merge 하는 것이 이 스킬군이 막으려는 상황이다.

## 3번 — 새 이슈 등록

`/issue-create` 로 넘긴다. 없으면 `issue-start` 의 `references/intake.md` 에 있는 설치 폴백 체인을 그대로 쓴다.

## 4번 — 종료

마무리 보고를 출력하고 끝낸다. 워크트리는 지우지 않는다.

```text
남은 워크트리   <n>개 — 통합하려면 /issue-merge
```

## 하지 않는 것

- **워크트리·브랜치 삭제.** 증거 URL 이 브랜치에 의존할 수 있고, 다른 작업이 진행 중일 수 있다. 정리는 `issue-merge` 가 통합을 마친 뒤에 한다.
- **`evidence/issue-<번호>` 브랜치 삭제.** 폴백으로 만들어진 증거 브랜치는 영구 보존 대상이다.
- **사용자에게 묻지 않고 다음 스킬로 넘어가기.** 이 선택은 반드시 사용자가 한다.
