---
paths:
  - "**/store/**/*.ts"
  - "**/hooks/api/**/*.ts"
---

# State Management Rules

## 적용 범위
스토어(`store/**/*.ts`) 와 API 훅(`hooks/api/**/*.ts`) 을 읽을 때 로드됩니다. 두 섹션으로 구성:
1. **원칙 (스택 중립)** — 어떤 상태 라이브러리에도 적용 가능.
2. **구현 가이드 (본 프로젝트)** — Zustand + React Query.

## 원칙 (스택 중립)
- **서버 상태**(원격에서 fetch) 와 **클라이언트 상태**(UI/세션) 를 도구·파일·디렉토리 수준에서 **분리**한다.
- 쿼리 키는 enum/상수로 중앙화한다. 하드코딩된 문자열 키 금지.
- 글로벌 스토어는 도메인별로 작은 단위로 쪼갠다. 하나의 "god store" 금지.
- 모달/다이얼로그 열림 상태는 한 폴더에 모아 도메인 스토어 비대화를 막는다.
- 상태 setter 네이밍 규약을 통일하고, 불변 업데이트만 허용한다.

## 구현 가이드 (본 프로젝트)
서버 상태는 **React Query**, 클라이언트 상태는 **Zustand** 입니다. Context API/Redux/useReducer 체이닝은 복잡한 전역 상태에 사용하지 않습니다.

### RULE-STATE-001 상태 종류별 도구 매핑
| 상태 | 도구 | 저장 위치 |
| --- | --- | --- |
| 서버 데이터 | React Query | 메모리 캐시 |
| 클라이언트 UI 상태 | Zustand | 메모리 스토어 |
| 폼 상태 | react-hook-form | 메모리 |
| 세션/인증 | NextAuth 등 | 쿠키/서버 |
| 모달 열림 상태 | Zustand(`store/modal/`) | 메모리 |

### RULE-STATE-002 React Query 훅 네이밍
- 쿼리: `use{Entity}{Purpose}` — 예: `useUserList`, `useUserDetail`.
- 뮤테이션: `use{Verb}{Entity}` — 예: `useCreateUser`, `useModifyUser`, `useDeleteUser`.

```ts
// 좋은 예
export function useUserList(): UserListResult { /* ... */ }
export function useCreateUser(): UseMutationResult<UserDTO, UserCreateDTO> { /* ... */ }

// 나쁜 예
export function getUsers(): UserDTO[] { /* ... */ }     // 훅이 아닌 이름
export function useUsers(): unknown { /* ... */ }       // 목적 불명확
```

### RULE-STATE-003 Query Key 는 enum/상수로
쿼리 키는 `ApiQueryKeys` 같은 enum 에 정의하고, 파라미터는 배열 뒤에 붙입니다.

```ts
// 좋은 예
import { ApiQueryKeys } from '@hooks/api/constants';

const queryKey: QueryKey = [ApiQueryKeys.USER_DETAIL, String(userId)];

// 나쁜 예
const queryKey: QueryKey = ['userDetail', userId];   // 오타/중복 발생 쉬움
```

### RULE-STATE-004 Base 훅 래퍼 사용
프로젝트 표준 래퍼(`useBaseQuery`, `useBaseMutation`, `useBasePagination`) 를 사용합니다. 공통 옵션(에러 처리, 토스트, retry)을 일관되게 적용하기 위함입니다.

```ts
// 좋은 예
export function useUserList(): UserListResult {
  const { data, isLoading, refetch } = useBaseQuery<ResponseWithMetadata<UserDTO[]>>({
    queryKey: [ApiQueryKeys.USER_LIST],
    queryFn: fetchUserList,
  });
  return { data: data?.data, isLoading, refetch };
}

// 나쁜 예 (원시 useQuery 직접 사용)
const { data } = useQuery({ queryKey: ['userList'], queryFn: fetchUserList });
```

### RULE-STATE-005 React Query 기본 옵션
`QueryClient` 기본값은 다음과 같이 고정합니다.
- `throwOnError: true`
- `retry: 1`
- `refetchOnWindowFocus: false`
- `staleTime: 60_000` (1분)

특수 케이스(실시간 데이터, 긴 캐시)는 훅 옵션에서 **명시적**으로 override 합니다.

### RULE-STATE-006 Zustand 스토어 구조
`set` 인자는 Zustand 가 추론하도록 두거나, 명시할 때는 `StoreApi<T>['setState']` 를 사용합니다. `any` 금지(typescript.md RULE-TS-005).

```ts
import { create, type StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

type UserSelectionState = {
  selectedUserId: number | null;
  setSelectedUserId: (id: number | null) => void;
  reset: () => void;
};

// StateCreator 로 set/get 타입을 자동 추론
const initializer: StateCreator<UserSelectionState> = (set) => ({
  selectedUserId: null,
  setSelectedUserId: (id) => set({ selectedUserId: id }),
  reset: () => set({ selectedUserId: null }),
});

// dev 에만 devtools, prod 에서는 제거
export const useUserSelectionStore =
  process.env.NODE_ENV !== 'production'
    ? create<UserSelectionState>()(devtools(initializer))
    : create<UserSelectionState>()(initializer);
```

### RULE-STATE-007 Setter 네이밍
상태 setter 는 `set{PropertyName}` 으로 명명합니다. Toggle 은 `toggle{PropertyName}`.

```ts
// 좋은 예
setSelectedUserId(42);
toggleDrawer();

// 나쁜 예
selectUser(42);              // 의도 불명확
updateSelectedUserId(42);    // 불필요하게 장황
```

### RULE-STATE-008 모달 상태는 단일 폴더에 집중
모든 모달/다이얼로그 열림 상태는 `store/modal/` 에 모아, 도메인 스토어가 비대해지지 않도록 합니다.

```
store/
├── user/              // 도메인 상태
├── modal/             // 모달 열림 상태만
│   ├── createUser.ts
│   ├── modifyUser.ts
│   └── confirmDelete.ts
```

### RULE-STATE-009 불변 업데이트
배열·객체 업데이트는 직접 mutate 하지 않습니다. 스프레드 또는 `immer` 를 사용합니다.

```ts
// 좋은 예 (spread)
set((state) => ({ items: [...state.items, newItem] }));

// 좋은 예 (immer)
import { produce } from 'immer';
set((state) => produce(state, (draft) => { draft.items.push(newItem); }));

// 나쁜 예
set((state) => { state.items.push(newItem); return state; });
```

### RULE-STATE-010 훅 밖에서 스토어 접근 시 `getState()`
React 컴포넌트 밖(이벤트 리스너, 라우팅 가드 등) 에서는 `useStore.getState()` 를 사용합니다. 함수형 업데이트는 `useStore.setState((state) => ...)`.

## 참고
- [`api-infrastructure.md`](./api-infrastructure.md) — React Query 훅이 호출하는 service 계층.
- [`architecture.md`](./architecture.md) — 계층 간 경계.
- TanStack React Query: <https://tanstack.com/query/latest>
- Zustand: <https://zustand.docs.pmnd.rs/>
