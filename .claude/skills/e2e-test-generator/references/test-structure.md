# 목표 골격과 codegen → 컨벤션 변환

codegen 산출물은 "평평한 액션 나열"이다. 구조·인증·검증이 빠져 있다. 이 문서는 그것을 발표 결과물 기준의 구조로 옮기는 변환을 보여준다.

브라우저 명령 자체(codegen 으로 코드 뽑기, storageState 저장)는 `playwright-cli` 레퍼런스가 다룬다. 여기서는 **무엇으로 바꾸느냐**만 다룬다.

## 목표 골격

```typescript
import { test, expect } from '@playwright/test';

test.describe('주문 생성 플로우', () => {
  test('장바구니에서 결제까지 완료한다', async ({ page }) => {
    await test.step('상품 상세에서 장바구니 담기', async () => {
      await page.goto('/products/1024');
      await page.getByRole('button', { name: '장바구니 담기' }).click();
      await expect(page.getByRole('status')).toHaveText('담겼습니다');
    });

    await test.step('장바구니에서 주문하기로 이동', async () => {
      await page.getByRole('link', { name: '장바구니' }).click();
      await page.getByRole('button', { name: '주문하기' }).click();
      await expect(page).toHaveURL(/\/checkout/);
    });

    await test.step('결제 정보 입력 후 결제 완료', async () => {
      await page.getByRole('textbox', { name: '카드번호' }).fill('4242424242424242');
      await page.getByRole('button', { name: '결제' }).click();
      await expect(page.getByRole('heading', { name: '주문 완료' })).toBeVisible();
    });
  });
});
```

요점:

- 계획서의 **각 단계 = 하나의 `test.step`**. 실패 시 리포트에 어느 스텝인지 그대로 찍힌다.
- 스텝명은 **한글**(프로젝트 언어). 사용자 행동을 그대로 읽히게 쓴다.
- 인증 단계가 **본문에 없다.** 아래 픽스처로 빠진다.
- 각 스텝이 행동 + `expect` 로 끝난다. codegen 에는 없던 단언을 계획서 기대 결과에서 가져온다.

## codegen → 컨벤션: before / after

**Before (codegen 그대로 — 출발점):**

```typescript
await page.goto('https://app.example.com/login');
await page.locator('#email').fill('qa@example.com');
await page.locator('#password').fill('secret123');
await page.locator('button.login-btn').click();
await page.goto('https://app.example.com/products/1024');
await page.locator('.add-to-cart').click();
```

문제: 로그인이 인라인됐고, 셀렉터가 CSS 라 깨지기 쉽고, baseURL 을 안 쓰며, 단언이 없고, 단계 구분이 없다.

**After (재구조화):**

```typescript
// 로그인은 storageState 픽스처로 분리 → 본문에서 사라짐
test('상품을 장바구니에 담는다', async ({ page }) => {
  await test.step('상품 상세에서 장바구니 담기', async () => {
    await page.goto('/products/1024');                              // baseURL 활용
    await page.getByRole('button', { name: '장바구니 담기' }).click(); // role 셀렉터
    await expect(page.getByRole('status')).toContainText('담겼습니다'); // 단언 추가
  });
});
```

## 변환 규칙 요약

- 로그인/회원가입 인라인 → storageState 픽스처 또는 setup 프로젝트(`references/auth-fixture.md`).
- 절대 URL → `baseURL` 이 있으면 상대경로.
- `locator('#id')` / `.class` → `getByRole`/`getByLabel`/`getByTestId`(프로젝트 관례 우선).
- `waitForTimeout(고정 ms)` → `expect(...).toBeVisible()` 등 자동 재시도 단언, 또는 `waitForLoadState`.
- 행동만 있는 라인 묶음 → 계획 단계 단위 `test.step` 으로 묶고 각 끝에 단언.
- 중복 흐름(여러 테스트가 같은 선행 상태) → fixture 로 승격.

## 셀렉터 우선순위 (프로젝트 관례가 없을 때 기본값)

1. `getByRole(name)` — 접근성 트리 기반, 가장 견고.
2. `getByLabel` / `getByPlaceholder` — 폼 입력.
3. `getByTestId` — 위가 애매할 때, `data-testid` 가 있으면.
4. CSS/XPath — 최후의 수단. codegen 이 뱉었어도 가능하면 승격.

프로젝트가 `data-testid` 를 표준으로 쓰면 그 관례를 1순위로 둔다 — 일관성이 견고함보다 먼저다.
