# 인증 분리: storageState 픽스처 / setup 프로젝트

발표 결과물의 핵심 컨벤션 하나가 "인증을 테스트 본문에서 떼어내는 것"이다. 이유:

- 매 테스트가 UI 로그인을 반복하면 **느리고 불안정**하다(로그인 페이지가 흔들리면 무관한 테스트가 다 깨진다).
- 테스트는 "로그인이 되는가"가 아니라 **로그인 이후의 시나리오**를 검증해야 한다. 로그인은 전제 조건이지 검증 대상이 아니다.

storageState(쿠키 + localStorage 스냅샷) 를 한 번 만들어 두고 여러 테스트가 재사용한다.

storageState 를 만들고 저장하는 **명령**은 여기서 다루지 않는다 — `.claude/skills/playwright-cli/references/storage-state.md`(`state-save` / `state-load`, 파일 포맷, 보안 주의). 이 문서는 그걸 **테스트 코드 구조에 어떻게 엮느냐**를 다룬다.

## 패턴 A: setup 프로젝트 (권장, 규모가 큰 저장소)

`playwright.config.ts` 에서 로그인 전용 프로젝트를 먼저 돌려 storageState 파일을 만들고, 본 테스트 프로젝트가 그 파일을 로드한다.

```typescript
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' },
      dependencies: ['setup'],   // setup 이 먼저 돈다
    },
  ],
});
```

```typescript
// auth.setup.ts — 로그인은 여기 한 곳에만 산다
import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = '.auth/user.json';

setup('로그인 상태 저장', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: '이메일' }).fill(process.env.E2E_USER!);
  await page.getByRole('textbox', { name: '비밀번호' }).fill(process.env.E2E_PASS!);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL(/\/dashboard/);   // 로그인 성공 확인
  await page.context().storageState({ path: AUTH_FILE });
});
```

이제 각 시나리오 테스트는 이미 로그인된 상태로 시작한다 — 본문에 로그인이 없다.

## 패턴 B: 커스텀 픽스처 (작은 저장소·세션별 계정)

테스트마다 다른 계정이 필요하거나 setup 프로젝트가 과한 경우, `test.extend` 로 인증된 page 를 픽스처화한다.

```typescript
// fixtures/auth.ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: '이메일' }).fill(process.env.E2E_USER!);
    await page.getByRole('textbox', { name: '비밀번호' }).fill(process.env.E2E_PASS!);
    await page.getByRole('button', { name: '로그인' }).click();
    await use(page);
  },
});
export { expect } from '@playwright/test';
```

시나리오 파일은 `import { test, expect } from '../fixtures/auth'` 로 가져와, 본문에서 로그인을 신경 쓰지 않는다.

## 어느 패턴을 고르나

- 기존 코드가 이미 한쪽을 쓰면 **그쪽을 따른다**(일관성 우선).
- 둘 다 없고 새로 정하는 경우: 계정이 공용 1개면 패턴 A, 테스트별 상태가 갈리면 패턴 B.

## 초기화 로직 일반론

인증 외에도 계획서가 전제하는 선행 상태가 있으면 같은 자리(setup/픽스처)에 모은다.

- 시드 데이터(주문·상품) — UI 보다 API 호출로 만드는 게 빠르고 안정적이다.
- 기능 플래그 / 실험 그룹 고정.
- 시간·로케일·뷰포트 같은 환경 고정.

원칙: **테스트 본문에는 "검증하려는 행동"만 남기고, 전제 상태는 전부 초기화 영역으로** 뺀다.

## 보안

- 계정/토큰은 환경변수(`E2E_USER`, `E2E_PASS` 등) 로. 코드에 하드코딩 금지.
- storageState 파일(`.auth/*.json`) 은 토큰을 품으므로 **커밋 금지** — `.gitignore` 에 추가.
- 더 자세한 보안 주의는 `playwright-cli/references/storage-state.md` 의 Security Notes.
