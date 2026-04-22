---
paths:
  - "**/infrastructure/**/*.ts"
---

# API / Infrastructure Rules

## 적용 범위
`infrastructure/**/*.ts` — HTTP 클라이언트, DTO 타입, service 호출 함수에 적용됩니다. 두 섹션으로 구성:
1. **원칙 (스택 중립)** — fetch/axios/ky 등 어떤 HTTP 어댑터에도 적용.
2. **구현 가이드 (본 프로젝트)** — axios 단일 인스턴스 + ApiEndpoints enum.

## 원칙 (스택 중립)
- Infrastructure 는 UI 런타임(React/Emotion/Next 등) 에 의존하지 않는다(순수 TS).
- HTTP 호출은 **서비스 함수 1 = 엔드포인트 1** 원칙으로 작성한다.
- 모든 엔드포인트 문자열은 enum/상수로 중앙화한다.
- 요청/응답 DTO 는 도메인 폴더의 `dtos.ts` 에 같이 둔다.
- 응답 타입은 공용 래퍼로 일관화하여 훅 계층이 동일한 방식으로 풀어 쓴다.
- HTTP 클라이언트는 단일 인스턴스를 공유한다(인증/타임아웃/에러 인터셉터를 한 곳에서).

## 구현 가이드 (본 프로젝트)

### RULE-API-001 도메인 폴더 구조
각 도메인은 `dtos.ts` + `services.ts` 두 파일로 구성합니다.

```
infrastructure/api/user/
├── dtos.ts      // UserDTO, UserCreateDTO, UserListDTO, ...
└── services.ts  // fetchUserList, createUser, modifyUser, ...
```

### RULE-API-002 DTO 네이밍
| 종류 | 네이밍 | 예시 |
| --- | --- | --- |
| 응답 단건 | `{Entity}DTO` | `UserDTO` |
| 응답 목록 아이템 | `{Entity}ListDTO` | `UserListDTO` |
| 요청 생성 | `{Entity}CreateDTO` | `UserCreateDTO` |
| 요청 수정 | `{Entity}ModifyDTO` | `UserModifyDTO` |

```ts
// 좋은 예
export type UserDTO = { id: number; name: string; email: string | null };
export type UserCreateDTO = { name: string; email: string };
export type UserModifyDTO = Partial<UserCreateDTO>;
```

### RULE-API-003 공용 응답 래퍼
서버 응답은 `ResponseWithMetadata<T>` / `ResponsePagingWithMetadata<T>` 로 래핑합니다. 훅 계층이 `.data` 를 꺼내고 컴포넌트에 전달합니다.

```ts
// base_dtos.ts
export type ResponseWithMetadata<T> = {
  success: boolean;
  message?: string;
  // optional: 에러 응답에는 data 가 없을 수 있어 단건 래퍼는 optional 로 둡니다.
  data?: T;
};

export type ResponsePagingWithMetadata<T> = {
  success: boolean;
  // required: 페이지 응답은 항상 content 배열을 가집니다(빈 배열이라도 존재).
  data: {
    content: T[];
    totalPages: number;
    totalElements: number;
    pageable: unknown;
  };
};
```

`pageable` 의 형태는 백엔드 페이지네이션 명세(예: Spring `Pageable`)에 따라 달라집니다. 프로젝트별로 구체 타입을 정의해도 됩니다.

### RULE-API-004 엔드포인트는 enum 으로
엔드포인트 문자열은 `ApiEndpoints` enum 에 정의합니다. 서비스 함수에서만 사용하고, 훅·컴포넌트에 노출하지 않습니다.

```ts
// constants.ts
export enum ApiEndpoints {
  LIST_USERS = '/v1/users',
  GET_USER = '/v1/users/:id',
  CREATE_USER = '/v1/users',
}

// services.ts
import { ApiEndpoints } from '@infrastructure/api/constants';

export async function fetchUserList(): Promise<ResponseWithMetadata<UserDTO[]>> {
  const res = await instance.get(ApiEndpoints.LIST_USERS);
  return res.data;
}
```

### RULE-API-005 서비스 함수 시그니처
- 이름은 `{verb}{Entity}`: `fetch`, `create`, `modify`, `delete`, `search`.
- 반환 타입은 **반드시 명시** (`Promise<ResponseWithMetadata<T>>`).
- 인자는 도메인 DTO 한 개로 받는 것이 기본. 다수 파라미터는 객체로 묶기.

```ts
// 좋은 예
export async function createUser(
  body: UserCreateDTO,
): Promise<ResponseWithMetadata<UserDTO>> {
  const res = await instance.post(ApiEndpoints.CREATE_USER, body);
  return res.data;
}

// 나쁜 예
export async function createUser(name, email) {   // 타입 없음
  return instance.post('/v1/users', { name, email });
}
```

### RULE-API-006 axios 인스턴스 단일화
`infrastructure/client/` 의 axios instance 하나를 모든 서비스가 공유합니다. 서비스 파일에서 `axios.create()` 를 반복 호출하지 않습니다.

```ts
// services.ts
import instance from '@infrastructure/client';

// 좋은 예
await instance.get(ApiEndpoints.LIST_USERS);

// 나쁜 예
import axios from 'axios';
await axios.get('https://api.example.com/v1/users');
```

### RULE-API-007 쿼리 파라미터
복잡한 쿼리 스트링은 `qs` 로 직렬화하거나 axios `params` 를 사용합니다. 수동 문자열 조립 금지.

```ts
// 좋은 예
await instance.get(ApiEndpoints.LIST_USERS, {
  params: { page, size, keyword },
  paramsSerializer: (p) => qs.stringify(p, { arrayFormat: 'repeat' }),
});

// 나쁜 예
await instance.get(`/v1/users?page=${page}&size=${size}&keyword=${keyword}`);
```

### RULE-API-008 URL 파라미터 치환
`path-to-regexp` 또는 helper(`pathToUrl`) 로 치환합니다. 문자열 결합 금지.

```ts
// 좋은 예
import { pathToUrl } from '@infrastructure/helper/url';

await instance.get(pathToUrl(ApiEndpoints.GET_USER, { id: String(userId) }));

// 나쁜 예
await instance.get('/v1/users/' + userId);
```

### RULE-API-009 Infrastructure 는 React 무관
이 계층 파일에서 `react`, `react-query`, `@emotion/*` import 를 금지합니다. React 통합은 `application/hooks/api/` 에서 처리합니다.

### RULE-API-010 DTO 외 로컬 확장 타입
컴포넌트용 가공 타입은 `presentation/features/{name}/types.ts` 또는 `application/hooks/api/{domain}/types.ts` 로 분리하고, DTO 파일에는 섞지 않습니다.

## 참고
- [`state-management.md`](./state-management.md) — React Query 훅이 services 를 호출하는 방식.
- [`architecture.md`](./architecture.md) — RULE-ARCH-004, RULE-ARCH-005.
- [`typescript.md`](./typescript.md) — DTO 타입 선언 방식.
- Axios: <https://axios-http.com/>
