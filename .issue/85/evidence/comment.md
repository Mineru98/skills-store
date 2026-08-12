## 작업 요약

암묵적 복합 요청도 원자 후보부터 추출하도록 `issue-create` 분할 지침을 강화했습니다.
fan-out/fan-in의 판정 근거와 이슈 범위 기록 형식을 초안·원본 요청 기록에 추가했습니다.

## 변경 파일

- `.codex/skills/issue-create/` 및 `.claude/skills/issue-create/` — 분할, 초안, 인계 지침 동기화
- `evals/issue-create/` — `implicit-composite` 100건과 태그 필터 평가 경로 추가

## 검증

- `node evals/issue-create/validate-split-dataset.mjs` 통과
- `node evals/issue-create/generate-split-dataset.mjs --check` 통과
- `node evals/issue-create/test-split-eval.mjs` 통과
- holdout 암묵 복합 2건: 원자 F1, 그룹 완전일치, 이슈 수, 결정 정확도 모두 100%

## 확인 제한

- `node scripts/test-capability-bundle-check.mjs`는 작업 전부터 stale인 `.codex/skills/issue-end/SKILL.md` closure hash 때문에 실패했습니다. 이번 변경 파일은 bundle 대상이 아니며, 이 이슈에서 재생성하지 않았습니다.

## 캡처 생략

문서·평가 데이터 변경이라 화면 또는 성능 캡처가 의미 없습니다. 대신 재현 가능한 평가 원본을 `.issue/85/evidence/after/`에 남겼습니다.

## 남은 이슈

없음
