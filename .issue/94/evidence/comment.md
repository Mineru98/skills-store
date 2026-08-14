## 작업 요약

결정론 패스(#93) 위에 LLM 보강 패스를 얹었습니다. sync 가 claude CLI(headless)를 자동 탐지해
엣지별 한국어 요약·kind 재분류·칩 라벨·키워드를 배치 생성하고, 별도 entailment 판정으로
confidence 를 확정합니다. 인용문은 LLM 이 건드리지 않으며(결정론 산출물 그대로), CLI 부재·실패
시 결정론 결과로 조용히 폴백합니다.

## 결과 비교 (실데이터 sync, 50 nodes / 6 edges)

| 항목 | 전 (결정론) | 후 (LLM 보강) |
| --- | --- | --- |
| context.summary | 템플릿 문장 ("#94 본문이 …로 참조") | 의미 요약 ("결정론 근거 위에 LLM이 한국어 요약과 관계 분류를 보강한다") |
| context.label | 매치 원문 ("depends on #93") | 의미 라벨 ("LLM 엣지 보강", ≤20자) |
| confidence | 일률 high | entailment 판정 — high 4 / medium 1 / 생략 1(결정론 유지) |
| generatedBy | deterministic 6 | llm 4~6 + deterministic(모델이 근거 불충분 판단 시) |

측정 원본: `.issue/94/evidence/before/edges.json` / `after/edges.json`

## 파이프라인 검증 (완료 기준 대응)

| 완료 기준 | 검증 | 결과 |
| --- | --- | --- |
| shortlist 에만 호출 (all-pairs 없음) | 결정론 엣지 6건만 배치 2회 호출 | `after/sync-llm.txt` |
| 한국어 summary/kind/label 저장 | 실호출 결과 | `LLM_ENRICHED=4~6` |
| verbatim 게이트 위반 미저장 | validateEnrichment 테스트 + quote 는 LLM 미개입 구조 | 테스트 통과 |
| 캐시 히트 시 재호출 없음 | 2회차 sync `LLM_CACHED=6` + mock 테스트(재호출 시 throw) | `after/sync-cache.txt` |
| LLM 비활성 시 정상 결정론 | 캐시 없는 상태 + 존재하지 않는 CLI 로 sync | `after/sync-fallback.txt` — `SNAPSHOT_STATUS=complete`, generatedBy 전부 deterministic |

추가 방어: 호출·파싱 실패는 **캐시하지 않아** 다음 sync 가 재시도합니다 (일시 장애의 영구화 방지).
모델이 응답에서 생략한 엣지만 부정 캐시됩니다.

## 변경 파일

- `.claude/skills/issue-onboard/scripts/issue-llm.mjs` — 신규 (cacheKey·CLI 탐지·배치 프롬프트·검증 게이트·enrichEdges)
- `.claude/skills/issue-onboard/scripts/issue-onboard.mjs` — cmdSync 훅 + `--no-llm` + LLM_* 통계 출력
- `.codex/skills/issue-onboard/scripts/` — 동일 동기화 (diff 0)
- `scripts/test-issue-graph-v2.mjs` — cacheKey·검증 게이트·mock runner 파이프라인·폴백 어서션

## 검증

- `node scripts/test-issue-graph-v2.mjs` 통과 (실 LLM 없이 mock 으로 파이프라인 전 경로 검증)
- 실호출 sync → 캐시 sync → 폴백 sync 3종 로그 전부 `SNAPSHOT_STATUS=complete`

## 남은 이슈

- 근거 표시 UI(#95), 검색(#96)이 이 필드를 소비합니다
