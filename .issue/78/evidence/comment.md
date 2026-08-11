# 구현 리포트

## 결과

GitHub 정본 기반 이슈 그래프 V2를 구현했다. 캐시는 구조화된 결정 코멘트와 이슈 본문에서만 다시 만들며,
`depends-on`만 일정 계산에 사용한다.

## 핵심 변경

- 관계를 `depends-on`, `parent-of`, `duplicate-of`, `relates-to`, `supersedes`로 고정했다.
- `duplicate-of`는 증거와 GitHub 코멘트 provenance가 있는 승인 결정만 반영한다.
- snapshot이 부분·실패·지원되지 않는 버전·dangling·순환·마이그레이션 상태면 plan/next를 fail-closed 한다.
- sync는 이전 캐시를 GitHub snapshot으로 완전 교체하고 원자 저장한다. 캐시는 private 본문·댓글을 담을 수 있어 추적하지 않는다.
- issue-create는 네 중복 조건을 검토 파일로 받아, 완전 일치 후보에서 GitHub 구조화 결정 id 없이는 새 이슈를 만들지 않는다.
- 네 필수 조건을 기계가 읽을 수 있게 출력하고, 10개 결정적 중복 시나리오·승인 폐기·관계별 일정 격리를 검증한다.

## 검증

- `node scripts/test-issue-graph-v2.mjs`
- `sh scripts/test-issue-create.sh`
- `sh scripts/check-shared.sh`
- 실 GitHub sync에서 #73 → #2 참조를 merge된 PR로 해석해 provenance와 close 상태를 보존했고, audit·graph 검증·plan/next가 정상 재개됨을 확인했다.
- 2026-08-12 요청자가 자동 차단 비활성 정책과 품질 평가 기준을 승인했다.

증거: `.issue/78/evidence/before/graph-cli-baseline.md`,
`.issue/78/evidence/after/graph-v2-verification.md`.
