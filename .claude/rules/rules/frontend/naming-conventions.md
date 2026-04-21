# Naming Conventions

## 적용 범위
프로젝트 전체. 폴더·파일·심볼 명명 규칙을 정의합니다. 개별 주제 규칙(TypeScript, React 등) 에서 참조합니다.

## 원칙
- 폴더는 **camelCase**, 파일은 역할에 따른 고정 이름(`index.tsx`, `types.ts`, `styles.ts`, `services.ts`, `dtos.ts`) 사용.
- 심볼(컴포넌트·타입) 은 **PascalCase**, 함수·훅은 **camelCase**, 상수는 **UPPER_SNAKE_CASE**.
- 도메인 계층 경로는 **단수형**(`user/`, `product/`) 을 기본으로, 서비스 내 컬렉션 엔티티에만 `List` 접미사.
- 이름은 **구체적**으로. `utils.ts`, `helpers.ts`, `common.ts` 같은 총칭 파일명을 피하고 역할로 이름 짓기.

## 규칙

### RULE-NAME-001 폴더 네이밍
| 계층 | 규칙 | 예시 |
| --- | --- | --- |
| `pages/` | kebab-case | `user-profile/`, `order-detail/` |
| `presentation/components/` | camelCase | `userCard/`, `productCard/` |
| `presentation/features/` | camelCase + `View` 접미사 | `userListView/`, `orderDetailView/` |
| `application/hooks/api/` | camelCase + 도메인 경로 | `user/`, `order/item/` |
| `application/store/` | camelCase | `user/`, `modal/` |
| `infrastructure/api/` | camelCase + 도메인 경로 | `user/`, `order/item/` |
| `providers/` | kebab-case 또는 단일 단어 | `auth/`, `query/`, `emotion/` |

`providers/` 가 kebab-case 인 이유: 라이브러리/외부 표기(`react-query`, `next-auth`) 와 어휘적으로 정렬되어, 단일 단어든 복합어든 동일한 패턴으로 표기됩니다.

### RULE-NAME-002 표준 파일명
| 역할 | 파일명 | 위치 |
| --- | --- | --- |
| 컴포넌트 진입점 | `index.tsx` | 컴포넌트 폴더 |
| Props / 상태 타입 | `types.ts` | 같은 폴더 |
| 스타일 | `styles.ts` | 같은 폴더 |
| API 서비스 | `services.ts` | `infrastructure/api/{domain}/` |
| DTO | `dtos.ts` | `infrastructure/api/{domain}/` |
| Storybook | `{name}.stories.tsx` | 컴포넌트 폴더 |
| 테스트 | `{name}.test.ts(x)` | 대상과 같은 폴더 또는 `__tests__/` |

`type.ts` / `dto.ts` (단수) 는 신규 작성 시 사용하지 않습니다 — 항상 복수형 `types.ts`, `dtos.ts`.

### RULE-NAME-002a 단수형 → 복수형 점진 마이그레이션
**현재 코드베이스에는 `type.ts` / `dto.ts` 단수형 파일이 잔존합니다.** 일괄 대량 개명은 PR 충돌·리뷰 부담 때문에 금지하고, 다음 조건에서만 함께 개명합니다.
- 같은 PR/커밋에서 해당 파일을 어차피 수정하는 경우.
- 같은 도메인 폴더(`infrastructure/api/{domain}/`) 내 다른 파일을 만지는 경우, 가능한 범위에서 동반 개명.
- import 경로 일괄 치환은 codemod/IDE 리네임으로 처리하고, 단독 PR 로 분리.

```
# 좋은 마이그레이션 단위
infrastructure/api/user/dto.ts  → dtos.ts   (해당 도메인 작업 PR 안에서)

# 금지
"전 도메인 dto.ts → dtos.ts" 단독 대규모 PR (리뷰 불가)
```

### RULE-NAME-003 심볼 네이밍
| 종류 | 규칙 | 예시 |
| --- | --- | --- |
| 컴포넌트 | PascalCase | `UserCard`, `SearchBar` |
| 타입/인터페이스 | PascalCase | `UserDTO`, `UserCardProps` |
| 훅 | `useXxx` (camelCase) | `useUserList`, `useCreateUser` |
| 일반 함수 | camelCase | `formatDate`, `pathToUrl` |
| 상수 | UPPER_SNAKE_CASE | `DEFAULT_PAGE_SIZE` |
| enum 멤버 | UPPER_SNAKE_CASE | `ApiEndpoints.LIST_USERS` |
| 파일 내 로컬 변수 | camelCase | `const userList` |

### RULE-NAME-004 훅 이름
- 쿼리 훅: `use{Entity}{Purpose}` — `useUserList`, `useUserDetail`.
- 뮤테이션 훅: `use{Verb}{Entity}` — `useCreateUser`, `useModifyUser`.
- 로직 훅: `use{Action}` — `useModalCreateUser`, `useConfirmDelete`.

### RULE-NAME-005 DTO / 서비스 함수 이름
`api-infrastructure.md` 의 RULE-API-002, RULE-API-005 참고. 요약:

```ts
// DTO
UserDTO, UserListDTO, UserCreateDTO, UserModifyDTO

// 서비스
fetchUserList(), fetchUser(id), createUser(body), modifyUser(id, body), deleteUser(id)
```

### RULE-NAME-006 부정/긍정 boolean
- 긍정형 우선: `isOpen`, `hasError`, `canEdit`.
- 부정형은 피하고, 필요 시 `isDisabled` 처럼 상태 단어에 편입.

```ts
// 좋은 예
const { isOpen, hasError } = useModalState();

// 나쁜 예
const { notClosed, noError } = useModalState();
```

### RULE-NAME-007 약어 사용
- 널리 쓰이는 약어만 허용: `id`, `url`, `dto`, `api`.
- 애매한 약어 금지: `mgr`, `usr`, `prd`. 전체 단어 사용.

### RULE-NAME-008 파일명에 날짜/작성자 금지
`user_v2.tsx`, `user_20260422.tsx` 같은 파일명을 만들지 않습니다. 히스토리는 git 으로 관리합니다.

## 참고
- [`architecture.md`](./architecture.md) — 계층별 배치 규칙.
- [`react-components.md`](./react-components.md) — 컴포넌트 파일 구조.
- [`api-infrastructure.md`](./api-infrastructure.md) — DTO/서비스 이름 규약.
