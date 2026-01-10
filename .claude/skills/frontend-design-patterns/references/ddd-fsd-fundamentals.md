# DDD + FSD Fundamentals

## Table of Contents

1. [Domain-Driven Design for Frontend](#domain-driven-design-for-frontend)
2. [Feature-Sliced Design Overview](#feature-sliced-design-overview)
3. [Fusion Strategy](#fusion-strategy)
4. [Features vs Entities](#features-vs-entities)

---

## Domain-Driven Design for Frontend

DDD is traditionally a backend methodology, but modern frontend complexity demands the same rigor.

### Core Concepts

#### Ubiquitous Language

Use the same terms across all stakeholders (designers, PMs, engineers).

```
// BAD: Generic naming
src/utils/misc/helpers.ts
src/components/Card1.tsx

// GOOD: Domain-aligned naming
src/features/cart/
src/entities/product/
```

If the spec says "Cart", the code says `cart`. No `basket`, no `shoppingBag`.

#### Bounded Context

Different domains may have different representations of the same entity.

```typescript
// Auth context: User for authentication
interface AuthUser {
  id: string;
  email: string;
  token: string;
}

// Shipping context: User for delivery
interface ShippingUser {
  id: string;
  address: Address;
  phone: string;
}
```

These don't mix. Each lives in its own slice.

---

## Feature-Sliced Design Overview

FSD is a frontend-specific architecture standard with three dimensions:

### Three Dimensions

1. **Layers**: Vertical hierarchy (App, Pages, Widgets, Features, Entities, Shared)
2. **Slices**: Horizontal domain divisions within a layer (cart, auth, user)
3. **Segments**: Technical subdivisions within a slice (ui, model, api, lib, config)

### Unidirectional Dependency Rule

**Critical constraint**: Higher layers depend on lower layers. Never reverse.

```
App
 └── can use: Pages, Widgets, Features, Entities, Shared

Pages
 └── can use: Widgets, Features, Entities, Shared
 └── CANNOT use: App

Features
 └── can use: Entities, Shared
 └── CANNOT use: App, Pages, Widgets

Entities
 └── can use: Shared
 └── CANNOT use: App, Pages, Widgets, Features

Shared
 └── can use: nothing (lowest layer)
 └── CANNOT use: anything above
```

This prevents circular dependencies and enforces modularity.

---

## Fusion Strategy

### DDD Provides the "Why"

- **What domains exist?** (User, Product, Cart, Order)
- **What language do we use?** (Ubiquitous language)
- **Where are the boundaries?** (Bounded contexts)

### FSD Provides the "How"

- **Where does code live?** (Layers, Slices, Segments)
- **What can depend on what?** (Unidirectional rule)
- **How do we expose APIs?** (Public API via `index.ts`)

### Mapping

| DDD Concept | FSD Implementation |
|-------------|-------------------|
| Domain | Slice (e.g., `features/cart`) |
| Bounded Context | Layer boundary |
| Entity | `entities/` layer slice |
| Use Case | `features/` layer slice |
| Value Object | Types in `model/` segment |
| Repository | Service in `api/` segment |

---

## Features vs Entities

The most confusing distinction. Use this decision framework:

### Entities: "What is it?"

Entities represent **data and its passive display**.

```
entities/
└── user/
    ├── ui/
    │   └── UserCard/         # Shows user avatar + name
    │       ├── index.tsx
    │       ├── types.ts
    │       └── styles.ts
    ├── model/
    │   └── types.ts          # interface User { id, name, avatar }
    └── index.ts              # Public API
```

- **No user interaction logic**
- **No side effects**
- **Pure data representation**

### Features: "What does it do?"

Features represent **user actions and interactions**.

```
features/
└── auth/
    ├── ui/
    │   └── LoginForm/        # Login form with submit handler
    │       ├── index.tsx
    │       ├── types.ts
    │       └── styles.ts
    ├── api/
    │   ├── auth.service.ts   # API calls
    │   ├── auth.keys.ts      # Query keys
    │   └── useAuth.ts        # React Query hooks
    ├── model/
    │   └── authStore.ts      # Zustand store (if needed)
    └── index.ts              # Public API
```

- **Has user interaction logic**
- **May call APIs**
- **May have side effects**

### Decision Tree

```
Is it about displaying data without user action?
  YES → Entity
  NO  → Feature

Does it trigger API calls or state changes?
  YES → Feature
  NO  → Entity

Can it exist without knowing about user actions?
  YES → Entity
  NO  → Feature
```

### Relationship

Features USE Entities. Entities DON'T KNOW about Features.

```typescript
// features/auth/ui/LoginForm/index.tsx
import { UserCard } from '@/entities/user';  // OK

// entities/user/ui/UserCard/index.tsx
import { LoginForm } from '@/features/auth';  // FORBIDDEN
```
