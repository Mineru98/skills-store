# issue-onboard V2 필드 품질 평가

고정된 2개 라벨 fixture에서 `problem`과 `scope`를 평가했다. 중복 후보 점수는 검색 전용이며,
네 조건의 명시적 일치와 GitHub 승인 결정 없이는 등록을 막거나 관계를 만들지 않는다.
자동 차단 승인 전에는 300 pair 잠금 holdout에서 precision 95% 이상과 false block 0건이 필요하다.

2026-08-12: 요청자가 이 보수적 정책과 평가 기준을 승인했다. holdout 게이트 전에는
`review-or-create` 흐름을 유지한다.
