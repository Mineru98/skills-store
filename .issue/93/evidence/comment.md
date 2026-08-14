## 작업 요약

엣지 스키마를 v3 로 가산 확장했습니다. `#N` 참조 주변 문장을 결정론적으로 verbatim 발췌해
`evidence[]` 에 저장하고, `kind`(5분류)·`context`(요약·라벨·공유 개념·신뢰도)·`status` 수명주기
(stale/resolved)를 추가했습니다. LLM 은 사용하지 않으며, `rationale` 은 `context.summary` 복사로
하위 호환을 유지해 issue-viz·issue-onboard 가 무수정으로 동작합니다.

## 구조 비교 (실데이터 sync, 50 nodes)

| 항목 | 전 | 후 | 변화 |
| --- | ---: | ---: | ---: |
| 엣지 수 | 5 | 6 | +1 (#94→#93 신규 감지) |
| evidence 보유 엣지 | 0 / 5 | 6 / 6 | **0% → 100%** |
| rationale | 고정 문자열 1종 | 참조 원문 기반 요약 | 검증 가능 |
| resolved 전이 | 없음 | 5건 (대상 close) | 신규 |
| kind 분류 | 없음 | blocked-by 6건 | 신규 |

측정 원본: `.issue/93/evidence/before/edges.json` / `after/edges.json` / `after/sync-log.txt`

## 근거 예시 — #94→#93 엣지 (새 코드 실행 결과 그대로)

```jsonc
{
  "from": 94, "to": 93, "type": "depends-on", "kind": "blocked-by",
  "rationale": "#94 본문이 \"depends on #93\" 로 #93 을(를) 참조",
  "context": { "label": "depends on #93", "sharedConcepts": [".claude/skills/*/scripts/issue-common.mjs", "enhancement"], "generatedBy": "deterministic", "confidence": "high" },
  "evidence": [{ "issue": 94, "field": "body", "author": "Mineru98",
    "quote": "…LLM 실패 시에도 그래프는 결정론 근거를 유지해야 한다.\n\ndepends on #93\n…",
    "start": 7, "end": 211, "digest": "sha256:d9f4ac86…" }],
  "status": "active", "schemaVersion": 1
}
```

quote 는 NFC 정규화 후 `indexOf` 재검증을 통과한 offset 만 저장합니다 (LLM 재생성 없음).

## 변경 파일

- `.claude/skills/issue-onboard/scripts/issue-graph-v2.mjs` — `extractQuote` / `sharedConcepts` / `kindOfType` / `carryStaleEdges` / `EDGE_CONTEXT_VERSION` 추가
- `.claude/skills/issue-onboard/scripts/issue-onboard.mjs` — `parseDependencies` 에 offset·원문 반환, cmdSync 엣지 조립 재구성, `graph.staleEdges` 이관
- `.codex/skills/issue-onboard/scripts/` — 동일 내용 동기화 (기존에 포맷만 다르던 사본을 byte-identical 로 통일, export 동등성 확인)
- `scripts/test-issue-graph-v2.mjs` — 발췌·NFC·공유 개념·stale 이관·결정론 어서션 추가

## 검증

- `node scripts/test-issue-graph-v2.mjs` 통과 (신규 어서션 포함)
- 실데이터 sync 2회 연속 실행 — `SNAPSHOT_STATUS=complete`, 결과 결정론적 동일
- stale 이관: 재감지되지 않은 sync 엣지는 `graph.staleEdges` 로 이동해 스케줄링(classify/viz derive)에 영향 없음 — 소비 코드 무수정 완료 기준을 이 방식으로 충족
- `sh scripts/check-shared.sh` — issue-onboard 는 DRIFT 없음 (issue-create/start/end/merge 의 기존 드리프트는 이 작업과 무관하게 main 에서도 동일하게 실패)

## 남은 이슈

- LLM 요약·분류 보강은 #94, 근거 표시 UI 는 #95 에서 이어집니다
- 캡처 이미지 없음 — 렌더링 UI 변경이 없는 데이터 파이프라인 작업이라 구조 diff·로그를 증거로 남깁니다
