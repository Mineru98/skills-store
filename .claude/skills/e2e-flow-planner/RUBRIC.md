# RUBRIC — e2e-flow-planner

"이 스킬이 실제로 동작하는가"를 채점하는 기준. 총 100점, 7개 항목. 각 항목은 id · criterion · why · max_points · how to verify 를 갖는다.

목표 합격선: 80점 이상이면 출시 가능. 60~79점은 보완 후 재평가. 60점 미만은 재작성.

---

## R1 — 발표 의도 충실성 (Planner의 본질) · 20점

- **id**: faithfulness-to-talk-intent
- **criterion**: 스킬이 "모든 것을 테스트하지 않는다", "실패하면 매출/데이터/신뢰가 깨지는 Critical User Flow를 추린다", "잘못된 수정이 기존 동작을 깨뜨리는 것을 막는 게 목적(테스트가 깨지는 게 목적이 아님)"이라는 발표의 핵심 사고를 명시적으로 담고, 산출물이 "코드 작성 전 사람이 검토하는 마크다운 계획서"로 고정되어 있다.
- **why**: 이 스킬의 novel value는 CLI 사용법이 아니라 harness 사고(무엇을·왜·언제 테스트할지)다. 이 의도가 빠지면 그냥 또 하나의 Playwright 튜토리얼이 된다.
- **how to verify**: SKILL.md "철학" 섹션과 cuf-criteria.md에 매출/데이터/신뢰 렌즈, 과잉 선정 안티패턴, "테스트가 깨지는 게 목적이 아니다"가 명시되어 있는지 확인. 도메인 예시(대출: 홈→약관→본인확인→결과조회/신청)가 CUF 개념을 구체화하는지 확인.

## R2 — 트리거링 description 품질 (한국어+영어, 과소발동 방지) · 18점

- **id**: triggering-description-quality
- **criterion**: frontmatter description이 한국어와 영어 두 표현 모두에서 발동하고, "무엇부터 테스트할지 정하는 Planner" 의도를 약간 pushy하게 포착한다. 동시에 near-miss(테스트 코드 구현, 실패 진단, 스크래핑)에는 발동하지 않도록 경계를 시사한다.
- **why**: 스킬의 1차 발동 메커니즘은 description이다. Claude는 스킬을 과소발동하는 경향이 있어, 한국어 위주 레포에서 영어 표현까지 커버하지 못하면 실제로 안 불린다.
- **how to verify**: evals/evals.json의 should-trigger 4건(한국어 정식/캐주얼, 영어, 패러프레이즈)이 description 문구와 합치하는지, should-not-trigger 3건(코드 구현·trace 진단·스크래핑)이 경계 문구로 걸러지는지 대조. description에 한/영 트리거 구문이 모두 포함됐는지 확인.

## R3 — 진행적 공개 / 구조 (playwright-cli 스타일 정렬) · 14점

- **id**: progressive-disclosure-structure
- **criterion**: SKILL.md 본문이 약 250줄 이하로 워크플로우+의사결정에 집중하고, 깊이(판별 기준·탐색 소스·탐색법·템플릿)는 references/로 분리되며, 각 reference에 "언제 읽어라" 포인터가 달려 있다.
- **why**: 진행적 공개가 안 되면 본문이 비대해져 매 발동마다 컨텍스트를 낭비하고, 정작 필요한 깊이는 못 찾는다. 같은 레포의 playwright-cli/make-design-md와 구조가 정렬되어야 유지보수된다.
- **how to verify**: `wc -l SKILL.md`로 줄 수 확인(<250). references/ 4개 파일 존재 및 SKILL.md "참조 파일" 섹션의 when-to-read 포인터 확인. 본문에 셀렉터/코드 덤프가 없고 의사결정 위주인지 확인.

## R4 — 구체적이고 실행 가능한 워크플로우 단계 · 16점

- **id**: actionable-workflow-steps
- **criterion**: 워크플로우가 순서화된 단계로 제시되고, 각 단계가 "다음으로 넘어가도 되는지" 판단하는 검증 지점을 가지며, 모호한 지시("적절히 분석하라") 대신 관찰 가능한 완료 기준을 준다.
- **why**: 약한 성공 기준은 에이전트가 매번 헤매게 만든다. 검증 지점이 있어야 Planner가 스스로 루프를 닫고 사람 검토 게이트까지 도달한다.
- **how to verify**: SKILL.md 워크플로우 1~5단계 각각에 "→ 검증:" 문구가 있는지 확인. cuf-criteria.md의 "후보→계획 전환 체크"와 test-plan-template.md의 검토 체크박스가 완료 기준을 제공하는지 확인.

## R5 — playwright-cli 재사용 (중복 없음) · 12점

- **id**: leverages-playwright-cli-no-duplication
- **criterion**: 브라우저 탐색에 기존 playwright-cli 스킬을 명시적으로 참조하고(파일 경로 포함), 전체 CLI 명령/세션/옵션을 재서술하지 않는다. 탐색은 "계획으로 옮기기" 관점에서만 다룬다.
- **why**: 빌딩블록 재사용이 이 과제의 핵심 제약이다. 브라우저 드라이버 문서를 복제하면 두 스킬이 어긋나고 유지보수가 깨진다.
- **how to verify**: SKILL.md와 exploration-with-playwright.md가 `.claude/skills/playwright-cli/SKILL.md`를 참조하는지 확인. 노출된 playwright-cli 명령이 탐색용 최소 집합(open/snapshot/goto)으로 제한되고, storage-state 등 세부는 참조로 위임됐는지 확인.

## R6 — 대형 Next.js 엔터프라이즈 레포에서의 실행 가능성 · 12점

- **id**: real-world-executability-nextjs
- **criterion**: 수십 개 화면을 가진 실제 Next.js 레포에서 동작하도록, 라우트 발견(app//pages/), 이슈/기획서 탐색(MCP + gh/rg/git 대체 경로), 인증·결제 벽 처리, 탐색 불가 시 대체 흐름이 구체적으로 제시된다.
- **why**: 발표 맥락(네이버파이낸셜)은 대형 엔터프라이즈 앱이다. MCP가 없거나 앱이 안 뜨거나 인증 벽이 있는 현실을 다루지 못하면 데모용에 그친다.
- **how to verify**: discovery-sources.md에 MCP 부재 시 `gh issue list`/`rg`/`git log` 대체 경로가 있는지, exploration-with-playwright.md에 인증/결제 벽에서 멈추고 선행조건으로 기록하는 지침과 "탐색 불가 시 라우트/기획 기반 추정 명시"가 있는지 확인.

## R7 — 산출물 형식과 사람 검토 게이트의 강제 · 8점

- **id**: output-format-and-human-gate
- **criterion**: 산출물이 일관된 마크다운 계획서 템플릿(범위, CUF 목록+우선순위+근거, 시나리오 단계/기대결과/선행조건, Out of scope, 오픈 질문)으로 고정되고, 승인 전 코드 단계로 넘어가지 않는 사람 검토 게이트가 워크플로우에 박혀 있다.
- **why**: "사람 검토 게이트가 핵심"이라는 발표 지침의 직접 구현. 형식이 고정돼야 검토자가 매번 같은 방식으로 빠르게 판단하고, 게이트가 있어야 미승인 계획이 코드로 새지 않는다.
- **how to verify**: test-plan-template.md가 모든 필수 섹션을 포함하는지, SKILL.md 5단계가 검토 요청 문구와 "승인 전 코드 단계 금지"를 명시하는지 확인. 셀렉터/코드가 계획서에서 배제되는지 확인.

---

## 채점 합계

```
R1 발표 의도 충실성            20
R2 트리거링 description         18
R3 진행적 공개/구조            14
R4 실행 가능한 워크플로우 단계  16
R5 playwright-cli 재사용        12
R6 Next.js 실행 가능성          12
R7 산출물 형식 + 검토 게이트     8
──────────────────────────────
합계                           100
```
