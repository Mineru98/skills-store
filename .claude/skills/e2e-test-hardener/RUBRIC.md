# RUBRIC — e2e-test-hardener

"이 스킬이 실제로 동작하는가"를 채점하는 기준. 가중 합계 100점. 각 항목은 검증 방법을 포함한다. 채점은 작성자가 아닌 별도 리뷰 패스(사람 또는 verifier)가 수행한다.

---

## R1. 발표 3원칙에 충실 (faithfulness) — 25점
**criterion:** 스킬이 네이버파이낸셜 발표의 3가지 설계 결정을 의미 그대로 반영하는가 — (A) 검증 갈래의 시작점에서 출발하도록 테스트용 셋업으로 공통 앞부분 제거, (B) '통제할 수 있는 것만 테스트' = 외부 의존성 모킹, (C) 머지 전 작성 단계에서 플래키 예방(하드 대기 금지·시멘틱 셀렉터·번인).
**why:** 스킬의 존재 이유. 원칙을 왜곡하거나 일반 Playwright 팁으로 희석되면 발표의 핵심 통찰(특히 "작성 직후가 추적보다 싸다", "호출 위치로 모킹 지점이 갈린다")이 사라진다.
**how_to_verify:** SKILL.md가 세 원칙을 A→B→C 순서와 그 근거(좁히고→고정하고→비결정성 제거)로 제시하는지 확인. (A) 약관·인증 같은 공통 앞부분을 시작점 세팅으로 외부화, (B) 클라이언트 page.route vs 서버 env 분기, (C) waitForTimeout 금지/role+name/--repeat-each 번인이 모두 명시됐는지 본다.

## R2. 트리거링 설명 품질 (triggering description) — 18점
**criterion:** frontmatter description이 한국어·영어 양쪽 표현에서 발동하고, 인접 형제 스킬(generator·healer·planner·ci-debug)과 단순 브라우저 자동화(playwright-cli)에 대해 과발동하지 않는가.
**why:** undertriggering이 스킬의 가장 흔한 실패다. 동시에, e2e 패밀리가 많아 overtriggering(특히 "실패한 테스트 고치기"=healer, "trace 디버깅"=ci-debug, "테스트 작성"=generator)도 실제 위험이다.
**how_to_verify:** description에 "플래키", "견고하게", "fix flaky", "harden e2e", "deflake", "waitForTimeout", "외부 의존성 모킹" 등 다국어 트리거구가 있는지 확인. evals.json의 should-trigger 4건(1,2,3,4)이 발동하고 should-not-trigger 3건(5 CI trace, 6 일회성 스크린샷, 7 계획)이 발동하지 않는지 검토. SKILL.md "안 쓰는 경우"가 형제 스킬과 경계를 긋는지 본다.

## R3. 점진적 공개 / 구조 (progressive disclosure) — 14점
**criterion:** SKILL.md 본문이 워크플로 결정에 집중하고(약 250줄 이하), 깊은 디테일은 references/로 내려보내며, 각 참조에 "언제 읽는지" 포인터가 있는가.
**why:** 본문이 비대하면 매 발동마다 컨텍스트를 낭비하고 핵심 판단이 묻힌다. 참조 분리는 skill-creator 방법론의 핵심.
**how_to_verify:** `wc -l SKILL.md`가 ~250줄 이하인지. references/에 independence·external-mocking·flaky-prevention·hardening-checklist 4개가 있고 SKILL.md가 각각을 "필요할 때만 읽기" 포인터로 연결하는지. 본문이 CLI 문법 덤프가 아니라 결정 트리·근거 중심인지 확인.

## R4. 구체적이고 실행 가능한 워크플로 (actionable steps) — 16점
**criterion:** 에이전트가 따라갈 수 있는 "찾기 → 고치기 → 근거" 단계와 판단 기준이 명확한가. 모호한 "적절히 처리하라"가 아니라 신호·결정 트리·전환 매핑을 제공하는가.
**why:** 스킬은 백만 번 재사용될 워크플로다. 구체적 신호(복붙된 로그인, describe.serial, waitForTimeout)와 전환 매핑(하드 대기→web-first, 클래스→role)이 있어야 일관되게 동작한다.
**how_to_verify:** 각 원칙 단계가 (1) 스캔할 신호, (2) 우선순위 있는 고치기 절차, (3) 왜를 담는지 확인. flaky-prevention.md의 대기 전환 매핑표·셀렉터 우선순위, external-mocking.md의 호출 위치 판별 분기, hardening-checklist.md의 보고 양식이 실재하는지 본다.

## R5. playwright-cli 레버리지 (no duplication) — 12점
**criterion:** 브라우저 구동·page.route·storage state·셀렉터 문법 등 메커니즘을 재작성하지 않고 playwright-cli 스킬의 해당 reference를 명시 경로로 참조하는가.
**why:** 중복은 두 곳이 어긋나는 부채를 만든다. 이 스킬의 novel value는 "무엇을·왜·언제"이지 CLI 튜토리얼이 아니다.
**how_to_verify:** SKILL.md "전제" 절이 request-mocking.md / storage-state.md / test-generation.md를 명시 경로로 가리키는지. 스킬 어디에도 page.route URL 패턴이나 cookie-set 같은 CLI 플래그를 자체적으로 재정의하지 않는지(`grep -nE "playwright-cli/references|references/request-mocking" SKILL.md`). 추가하는 건 판단(무엇을 fulfill할지, 어디서 게이팅할지)뿐인지 본다.

## R6. 대형 Next.js 엔터프라이즈 현실성 (real-world executability) — 15점
**criterion:** 실제 대형 Next.js 앱(SSR/BFF, 다수 외부 연동, 한국어 UI)에서 바로 적용 가능한가. SSR로 그려지는 데이터가 page.route를 우회하는 함정, E2E 환경변수의 운영 누출 방지, 한국어 role+name, env 파일 전략을 다루는가.
**why:** 발표의 맥락이 정확히 이 환경(네이버파이낸셜). SSR/서버 호출을 클라이언트 모킹으로 착각하는 함정은 엔터프라이즈에서 가장 비싼 거짓 안전이다.
**how_to_verify:** external-mocking.md가 "page.route를 걸었는데 SSR로 그려져 무시되는" 함정과 클라이언트+서버 둘 다 막는 경우를 다루는지. E2E 게이트를 한 곳(어댑터 계층)에 모으고 운영에서 꺼지게 하며 NEXT_PUBLIC 노출을 막는지. 저장소 규칙(workflow-build.md env 전략)을 참조하는지. 셀렉터 예시가 한국어 라벨(`{ name: '다음' }`)을 쓰는지 확인.

---

### 점수 합계 가이드
- 90–100: 머지 가능. 발표 의도에 충실하고 형제 스킬과 경계가 분명하며 엔터프라이즈에서 바로 쓸 수 있다.
- 75–89: 작동하나 한 영역(보통 트리거링 경계 또는 SSR 함정 깊이)에서 보강 필요.
- 75 미만: 핵심 원칙 왜곡, CLI 중복, 또는 과/미발동 — 재작업.
