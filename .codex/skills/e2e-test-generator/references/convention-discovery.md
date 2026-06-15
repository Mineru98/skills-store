# 컨벤션 학습 체크리스트

코드를 짜기 전에 프로젝트가 "어떻게 테스트를 쓰는지"를 읽는다. 새 테스트가 기존 코드와 이질적이면 리뷰에서 막히고, 유지보수도 깨진다. 목표는 새 파일이 기존 코드 사이에 자연스럽게 끼어드는 것.

## 무엇을 어디서 찾나

대규모 Next.js 모노레포에서는 테스트 자산이 흩어져 있다. 순서대로 훑는다.

1. **설정 파일** — `playwright.config.ts`(또는 `.js`)
   - `testDir`: 테스트가 어디 사는가. 새 파일도 여기 또는 동일 관례로 둔다.
   - `use.baseURL`: URL 을 상대경로로 쓸 수 있는지.
   - `projects`: 브라우저 매트릭스, 그리고 **setup 프로젝트**(로그인 등 선행 작업) 가 있는지.
   - `use.storageState`: 인증을 storageState 로 주입하는지.
   - `globalSetup` / `globalTeardown`: 시드·정리 로직.

2. **기존 spec 파일** — `**/*.spec.ts`, `**/*.test.ts` 두세 개를 실제로 읽는다.
   - `test.describe` 로 묶는가, 평평하게 두는가.
   - `test.step` 을 쓰는가. 쓴다면 **스텝명이 한글인가 영문인가**(본 프로젝트 기준은 한글).
   - 셀렉터: `getByRole` / `getByTestId` / `getByLabel` / CSS 중 무엇이 주류인가.
   - 단언: `expect(page)...` / `expect(locator)...` 패턴, 커스텀 매처 유무.

3. **픽스처·헬퍼**
   - `test.extend` 로 만든 커스텀 fixture(인증된 page, 시드 데이터 등).
   - 로그인 헬퍼, 데이터 팩토리, API 시드 스크립트.
   - 공용 셀렉터/상수 모듈.

4. **인증 방식** (가장 중요)
   - 로그인 setup 프로젝트가 storageState 를 파일로 저장하고 다른 프로젝트가 그걸 로드하는 구조인가.
   - 아니면 fixture 가 매 테스트 앞에서 로그인하는가.
   - 토큰/계정은 환경변수에서 오는가.

5. **가이드 문서**
   - `docs/`, `CONTRIBUTING.md`, `README` 의 테스트 섹션.
   - 이 저장소의 `.codex/rules/` — 네이밍·아키텍처 규칙이 테스트 파일 위치/이름에도 적용될 수 있다.

## 빠른 탐색 명령

```bash
# 설정과 기존 테스트 위치 파악
find . -name "playwright.config.*" -not -path "*/node_modules/*"
find . \( -name "*.spec.ts" -o -name "*.test.ts" \) -not -path "*/node_modules/*" | head

# 인증/픽스처 패턴 스캔
grep -rn "storageState\|test.extend\|globalSetup\|test.step" \
  --include="*.ts" . | grep -v node_modules | head -40

# 스텝명 언어 확인(한글 스텝이 이미 쓰이는지)
grep -rn "test.step(" --include="*.ts" . | grep -v node_modules | head
```

## 산출: 한 문장 요약

학습이 끝나면 새 파일이 따라야 할 규칙을 한 문장으로 적는다. 예:

> "auth 는 `storageState` 픽스처(`fixtures/auth.ts`), 시나리오는 `test.describe` + 한글 `test.step`, 셀렉터는 `getByRole` 우선·없으면 `data-testid`, baseURL 설정됨이라 경로는 상대경로."

이 요약이 재구조화(3단계)의 기준점이 된다. 요약을 못 적겠으면 아직 충분히 안 읽은 것이다.

## 컨벤션이 아예 없을 때

처음 도입하는 저장소라 기준이 없으면, 추측하지 말고 발표 결과물의 기본값을 채택한다.

- 인증: storageState 픽스처로 분리.
- 단계: `test.step`, 한글 스텝명.
- 셀렉터: `getByRole` 우선.
- 위치: `playwright.config.ts` 의 `testDir`(없으면 `e2e/` 또는 `tests/`).

그리고 "이게 첫 테스트라 이런 기준을 세웠다"고 사용자에게 알려 합의를 만든다.
