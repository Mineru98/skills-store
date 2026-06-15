# RUBRIC — e2e-test-healer

"이 스킬이 실제로 동작하는가"를 채점하는 기준. 총 100점, 7개 항목. 각 항목은 id / criterion / why / max_points / how to verify 를 가진다.

채점은 SKILL.md + `references/*` + `evals/evals.json` 을 함께 읽고, 가능하면 should-trigger 프롬프트 1개를 실제로 돌려 행동을 관찰해 매긴다.

---

## R1 — 발표 의도 충실성 (Healer 루프 + trace 통찰)
- id: faithfulness-to-talk
- max_points: 20
- why: 이 스킬의 존재 이유다. 발표의 Healer 에이전트는 "trace = 그때 일어난 모든 것"을 필요 시점에 골라 보고, 실행→디버그→근본원인→수정→검증→반복 루프를 돈다. 이 골격이 빠지면 그냥 일반 디버깅 스킬이다.
- how to verify:
  - SKILL.md에 6단계 루프(run → debug → root-cause → fix → verify → repeat)가 순서대로 명시돼 있는가.
  - "trace에 모든 것(동작/단계 화면/네트워크/콘솔·에러스택)이 들어있고, devtools처럼 필요한 것만 본다"는 통찰이 본문에 살아있는가(단순 명령 나열이 아니라).
  - "통과 = 해결 아님", 끝에 lint/type 게이트가 루프에 포함돼 있는가.

## R2 — 핵심 판단: 테스트가 틀림 vs 제품이 깨짐
- id: test-vs-code-judgment
- max_points: 20
- why: 발표가 특히 강조한 지점. "테스트를 무조건 통과시키지 말 것." 이 판단이 없으면 회귀를 테스트로 덮어 숨기는 위험한 스킬이 된다. 스킬의 novel value 중 가장 큰 부분.
- how to verify:
  - root-cause 단계에 "제품 회귀 / 낡은 테스트 / 모호→사람에게" 3분기 판정이 명시돼 있는가.
  - `references/decision-test-vs-code.md`에 양쪽을 가르는 구체 신호와 사례가 있는가.
  - "원인 모른 채 단언 약화/삭제·sleep 삽입으로 green 만들기"가 명시적 안티패턴으로 금지돼 있는가.

## R3 — 트리거링 description 품질 (한/영 + 과소발동 방지 + 경계)
- id: triggering-quality
- max_points: 15
- why: description은 발동의 1차 메커니즘이고, 흔한 실패는 과소발동(undertrigger)이다. 한국어·영어 두 표현, 스택/trace 경로만 붙여넣는 경우까지 잡아야 하고, 형제 스킬(생성/계획/하드닝/CI)과 겹치지 않아야 한다.
- how to verify:
  - frontmatter description이 한국어("깨졌어/실패/빨개/통과시켜줘")와 영어("failing/flaky/timing out/heal/debug this trace") 표현을 모두 포함하는가.
  - 스택 트레이스/실패 테스트명/trace.zip 경로만 줘도 발동한다고 명시했는가.
  - evals.json의 should-trigger(1–4)가 발동하고, should-not-trigger 근접오답(5 계획, 6 CI-링크, 7 단순 스크래핑)이 발동하지 않는가.

## R4 — 점진적 공개 / 구조
- id: progressive-disclosure
- max_points: 12
- why: SKILL.md는 항상 컨텍스트에 올라오므로 가벼워야 하고, 깊이는 references로 내려야 한다. when-to-read 포인터가 없으면 참고 파일이 죽은 문서가 된다.
- how to verify:
  - SKILL.md 본문이 ~250줄 이하이고, 판정 신호·증상매핑·명령 레시피 같은 깊이가 references로 분리됐는가.
  - SKILL.md가 각 reference를 "필요할 때 읽어라"는 명확한 포인터와 함께 가리키는가(diagnosis-playbook / decision-test-vs-code / loop-recipes).
  - 각 reference가 한 가지 주제로 응집돼 있는가.

## R5 — 구체적·실행가능한 워크플로우 단계
- id: actionable-workflow
- max_points: 13
- why: 에이전트가 모호한 격려가 아니라 다음 행동을 알 수 있어야 한다. 각 단계가 관찰 가능한 산출(실행 명령, 볼 trace 단서, 판정, 재실행, 게이트)로 끝나야 루프가 자율적으로 돈다.
- how to verify:
  - 각 단계가 "무엇을 하고 무엇으로 끝나는지" 검증 가능하게 적혔는가(예: 단일 스펙 trace 실행 → 실패 단계 스냅샷 → diff 대조 → 한쪽 수정 → 재실행 → lint/type).
  - `references/diagnosis-playbook.md`에 증상→trace-단서 매핑이 구체적으로 있는가.
  - 종료 조건(안정 green / 모호→질문 / 진전 없음→보고)이 명시돼 무한 루프를 막는가.

## R6 — playwright-cli 위에 빌드(중복 없음)
- id: leverages-playwright-cli
- max_points: 10
- why: trace 켜기·뜨기·trace zip 탐색은 이미 playwright-cli가 제공한다. 재발명하면 두 스킬이 어긋나고 유지보수가 깨진다. 이 스킬의 가치는 CLI 문법이 아니라 하네스 사고다.
- how to verify:
  - SKILL.md/references가 trace 조작 세부를 playwright-cli의 `references/tracing.md`로 위임한다고 명시하는가.
  - 브라우저 드라이버 문법(개별 click/fill/tracing 플래그 의미 등)을 장황히 재설명하지 않는가.
  - 그러면서도 "치유 루프에서 그것들을 어떻게 엮는가"(레시피)는 자체적으로 제공하는가.

## R7 — 대규모 Next.js 엔터프라이즈 저장소에서 실행 가능
- id: enterprise-executability
- max_points: 10
- why: 본 저장소는 5계층 Clean Architecture의 대형 Next.js다. 스위트 전체를 돌리거나 명령을 짐작하면 실전에서 못 쓴다. 저장소 규칙·구조에 맞아야 한다.
- how to verify:
  - 전체 스위트 대신 단일 스펙/프로젝트로 좁혀 피드백 루프를 짧게 하라는 지침이 있는가.
  - 검증 게이트가 저장소 명령(`yarn lint` / `yarn type-check`, RULE-BUILD-002)에 맞춰져 있고, package.json/playwright.config에서 실제 스크립트를 찾으라고 하는가.
  - 제품 회귀가 어디서 나는지를 저장소 계층(`presentation/features/*View`, `application/hooks/*`, `infrastructure/api/*`)과 연결하는가.

---

## 합산
```
R1 발표 의도 충실성          20
R2 테스트 vs 코드 판단        20
R3 트리거링 품질             15
R4 점진적 공개/구조          12
R5 실행가능 워크플로우        13
R6 playwright-cli 빌드       10
R7 엔터프라이즈 실행성        10
------------------------------
합계                        100
```

가중치 의도: R1+R2(40점)가 "발표 충실 + 핵심 판단"으로 가장 무겁다 — 이 스킬을 일반 디버깅 스킬과 구별하는 두 축이기 때문. R3(15)는 발동 안 되면 나머지가 무의미하므로 높게. R6(10)은 빌딩블록 재사용 원칙이라 통과/감점이 비교적 이진적이다.
