---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.stories.ts"
  - "**/*.stories.tsx"
---

# Testing Rules

본 파일은 **테스트 도구 도입 시 따를 규약**을 미리 합의해 둔 사양서입니다. 실제 테스트 작성을 시작하려면 다음 순서를 지키세요.

1. **도구 도입 PR 선행** — Vitest 또는 Jest, Testing Library, MSW 등을 `devDependencies` 로 추가하고 `test` 스크립트와 설정 파일을 커밋.
2. (선택) E2E — Playwright 설치, `playwright.config.ts`, `test:e2e` 스크립트.
3. (선택) Storybook 시각 회귀 — Chromatic 토큰/CI 단계 추가.
4. 도입 PR 머지 후 본 규칙에 따라 테스트 작성 시작.

도구 미설치 상태에서 본 규칙을 근거로 테스트 코드를 생성하지 마세요(존재하지 않는 모듈 import 위험).

## 적용 범위
테스트 파일(`*.test.ts(x)`) 또는 Storybook 파일(`*.stories.*`) 을 읽을 때 로드됩니다. 도입 후 레이어별 테스트 책임과 Storybook 규칙을 정의합니다.

## 원칙
- **단위 테스트**는 로직(유틸, 훅) 중심. 렌더 스냅샷을 맹목적으로 쓰지 않는다.
- **통합 테스트**는 Feature View 단위에서 훅 + 컴포넌트 조합을 검증한다.
- **E2E 테스트**는 사용자 시나리오 중심. 외부 의존성은 `.env.test` 환경으로 고립.
- **Storybook** 은 컴포넌트 계약/시각 회귀의 Source of Truth.
- 테스트 파일은 대상과 **같은 폴더** 에 둔다. 먼 곳의 `__tests__/` 디렉토리 지양.

## 규칙 (도입 후 적용)

### RULE-TEST-001 테스트 피라미드
| 레벨 | 범위 | 도구(예시) |
| --- | --- | --- |
| 단위 | 유틸, 순수 훅, reducer, 셀렉터 | Jest 또는 Vitest |
| 통합 | Feature View, 컴포넌트 + 훅 | Testing Library |
| E2E | 핵심 사용자 시나리오 | Playwright |
| 시각 | UI 회귀 | Storybook + Chromatic |

피라미드 기준: 단위 ≫ 통합 > E2E. E2E 는 **중요한 행복 경로**만.

### RULE-TEST-002 파일 배치
테스트 파일은 대상과 같은 폴더에 둡니다.

```
components/molecules/userCard/
├── index.tsx
├── styles.ts
├── types.ts
├── userCard.test.tsx     // 통합 테스트
└── userCard.stories.tsx  // Storybook
```

### RULE-TEST-003 테스트 이름
`describe` / `it` 의 문장은 **행동 + 기대 결과** 로 작성합니다.

```ts
// 좋은 예
describe('formatCurrency', () => {
  it('KRW 금액을 ₩ 기호와 천단위 쉼표로 변환한다', () => {
    expect(formatCurrency(1234567, 'KRW')).toBe('₩1,234,567');
  });
});

// 나쁜 예
describe('formatCurrency', () => {
  it('works', () => { /* ... */ });
});
```

### RULE-TEST-004 단위 테스트 대상 선정
- 유틸 함수: 필수.
- 순수 훅(외부 I/O 없음): 필수.
- React Query 훅: MSW 또는 쿼리 클라이언트 mocking 으로 테스트 가능할 때만.
- Presentational 컴포넌트: 기본 렌더 + 핵심 조건 분기 중심. 스냅샷 남발 금지.

### RULE-TEST-005 E2E 대상 선정
E2E 는 다음 **사용자 행복 경로**에 한정합니다.
- 로그인 → 주요 리스트 진입.
- 리소스 생성/수정/삭제 핵심 플로우.
- 권한/역할별 접근 제어.

데이터 fixture 는 `.env.test` 대상 백엔드의 seed 데이터에 의존합니다.

### RULE-TEST-006 Storybook 스토리 구조
각 컴포넌트는 다음 스토리를 갖습니다.
- **`Default` (필수)** — 기본 상태.
- **`Playground` (필수)** — `args` 로 수동 조작.
- **`Loading` / `Empty` / `Error` (해당 상태가 있을 때 추가)** — 비동기/빈/에러 상태가 컴포넌트에 존재하는 경우만.

```tsx
// userCard.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { UserCard } from './';

const meta: Meta<typeof UserCard> = {
  title: 'molecules/UserCard',
  component: UserCard,
};
export default meta;

type Story = StoryObj<typeof UserCard>;

export const Default: Story = {
  args: { user: { id: 1, name: 'Alice', email: 'a@example.com' } },
};

export const Playground: Story = {
  args: { user: { id: 2, name: 'Bob', email: null } },
};
```

### RULE-TEST-007 Storybook 뷰포트
커스텀 뷰포트(Desktop/Tablet/Mobile) 전체에서 주요 컴포넌트가 **레이아웃 깨짐 없이** 렌더되는지 확인합니다. Storybook 은 PR 전에 1회 이상 실행.

### RULE-TEST-008 모킹 원칙
- 네트워크: MSW 로 모킹 → 실제 axios 코드 경로 유지.
- 모듈: 같은 레이어만 모킹. Presentation 테스트가 axios 를 직접 mock 하지 않도록 훅 수준 mocking 사용.

```ts
// 좋은 예 (훅 수준 모킹)
vi.mock('@hooks/api/user', () => ({
  useUserList: () => ({
    data: [{ id: 1, name: 'Alice', email: 'a@example.com' }],
    isLoading: false,
  }),
}));

// 나쁜 예 (먼 레이어 모킹)
vi.mock('axios');   // Presentation 테스트에서 axios 직접 모킹
```

### RULE-TEST-009 비결정성 제거
`Date.now`, `Math.random`, 타이머는 테스트에서 고정합니다(`vi.useFakeTimers`, `jest.setSystemTime`).

### RULE-TEST-010 테스트 커버리지 목표
- 유틸/순수 훅: 90%+.
- Feature View 통합: 핵심 분기 커버 (세부 % 강제 없음).
- E2E: 행복 경로 per feature 1개 이상.

커버리지 수치는 품질 게이트 용이며, 단독 목표가 아닙니다.

## 참고
- [`workflow-build.md`](./workflow-build.md) — CI 에서 테스트 실행 순서.
- [`architecture.md`](./architecture.md) — Feature View 단위 테스트 경계.
- Testing Library: <https://testing-library.com/>
- Playwright: <https://playwright.dev/>
