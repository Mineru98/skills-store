# 변경 후 증거

## 지침

- `issue-create`는 사용자가 분할을 명시하지 않은 복합 요청에서도 원자 후보를 먼저 모두 추출한다.
- fan-out은 네 독립성 질문을 모두 통과한 별도 이슈·PR 단위이고, fan-in은 단독 완료할 수 없는 강결합 후보 묶음이다.
- 분할안, 이슈 초안, `--request-file` 원본 요청 기록에 범위와 관계 근거를 남긴다.
- 5개 상한과 분할안·초안 승인 단계는 유지한다.

## 평가

- `implicit-composite` 태그로 분할 요청이 없는 복합 입력 100건을 생성한다.
- holdout `split-425`는 6개의 독립 원자를 `over_limit`으로 정확히 판정해 상한을 보존했다.
- holdout `split-325`는 강결합 API/UI 후보와 독립 후보를 `partial`로 정확히 판정했다.
- 원본 결과: `implicit-split-eval.json`, `implicit-fan-in-eval.json`.
