---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript Style

## 적용 범위
`.ts`, `.tsx` 파일을 읽을 때 로드됩니다. `tsconfig.json` 의 `strict: true` 를 전제합니다.

## 원칙
- 타입은 **명시적**으로 선언하고, 추론에 의존할 곳/의존하지 않을 곳을 구분한다.
- API 경계(DTO, 함수 시그니처)는 반드시 타입을 드러낸다.
- `any` 는 마이그레이션 잔재 외에는 금지. 정당화가 필요하면 주석을 남긴다.
- `import type` 으로 타입 전용 import 를 분리해 번들러 최적화를 돕는다.

## 규칙

### RULE-TS-001 `type` 우선, `interface` 는 선택적
DTO, Props, 스토어 상태는 `type` 으로 선언합니다. `interface` 는 선언 병합(declaration merging)이 꼭 필요할 때만 사용합니다.

```ts
// 좋은 예
export type UserDTO = {
  id: number;
  name: string;
  email: string | null;
};

// 예외: 외부 라이브러리 타입 확장이 필요할 때
declare global {
  interface Window {
    __APP_VERSION__: string;
  }
}
```

### RULE-TS-002 Null 표현은 `| null`, optional 은 `?`
API 응답에서 **값이 존재할 수도, 없을 수도 있는 필드**는 `| null` 로 명시합니다. 호출 시 **생략 가능한 prop** 만 `?` 를 사용합니다.

```ts
// 좋은 예 (API 응답)
type ProductDTO = {
  id: number;
  description: string | null;   // 서버가 null 을 반환할 수 있음
};

// 좋은 예 (컴포넌트 props)
type ButtonProps = {
  label: string;
  disabled?: boolean;            // 생략 가능
};

// 나쁜 예 — 섞어 쓰지 말 것
type Bad = { description?: string | null };
```

### RULE-TS-003 명시적 반환 타입
`@typescript-eslint/explicit-function-return-type` 에 따라 모든 **exported 함수/컴포넌트**에 반환 타입을 명시합니다. 스타일 파일(`styles.ts`) 은 예외로 설정할 수 있습니다.

```tsx
// 좋은 예
export function getFullName(user: UserDTO): string {
  return `${user.firstName} ${user.lastName}`;
}

export function UserCard(props: UserCardProps): JSX.Element {
  return <div>{props.user.name}</div>;
}

// 나쁜 예
export function getFullName(user: UserDTO) {
  return `${user.firstName} ${user.lastName}`;
}
```

### RULE-TS-004 `import type` 강제
`@typescript-eslint/consistent-type-imports` 설정을 유지하고, 타입만 사용하는 import 는 반드시 `import type` 으로 구분합니다.

```ts
// 좋은 예
import type { UserDTO } from '@infrastructure/api/user/dtos';
import { fetchUser } from '@infrastructure/api/user/services';

// 나쁜 예
import { UserDTO, fetchUser } from '@infrastructure/api/user/services';
```

### RULE-TS-005 `any` 금지, `unknown` 허용
`any` 는 사용하지 않습니다. 외부 값(이벤트, JSON, 에러)은 `unknown` 으로 받고 좁혀서 사용합니다.

```ts
// 좋은 예
function handleError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return '알 수 없는 오류';
}

// 나쁜 예
function handleError(err: any) {
  return err.message;
}
```

### RULE-TS-006 Enum 은 API 상수/라우팅에만
문자열 enum 은 API 엔드포인트, 쿼리 키 등 **열거형 상수**에만 사용합니다. 일반 타입 조합은 Union literal 을 선호합니다.

```ts
// 좋은 예 (API 엔드포인트)
export enum ApiEndpoints {
  LIST_USERS = '/v1/users',
  CREATE_USER = '/v1/users',
}

// 좋은 예 (union literal)
type Status = 'idle' | 'loading' | 'success' | 'error';

// 나쁜 예 (불필요한 enum)
enum StatusEnum { Idle, Loading, Success, Error }
```

### RULE-TS-007 제네릭은 의미 있는 이름으로
`T`, `U` 만 쓰지 말고, 역할이 명확할 때는 `TData`, `TRequest`, `TResponse` 같이 역할 접두사를 붙입니다.

```ts
// 좋은 예
export function useBaseMutation<TResponse, TRequest>(
  props: BaseMutationProps<TResponse, TRequest>,
): BaseMutationResult<TResponse, TRequest> { /* ... */ }
```

### RULE-TS-008 좁은 타입을 먼저, 넓은 타입을 나중에
함수 오버로드·유니온 분기에서는 **더 구체적인 타입**을 먼저 두고, `never` 가 필요한 분기에 exhaustive check 를 적용합니다.

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${String(x)}`);
}

type Shape = { kind: 'circle'; r: number } | { kind: 'square'; a: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2;
    case 'square': return s.a ** 2;
    default:       return assertNever(s);
  }
}
```

## 참고
- [`react-components.md`](./react-components.md) — Props 타입 위치/이름 규칙.
- [`api-infrastructure.md`](./api-infrastructure.md) — DTO 타입 선언 세부.
- ESLint 규칙: `@typescript-eslint/explicit-function-return-type`, `consistent-type-imports`.
