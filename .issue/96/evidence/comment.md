## 작업 요약

substring 검색을 MiniSearch(vendored 인라인, MIT) 기반 맥락 검색으로 교체했습니다.
한글 문자 bigram 토크나이저로 조사·어미 변형("그래프를" ↔ "그래프")을 형태소 분석기 없이 잡고,
엣지(요약·라벨·키워드·인용문)를 1급 검색 문서로 색인해 "관계" 결과 그룹을 제공합니다.
기존 substring 매치는 OR fallback 으로 유지되고, 렌더 HTML 의 외부 네트워크 요청은 0건입니다.

## 변경 전후 — 같은 질의 "그래프를"

| 전 (substring) | 후 (MiniSearch + bigram) |
| --- | --- |
| ![검색 전](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/96/evidence/before/search-josa.webp) | ![검색 후](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/96/evidence/after/search-josa.webp) |

전: 조사 붙은 질의는 어떤 제목과도 일치하지 않아 결과 0건.
후: "이슈 그래프 V2 설계"(#78)·"그래프 상태 동기화"(#82)가 bigram 으로 매치되고,
상단에 **관계 1건**(#94→#93, 엣지 요약 스니펫 하이라이트) 그룹이 표시됩니다 (빨간 박스).

## 신규 기능 (before 없음)

<details>
<summary>관계 검색 그룹 · 검색-그래프 하이라이트 연동</summary>

| 엣지 요약·인용문 검색 ("보강") | 매치 엣지 hot 강조 ("DAG") |
| --- | --- |
| ![관계 검색](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/96/evidence/after/search-relation.webp) | ![하이라이트 연동](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/96/evidence/after/search-highlight.webp) |

관계 결과를 클릭하면 #95 의 엣지 드로어(근거 카드)로 이동합니다.
검색 시 양끝이 모두 매치된 엣지는 스윔레인 위에서 진한 선으로 강조됩니다.

</details>

## 변경 파일

- `.claude/skills/issue-viz/assets/minisearch.min.js` — 신규 vendored (v7.2.0, MIT 배너, 18.5KB)
- `.claude/skills/issue-viz/scripts/issue-viz.mjs` — krTokenize(서버 export)·miniSearchInline·색인·관계 그룹·하이라이트
- `.codex/skills/issue-viz/` — 동일 동기화 (scripts·assets diff 0)
- `scripts/test-issue-viz-v2.mjs` — bigram 단위 검증(`'그래프를'→['그래프를','그래','래프','프를']`)·인라인·fallback·CDN 부재 어서션

## 검증

- `node scripts/test-issue-viz-v2.mjs` 통과
- 렌더 HTML 158KB (MiniSearch 인라인 포함), 외부 `src=`/`href=` http 참조 0건
- 실데이터(50 nodes / LLM 보강 엣지 6건) 1440×900 실캡처 3종으로 완료 기준 검증
- MiniSearch 자산 부재 시 substring 전용 폴백 (typeof 가드)

## 남은 이슈

- 없음. 키워드 확장·임베딩(리서치 선택 단계)은 효과 검증 후 별도 이슈로.
