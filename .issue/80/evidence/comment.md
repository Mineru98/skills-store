## 작업 요약

`issue-viz`를 V2 이슈 탐색 화면으로 교체했습니다. 작업 맥락과 실행 순서를 분리하고, 검색·필터·선택 inspector·실행 경로 계산을 추가했습니다.

## 변경 전후

변경 전에는 단일 force-directed 그래프만 제공했습니다. 변경 후에는 카드 기반 분석 작업대에서 상태·라벨·관계를 교차 필터링하고, 선택한 이슈의 context와 provenance를 확인할 수 있습니다.

| 전 | 후 |
| --- | --- |
| ![V1 단일 그래프](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/80/evidence/before/v1-graph.webp) | ![V2 작업 맥락 화면](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/80/evidence/after/v2-context.webp) |

![V2 모바일 작업 맥락 화면](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/80/evidence/after/v2-mobile.webp)

## 변경 파일

- `.claude/skills/issue-viz/scripts/issue-viz.mjs`
- `.codex/skills/issue-viz/scripts/issue-viz.mjs`
- `scripts/test-issue-viz-v2.mjs`

## 검증

- `node scripts/test-issue-graph-v2.mjs` 통과
- `node scripts/test-issue-viz-v2.mjs` 통과
- Chrome DevTools에서 실행 순서·검색 포커스·필터·선택 drawer·모바일 줄바꿈 재-QA 통과

## 남은 이슈

- 현재 snapshot은 acyclic이라, cycle 진단은 회귀 테스트로 검증했습니다.
