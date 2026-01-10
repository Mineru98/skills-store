# FSD Layers Guide

## Table of Contents

1. [Layer Overview](#layer-overview)
2. [Layer Details](#layer-details)
3. [Segments](#segments)
4. [Public API Pattern](#public-api-pattern)
5. [Directory Structure Example](#directory-structure-example)

---

## Layer Overview

| Layer | Purpose | Dependencies |
|-------|---------|--------------|
| `app/` | Application entry, providers, global config | All layers below |
| `pages/` | Route-level components, page composition | Widgets, Features, Entities, Shared |
| `widgets/` | Large reusable UI blocks | Features, Entities, Shared |
| `features/` | User interactions, business logic | Entities, Shared |
| `entities/` | Domain models, data representation | Shared |
| `shared/` | Reusable infrastructure | None |

---

## Layer Details

### App Layer

Application entry point. No business logic.

```
app/
├── providers/           # React providers (Theme, Query, Router)
│   └── index.tsx
├── styles/              # Global styles, CSS reset
│   └── global.ts
├── config/              # Environment config
│   └── env.ts
└── index.tsx            # Entry point
```

**Responsibility**: Compose providers, set up routing, initialize app.

### Pages Layer

Route-level components. Compose widgets and features into pages.

```
pages/
├── home/
│   ├── ui/
│   │   └── HomePage/
│   │       ├── index.tsx
│   │       ├── types.ts
│   │       └── styles.ts
│   └── index.ts
├── profile/
│   └── ...
└── cart/
    └── ...
```

**Responsibility**: Layout composition, route params handling.

### Widgets Layer

Large, self-contained UI blocks. Reusable across pages.

```
widgets/
├── header/
│   ├── ui/
│   │   └── Header/
│   └── index.ts
├── sidebar/
│   └── ...
└── product-list/
    ├── ui/
    │   └── ProductListContainer/
    └── index.ts
```

**Responsibility**: Complex UI composition, may contain multiple features.

### Features Layer

User-facing functionality. Business logic lives here.

```
features/
├── auth/
│   ├── ui/
│   │   ├── LoginForm/
│   │   └── LogoutButton/
│   ├── api/
│   │   ├── auth.service.ts
│   │   ├── auth.keys.ts
│   │   └── useAuth.ts
│   ├── model/
│   │   └── authStore.ts
│   └── index.ts
├── cart/
│   └── ...
└── search/
    └── ...
```

**Responsibility**: User interactions, API calls, state mutations.

### Entities Layer

Domain models and their visual representation. No business logic.

```
entities/
├── user/
│   ├── ui/
│   │   ├── UserCard/
│   │   └── UserAvatar/
│   ├── model/
│   │   └── types.ts
│   └── index.ts
├── product/
│   ├── ui/
│   │   ├── ProductCard/
│   │   └── ProductThumbnail/
│   ├── model/
│   │   └── types.ts
│   └── index.ts
└── order/
    └── ...
```

**Responsibility**: Data types, passive UI components for displaying data.

### Shared Layer

Domain-agnostic infrastructure. Used by all layers.

```
shared/
├── ui/                  # UI kit components
│   ├── Button/
│   ├── Input/
│   ├── Modal/
│   └── index.ts
├── api/                 # API infrastructure
│   ├── axiosClient.ts
│   └── types.ts
├── lib/                 # Utilities
│   ├── formatDate.ts
│   └── cn.ts
├── config/              # Shared constants
│   └── routes.ts
└── index.ts
```

**Responsibility**: Reusable utilities, UI primitives, API client.

---

## Segments

Each slice contains standardized segments:

| Segment | Purpose | Examples |
|---------|---------|----------|
| `ui/` | React components | `LoginForm/`, `UserCard/` |
| `model/` | State, types, business logic | `authStore.ts`, `types.ts` |
| `api/` | Server communication | `auth.service.ts`, `useAuth.ts` |
| `lib/` | Slice-specific utilities | `formatPrice.ts` |
| `config/` | Constants, enums | `authRoutes.ts` |
| `index.ts` | Public API | Exports for external use |

Not every segment is required. Include only what the slice needs.

---

## Public API Pattern

Every slice MUST have an `index.ts` that explicitly exports its public interface.

```typescript
// features/auth/index.ts

// UI exports
export { LoginForm } from './ui/LoginForm';
export { LogoutButton } from './ui/LogoutButton';

// Hook exports
export { useAuthLogin, useAuthProfile, useAuthLogout } from './api/useAuth';

// Type exports
export type { LoginFormProps } from './ui/LoginForm/types';
export type { AuthUser, LoginCredentials } from './api/types';
```

### Rules

1. **Never import from internal paths**
   ```typescript
   // BAD
   import { LoginForm } from '@/features/auth/ui/LoginForm';
   
   // GOOD
   import { LoginForm } from '@/features/auth';
   ```

2. **Only export what's needed externally**
   - Internal helpers stay internal
   - Implementation details are hidden

3. **Use barrel exports consistently**

---

## Directory Structure Example

Complete FSD structure for an e-commerce app:

```
src/
├── app/
│   ├── providers/
│   │   └── index.tsx
│   ├── styles/
│   │   └── global.ts
│   └── index.tsx
│
├── pages/
│   ├── home/
│   │   ├── ui/HomePage/
│   │   └── index.ts
│   ├── product/
│   │   ├── ui/ProductPage/
│   │   └── index.ts
│   └── cart/
│       ├── ui/CartPage/
│       └── index.ts
│
├── widgets/
│   ├── header/
│   │   ├── ui/Header/
│   │   └── index.ts
│   └── product-list/
│       ├── ui/ProductListContainer/
│       └── index.ts
│
├── features/
│   ├── auth/
│   │   ├── ui/
│   │   │   ├── LoginForm/
│   │   │   └── LogoutButton/
│   │   ├── api/
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.keys.ts
│   │   │   └── useAuth.ts
│   │   ├── model/
│   │   │   └── authStore.ts
│   │   └── index.ts
│   ├── cart/
│   │   ├── ui/AddToCartButton/
│   │   ├── api/
│   │   ├── model/cartStore.ts
│   │   └── index.ts
│   └── search/
│       ├── ui/SearchBar/
│       ├── api/
│       └── index.ts
│
├── entities/
│   ├── user/
│   │   ├── ui/
│   │   │   ├── UserCard/
│   │   │   └── UserAvatar/
│   │   ├── model/types.ts
│   │   └── index.ts
│   ├── product/
│   │   ├── ui/
│   │   │   ├── ProductCard/
│   │   │   └── ProductThumbnail/
│   │   ├── model/types.ts
│   │   └── index.ts
│   └── order/
│       ├── ui/OrderStatus/
│       ├── model/types.ts
│       └── index.ts
│
└── shared/
    ├── ui/
    │   ├── Button/
    │   ├── Input/
    │   ├── Modal/
    │   └── index.ts
    ├── api/
    │   └── axiosClient.ts
    ├── lib/
    │   ├── cn.ts
    │   └── formatDate.ts
    └── config/
        └── routes.ts
```
