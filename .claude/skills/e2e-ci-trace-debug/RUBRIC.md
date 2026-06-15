# RUBRIC — e2e-ci-trace-debug

이 스킬이 "실제로 동작하는가"를 사람이 채점하기 위한 기준. 가중 합계 **100점**. 각 항목은 SKILL.md / references / evals 산출물을 직접 확인해 채점한다.

## 채점 항목

### R1. 발표 의도 충실성 (max 20)
- **기준**: 발표의 'e2e-debug'가 말한 닫힌 루프 — *PR/Actions 실패 링크에서 출발 → trace 아티팩트 로컬 다운로드 → trace로 원인 분석 → 고쳐 같은 PR에 반영 → CI 재검증* — 을 그대로 구현하는가. "에이전트가 작업하고 테스트로 검증하는 자가 개선 루프를 닫는다"는 목적이 본문에 드러나는가.
- **왜 중요한가**: 이 스킬의 존재 이유. 단계 하나라도 빠지면(특히 마지막 'CI 재검증'으로 루프를 닫는 부분) 발표가 강조한 자가 개선 사이클이 끊긴다.
- **확인 방법**: SKILL.md의 4단계 워크플로우가 위 5요소를 모두 포함하는지, 마지막 단계가 "push로 끝"이 아니라 "CI 초록 확인"으로 닫히는지 읽어 확인.

### R2. 트리거 description 품질 (max 18)
- **기준**: frontmatter description이 한국어·영어 양쪽 표현("CI에서 e2e가 깨졌다", "PR 체크가 빨갛다", "trace 분석", "failing e2e on this PR", "e2e-debug")에서 발동하도록 충분히 "pushy"하면서, 인접 스킬(신규 작성/로컬 치유/계획)과의 경계를 명시해 오발동을 막는가.
- **왜 중요한가**: 스킬 실패의 가장 흔한 원인은 undertriggering. 동시에 형제 스킬이 많아(generator/healer/hardener/planner) overtrigger 위험도 크다.
- **확인 방법**: evals.json의 should-trigger 4건(id 1–4)에서 발동이 자연스럽고, should-not-trigger 3건(id 5–7: 신규 작성/로컬 trace 치유/커버리지 계획)에서 description이 경계를 명확히 그어 오발동을 막는지 대조.

### R3. 점진적 공개 / 구조 (max 14)
- **기준**: SKILL.md 본문이 ~250줄 이하로 워크플로우+판단에 집중하고, 깊은 명령 레시피(gh)와 trace triage 체크리스트를 references/로 내려 **언제 읽을지** 포인터와 함께 연결했는가.
- **왜 중요한가**: 본문이 비대하면 매 발동마다 토큰을 낭비하고 핵심 판단이 묻힌다. 깊이는 필요할 때만 로드돼야 한다.
- **확인 방법**: `wc -l SKILL.md`가 ~250 이하인지, references/ci-diagnosis.md·trace-triage.md가 "1·2단계 막힐 때 / 3단계 분류 때" 식 when-to-read 문구로 참조되는지 확인.

### R4. 구체적이고 실행 가능한 워크플로우 단계 (max 16)
- **기준**: 각 단계가 실제로 돌아가는 명령으로 뒷받침되는가 — `gh pr checks`, `gh run view --log-failed`, `gh api .../artifacts`, `gh run download -n … -D …`, `npx playwright show-trace`, `gh pr checks --watch`. 추측 명령이 아니라 실재하는 플래그인가.
- **왜 중요한가**: 워크플로우 스킬의 가치는 "막연한 조언"이 아니라 따라 하면 되는 구체적 경로다. 가짜 플래그는 즉시 신뢰를 깨뜨린다.
- **확인 방법**: 본문/레퍼런스의 gh·playwright 명령을 `gh <cmd> --help`로 대조. 각 단계가 다음 단계로 넘길 "증거"(run-id, trace 경로, 한 줄 원인 등)를 산출하도록 설계됐는지 확인.

### R5. playwright-cli 레버리지 (중복 없음) (max 12)
- **기준**: 브라우저/trace CLI 문법(tracing-start/stop, trace 읽는 법, role 기반 셀렉터)을 새로 적지 않고 playwright-cli의 tracing.md·test-generation.md를 **상대 경로로 참조**하는가. 이 스킬은 그 위에 *얹는* 워크플로우인가.
- **왜 중요한가**: 중복은 두 곳이 어긋나면 거짓 정보가 된다. 재사용 빌딩블록을 참조하는 것이 유지보수와 정확성의 핵심.
- **확인 방법**: SKILL.md에 `../playwright-cli/references/...` 링크가 있고, tracing 명령 사전이 본문에 복제돼 있지 않은지 확인.

### R6. Healer 핸드오프 / 책임 경계 (max 10)
- **기준**: 실제 수정·근본 원인 치유·"테스트 vs 제품" 판정의 본체를 e2e-test-healer에 위임하고, 이 스킬은 그 앞(CI→로컬 trace)과 뒤(PR CI 재검증) 절반을 맡는다고 명확히 선을 긋는가. 파이프라인 내 위치(planner→generator→hardener→**이 스킬**→healer)를 밝히는가.
- **왜 중요한가**: 형제 스킬과 책임이 겹치면 둘 다 어중간해진다. 명확한 핸드오프가 각 스킬을 날카롭게 유지한다.
- **확인 방법**: 4단계가 Healer 위임을 명시하고, "언제 멈추고 다른 길로" 섹션이 로컬 trace를 이미 가진 경우 Healer로 직행하라고 안내하는지 확인.

### R7. 대형 Next.js 엔터프라이즈 레포 현실성 (max 10)
- **기준**: monorepo 다중 워크플로우(실패한 그 run-id 고정), 아티팩트 이름 가변성(추측 말고 나열), 작업 트리 오염 방지(/tmp 격리 다운로드), 비밀값 비유출, 재실행/만료(attempt·rerun) 같은 현실 함정을 다루는가.
- **왜 중요한가**: 장난감 레포에서만 되는 스킬은 실무에서 깨진다. 큰 레포의 운영 현실을 반영해야 실제로 쓸 수 있다.
- **확인 방법**: SKILL.md "큰 Next.js 엔터프라이즈 레포에서의 현실 팁"과 ci-diagnosis.md "재실행/여러 워크플로우/자주 막히는 지점"이 위 항목들을 구체적으로 다루는지 확인.

## 합산
- 합계 100점. **80점 이상**이면 배포 가능. R1·R2 중 하나라도 절반 미만이면 점수와 무관하게 재작업(의도 또는 트리거가 깨지면 스킬이 제 역할을 못 함).
