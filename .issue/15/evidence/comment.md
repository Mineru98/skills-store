## 결과

`issue-create` 의 `description` 을 실측으로 고쳤습니다. 검증 셋에서 recall 이 0.933 → 1.000 으로 올랐고 specificity 는 1.000 을 유지합니다.

```text
                  recall   specificity   accuracy
개선 전 (30문항)    0.933      0.933        0.933
개선 후 (30문항)    1.000      0.933        0.967
개선 전 (검증 10)   0.933      1.000        0.967
개선 후 (검증 10)   1.000      1.000        1.000
```

완료 기준 대비:

- [x] 회귀 셋이 저장소에 있고 발동해야 하는 질의 15 / 아닌 질의 15 로 같은 수
- [x] 튜닝에 쓰지 않은 검증 셋 10문항 별도 존재
- [x] 개선 전후를 같은 방식으로 측정해 recall / specificity 를 나눠 기록
- [x] 검증 셋에서도 개선 확인 (튜닝 셋에서만 오른 것이 아님)
- [x] specificity 가 개선 전보다 낮아지지 않음 (튜닝 0.933 유지, 검증 1.000 유지)
- [x] 최종 문구에 다중 이슈 생성과 인접 스킬 경계가 함께 드러남
- [x] `.claude` / `.codex` 양쪽 `SKILL.md` 에 동일 반영
- [x] 회귀 셋이 `.gitignore` 에 걸리지 않음
- [x] README 에 무엇을 돌려야 하는지와 현재 측정값 기록

## 무엇이 문제였나

개선 전 문구가 놓친 것은 **삭제 요청**이었습니다.

- `scripts/export-legacy.mjs 이거 이제 안 쓰는 것 같은데 지워도 될까?` — 3회 중 0회 발동
- `legacy 결제 어댑터 걷어내자. 신규 PG 로 다 넘어갔고` — 3회 중 1회 발동

물음표로 끝나는 정리 요청과 코드 제거 요청이 사각지대였습니다. 새 문구가 "안 쓰는 코드·플래그·스크립트 삭제"와 "이거 지워도 될까? 처럼 물음표로 끝나는 정리 요청"을 명시해 메웠습니다.

## specificity 를 지킨 과정

첫 후보는 recall 을 1.000 으로 올린 대가로 튜닝 셋 specificity 가 0.933 → 0.889 로 떨어졌습니다. 신규 스캐폴딩 요청을 새로 끌어당겼기 때문입니다.

- `방금 git init 했어. Next.js 14 앱라우터로…` — 0/3 → 1/3
- `빈 폴더에서 시작하는 중입니다. package.json 만들고…` — 0/3 → 1/3

원인은 배치였습니다. "코드를 바꾸는 요청이면 크기와 무관하게" 라는 강한 신호를 맨 앞에 두고, 스캐폴딩 제외 조건은 맨 끝에 뒀습니다. 앞의 신호가 뒤의 제외를 덮었습니다.

제외 조건을 **두 번째 문장으로 끌어올리고** 취할 행동("그냥 만들어 주세요")까지 적어 되돌렸습니다. recall 1.000 을 유지한 채 specificity 가 0.933 으로 복귀했습니다.

## 측정 조건이 결과를 흔든다

이 이슈에서 가장 중요한 발견입니다. 같은 문구인데 조건에 따라 값이 갈립니다.

```text
                                        개선 전 recall
issue-* 5개만 설치 + 도구 Skill/Read       1.000   ← 변별 불가
저장소 스킬 13개 + 도구 전체                0.933   ← 채택
```

- **도구셋** — `Edit` / `Write` / `Bash` 를 빼면 모델이 코드로 직행할 길이 막혀 `Skill` 쪽으로 쏠립니다. 전 구간이 1.000 으로 붙어 전후 비교 자체가 불가능했습니다. 정작 이 이슈가 지적한 미발동은 "스킬을 건너뛰고 코드로 직행"하는 상황이라, 그 경로를 막은 하네스는 문제를 재현하지 못합니다
- **경쟁 스킬** — `issue-*` 만 깔면 스킬 목록 자체가 "이 저장소는 이슈 워크플로를 쓴다" 는 힌트가 되어 recall 이 부풀려집니다

두 조건 모두 `--tools` / `--skills` 인자로 노출해 다음에 같은 기준으로 다시 잴 수 있게 했습니다.

## 이슈 본문 전제의 정정

이슈 본문은 "단건 변경 요청은 발동하지 않는다", 기존 README 는 "개선 전 recall 0.400 / 검증 셋 0.000" 이라고 적었습니다. **실측에서 재현되지 않았습니다.** 실제로는 0.933 / 0.933 이며, 개선 전 문구도 단건 변경 요청 대부분에서 발동합니다.

실제 사각지대는 단건 여부가 아니라 **삭제·정리 요청**이었습니다.

## 다시 재는 법

```bash
node evals/issue-create/run-trigger-eval.mjs --set tuning     # 문구를 다듬는 동안
node evals/issue-create/run-trigger-eval.mjs --set holdout    # 확정한 뒤 마지막에 한 번만
```

커밋 35개짜리 픽스처 저장소를 임시로 만들어 저장소의 스킬을 전부 설치하고, 질의를 헤드리스 `claude` 에 던져 `Skill` 도구가 `issue-create` 를 부르는지 셉니다. 기본값은 `sonnet` 에 질의당 3회, 동시 3개입니다. 동시 실행을 6 이상으로 올리면 API 가 요청을 거절해 전 시행이 실패할 수 있습니다.

## 남은 오발동과 한계

- `이슈들 라벨이 엉망이야. 라벨 없는 것들 찾아서 정리 좀 해줘` — 3회 중 2회 발동. 개선 전에도 3회 중 3회 발동하던 항목입니다. 이 스킬이 실제로 라벨 보정 기능을 갖고 있어 경계가 본질적으로 흐립니다
- `빈 폴더에서 시작하는 중입니다` — 3회 중 1회 발동
- Claude 는 스스로 처리 가능한 단순 요청에 스킬 목록을 조회하지 않습니다. `description` 으로 끌어올릴 수 있는 상한이 있고, 위 수치는 그 상한 안에서의 값입니다

## 증거

질의별 발동 횟수까지 담긴 원본입니다.

- [`baseline-tuning.json`](https://github.com/Mineru98/skills-store/blob/main/.issue/15/evidence/baseline-tuning.json) / [`baseline-holdout.json`](https://github.com/Mineru98/skills-store/blob/main/.issue/15/evidence/baseline-holdout.json) — 개선 전
- [`after-tuning.json`](https://github.com/Mineru98/skills-store/blob/main/.issue/15/evidence/after-tuning.json) / [`after-holdout.json`](https://github.com/Mineru98/skills-store/blob/main/.issue/15/evidence/after-holdout.json) — 개선 후
- `v2-firstdraft-*` — specificity 가 떨어졌던 1차 후보
- `v1-restricted-*` — 변별력이 없어 폐기한 초기 하네스 (스킬 5개 + 도구 제한)
