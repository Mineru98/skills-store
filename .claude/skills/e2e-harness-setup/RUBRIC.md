# RUBRIC — e2e-harness-setup

이 스킬이 "실제로 작동하는가"를 채점하는 기준. 총 100점. 각 항목은 id / 기준 / 왜 중요한가 / 배점 / 검증 방법으로 구성한다.

평가 맥락: 큰 Next.js 엔터프라이즈 모노레포에서, 테스트 맥락이 0인 새 에이전트가 이 스킬만 보고 E2E 하네스를 깔 수 있어야 한다.

---

## R1. 발표 의도 충실성 — 하네스 4종 (20점)

- **criterion**: 발표의 "하네스 구축 4가지"(① AGENTS.md 코드베이스 안내, ② E2E 운영규칙 SSOT, ③ 반복 fixture/헬퍼, ④ MCP 배선)를 모두, 발표가 의도한 역할 그대로 다룬다. 특히 ①과 ②가 별개 문서임을 명확히 한다.
- **why**: 이 스킬의 존재 이유. 4종 중 하나라도 빠지거나 ①·②를 한 문서로 뭉개면 발표의 핵심 구조가 깨진다.
- **max_points**: 20
- **how_to_verify**: SKILL.md "산출물 4종" 섹션에 4개가 모두 있고 각 역할 설명이 있는지. AGENTS.md vs SSOT 분리 이유가 명시됐는지. eval 1·2 가 4종 언급 + 문서 분리를 검사한다.

## R2. 핵심 통찰 전달 — "우리만 아는 맥락"의 명시화 (18점)

- **criterion**: "에이전트는 테스트 전략·도메인·구조 맥락이 0" 이라는 통찰과, 그 해법으로 인증 함수(getServerState 류)·만료 에러코드(code 90→setup 재실행)·baseURL 환경변수 결정·테스트 제외 항목을 **글로 박제**하라는 지침이 살아 있다.
- **why**: 발표 전체를 관통하는 통찰. 이게 약하면 그냥 "문서 4개 만들기"로 전락하고, 에이전트가 매번 헛다리 짚는 근본 문제를 못 푼다.
- **max_points**: 18
- **how_to_verify**: SKILL.md "왜 필요한가"에 세 가지 구체 예시(인증 함수, 만료코드, baseURL)가 있는지. SSOT 가이드의 질문 B·C·D 가 인증/만료/범위를 강제하는지. eval 1·2·3 의 관련 assertion 통과 여부.

## R3. 트리거링 설명 품질 — 한·영 양방향, 과소트리거 방지 (16점)

- **criterion**: description 이 한국어와 영어 표현 모두에서 발동하고, 인접 작업(단발 스크린샷, CI trace 디버그, 계획서→코드 구현)과 경계를 그어 오발동/과소발동을 줄인다. 약간 "pushy" 하다.
- **why**: 설명은 스킬이 호출되는 1차 메커니즘. 과소트리거가 가장 흔한 실패다. 동시에 인접 스킬(generator/healer/ci-debug)과 충돌하면 오발동한다.
- **max_points**: 16
- **how_to_verify**: frontmatter description 에 한국어 트리거 구절 + "Trigger on English too" 영어 구절이 모두 있는지, "단발 실행이 아니라 하네스" 경계 문구가 있는지. eval 5·6·7(near-miss) 이 should_trigger=false 로 정확히 갈리는지, eval 2 가 영어로 트리거되는지.

## R4. 점진적 공개 / 구조 (12점)

- **criterion**: SKILL.md 본문이 간결(<~250줄)하고, 깊이는 references/ 4개로 분리되며, 각 레퍼런스에 "언제 읽어라"는 명확한 포인터가 있다. playwright-cli 의 SKILL.md+references 구조를 닮았다.
- **why**: 진행 비용 절감과 가독성. 본문이 비대하면 매 호출마다 토큰을 낭비하고, 포인터가 없으면 깊이 문서가 죽은 채로 방치된다.
- **max_points**: 12
- **how_to_verify**: `wc -l SKILL.md` 가 ~250 이하인지. references/ 에 4개 파일이 있고 SKILL.md 본문 각 단계에서 해당 파일을 when-to-read 와 함께 가리키는지. "참고 파일" 섹션이 있는지.

## R5. 실행 가능한 워크플로우 단계 (12점)

- **criterion**: 막연한 조언이 아니라 의존성 순서가 있는 단계(0 기존파악 → 1 AGENTS.md → 2 SSOT → 3 fixture → 4 MCP)와, 각 단계의 검증 기준, 그리고 체크박스형 완료 기준을 제공한다.
- **why**: 에이전트가 루프를 닫으려면 "성공이 무엇인지"가 검증 가능해야 한다(프로젝트 CLAUDE.md 의 goal-driven 원칙). 약한 기준은 매번 사람에게 되묻게 만든다.
- **max_points**: 12
- **how_to_verify**: SKILL.md "진행 순서"에 단계별 verify 가 붙어 있는지, "완료 기준" 체크리스트가 4종 + 맥락 4종을 모두 포괄하는지, 단계 0(재발명/덮어쓰기 방지)이 있는지.

## R6. playwright-cli 레버리지 — 중복 금지 (12점)

- **criterion**: storageState 인증 분리·다중 세션·라우트 mock 등 브라우저 드라이버/CLI 문법은 새로 쓰지 않고 playwright-cli 의 storage-state.md / session-management.md 등을 정확한 상대경로로 가리킨다. 이 스킬은 "무엇을·왜·언제"(설계/결정)만 다룬다.
- **why**: 과제의 명시 제약. 문법을 복제하면 두 곳이 갈라져 썩고, 스킬의 novel value(하네스 사고)가 희석된다.
- **max_points**: 12
- **how_to_verify**: fixtures-helpers-guide.md 가 `../../playwright-cli/references/storage-state.md` 등으로 위임하는지, SKILL.md 단계 3 이 CLI 문법을 인라인으로 적지 않는지. 상대경로가 실제 파일을 가리키는지(존재 확인).

## R7. 엔터프라이즈 Next.js 실전성 (10점)

- **criterion**: 큰 모노레포 현실(앱별 인증/baseURL 차이, 기존 CLAUDE.md/.claude/rules 존중, 계층형 AGENTS.md, 환경변수 baseURL, 토큰 비커밋)을 구체적으로 다룬다. 인접 E2E 스킬(generator/hardener/healer/ci-debug)로의 핸드오프 경계가 분명하다.
- **why**: 실제 배포 환경에서 동작해야 가치가 있다. 토이 예제만 다루면 큰 저장소에서 무너진다. 경계가 흐리면 다른 스킬과 일을 다툰다.
- **max_points**: 10
- **how_to_verify**: SKILL.md/레퍼런스에 모노레포 앱별 분기, 기존 규칙 보강(단계 0), 환경변수 baseURL, storageState 비커밋이 있는지. "어디까지가 이 스킬인가" 식 핸드오프 문구가 있는지. eval 2 의 모노레포 assertion 통과 여부.

---

## 채점 합산

```
R1 하네스 4종 충실성        /20
R2 핵심 통찰(맥락 박제)      /18
R3 트리거링(한·영, 경계)     /16
R4 점진적 공개/구조          /12
R5 실행가능 워크플로우       /12
R6 playwright-cli 레버리지   /12
R7 엔터프라이즈 실전성       /10
─────────────────────────────
합계                         /100
```

가중치 근거: R1·R2 가 합 38점으로 가장 무겁다 — 발표 충실성과 핵심 통찰이 이 스킬의 정체성이기 때문. R3 가 16점인 이유는 트리거링이 스킬 가치 실현의 관문이라서다(과소트리거 = 0회 사용 = 무가치). R6 는 과제의 명시 제약이라 독립 항목으로 12점 배정.
