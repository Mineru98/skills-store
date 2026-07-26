## 작업 요약

`issue-start` / `issue-end` / `issue-merge` 가 사용자에게 말을 걸 때 **현재 단계를 반드시 밝히도록** 출력 규약을 추가했습니다.

세 SKILL.md 는 이미 `# 문제 보고 형식` 이라는 공통 출력 규약을 갖고 있었지만, 그 규약은 "문제가 생겼을 때"만 다뤘습니다. 정상 흐름의 전이 보고와 승인·확인 질문에는 어떤 규약도 없었습니다. 같은 자리에 `# 현재 단계 밝히기` 를 나란히 넣었습니다.

## 규칙

```text
표기      <스킬 이름> <n>단계(<단계 이름>)      예) issue-start 5단계(워크트리 생성)

위치      5줄 미만   단계를 먼저 말하고, 이어서 할 말을 한다
          5줄 이상   할 말을 먼저 하고, 마지막에 `현재 단계 — <표기>` 를 한 줄로

대상      전이 보고 (다음 단계로 넘어가기 직전)
          질문      (승인·확인·선택 — AskUserQuestion 포함)
```

줄 수는 사용자에게 보이는 본문 기준이고, AskUserQuestion 의 선택지는 세지 않습니다. 질문일 때는 질문 본문에 넣고 선택지 라벨에는 넣지 않습니다.

번호를 즉석에서 지어내지 않도록 각 SKILL.md 에 **단계 이름 정본 표**를 넣었습니다. 번호는 그 스킬이 실제로 만드는 TodoWrite 체크리스트 번호를 씁니다 — 사용자가 진행 상황으로 실제 보는 것이 그 목록이기 때문입니다.

## 변경 전후

문서 전용 변경이라 화면 캡처와 성능 측정이 성립하지 않습니다. 대신 같은 지점의 텍스트를 전후로 발췌해 증거로 남겼습니다.

원본: [`before/stage-banner-absent.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/11/evidence/before/stage-banner-absent.txt) · [`after/stage-banner-present.txt`](https://github.com/Mineru98/skills-store/blob/main/.issue/11/evidence/after/stage-banner-present.txt)

### issue-start — 워크트리 배치 질문

```diff
- 질문   워크트리를 어디에 만들까요? 한 번 정하면 이후 계속 이 방식을 씁니다.
+ 질문   issue-start 5단계(워크트리 생성)입니다.
+        워크트리를 어디에 만들까요? 한 번 정하면 이후 계속 이 방식을 씁니다.
```

### issue-end — 다음 행동 4지선다

```diff
- 질문   다음으로 무엇을 할까요?
+ 질문   issue-end 10단계(다음 행동 선택)입니다. PR 까지 끝났습니다. 다음으로 무엇을 할까요?
```

### issue-merge — merge 후보 확정

```diff
- 질문: 아래 <n>개를 이번 통합 대상으로 잡았습니다. 진행할까요?
+ 질문: issue-merge 3단계(merge 후보 확정)입니다.
+       아래 <n>개를 이번 통합 대상으로 잡았습니다. 진행할까요?
```

### 마무리 보고 템플릿

```diff
  다음      <사용자가 고른 행동>
+
+ 현재 단계 — issue-end 10단계(다음 행동 선택) 완료
```

## 변경 파일

28개 파일 (`.claude` 14 + `.codex` 미러 14).

```text
SKILL.md × 3        '현재 단계 밝히기' 섹션 · 단계 이름 정본 표 · hard-rule ·
                    <reporting> 확장 · 마무리 보고 템플릿에 현재 단계 줄

references × 11     실제 질문·확인 지점의 예시 문구에 단계 표기 반영
  issue-start       intake.md · worktree.md · implementation.md · evidence-capture.md
  issue-end         context-triage.md · evidence-recheck.md · report-and-pr.md · next-actions.md
  issue-merge       inventory.md · merge-plan.md · verify-and-close.md
```

`.codex/skills/` 는 `.claude/skills/` 의 완전한 사본입니다(`agents/` 제외). 양쪽을 동기화했습니다.

## 묻지 않는 필수 단계도 대상입니다

`issue-end` 의 6·7단계(증거 커밋, 이슈 코멘트)는 선택지가 없어 묻지 않습니다. 그렇다고 상태를 안 알리는 것은 아니어서, **질문 대신 전이 보고로 단계를 밝히도록** 명시했습니다. `issue-start` 8단계의 무확인 커밋도 같습니다.

## 검증

```text
✓ 공통 블록 존재          6개 SKILL.md 모두 1건
✓ .claude / .codex 동기화  agents/ 를 제외하면 완전 일치
✓ issue-create 무변경      커밋에 issue-create 경로 0건
✓ 증거 혼입 없음           구현 커밋에 .issue/ 경로 0건
```

저장소에 빌드·테스트 스크립트가 없는 문서 저장소라 lint·build 단계는 해당 없습니다.

## 남은 이슈

인접 이슈 둘과 범위가 겹치지 않습니다.

- #9 — 승인 지점을 AskUserQuestion 으로 통일. **어떤 도구로 묻는가.**
- #6 — 종료 시 다음 단계 4지선다 추천. **앞으로 무엇을 할지.**
- 이 이슈 — **지금 어디에 있는지.**

작업 중 별건 하나를 발견했습니다. `scripts/issue-*.mjs` 의 엔트리포인트 가드가 심볼릭 링크 실행을 버티지 못해, `~/.claude/skills/...` 경로로 부르면 `main()` 이 돌지 않고 exit 0 으로 조용히 끝납니다. 이번 범위 밖이라 손대지 않았습니다.
