# after — 변경 후 원문 (구현 커밋 34585f7)

## issue-start/references/next-actions.md
```text
상황에 따라 권장 위치를 바꾼다.

- `plan.md` 의 작업 계획에 **끝내지 못한 항목이 남아 있으면** 2번을 권장으로 올린다. 무엇이 남았는지 한 줄로 적는다.
- 검증 명령이 실패한 채로 왔으면 2번을 권장으로 올린다. **실패를 덮은 채 PR 로 넘기지 않는다.**
- 현재 이슈를 제외한 남은 열린 이슈가 하나도 없으면 3번(다른 이슈 착수)을 선택지에서 뺀다. 다른 이슈 착수는 남은 열린 이슈가 있을 때만 제안한다.
- 그 외에는 1번이 권장이다.
```

## issue-end/references/next-actions.md
```text
- 남은 열린 이슈가 하나도 없으면 1번(다른 이슈 착수)을 선택지에서 빼고 3번을 권장으로 올린다. 다른 이슈 착수는 남은 열린 이슈가 있을 때만 제안한다.
- 워크트리가 이 작업 하나뿐이면 2번 설명에 "현재 1개"라고 적는다.
```

## issue-merge/references/next-actions.md
```text
- **보류된 워크트리가 있으면 2번을 권장으로 올린다.** 무엇이 왜 빠졌는지 한 줄씩 적는다.
- **통합 테스트에서 회귀가 나왔으면 3번을 권장으로 올린다.** 회귀는 기억이 아니라 이슈로 남겨야 한다.
- 남은 열린 이슈가 하나도 없으면 1번(다른 이슈 착수)을 선택지에서 빼고 3번을 권장으로 올린다. 다른 이슈 착수는 남은 열린 이슈가 있을 때만 제안한다.
- 그 외에는 1번이 권장이다.
```

## git diff 발췌
```diff
34585f7 fix(issue-skills): 다른 이슈 착수 제안을 남은 열린 이슈가 있을 때만 하도록 통일

 .claude/skills/issue-end/references/next-actions.md   | 2 +-
 .claude/skills/issue-merge/references/next-actions.md | 2 +-
 .claude/skills/issue-start/references/next-actions.md | 1 +
 3 files changed, 3 insertions(+), 2 deletions(-)
```
