# 변경 전 증거

## 관찰

- `split-requests.md`는 원자 후보와 강결합·독립성 확인을 정의하지만, 사용자가 분할을 명시하지 않은 복합 요청에도 이 절차를 반드시 먼저 적용한다는 지시가 없다.
- fan-out(독립 분리)과 fan-in(강결합 묶음)이라는 관계 이름, 그리고 각 이슈의 범위·관계 근거를 원본 요청 기록에 보존하는 형식이 없다.
- 기존 평가 단위 테스트는 분할 점수 계산만 확인하며, 이 지침 계약을 고정하지 않는다.

## 기준 파일

- `.codex/skills/issue-create/SKILL.md`
- `.codex/skills/issue-create/references/split-requests.md`
- `.codex/skills/issue-create/references/issue-draft.md`
- `evals/issue-create/test-split-eval.mjs`
