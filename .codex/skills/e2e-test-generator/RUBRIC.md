# RUBRIC — e2e-test-generator

스킬이 "실제로 동작하는가"를 채점하는 기준. 총 100점, 7개 항목. 각 항목은 id / 기준 / 왜 중요한가 / 배점 / 검증법을 가진다.

발표 의도(Naver Financial, "AI 에이전트용 Playwright E2E 하네스")의 핵심 매핑:
- Generator 는 "계획과 구현 분리"에서 **구현** 담당.
- codegen 을 출발점으로 삼되 컨벤션으로 재구조화.
- 컨벤션 = storageState 인증 분리 + 한글 test.step + 기존 코드/가이드 학습 + 초기화 로직.
- 완료 기준 = type/lint 통과 + 실제 실행 green.

---

## RUBRIC-001 — 발표 의도 충실성 (plan/implement 분리 + 구현 집중)
- **criterion**: 스킬이 "계획은 입력으로 받고 구현에만 집중한다"는 분리 원칙을 명확히 구현하는가. 계획이 없으면 생성하지 않고 Planner 로 넘기며, 시나리오를 임의로 지어내지 않는가.
- **why**: 발표의 출발점은 "LLM 하나에 다 시키면 완성도가 떨어진다 → 한 가지에 집중"이다. 이 분리가 무너지면 스킬의 존재 이유가 사라진다.
- **max_points**: 18
- **how_to_verify**: SKILL.md 의 "왜 계획과 구현을 분리하나" + "파이프라인에서의 위치" 섹션이 입력=계획서, 출력=코드임을 명시하는지 확인. eval 4(계획 없음)에서 코드 생성 대신 e2e-flow-planner 안내가 나오는지 확인.

## RUBRIC-002 — 트리거 description 품질 (양방향·언더트리거 방지·경계)
- **criterion**: description 이 한/영 양쪽의 현실적 표현에 발동하고, 옆 단계(planner/healer/hardener/playwright-cli)와의 경계로 오발동을 막는가.
- **why**: description 이 유일한 트리거 메커니즘이다. 언더트리거가 흔한 실패 모드이고, 동시에 이웃 E2E 스킬과의 과트리거도 위험하다. 둘 다 막아야 한다.
- **max_points**: 16
- **how_to_verify**: evals 의 should_trigger 3건(한글 계획서, codegen 정리, 영문 implement)이 모두 발동 신호를 주는지, should_not_trigger 4건(계획 없음/flaky/깨진 테스트/단순 조작)이 각각 올바른 이웃 스킬로 비켜가는지 description 문구로 추적.

## RUBRIC-003 — 점진적 공개 / 구조 (body 간결 + references 분리)
- **criterion**: SKILL.md body 가 워크플로와 의사결정에 집중해 간결하고(≈250줄 이내), 깊이는 references/ 로 빠지며, 각 reference 에 "언제 읽는지" 포인터가 달려 있는가.
- **why**: progressive disclosure 는 컨텍스트 비용을 줄이고 트리거 시 핵심만 로드되게 한다. body 가 비대하면 모델이 길을 잃는다.
- **max_points**: 14
- **how_to_verify**: `wc -l SKILL.md` 가 250 미만인지. body 의 각 단계에서 convention-discovery / test-structure / auth-fixture / quality-gates 로 가는 when-to-read 포인터가 있는지. references 4종이 실제로 존재하는지.

## RUBRIC-004 — 구체적이고 실행 가능한 워크플로 단계
- **criterion**: 학습 → codegen 초안 → 재구조화 → 단계별 실행 검증 → 품질 게이트의 5단계가 각각 무엇을·어떻게·무엇으로 검증(verify)하는지 실행 가능한 수준으로 적혀 있는가.
- **why**: 추상적 조언("좋은 테스트를 짜라")은 재현되지 않는다. 단계별 verify 기준이 있어야 에이전트가 독립적으로 루프를 돌 수 있다.
- **max_points**: 16
- **how_to_verify**: 각 단계에 "검증:" 문장이 있는지. 재구조화 단계가 test.step/한글 스텝명/storageState 분리/셀렉터 승격/초기화/assertion 추가를 구체적으로 지시하는지. before/after 예시(test-structure.md)가 실제 변환을 보여주는지.

## RUBRIC-005 — playwright-cli 레버리지 (중복 금지)
- **criterion**: 브라우저 드라이버 문법(codegen, storageState 저장, run-code)을 재작성하지 않고 playwright-cli 의 test-generation/storage-state/running-code 레퍼런스를 정확한 경로로 참조하는가.
- **why**: 과제의 명시 제약이자 발표의 하네스 사고와도 일치한다 — 재사용 가능한 빌딩블록 위에 "무엇을·왜·언제"를 얹어야지, CLI 튜토리얼을 복제하면 안 된다.
- **max_points**: 12
- **how_to_verify**: SKILL.md 와 references 에서 `.codex/skills/playwright-cli/references/*.md` 경로 참조가 있는지. CLI 명령 나열(클릭/입력/state-save 문법 설명)을 자체적으로 다시 적지 않았는지 grep 으로 확인.

## RUBRIC-006 — 대형 Next.js 엔터프라이즈 레포에서의 실행 가능성
- **criterion**: 흩어진 테스트 자산을 가진 실제 모노레포에서 통하는가 — 컨벤션 탐색 명령, playwright.config 항목, setup 프로젝트 vs 픽스처 선택, 프로젝트 스크립트 우선 + fallback(`yarn type-check`/`tsc --noEmit`, `yarn lint`/`eslint`)을 제시하는가.
- **why**: 이 스킬은 진공이 아니라 기존 대형 코드베이스에 새 테스트를 끼워 넣는다. 컨벤션 무시·스크립트 가정 오류는 곧바로 리뷰/CI 실패다.
- **max_points**: 14
- **how_to_verify**: convention-discovery.md 의 탐색 명령(find/grep)과 설정 항목 목록 확인. auth-fixture.md 가 setup 프로젝트와 fixture 두 패턴, "기존 코드를 따른다"는 일관성 우선 규칙을 제시하는지. quality-gates.md 가 프로젝트 스크립트 우선 + fallback 을 제시하는지.

## RUBRIC-007 — 완료 정의의 정직성 (게이트 + 앱 버그 분기)
- **criterion**: 완료를 "코드 작성"이 아니라 "type/lint 통과 + 실제 green"으로 정의하고, 실행 실패 시 테스트 버그 vs 앱 버그를 구분해 통과를 위해 assertion 을 약화/삭제하지 말라고 가드하는가.
- **why**: 발표의 완료 기준을 그대로 옮긴 부분이자, 에이전트가 빠지기 쉬운 함정(테스트를 억지로 green 으로 만들어 거짓 신뢰를 주는 것)을 막는 안전장치다.
- **max_points**: 10
- **how_to_verify**: SKILL.md 5단계와 quality-gates.md 가 세 게이트를 모두 green 일 때만 완료로 규정하는지. "테스트 버그인가 앱 버그인가" 분기와 "assertion 약화 금지"가 명시돼 있는지. eval 3 의 completion_means_green_run 단언과 일치하는지.

---

## 채점 운용
- 각 항목 0~max 사이 정수. 부분 점수 허용.
- 70점 미만이면 트리거 또는 워크플로 실행 가능성에 구조적 결함이 있다고 보고 개선 루프로 돌아간다.
- RUBRIC-001/002/004 는 가중치가 커서, 여기서 깎이면 다른 항목이 높아도 스킬의 핵심 가치가 약하다는 신호다.
