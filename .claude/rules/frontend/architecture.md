# Architecture Rules

## 적용 범위
프로젝트 전체. 두 섹션으로 구성됩니다.
1. **원칙 (스택 중립)** — 어떤 프론트엔드 프로젝트에서도 적용 가능한 계층 설계 원칙.
2. **본 프로젝트 매핑** — Next.js + TypeScript 기반 5계층 Clean Architecture 채택 사례.

> 지침이 더 구체적이고 간결할수록 Claude가 더 일관되게 따릅니다. (Claude Code 공식 문서)

## 원칙 (스택 중립)
- 의존성은 **단방향**으로만 흐른다: UI → 도메인 로직 → 외부 어댑터(HTTP·스토리지 등).
- 계층 간 import 는 **경로 별칭**으로만. 상대 경로 `../../` 다중 참조 금지.
- **Thin router**: 라우팅 계층은 진입점에 머물고, 비즈니스 조합은 별도 컨테이너(=Feature View) 로 위임.
- 제공자(Provider) 순서는 앱 진입점에서 한 곳에 고정한다.
- 같은 계층 내에서도 feature 간 직접 import 를 지양하고, 공통은 한 단계 내려 승격한다.

## 본 프로젝트 매핑

본 프로젝트는 5계층 Clean Architecture 를 채택합니다: **Pages → Presentation → Application → Infrastructure → Providers**. 아래 RULE-ARCH-* 는 이 매핑을 전제로 작성되었습니다.

### RULE-ARCH-001 계층 역참조 금지
Infrastructure/Domain 은 상위 계층(`hooks`, `store`, `components`) 을 import 할 수 없습니다. Presentation 은 Infrastructure 를 직접 import 할 수 없고, 반드시 Application 훅 레이어를 경유합니다.

```ts
// 좋은 예: Presentation -> Application (hooks) 경유
import { useUserList } from '@hooks/api/user';

// 나쁜 예: Presentation -> Infrastructure 직접 호출
import { fetchUserList } from '@infrastructure/api/user/services';
```

### RULE-ARCH-002 Feature View 패턴
각 주요 페이지는 `presentation/features/{name}View/index.tsx` 와 1:1 매핑합니다. 라우팅 파일에서 직접 API 호출/상태 훅을 사용하지 않습니다(i18n/세션 초기화 예외).

```tsx
// pages/user/index.tsx (얇은 라우팅 계층)
export default function UserPage(): JSX.Element {
  return <UserListView />;
}
```

### RULE-ARCH-003 경로 별칭 강제
계층 간 import 는 `@alias` 를 사용합니다. 3단계 이상의 `../` 는 금지합니다.

```ts
// 좋은 예
import { Button } from '@presentation/components/atoms/button';

// 나쁜 예
import { Button } from '../../../../presentation/components/atoms/button';
```

권장 별칭(본 프로젝트 — 다른 프로젝트에서는 동등 매핑으로 조정):

| 별칭 | 매핑 |
| --- | --- |
| `@assets/*` | `./public/*` |
| `@providers/*` | `./src/providers/*` |
| `@hooks/*` | `./src/application/hooks/*` |
| `@store/*` | `./src/application/store/*` |
| `@infrastructure/*` | `./src/infrastructure/*` |
| `@presentation/*` | `./src/presentation/*` |

### RULE-ARCH-004 DTO / Service 파일 이름
각 도메인 폴더는 `dtos.ts`(DTO 타입 정의) + `services.ts`(HTTP 호출 함수) 의 두 파일로 구성합니다.

```
infrastructure/api/user/
├── dtos.ts       // UserDTO, UserCreateDTO, UserModifyDTO
└── services.ts   // fetchUser, createUser, modifyUser
```

### RULE-ARCH-005 계층 배치 기준
| 종류 | 배치 | 비고 |
| --- | --- | --- |
| HTTP 호출, DTO | `infrastructure/api/{domain}/` | 순수 함수, React 비의존 |
| API 훅 (React Query) | `application/hooks/api/{domain}/` | 쿼리/뮤테이션 래핑 |
| 로직 훅 (모달/핸들러) | `application/hooks/logics/` | UI 로직 응집 |
| Zustand 스토어 | `application/store/{domain}/` | 클라이언트 상태만 |
| 재사용 UI | `presentation/components/{atoms\|molecules\|organisms}/` | Atomic Design |
| 페이지 조합 | `presentation/features/{name}View/` | Feature-Based |
| 전역 Provider | `providers/{name}/` | Query/Auth/Theme/Modal/Toast |

### RULE-ARCH-006 Provider 계층 순서 고정
앱 진입점의 Provider 중첩 순서를 고정합니다. 순서가 바뀌면 세션/테마/에러바운더리 동작이 깨질 수 있습니다.

```tsx
// 본 프로젝트 순서 (밖 → 안)
<QueryProvider>
  <AuthProvider>
    <EmotionProvider>
      <ErrorBoundary>
        <ToastProvider>
          <ModalProvider>
            <Component {...pageProps} />
          </ModalProvider>
        </ToastProvider>
      </ErrorBoundary>
    </EmotionProvider>
  </AuthProvider>
</QueryProvider>
```

### RULE-ARCH-007 라우팅 계층은 라우팅에만 집중
라우팅 파일(Next.js 의 `pages/*.tsx` 등)은 다음만 담당합니다.
- 라우팅·동적 세그먼트
- 초기 데이터 로드(`getServerSideProps` / `getStaticProps`)
- Layout 선택, i18n 네임스페이스 prefetch

비즈니스 로직·훅·스토어 조합은 `features/` 로 위임합니다.

### RULE-ARCH-008 Feature View 컨테이너 책임
Feature View 는 다음 책임만 가집니다.
- 관련 훅(API, 스토어, 로직) 조합
- Organism/Molecule 렌더
- props 연결

Feature View 내부에 `styled` 컴포넌트를 직접 작성하지 않습니다(조합 책임 분리). **대안 위치**: 재사용 가능한 시각 단위면 `presentation/components/{molecules|organisms}/` 의 `styles.ts` 로, Feature 한정 레이아웃이면 같은 Feature 폴더의 `styles.ts` 로 분리합니다.

### RULE-ARCH-009 수평 의존성 최소화
같은 계층 내에서도 feature ↔ feature 간 직접 import 를 지양합니다. 공통 로직은 `presentation/components/` 또는 `application/hooks/common/` 으로 승격합니다.

## 참고
- [`naming-conventions.md`](./naming-conventions.md) — 폴더/파일 네이밍 세부.
- [`state-management.md`](./state-management.md) — Application 계층 훅 규칙.
- [`api-infrastructure.md`](./api-infrastructure.md) — Infrastructure 계층 세부.
- 공식 문서: <https://code.claude.com/docs/ko/memory>
