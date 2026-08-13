## 작업 요약

PR #86 revert 이후 `main`에 남아 있던 `issue-todo`를 다시 `issue-onboard`로 바꿨습니다.
그래프가 없으면 `issue-sync`가 GitHub 완전 스냅샷을 만들고, HTML·webp·우선순위·다음 행동을 한 번에 냅니다.
이번 재적용은 merge를 막았던 capability bundle 게이트를 현재 계약으로 다시 맞춰 통과시켰습니다.

## 변경 전후

![기존 issue-todo plan 출력](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/84/evidence/before/issue-onboard.webp)

![issue-onboard 그래프 온보딩 결과](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/84/evidence/after/issue-onboard.webp)

변경 전은 `issue-todo plan` 텍스트입니다. 변경 후는 그래프 온보딩 화면입니다.
Playwright가 없어 after 이미지에 빨간 박스는 그리지 못했습니다. viz가 만든 1440×900 webp를 그대로 씁니다.

## 변경 파일

- `.claude/skills/issue-onboard`, `.codex/skills/issue-onboard` — todo 스킬을 온보딩 진입점으로 이전
- `.claude/skills/issue-sync`, `.codex/skills/issue-sync` — 그래프 부재 시 완전 스냅샷
- `issue-viz` — HTML 렌더와 webp 추출
- README 설치 목록에 `issue-onboard`, `issue-sync` 추가

## 검증

- 그래프 없는 워크트리에서 `issue-sync` 자동 호출, `SNAPSHOT_STATUS=complete`
- 노드 44개, 엣지 5개 HTML·webp 생성
- 열린 이슈 우선순위: #84, #85
- 레거시 `todo` 명령 거부
- `node scripts/test-issue-graph-v2.mjs` 통과
- `node scripts/test-issue-viz-v2.mjs` 통과
- `node scripts/build-phase-capability-bundle.mjs --check` 통과
- `node scripts/test-phase-compatibility.mjs` 9/9
- `node scripts/test-capability-bundle-check.mjs` 통과

## 남은 이슈

- 없음
