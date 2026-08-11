# 구현 리포트

## 결과

GitHub 정본 기반 이슈 그래프 V2를 구현했다. 캐시는 구조화된 결정 코멘트와 이슈 본문에서만 다시 만들며,
`depends-on`만 일정 계산에 사용한다.

## 핵심 변경

- 관계를 `depends-on`, `parent-of`, `duplicate-of`, `relates-to`, `supersedes`로 고정했다.
- `duplicate-of`는 증거와 GitHub 코멘트 provenance가 있는 승인 결정만 반영한다.
- snapshot이 부분·실패·지원되지 않는 버전·dangling·순환 상태면 plan/next를 fail-closed 한다.
- issue-create 검색은 후보 점수와 `DUPLICATE_REVIEW_NUMBERS`를 출력한다. 후보는 자동 등록을 막지 않는다.

## 검증

- `node scripts/test-issue-graph-v2.mjs`
- `sh scripts/test-issue-create.sh`
- `sh scripts/check-shared.sh`
- 실 GitHub sync에서 #73 → #2의 기존 dangling 참조를 검출했고, plan/next가 안전하게 거부하는 것을 확인했다.

증거: `.issue/78/evidence/before/graph-cli-baseline.md`,
`.issue/78/evidence/after/graph-v2-verification.md`.
