---
paths:
  - "**/*.tsx"
  - "**/types.ts"
---

# React Component Rules

## 적용 범위
`.tsx` 또는 컴포넌트 폴더 옆 `types.ts` 를 읽을 때 로드됩니다. React 18 함수 컴포넌트 + Hooks 를 전제하며, Atomic Design + Feature-Based 폴더 구조를 가정합니다.

## 원칙
- **함수 선언(function declaration)** 을 기본으로 사용한다.
- Props 타입은 별도 `types.ts` 로 분리한다.
- **Named export** 를 선호하고 default export 는 라우터가 요구하는 페이지 파일에 한정한다.
- `memo`/`forwardRef` 는 성능·ref 전달이 실제로 필요할 때만 쓴다.
- 컴포넌트 하나 = 폴더 하나 (`index.tsx` + `types.ts` + `styles.ts` + `*.stories.tsx`).

## 규칙

### RULE-COMP-001 함수 선언문 사용
컴포넌트는 `function` 키워드로 선언하고 반환 타입을 명시합니다. 화살표 함수는 `forwardRef` 같이 참조 변수가 필요할 때만 사용합니다.

```tsx
// 좋은 예
export function UserCard(props: UserCardProps): JSX.Element {
  return <div>{props.user.name}</div>;
}

// 허용: forwardRef
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (props, ref) => <input ref={ref} {...props} />,
);

// 나쁜 예 (화살표 + named const)
export const UserCard = (props: UserCardProps): JSX.Element => (
  <div>{props.user.name}</div>
);
```

### RULE-COMP-002 Props 타입은 `types.ts` 로 분리
같은 폴더의 `types.ts` 에 Props 타입을 두고 `index.tsx` 가 import 합니다. 4–5줄의 작은 타입이더라도 분리합니다(자동 import·재사용 용이).

```
components/molecules/userCard/
├── index.tsx      // export function UserCard
├── types.ts       // export type UserCardProps
├── styles.ts      // export const Container = styled.div`...`
└── userCard.stories.tsx
```

```ts
// types.ts
export type UserCardProps = {
  user: UserDTO;
  onSelect?: (id: number) => void;
};
```

### RULE-COMP-003 Named Export 선호
default export 는 라우터가 요구하는 페이지 파일(예: Next.js `pages/**/*`) 처럼 시스템이 요구하는 경우에만 사용합니다. 컴포넌트·훅·유틸은 named export 로 통일합니다.

```tsx
// 좋은 예
export function UserCard(): JSX.Element { /* ... */ }

// 라우터 페이지만 예외
export default function UserPage(): JSX.Element { /* ... */ }
```

### RULE-COMP-004 `memo` / `forwardRef` 사용 기준
- `memo`: 리스트 아이템·가상화 컴포넌트처럼 **부모가 자주 리렌더링되지만 자식 props 가 거의 안 바뀌는** 경우에만.
- `forwardRef`: 포커스 제어, 외부 스크롤, 서드파티 ref 연결이 필요할 때만.

```tsx
// 좋은 예 (리스트 아이템에 memo)
export const UserRow = memo(function UserRow(props: UserRowProps): JSX.Element {
  return <Row>{props.user.name}</Row>;
}, isEqualProps);

// 나쁜 예 (리프 Presentational 컴포넌트에 무분별한 memo)
export const Badge = memo(function Badge(): JSX.Element { return <span /> });
```

### RULE-COMP-005 컴포넌트 길이 권장
`index.tsx` 는 **150줄 이하 권장**(경험적 분해 임계치). 넘으면 하위 컴포넌트(`components/{parent}/parts/`) 또는 커스텀 훅으로 분해합니다. 강제 한도는 아니며, 책임이 응집되어 있으면 초과해도 무방합니다.

### RULE-COMP-006 props 구조 분해는 함수 인자에서 한 번만
Props 를 여러 번 구조 분해해서 재할당하지 않습니다. 필요한 변수명은 인자 자리에서 바로 바꿉니다.

```tsx
// 좋은 예
export function UserCard({ user, onSelect }: UserCardProps): JSX.Element {
  return <Row onClick={() => onSelect?.(user.id)}>{user.name}</Row>;
}

// 나쁜 예
export function UserCard(props: UserCardProps): JSX.Element {
  const { user } = props;
  const u = user;
  return <Row>{u.name}</Row>;
}
```

### RULE-COMP-007 조건부 렌더링 스타일
- boolean 게이트: `cond && <X />`
- 둘 중 하나: `cond ? <A /> : <B />`
- 3 가지 이상: 상수 테이블 또는 `switch` 기반 서브 컴포넌트.

```tsx
// 좋은 예 (3가지 이상 분기)
const STATUS_BADGES: Record<Status, JSX.Element> = {
  idle:    <IdleBadge />,
  loading: <Spinner />,
  success: <SuccessBadge />,
  error:   <ErrorBadge />,
};
return STATUS_BADGES[status];
```

### RULE-COMP-008 Side-Effect 훅은 컴포넌트 최상단
`useEffect`, `useLayoutEffect` 는 컴포넌트 상단 훅 그룹에 모으고, JSX 직전에 이벤트 핸들러·파생 상태를 선언합니다.

```tsx
export function UserCard(props: UserCardProps): JSX.Element {
  // 1) 훅
  const { data } = useUser(props.id);
  useEffect(() => { /* ... */ }, []);

  // 2) 파생/핸들러
  const handleClick = useCallback(() => {}, []);

  // 3) 렌더
  return <div onClick={handleClick}>{data?.name}</div>;
}
```

### RULE-COMP-009 인라인 스타일/컬러 금지
JSX 에 `style={{ color: '#333' }}` 같은 인라인 스타일/하드코딩 컬러를 쓰지 않습니다. 스타일 파일의 `styled` 또는 `css` 와 테마 토큰을 사용합니다(`styling-emotion.md`).

## 참고
- [`typescript.md`](./typescript.md) — Props 타입 선언 규칙.
- [`styling-emotion.md`](./styling-emotion.md) — `styles.ts` 구조.
- [`naming-conventions.md`](./naming-conventions.md) — 폴더/파일 네이밍.
