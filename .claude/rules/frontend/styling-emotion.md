---
paths:
  - "**/styles.ts"
  - "**/style.ts"
  - "**/*.styles.ts"
---

# Styling Rules

## 적용 범위
컴포넌트 폴더의 스타일 파일에 적용됩니다. 두 섹션으로 구성:
1. **원칙 (스택 중립)** — CSS-in-JS / CSS Modules / Tailwind 등 어느 솔루션이든 공통.
2. **구현 가이드 (본 프로젝트)** — Emotion(`@emotion/styled`, `@emotion/react`) 채택.

## 원칙 (스택 중립)
- 모든 스타일은 **컴포넌트 폴더 옆 `styles.ts`** (또는 `*.module.css`) 에 둔다. 인라인/전역 CSS 는 최소화한다.
- 색·간격·폰트는 반드시 **테마 토큰**에서 가져온다. 하드코딩 금지.
- 조건부 스타일은 **선언적**으로 표현한다. JSX 측에는 토글 신호만 남긴다.
- 전역 스타일은 reset/폰트/접근성 기본에 한정. 컴포넌트별 스타일이 전역으로 새지 않게 한다.
- 미디어 쿼리 값은 **테마 브레이크포인트 토큰**에서 가져온다.

## 구현 가이드 (본 프로젝트)
본 프로젝트는 Emotion 을 채택하고 빌드 시 `compiler.emotion: true` (Next.js) 가 활성화되어 있습니다.

### RULE-STYLE-001 `styles.ts` 파일 분리
컴포넌트 폴더마다 `styles.ts` 를 분리합니다. 한 파일은 **같은 컴포넌트**의 스타일만 담습니다.

```
components/molecules/userCard/
├── index.tsx
├── styles.ts
└── types.ts
```

```ts
// styles.ts
import styled from '@emotion/styled';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

export const Name = styled.span`
  font-weight: 600;
`;
```

### RULE-STYLE-002 테마 토큰 강제
색·간격·보더·브레이크포인트는 `@presentation/styles/theme` (또는 동등 경로) 에서 import 합니다. 리터럴 값 하드코딩 금지.

```ts
// 좋은 예
import { colors, spacing } from '@presentation/styles/theme';

export const Container = styled.div`
  background-color: ${colors.surface[0]};
  padding: ${spacing.md};
`;

// 나쁜 예
export const Container = styled.div`
  background-color: #ffffff;
  padding: 16px;
`;
```

### RULE-STYLE-003 조건부 스타일은 props generic 으로
스타일 분기는 `styled.div<Props>` + 함수형 리터럴로 표현합니다. className 조합은 `classnames` 로 최소한만 사용합니다.

```ts
// 좋은 예
import styled from '@emotion/styled';
import { colors } from '@presentation/styles/theme';

type BadgeProps = { status: 'idle' | 'active' | 'error' };

export const Badge = styled.div<BadgeProps>`
  background-color: ${(props) =>
    props.status === 'error'  ? colors.danger[3]  :
    props.status === 'active' ? colors.primary[3] :
                                colors.neutral[3]};
`;

// 나쁜 예 (inline style)
<div style={{ backgroundColor: status === 'error' ? 'red' : 'gray' }} />
```

### RULE-STYLE-004 전역 스타일은 한 곳만
`Global` 컴포넌트(또는 `global.ts`) 사용은 reset/폰트/접근성 기본 정도로 제한합니다. 개별 컴포넌트 스타일이 전역에 새어 나가지 않게 합니다.

```tsx
// 허용 (앱 진입점 1회)
<Global styles={globalCss} />

// 금지 (컴포넌트 파일 안에서 전역 스타일 선언)
<Global styles={css`body { background: red; }`} />
```

### RULE-STYLE-005 CSS 속성 순서
관례: **Box model → Position/Layout → Border/Background → Typography/Color → Effects**. 가독성이 우선이므로 기계적으로 맞추지 않아도 됩니다.

```ts
export const Card = styled.div`
  /* Box */
  width: 100%;
  padding: ${spacing.md};
  margin: 0;

  /* Layout */
  display: flex;
  flex-direction: column;

  /* Border / Background */
  border: 1px solid ${colors.border};
  background-color: ${colors.surface[0]};

  /* Typography */
  font-size: 14px;
  color: ${colors.text.primary};

  /* Effects */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
`;
```

### RULE-STYLE-006 애니메이션 래퍼 패턴
애니메이션 라이브러리(예: `@react-spring/web`) 와 함께 쓸 때는 `animated(styled.*)` 로 감싸 타입을 보존합니다.

```ts
import { animated } from '@react-spring/web';
import styled from '@emotion/styled';

export const AnimatedDrawer = animated(styled.div<{ isOpen: boolean }>`
  transform: translateX(${(p) => (p.isOpen ? '0' : '100%')});
`);
```

### RULE-STYLE-007 미디어 쿼리는 테마 브레이크포인트
미디어 쿼리 값은 테마에서 가져옵니다.

```ts
import { breakPoints } from '@presentation/styles/theme';

export const Container = styled.div`
  padding: ${spacing.md};

  @media (max-width: ${breakPoints.mobile}) {
    padding: ${spacing.sm};
  }
`;
```

### RULE-STYLE-008 styled 파일에서는 반환 타입 생략 허용
`styles.ts` 파일은 `@typescript-eslint/explicit-function-return-type` 예외로 설정할 수 있습니다(스타일 라이브러리 내부 타입 추론 유지).

## 참고
- [`react-components.md`](./react-components.md) — `styles.ts` 파일 위치와 JSX 인라인 스타일 금지 규칙.
- [`typescript.md`](./typescript.md) — 반환 타입 규칙 예외.
- Emotion 공식 문서: <https://emotion.sh/docs/introduction>
