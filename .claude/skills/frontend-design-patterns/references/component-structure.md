# Component Structure: Index/Types/Styles Pattern

## Table of Contents

1. [Why This Pattern](#why-this-pattern)
2. [Directory Structure](#directory-structure)
3. [File Implementations](#file-implementations)
4. [Import Patterns](#import-patterns)
5. [Best Practices](#best-practices)

---

## Why This Pattern

### Problems with Single-File Components

```typescript
// BAD: Everything in one file (200+ lines)
// Button.tsx
import styled from '@emotion/styled';

interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  // ... 20 more props
}

const StyledButton = styled.button<{ variant: string; size: string }>`
  // ... 50 lines of styles
`;

export const Button = ({ variant, size, ...props }: ButtonProps) => {
  // ... component logic
};
```

**Issues**:
- Long files reduce readability
- Merge conflicts when multiple people edit
- Hard to find what you need
- Mixing concerns

### Solution: Separation at Filesystem Level

```
Button/
├── index.tsx    # Logic only (~30 lines)
├── types.ts     # Types only (~20 lines)
└── styles.ts    # Styles only (~40 lines)
```

---

## Directory Structure

### Standard Component Directory

```
ComponentName/
├── index.tsx           # Component logic & JSX
├── types.ts            # TypeScript interfaces
├── styles.ts           # CSS-in-JS styles
└── ComponentName.test.tsx  # Tests (optional)
```

### Complex Component with Subcomponents

```
DataTable/
├── index.tsx           # Main component
├── types.ts            # Shared types
├── styles.ts           # Main styles
├── components/         # Subcomponents
│   ├── TableHeader/
│   │   ├── index.tsx
│   │   ├── types.ts
│   │   └── styles.ts
│   └── TableRow/
│       ├── index.tsx
│       ├── types.ts
│       └── styles.ts
└── DataTable.test.tsx
```

---

## File Implementations

### types.ts

Define all TypeScript interfaces and types.

```typescript
// components/Button/types.ts
import { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
```

**Rules**:
- Export all types that might be used externally
- Use `type` for unions/primitives, `interface` for object shapes
- Extend HTML element attributes when appropriate

### styles.ts

Define all styled components and style utilities.

```typescript
// components/Button/styles.ts
import styled from '@emotion/styled';
import { css } from '@emotion/react';
import type { ButtonVariant, ButtonSize } from './types';

const sizeStyles = {
  sm: css`
    padding: 8px 12px;
    font-size: 14px;
  `,
  md: css`
    padding: 12px 16px;
    font-size: 16px;
  `,
  lg: css`
    padding: 16px 24px;
    font-size: 18px;
  `,
};

const variantStyles = {
  primary: css`
    background: #3b82f6;
    color: white;
    &:hover { background: #2563eb; }
  `,
  secondary: css`
    background: #6b7280;
    color: white;
    &:hover { background: #4b5563; }
  `,
  outline: css`
    background: transparent;
    border: 1px solid #3b82f6;
    color: #3b82f6;
    &:hover { background: #eff6ff; }
  `,
  ghost: css`
    background: transparent;
    color: #3b82f6;
    &:hover { background: #f3f4f6; }
  `,
};

export const Container = styled.button<{
  variant: ButtonVariant;
  size: ButtonSize;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  ${({ size }) => sizeStyles[size]}
  ${({ variant }) => variantStyles[variant]}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const IconWrapper = styled.span<{ position: 'left' | 'right' }>`
  display: flex;
  align-items: center;
  margin-left: ${({ position }) => (position === 'right' ? '8px' : 0)};
  margin-right: ${({ position }) => (position === 'left' ? '8px' : 0)};
`;

export const Spinner = styled.span`
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
```

**Rules**:
- Export styled components with semantic names
- Use style objects/maps for variants
- Keep animation keyframes with their components

### index.tsx

Component logic and JSX only.

```typescript
// components/Button/index.tsx
import type { ButtonProps } from './types';
import * as S from './styles';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  ...rest
}: ButtonProps) => {
  return (
    <S.Container
      variant={variant}
      size={size}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && <S.Spinner />}
      {!isLoading && leftIcon && (
        <S.IconWrapper position="left">{leftIcon}</S.IconWrapper>
      )}
      {children}
      {!isLoading && rightIcon && (
        <S.IconWrapper position="right">{rightIcon}</S.IconWrapper>
      )}
    </S.Container>
  );
};

// Re-export types for convenience
export type { ButtonProps, ButtonVariant, ButtonSize } from './types';
```

**Rules**:
- Import styles as namespace (`* as S`)
- Import types with `type` keyword
- Re-export commonly used types
- Keep JSX clean and readable

---

## Import Patterns

### Namespace Import for Styles (Recommended)

```typescript
import * as S from './styles';

// Usage
<S.Container>
  <S.Title>Hello</S.Title>
</S.Container>
```

**Benefits**:
- Clear visual distinction between styled and regular components
- Easy to identify style-related elements
- Avoids naming conflicts

### Alternative: Named Imports

```typescript
import { Container, Title } from './styles';

// Usage
<Container>
  <Title>Hello</Title>
</Container>
```

Use when fewer styled components or team preference.

---

## Best Practices

### 1. Component Naming

```
// Directory name = Component name (PascalCase)
Button/
UserProfile/
ProductCard/
```

### 2. Single Export per Component

```typescript
// index.tsx
export const Button = () => { ... };  // Named export

// NOT
export default Button;  // Avoid default exports
```

### 3. Type Re-exports

```typescript
// index.tsx - re-export types for external use
export type { ButtonProps } from './types';
```

### 4. Conditional Subcomponents

For compound components:

```typescript
// Card/index.tsx
import { CardHeader } from './components/CardHeader';
import { CardBody } from './components/CardBody';
import { CardFooter } from './components/CardFooter';

export const Card = ({ children }: CardProps) => {
  return <S.Container>{children}</S.Container>;
};

// Attach subcomponents
Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

// Usage
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>
```

### 5. Test File Location

Keep tests colocated with components:

```
Button/
├── index.tsx
├── types.ts
├── styles.ts
└── Button.test.tsx    # Colocated test
```
