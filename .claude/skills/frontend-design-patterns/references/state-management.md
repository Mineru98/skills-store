# State Management: Zustand + React Query

## Table of Contents

1. [State Classification](#state-classification)
2. [Zustand Store Pattern](#zustand-store-pattern)
3. [Store Location in FSD](#store-location-in-fsd)
4. [Selector Optimization](#selector-optimization)
5. [Middleware Usage](#middleware-usage)
6. [Complete Examples](#complete-examples)

---

## State Classification

### Server State vs Client State

| Type | Definition | Tool | Examples |
|------|------------|------|----------|
| Server State | Data from API | React Query | User profile, products, orders |
| Client State | UI/app state | Zustand | Theme, modals, form state, cart |

### Decision Tree

```
Is this data from an API?
  YES -> React Query
  NO  -> Is it global across components?
           YES -> Zustand
           NO  -> useState/useReducer
```

### When to Use Zustand

- Theme/dark mode
- Modal/drawer open state
- Shopping cart (optimistic UI)
- Multi-step form state
- Sidebar collapsed state
- User preferences

### When to Use React Query

- User profile data
- Product listings
- Search results
- Any API-fetched data

---

## Zustand Store Pattern

### Basic Store Structure

```typescript
// features/cart/model/cartStore.ts
import { create } from 'zustand';

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

interface CartState {
  // State
  items: CartItem[];
  isOpen: boolean;

  // Actions
  actions: {
    addItem: (item: Omit<CartItem, 'id'>) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    toggleCart: () => void;
    clearCart: () => void;
  };
}

export const useCartStore = create<CartState>((set) => ({
  // Initial state
  items: [],
  isOpen: false,

  // Actions grouped in object
  actions: {
    addItem: (item) =>
      set((state) => ({
        items: [...state.items, { ...item, id: crypto.randomUUID() }],
      })),

    removeItem: (id) =>
      set((state) => ({
        items: state.items.filter((item) => item.id !== id),
      })),

    updateQuantity: (id, quantity) =>
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, quantity } : item
        ),
      })),

    toggleCart: () =>
      set((state) => ({ isOpen: !state.isOpen })),

    clearCart: () =>
      set({ items: [] }),
  },
}));
```

### Why Group Actions in `actions` Object

1. **Stable reference**: Actions object doesn't change, preventing re-renders
2. **Clean selectors**: Separate state selection from action selection
3. **TypeScript friendly**: Clear type inference

---

## Store Location in FSD

### Feature-Level Store

Store lives in the feature's `model/` segment.

```
features/
├── cart/
│   ├── model/
│   │   └── cartStore.ts    # Cart-specific state
│   └── ...
├── auth/
│   ├── model/
│   │   └── authStore.ts    # Auth-specific state
│   └── ...
```

### Global/App-Level Store

For truly global state, use `shared/model/` or `app/store/`.

```
shared/
├── model/
│   ├── themeStore.ts       # Theme state
│   └── uiStore.ts          # Global UI state (sidebar, etc.)
```

### Rule: Store Scope = Slice Scope

If state is used only within a feature, it belongs in that feature's `model/`.

---

## Selector Optimization

### Problem: Full Store Subscription

```typescript
// BAD: Re-renders on ANY store change
const { items, isOpen, actions } = useCartStore();
```

### Solution: Granular Selectors

```typescript
// features/cart/model/cartStore.ts

// Export individual selectors
export const useCartItems = () => useCartStore((state) => state.items);
export const useIsCartOpen = () => useCartStore((state) => state.isOpen);
export const useCartActions = () => useCartStore((state) => state.actions);

// Computed selectors
export const useCartTotal = () =>
  useCartStore((state) =>
    state.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

export const useCartItemCount = () =>
  useCartStore((state) =>
    state.items.reduce((count, item) => count + item.quantity, 0)
  );
```

### Component Usage

```typescript
// Only re-renders when items change
const items = useCartItems();

// Only re-renders when cart total changes
const total = useCartTotal();

// Actions never change, no re-renders
const { addItem, removeItem } = useCartActions();
```

---

## Middleware Usage

### Immer: Immutable Updates Made Easy

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface State {
  items: CartItem[];
  actions: {
    addItem: (item: CartItem) => void;
    updateQuantity: (id: string, quantity: number) => void;
  };
}

export const useCartStore = create<State>()(
  immer((set) => ({
    items: [],
    actions: {
      // Direct mutation syntax (Immer handles immutability)
      addItem: (item) =>
        set((state) => {
          state.items.push(item);
        }),

      updateQuantity: (id, quantity) =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item) {
            item.quantity = quantity;
          }
        }),
    },
  }))
);
```

### Persist: Local Storage Sync

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      actions: {
        // ... actions
      },
    }),
    {
      name: 'cart-storage', // localStorage key
      partialize: (state) => ({ items: state.items }), // Only persist items
    }
  )
);
```

### Devtools: Redux DevTools Integration

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export const useCartStore = create<CartState>()(
  devtools(
    (set) => ({
      items: [],
      actions: {
        addItem: (item) =>
          set(
            (state) => ({ items: [...state.items, item] }),
            false,
            'cart/addItem' // Action name in DevTools
          ),
      },
    }),
    { name: 'CartStore' }
  )
);
```

### Combining Middleware

```typescript
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      immer((set) => ({
        items: [],
        actions: {
          addItem: (item) =>
            set((state) => {
              state.items.push(item);
            }),
        },
      })),
      { name: 'cart-storage' }
    ),
    { name: 'CartStore' }
  )
);
```

**Order matters**: `devtools` -> `persist` -> `immer` -> store

---

## Complete Examples

### Theme Store (Global)

```typescript
// shared/model/themeStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  actions: {
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
  };
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      actions: {
        setTheme: (theme) => set({ theme }),
        toggleTheme: () =>
          set((state) => ({
            theme: state.theme === 'light' ? 'dark' : 'light',
          })),
      },
    }),
    { name: 'theme-storage' }
  )
);

// Selectors
export const useTheme = () => useThemeStore((state) => state.theme);
export const useThemeActions = () => useThemeStore((state) => state.actions);
```

### Modal Store (UI State)

```typescript
// shared/model/modalStore.ts
import { create } from 'zustand';

interface ModalState {
  modals: Record<string, boolean>;
  actions: {
    open: (id: string) => void;
    close: (id: string) => void;
    toggle: (id: string) => void;
  };
}

export const useModalStore = create<ModalState>((set) => ({
  modals: {},
  actions: {
    open: (id) =>
      set((state) => ({ modals: { ...state.modals, [id]: true } })),
    close: (id) =>
      set((state) => ({ modals: { ...state.modals, [id]: false } })),
    toggle: (id) =>
      set((state) => ({
        modals: { ...state.modals, [id]: !state.modals[id] },
      })),
  },
}));

// Selector factory
export const useModal = (id: string) =>
  useModalStore((state) => state.modals[id] ?? false);
export const useModalActions = () => useModalStore((state) => state.actions);

// Usage
const isLoginModalOpen = useModal('login');
const { open, close } = useModalActions();

// Open modal
open('login');
```

### Form Store (Feature-Level)

```typescript
// features/checkout/model/checkoutFormStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface Address {
  street: string;
  city: string;
  zipCode: string;
  country: string;
}

interface CheckoutFormState {
  step: number;
  shippingAddress: Address;
  billingAddress: Address;
  sameAsShipping: boolean;

  actions: {
    setStep: (step: number) => void;
    nextStep: () => void;
    prevStep: () => void;
    setShippingAddress: (address: Partial<Address>) => void;
    setBillingAddress: (address: Partial<Address>) => void;
    setSameAsShipping: (same: boolean) => void;
    reset: () => void;
  };
}

const initialAddress: Address = {
  street: '',
  city: '',
  zipCode: '',
  country: '',
};

export const useCheckoutFormStore = create<CheckoutFormState>()(
  immer((set) => ({
    step: 1,
    shippingAddress: initialAddress,
    billingAddress: initialAddress,
    sameAsShipping: true,

    actions: {
      setStep: (step) => set({ step }),
      nextStep: () => set((state) => { state.step += 1; }),
      prevStep: () => set((state) => { state.step -= 1; }),

      setShippingAddress: (address) =>
        set((state) => {
          Object.assign(state.shippingAddress, address);
          if (state.sameAsShipping) {
            Object.assign(state.billingAddress, address);
          }
        }),

      setBillingAddress: (address) =>
        set((state) => {
          Object.assign(state.billingAddress, address);
        }),

      setSameAsShipping: (same) =>
        set((state) => {
          state.sameAsShipping = same;
          if (same) {
            state.billingAddress = { ...state.shippingAddress };
          }
        }),

      reset: () =>
        set({
          step: 1,
          shippingAddress: initialAddress,
          billingAddress: initialAddress,
          sameAsShipping: true,
        }),
    },
  }))
);

// Selectors
export const useCheckoutStep = () =>
  useCheckoutFormStore((state) => state.step);
export const useShippingAddress = () =>
  useCheckoutFormStore((state) => state.shippingAddress);
export const useBillingAddress = () =>
  useCheckoutFormStore((state) => state.billingAddress);
export const useCheckoutFormActions = () =>
  useCheckoutFormStore((state) => state.actions);
```
