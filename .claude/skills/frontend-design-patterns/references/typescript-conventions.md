# TypeScript Conventions

## Table of Contents

1. [Naming Conventions](#naming-conventions)
2. [Strict Mode Rules](#strict-mode-rules)
3. [Type vs Interface](#type-vs-interface)
4. [Component Props Typing](#component-props-typing)
5. [Generic Components](#generic-components)
6. [Utility Types](#utility-types)
7. [Type Guards](#type-guards)

---

## Naming Conventions

### Quick Reference

| Target | Case | Prefix/Pattern | Example |
|--------|------|----------------|---------|
| Component | PascalCase | - | `UserProfile`, `LoginForm` |
| Component File | PascalCase | Directory-based | `UserProfile/index.tsx` |
| Interface/Type | PascalCase | No `I` prefix | `UserProfileProps` |
| Variable | camelCase | - | `userList`, `isLoading` |
| Boolean | camelCase | `is`, `has`, `should`, `can` | `isVisible`, `hasError` |
| Function | camelCase | verb + noun | `fetchUser`, `handleClick` |
| Event Handler (prop) | camelCase | `on` prefix | `onClick`, `onSubmit` |
| Event Handler (impl) | camelCase | `handle` prefix | `handleClick`, `handleSubmit` |
| Constant | UPPER_SNAKE | - | `MAX_COUNT`, `API_URL` |
| Enum | PascalCase | - | `UserRole`, `OrderStatus` |
| Enum Member | PascalCase | - | `UserRole.Admin` |
| Custom Hook | camelCase | `use` prefix | `useAuth`, `useWindowSize` |
| Context | PascalCase | `Context` suffix | `ThemeContext` |
| Type Parameter | PascalCase | Single letter or descriptive | `T`, `TItem`, `TData` |

### Boolean Naming

Always use prefix for boolean variables:

```typescript
// GOOD
const isLoading = true;
const hasPermission = user.role === 'admin';
const shouldRefresh = lastUpdate < threshold;
const canEdit = isOwner && !isLocked;

// BAD
const loading = true;      // Unclear if boolean
const permission = true;   // Sounds like a string
const refresh = true;      // Sounds like a function
```

### Event Handler Pattern

```typescript
// Props: "on" prefix
interface ButtonProps {
  onClick?: () => void;
  onHover?: () => void;
}

// Implementation: "handle" prefix
const MyComponent = () => {
  const handleClick = () => {
    console.log('clicked');
  };

  const handleHover = () => {
    console.log('hovered');
  };

  return <Button onClick={handleClick} onHover={handleHover} />;
};
```

### Custom Hooks

```typescript
// GOOD: Descriptive, starts with "use"
const useAuth = () => { ... };
const useWindowSize = () => { ... };
const useDebounce = (value: string, delay: number) => { ... };
const useLocalStorage = <T>(key: string, initialValue: T) => { ... };

// BAD
const authHook = () => { ... };      // Not a hook pattern
const getAuth = () => { ... };       // Sounds like a function
```

---

## Strict Mode Rules

### Required tsconfig.json Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Forbidden Patterns

#### Never Use `any`

```typescript
// FORBIDDEN
const data: any = fetchData();
function process(input: any): any { ... }

// CORRECT: Use unknown and narrow
const data: unknown = fetchData();

if (isUser(data)) {
  console.log(data.name); // Safe
}
```

#### Never Use Type Assertions to Escape

```typescript
// FORBIDDEN
const user = response.data as User;       // Unsafe
const element = document.getElementById('app') as HTMLDivElement;

// CORRECT: Validate or handle null
const user = validateUser(response.data); // Throws if invalid

const element = document.getElementById('app');
if (element instanceof HTMLDivElement) {
  // Safe to use as HTMLDivElement
}
```

#### Never Use @ts-ignore

```typescript
// FORBIDDEN
// @ts-ignore
const result = brokenFunction();

// @ts-expect-error
const value = anotherBrokenThing();

// CORRECT: Fix the type issue
```

---

## Type vs Interface

### Use `interface` for Object Shapes

```typescript
// Component props
interface ButtonProps {
  children: ReactNode;
  variant: 'primary' | 'secondary';
  onClick?: () => void;
}

// Data models
interface User {
  id: string;
  name: string;
  email: string;
}

// Extendable contracts
interface ApiResponse<T> {
  data: T;
  status: number;
}
```

### Use `type` for Everything Else

```typescript
// Unions
type ButtonVariant = 'primary' | 'secondary' | 'outline';
type Status = 'idle' | 'loading' | 'success' | 'error';

// Function types
type ClickHandler = (event: MouseEvent) => void;
type Fetcher<T> = () => Promise<T>;

// Mapped/conditional types
type Nullable<T> = T | null;
type ReadonlyUser = Readonly<User>;

// Tuple
type Coordinates = [number, number];
```

### Declaration Merging (Interface Only)

```typescript
// Extending third-party types
declare module 'express' {
  interface Request {
    user?: User;
  }
}
```

---

## Component Props Typing

### Do NOT Use React.FC

```typescript
// AVOID: React.FC
const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>;
};

// PREFER: Direct prop typing
const Button = ({ children, onClick }: ButtonProps) => {
  return <button onClick={onClick}>{children}</button>;
};
```

**Why avoid React.FC:**
- Implicit `children` prop (confusing)
- Verbose
- No advantage in modern React

### Extend HTML Attributes

```typescript
import { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary';
  isLoading?: boolean;
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}
```

### Children Typing

```typescript
import { ReactNode, PropsWithChildren } from 'react';

// Explicit
interface CardProps {
  title: string;
  children: ReactNode;
}

// Using PropsWithChildren
interface CardProps {
  title: string;
}
const Card = ({ title, children }: PropsWithChildren<CardProps>) => { ... };
```

---

## Generic Components

### Basic Generic Component

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => ReactNode;
  keyExtractor: (item: T) => string;
}

const List = <T,>({ items, renderItem, keyExtractor }: ListProps<T>) => {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
};

// Usage
<List
  items={users}
  renderItem={(user) => <span>{user.name}</span>}
  keyExtractor={(user) => user.id}
/>
```

### Constrained Generics

```typescript
// Must have id property
interface WithId {
  id: string | number;
}

interface SelectProps<T extends WithId> {
  items: T[];
  selected: T | null;
  onChange: (item: T) => void;
  labelKey: keyof T;
}

const Select = <T extends WithId>({
  items,
  selected,
  onChange,
  labelKey,
}: SelectProps<T>) => {
  return (
    <select
      value={selected?.id ?? ''}
      onChange={(e) => {
        const item = items.find((i) => String(i.id) === e.target.value);
        if (item) onChange(item);
      }}
    >
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {String(item[labelKey])}
        </option>
      ))}
    </select>
  );
};
```

### Generic Hook

```typescript
const useLocalStorage = <T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    setStoredValue(value);
    localStorage.setItem(key, JSON.stringify(value));
  };

  return [storedValue, setValue];
};
```

---

## Utility Types

### Common Built-in Types

```typescript
// Partial: All properties optional
type PartialUser = Partial<User>;
// { id?: string; name?: string; email?: string; }

// Required: All properties required
type RequiredConfig = Required<Config>;

// Readonly: All properties readonly
type ImmutableUser = Readonly<User>;

// Pick: Select specific properties
type UserPreview = Pick<User, 'id' | 'name'>;
// { id: string; name: string; }

// Omit: Exclude specific properties
type UserWithoutEmail = Omit<User, 'email'>;
// { id: string; name: string; }

// Record: Object with specific key/value types
type UserRoles = Record<string, 'admin' | 'user' | 'guest'>;

// ReturnType: Extract function return type
type FetchResult = ReturnType<typeof fetchUser>;
```

### Custom Utility Types

```typescript
// Nullable
type Nullable<T> = T | null;

// NonNullableFields
type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

// DeepPartial
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// DeepReadonly
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
```

---

## Type Guards

### typeof Guard

```typescript
const processValue = (value: string | number) => {
  if (typeof value === 'string') {
    return value.toUpperCase(); // string methods available
  }
  return value.toFixed(2); // number methods available
};
```

### instanceof Guard

```typescript
const handleError = (error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message); // Error properties available
  } else {
    console.error('Unknown error:', error);
  }
};
```

### Custom Type Guard (is keyword)

```typescript
interface User {
  type: 'user';
  name: string;
  email: string;
}

interface Admin {
  type: 'admin';
  name: string;
  permissions: string[];
}

type Person = User | Admin;

// Type guard function
const isAdmin = (person: Person): person is Admin => {
  return person.type === 'admin';
};

// Usage
const getPermissions = (person: Person) => {
  if (isAdmin(person)) {
    return person.permissions; // Admin properties available
  }
  return []; // User has no permissions
};
```

### Discriminated Unions

```typescript
type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

const renderState = <T>(state: ApiState<T>) => {
  switch (state.status) {
    case 'idle':
      return <div>Ready</div>;
    case 'loading':
      return <div>Loading...</div>;
    case 'success':
      return <div>Data: {JSON.stringify(state.data)}</div>; // data available
    case 'error':
      return <div>Error: {state.error.message}</div>; // error available
  }
};
```

### Assertion Functions

```typescript
function assertIsString(value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('Value must be a string');
  }
}

const processInput = (input: unknown) => {
  assertIsString(input);
  // After assertion, input is string
  console.log(input.toUpperCase());
};
```
