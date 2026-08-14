## 작업 요약

스윔레인 DAG 의 관계선에 "왜 연결됐는지"를 3단 점진 공개로 렌더합니다.
① 엣지 중점의 라벨 칩 + 상태 배지(상시) ② 650ms 호버/포커스 인용문 카드(WCAG 1.4.13)
③ 드로어 엣지 모드(근거 카드 + 원문 링크 + digest 일치 배지). #93·#94 가 저장한
kind/context/evidence 필드를 소비하며, 필드가 없으면 rationale 로 폴백합니다.

## 변경 전후

| 전 | 후 |
| --- | --- |
| ![실행 순서 뷰 - 전](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/before/execution.webp) | ![실행 순서 뷰 - 후](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/after/execution.webp) |
| ![작업 맥락 뷰 - 전](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/before/context.webp) | ![작업 맥락 뷰 - 후](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/after/context.webp) |

빨간 박스가 변경 구간입니다. 전: 이름 없는 관계선뿐 → 후: 엣지마다 라벨 칩("시각화 기초" 등)과
해소됨·추정 배지가 상시 표시됩니다. resolved 엣지는 흐리게, kind 별로 선 스타일이 구분됩니다.

## 신규 상호작용 (before 없음 — 새 기능)

<details>
<summary>호버/포커스 근거 카드 · 드로어 엣지 근거 뷰</summary>

| 근거 카드 (팝오버) | 드로어 엣지 모드 |
| --- | --- |
| ![근거 카드](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/after/edge-popover.webp) | ![드로어](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/95/evidence/after/edge-drawer.webp) |

칩 focus/호버 시 verbatim 인용문 + 출처 breadcrumb("#61 본문 · @Mineru98 · 날짜")가 열리고,
클릭하면 드로어에 연결 요약·근거 카드(원문 보기 링크 + digest 일치 배지)·공유 개념·생성 정보
(llm · haiku · confidence)가 표시됩니다. Raw JSON 은 details 로 접혔습니다.

</details>

## 변경 파일

- `.claude/skills/issue-viz/scripts/issue-viz.mjs` — 칩 레이어·팝오버·히트 path·드로어 엣지 모드·kind/상태 선 스타일·staleEdges 렌더
- `.codex/skills/issue-viz/scripts/issue-viz.mjs` — 동일 동기화 (diff 0)
- `scripts/test-issue-viz-v2.mjs` — 소스 마커 어서션 (칩·팝오버·배지·ESC·rationale 폴백)

## 검증

- `node scripts/test-issue-viz-v2.mjs` 통과
- 실데이터(50 nodes / LLM 보강 엣지 6건) 1440×900 렌더 — 칩·팝오버·드로어 모두 실캡처로 확인
- 외부 네트워크 요청 0건 (자립형 HTML 유지), 모바일(≤760px)은 칩 레이어 숨김

## 남은 이슈

- 검색과의 연동(#96)이 이 칩·근거 필드를 검색 결과 하이라이트에 재사용합니다
