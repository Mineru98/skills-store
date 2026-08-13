## 작업 요약

실행 순서 뷰를 상태별 스윔레인(완료 → 지금 착수 → 진행 중 → 대기)으로 재구성하고, depends-on 엣지를 SVG 곡선으로 상시 오버레이했습니다.
카드를 선택하면 해당 의존 체인만 진하게 강조되고, blocked 카드에는 `↳ #N 완료 대기` 차단 원인이 인라인 표기됩니다.
webp 캡처에 레인+관계선이 담기도록 초기 모드를 `execution` 으로 변경했습니다 (작업 맥락 탭은 그대로 유지).

## 변경 전후

| 전 | 후 |
| --- | --- |
| ![실행 순서 뷰 - 전](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/before/execution.webp) | ![실행 순서 뷰 - 후](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/after/execution.webp) |
| ![작업 맥락 뷰 - 전](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/before/context.webp) | ![작업 맥락 뷰 - 후](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/after/context.webp) |

빨간 박스가 변경 구간입니다. 전: 카운터 + 평면 카드 그리드(관계선·범례 없음) → 후: 상태명·건수가 달린 4개 레인 + 의존 관계선. 작업 맥락 뷰는 blocked 카드의 차단 원인 표기 외 동일합니다.

## 신규 상호작용 (before 없음 — 새 기능)

<details>
<summary>카드 선택 시 의존 체인 강조 / 완료 레인 접기 + 활성 엣지만 토글</summary>

| 카드 선택 (체인 강조) | 토글 적용 |
| --- | --- |
| ![선택 체인 강조](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/after/execution-selected.webp) | ![토글 적용](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/91/evidence/after/execution-toggles.webp) |

#73 선택 시 선행 이슈(#2, #5, #60)에서 들어오는 체인만 진한 선으로 강조됩니다. 토글 화면은 완료 레인이 접히고 활성 이슈 엣지만 남은 상태입니다.

</details>

현재 그래프에는 blocked 이슈가 없어 `↳ #N 완료 대기` 표기는 캡처에 없습니다. 해당 로직은 `scripts/test-issue-viz-v2.mjs` 의 blocked 픽스처(#4, #5)로 검증했습니다.

## 변경 파일

- `.claude/skills/issue-viz/scripts/issue-viz.mjs` — CLIENT_JS 스윔레인 뷰 + 엣지 드로잉 + 토글, CSS 레인·엣지 스타일
- `.codex/skills/issue-viz/scripts/issue-viz.mjs` — 동일 내용 동기화 (diff 0)
- `scripts/test-issue-viz-v2.mjs` — 스윔레인 마커 어서션 추가

## 검증

- `node scripts/test-issue-viz-v2.mjs` 통과 (기존 + 신규 어서션 7개)
- 실데이터(46 nodes / 5 edges) 렌더 후 1440×900 캡처로 레인·엣지·선택 강조·토글 동작 확인
- `.claude` ↔ `.codex` 사본 diff 없음, 외부 네트워크 요청 0건 (자립형 HTML 유지)

## 남은 이슈

- 없음
