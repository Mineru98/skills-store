# C. 플래키 예방 — 작성 단계에서, 머지 전에

SKILL.md 3단계의 세부. 발표의 통찰: **머지 후 추적되는 플래키는 비싸다. 작성 직후, 컨텍스트를 쥔 사람이 잡는 게 압도적으로 싸다.** 세 가지를 본다.

## C-1. 하드 대기 → web-first 대기

하드 대기는 "시간"에 베팅한다. 느린 CI에선 시간이 모자라 터지고, 빠를 땐 그만큼 낭비한다. Playwright의 web-first assertion/locator는 조건이 만족되면 즉시 진행하고, 아니면 타임아웃까지 자동 재시도한다 — 필요한 만큼만 기다린다.

금지 신호: `page.waitForTimeout(...)`, `setTimeout` 기반 sleep, 임의의 고정 지연, "일단 좀 기다리면 되더라"식 주석.

전환 매핑(고정 대기 → 의도에 맞는 조건 대기):

```
무엇을 기다리던 거였나?            →  조건 기반 표현

요소가 보일 때까지                  →  await expect(locator).toBeVisible()
요소가 사라질 때까지                →  await expect(locator).toBeHidden()
텍스트/값이 바뀔 때까지             →  await expect(locator).toHaveText(/.../)
버튼이 활성화될 때까지              →  await expect(locator).toBeEnabled()
URL이 바뀔 때까지                   →  await page.waitForURL('**/done')
특정 응답이 올 때까지               →  await page.waitForResponse(pred)
네트워크가 잠잠해질 때까지(최후)    →  await page.waitForLoadState('networkidle')
```

원칙:
- **단언과 대기를 합친다.** `toBeVisible()` 같은 web-first assertion은 자체적으로 재시도하므로, 앞에 별도 대기를 둘 필요가 없다.
- **networkidle는 최후수단.** SPA에서는 idle이 안 와서 더 플래키해질 수 있다. 가능하면 "그 요소/그 텍스트"라는 구체 조건으로.
- **전역 타임아웃을 늘려 가리지 않는다.** 타임아웃을 키우면 플래키가 "느린 통과"로 위장될 뿐 원인은 남는다.
- run-code로 커스텀 대기가 필요하면 playwright-cli의 `.claude/skills/playwright-cli/references/running-code.md`의 Wait Strategies(`waitForFunction` 등)를 참조한다.

## C-2. 취약 셀렉터 → 시멘틱 셀렉터

CSS 클래스명·DOM 구조·`nth-child`는 사용자에게 안 보이는 구현 디테일이다. 스타일 리팩터링·마크업 변경으로 *조용히* 바뀌고, 그때 테스트가 깨진다. role+name은 "사용자가 인지하는 의미"라 훨씬 안정적이고, 깨질 땐 진짜로 UX가 바뀐 것이다.

우선순위(위가 더 견고):

```
1. getByRole(role, { name })      // 접근성 트리 — 가장 견고
2. getByLabel / getByPlaceholder  // 폼 입력
3. getByText                      // 사용자가 보는 텍스트
4. getByTestId                    // 위가 불가능할 때의 안정적 후크(data-testid)
   ───────────────────────────────  아래는 피한다 ───────────────
x. .locator('.css-class')         // 스타일에 결합
x. nth-child / 구조 기반 XPath     // 마크업에 결합
```

전환 예:

```ts
// before — 구조/클래스 결합
await page.locator('.modal .footer button:last-child').click();
await page.locator('#user-table tr:nth-child(2) td.name').textContent();

// after — 의미 기반
await page.getByRole('button', { name: '확인' }).click();
await page.getByRole('row', { name: /김토스/ }).getByRole('cell', { name: '이름' });
```

판단:
- 한국어 UI면 `name`도 한국어 라벨 그대로(`{ name: '다음' }`). codegen이 뽑아주는 role+name을 그대로 활용한다(playwright-cli/references/test-generation.md).
- role+name이 정말 안 되는 요소(아이콘만 있는 버튼 등)는 `data-testid`를 *제품 코드에 추가*해서 안정 후크를 만든다. 임의 CSS 경로보다 testid가 낫다.
- 동일 이름이 여러 개라 모호하면, 구조 셀렉터로 도망가지 말고 컨테이너 role로 스코프를 좁힌다(`getByRole('dialog').getByRole('button', {name})`).

## C-3. 번인(burn-in)

작성 직후 같은 테스트를 여러 번 반복 실행해 **숨은 비결정성을 표면화**한다. 한 번이라도 실패하면 플래키로 간주하고 머지하지 않는다.

```bash
# 변경/추가한 테스트만 골라 반복
npx playwright test path/to/changed.spec.ts --repeat-each=10

# 순서 의존·공유 상태 결함을 더 잘 드러내려면 워커 1개
npx playwright test path/to/changed.spec.ts --repeat-each=20 --workers=1

# 특정 테스트만(제목 필터)
npx playwright test --grep "결제수단 등록 실패" --repeat-each=15
```

회차 가이드(절대 규칙이 아니라 기대비용 기준):
- 빠른 테스트: 10–20회. 거의 비용이 안 든다.
- 무겁고 느린 테스트: 5–10회 + `--workers=1`로 한 번은 직렬 검증.
- 의심스러운(시간/네트워크가 얽힌) 테스트: 더 올린다.

해석:
- **단 한 번이라도 실패 = 플래키.** "20번 중 1번 실패"는 운영 CI에서 결국 빨개진다. 통과율을 신뢰 근거로 삼지 않는다.
- 번인에서 깨지면 보통 원인은 A(순서/공유 상태)나 B(외부가 안 막힘) 또는 C-1(대기)다. 거슬러 올라가 고친다.
- **머지 게이트로 쓴다.** 번인 없이 "로컬에서 한 번 통과"만으로 머지하면, 플래키를 머지 후로 미루는 것이다 — 발표가 경고한 바로 그 비싼 길.

## 자주 빠지는 함정

- `waitForTimeout`을 "임시로" 넣고 안 지움 → 영구 부채가 됨.
- 애니메이션/트랜지션 끝을 시간으로 추정 → 최종 상태를 조건으로 단언하라.
- 토스트/스낵바처럼 사라지는 요소를 고정 시간으로 잡기 → `toBeVisible` 후 `toBeHidden`으로 라이프사이클을 단언.
- 첫 실행만 보고 통과 선언 → 반드시 번인.
