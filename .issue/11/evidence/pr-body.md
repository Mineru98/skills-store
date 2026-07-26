관련 이슈: #11 (통합 테스트 뒤 close)

## 변경 내용

`issue-start` / `issue-end` / `issue-merge` 가 사용자에게 말을 걸 때 현재 단계를 반드시 밝히도록 출력 규약을 추가한다.

```text
표기   <스킬 이름> <n>단계(<단계 이름>)     예) issue-start 5단계(워크트리 생성)
위치   5줄 미만 → 앞    5줄 이상 → 마지막 줄에 `현재 단계 — <표기>`
대상   전이 보고 + 승인·확인 질문 (AskUserQuestion 포함)
```

- **SKILL.md × 3** — `# 현재 단계 밝히기` 섹션 신설, 단계 이름 정본 표, hard-rule 추가,
  `<reporting>` 확장, 마무리 보고 템플릿에 `현재 단계` 줄.
- **references × 11** — 실제 질문·확인 지점의 예시 문구에 단계 표기 반영 (합계 20건).
  - `issue-start` — intake / worktree / implementation / evidence-capture
  - `issue-end` — context-triage / evidence-recheck / report-and-pr / next-actions
  - `issue-merge` — inventory / merge-plan / verify-and-close
- **`.codex/skills/` 미러 동기화** — `.claude/skills/` 의 사본이라 양쪽을 맞춘다.

묻지 않는 필수 단계(`issue-end` 6·7, `issue-start` 8)도 대상이다. 확인을 안 받는 것과 상태를 안 알리는 것은 다르므로, 질문 대신 전이 보고로 단계를 밝히게 했다.

문서 전용 변경이며 스크립트 동작은 바뀌지 않는다.

## 검증

```text
✓ 공통 블록 존재          6개 SKILL.md 모두 1건
✓ hard-rule 반영          3개 SKILL.md 모두 1건
✓ 마무리 보고 템플릿       3개 SKILL.md 모두 '현재 단계 — ' 줄 보유
✓ 지점별 예시 문구         references 11개 파일 전부 1건 이상 (합계 20건)
✓ .claude / .codex 동기화  agents/ 를 제외하면 완전 일치
✓ issue-create 무변경      커밋에 issue-create 경로 0건
✓ 증거 혼입 없음           구현 커밋에 .issue/ 경로 0건
```

저장소에 빌드·테스트 스크립트가 없는 문서 저장소라 lint·build 는 해당 없다.

## 인접 이슈와의 경계

- #9 — 승인 지점을 AskUserQuestion 으로 통일. **어떤 도구로 묻는가.**
- #6 — 종료 시 다음 단계 4지선다 추천. **앞으로 무엇을 할지.**
- #11 — **지금 어디에 있는지.**

## 증거

https://github.com/Mineru98/skills-store/issues/11#issuecomment-5081648937
