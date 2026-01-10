# Data Layer Architecture

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Axios Instance Setup](#axios-instance-setup)
3. [Service Layer](#service-layer)
4. [Hook Layer](#hook-layer)
5. [Query Key Factory](#query-key-factory)
6. [Complete Example](#complete-example)

---

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Components    │ --> │   Hook Layer    │ --> │  Service Layer  │
│   (React)       │     │  (React Query)  │     │   (Pure TS)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        v
                                                ┌─────────────────┐
                                                │  Axios Instance │
                                                │   (Shared)      │
                                                └─────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | React Dependency |
|-------|---------------|------------------|
| Service | API calls, DTOs | No |
| Hook | Caching, loading/error states | Yes (React Query) |
| Component | UI rendering | Yes |

### 1:1 Mapping Rule

**One service function = One custom hook**

```typescript
// Service
authService.login()      --> useAuthLogin()
authService.fetchProfile() --> useAuthProfile()
authService.logout()     --> useAuthLogout()
```

---

## Axios Instance Setup

Centralized HTTP client with interceptors.

```typescript
// shared/api/axiosClient.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL;

export const axiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Auth token injection
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Error handling & token refresh
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Token refresh logic (401 Unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        localStorage.setItem('accessToken', data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;

        return axiosInstance(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Service Layer

Pure TypeScript functions. No React, no hooks.

### File Structure

```
features/auth/api/
├── auth.service.ts    # API functions
├── auth.keys.ts       # Query key factory
├── useAuth.ts         # React Query hooks
└── types.ts           # DTOs
```

### Service Implementation

```typescript
// features/auth/api/types.ts
export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}
```

```typescript
// features/auth/api/auth.service.ts
import { axiosInstance } from '@/shared/api/axiosClient';
import type { LoginRequestDto, LoginResponseDto, UserDto } from './types';

export const authService = {
  login: async (credentials: LoginRequestDto): Promise<LoginResponseDto> => {
    const { data } = await axiosInstance.post<LoginResponseDto>(
      '/auth/login',
      credentials
    );
    return data;
  },

  fetchProfile: async (): Promise<UserDto> => {
    const { data } = await axiosInstance.get<UserDto>('/auth/me');
    return data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
  },

  refreshToken: async (refreshToken: string): Promise<{ accessToken: string }> => {
    const { data } = await axiosInstance.post('/auth/refresh', { refreshToken });
    return data;
  },
};
```

**Rules**:
- Functions are pure and stateless
- Return typed promises
- Use object pattern for namespace grouping

---

## Hook Layer

React Query integration. One hook per service function.

```typescript
// features/auth/api/useAuth.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from './auth.service';
import { authKeys } from './auth.keys';
import type { LoginRequestDto } from './types';

// 1:1 mapping: fetchProfile -> useAuthProfile
export const useAuthProfile = () => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: authService.fetchProfile,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
};

// 1:1 mapping: login -> useAuthLogin
export const useAuthLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginRequestDto) => authService.login(credentials),
    onSuccess: (data) => {
      // Store tokens
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Invalidate and refetch profile
      queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
};

// 1:1 mapping: logout -> useAuthLogout
export const useAuthLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      // Clear tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');

      // Clear all queries
      queryClient.clear();
    },
  });
};
```

---

## Query Key Factory

Centralized query key management. Prevents typos and enables type safety.

```typescript
// features/auth/api/auth.keys.ts
export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};

// features/products/api/product.keys.ts
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductFilters) => [...productKeys.lists(), filters] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
};
```

### Usage in Hooks

```typescript
// Fetch
useQuery({
  queryKey: productKeys.detail(productId),
  queryFn: () => productService.fetchById(productId),
});

// Invalidate
queryClient.invalidateQueries({ queryKey: productKeys.lists() });

// Optimistic update
queryClient.setQueryData(productKeys.detail(id), updatedProduct);
```

---

## Complete Example

Full feature implementation: Cart

### Directory Structure

```
features/cart/
├── api/
│   ├── cart.service.ts
│   ├── cart.keys.ts
│   ├── useCart.ts
│   └── types.ts
├── ui/
│   ├── AddToCartButton/
│   └── CartSummary/
├── model/
│   └── cartStore.ts
└── index.ts
```

### Types

```typescript
// features/cart/api/types.ts
export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total: number;
}

export interface AddToCartDto {
  productId: string;
  quantity: number;
}
```

### Service

```typescript
// features/cart/api/cart.service.ts
import { axiosInstance } from '@/shared/api/axiosClient';
import type { Cart, AddToCartDto, CartItem } from './types';

export const cartService = {
  fetchCart: async (): Promise<Cart> => {
    const { data } = await axiosInstance.get<Cart>('/cart');
    return data;
  },

  addItem: async (dto: AddToCartDto): Promise<CartItem> => {
    const { data } = await axiosInstance.post<CartItem>('/cart/items', dto);
    return data;
  },

  removeItem: async (itemId: string): Promise<void> => {
    await axiosInstance.delete(`/cart/items/${itemId}`);
  },

  updateQuantity: async (itemId: string, quantity: number): Promise<CartItem> => {
    const { data } = await axiosInstance.patch<CartItem>(
      `/cart/items/${itemId}`,
      { quantity }
    );
    return data;
  },

  clearCart: async (): Promise<void> => {
    await axiosInstance.delete('/cart');
  },
};
```

### Keys

```typescript
// features/cart/api/cart.keys.ts
export const cartKeys = {
  all: ['cart'] as const,
  detail: () => [...cartKeys.all, 'detail'] as const,
  items: () => [...cartKeys.all, 'items'] as const,
};
```

### Hooks

```typescript
// features/cart/api/useCart.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cartService } from './cart.service';
import { cartKeys } from './cart.keys';
import type { AddToCartDto } from './types';

export const useCart = () => {
  return useQuery({
    queryKey: cartKeys.detail(),
    queryFn: cartService.fetchCart,
  });
};

export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: AddToCartDto) => cartService.addItem(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
    },
  });
};

export const useRemoveFromCart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (itemId: string) => cartService.removeItem(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
    },
  });
};

export const useUpdateCartQuantity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, quantity }: { itemId: string; quantity: number }) =>
      cartService.updateQuantity(itemId, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
    },
  });
};

export const useClearCart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cartService.clearCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
    },
  });
};
```

### Component Usage

```typescript
// features/cart/ui/AddToCartButton/index.tsx
import { useAddToCart } from '../../api/useCart';
import type { AddToCartButtonProps } from './types';
import * as S from './styles';

export const AddToCartButton = ({ productId }: AddToCartButtonProps) => {
  const { mutate: addToCart, isPending } = useAddToCart();

  const handleClick = () => {
    addToCart({ productId, quantity: 1 });
  };

  return (
    <S.Button onClick={handleClick} disabled={isPending}>
      {isPending ? 'Adding...' : 'Add to Cart'}
    </S.Button>
  );
};
```
