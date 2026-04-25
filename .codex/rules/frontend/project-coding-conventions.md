# Project Coding Conventions

This is a compact Codex-facing rewrite of `.claude/rules/*.md`.

Codex does not interpret this file as execution policy. It is kept here because
`.codex/rules/*.rules` can only express command-prefix decisions.

## Architecture

- Use the 5-layer mapping: Pages -> Presentation -> Application -> Infrastructure -> Providers.
- Keep dependencies one-way. Presentation must call Infrastructure only through Application hooks.
- Keep route files thin. Route files handle routing, dynamic segments, SSR/SSG data loading, layout choice, and i18n prefetch only.
- Map major pages to `presentation/features/{name}View/index.tsx`.
- Use path aliases for cross-layer imports. Avoid 3+ level `../` imports.
- Keep Provider nesting fixed in the app entry point.
- Avoid direct feature-to-feature imports. Promote shared code to common components or hooks.

## Naming

- Folders use camelCase except `pages/` and `providers/`, where kebab-case is allowed.
- Standard files are `index.tsx`, `types.ts`, `styles.ts`, `services.ts`, and `dtos.ts`.
- Do not create new `type.ts` or `dto.ts`. Rename old singular files only when touching that domain.
- Components and types use PascalCase.
- Functions, hooks, and variables use camelCase.
- Constants and enum members use UPPER_SNAKE_CASE.
- Prefer concrete names. Avoid generic `utils.ts`, `helpers.ts`, and `common.ts`.
- Boolean names should be positive: `isOpen`, `hasError`, `canEdit`.

## TypeScript

- Use `type` by default. Use `interface` only when declaration merging or external extension is required.
- API nullable values use `| null`. Optional props use `?`.
- Exported functions and components must declare return types.
- Use `import type` for type-only imports.
- Avoid `any`. Use `unknown` and narrow it.
- Use string enums only for API endpoints, query keys, and similar constants. Prefer union literals for general variants.
- Give generics meaningful names such as `TData`, `TRequest`, and `TResponse`.
- Use exhaustive checks for discriminated unions.

## React Components

- Write components as function declarations by default.
- Put Props in the same folder's `types.ts`.
- Prefer named exports. Use default exports only where the router requires them.
- Use `memo` and `forwardRef` only for real performance or ref-transfer needs.
- Keep `index.tsx` around 150 lines where practical. Split large components into parts or hooks.
- Destructure props once at the function parameter.
- Use `cond && <X />`, ternaries for two-way branches, and tables or switch-based subcomponents for 3+ branches.
- Keep effect hooks near the top, then derived state/handlers, then render.
- Do not use inline styles or hard-coded colors in JSX.

## Styling

- Put component styles in adjacent `styles.ts` files.
- Use Emotion for this project.
- Import colors, spacing, borders, and breakpoints from theme tokens.
- Express conditional styles through styled props.
- Keep global styles limited to reset, fonts, and accessibility defaults.
- Use theme breakpoint tokens for media queries.
- `styles.ts` may omit explicit function return types when ESLint is configured for that exception.

## State Management

- Separate server state from client/UI state.
- Use React Query for server state and Zustand for client state.
- Centralize query keys in enums/constants.
- Use standard wrappers such as `useBaseQuery`, `useBaseMutation`, and `useBasePagination`.
- Keep QueryClient defaults aligned: `throwOnError: true`, `retry: 1`, `refetchOnWindowFocus: false`, `staleTime: 60_000`.
- Split global stores by domain. Avoid one large store.
- Put modal open/close state under `store/modal/`.
- Name setters `set{PropertyName}` and toggles `toggle{PropertyName}`.
- Update state immutably.
- Outside React components, access stores through `useStore.getState()` and `useStore.setState(...)`.

## API And Infrastructure

- Infrastructure is pure TypeScript. Do not import React, React Query, or Emotion there.
- Use `dtos.ts` and `services.ts` for each API domain.
- Name DTOs as `{Entity}DTO`, `{Entity}ListDTO`, `{Entity}CreateDTO`, and `{Entity}ModifyDTO`.
- Wrap responses with `ResponseWithMetadata<T>` or `ResponsePagingWithMetadata<T>`.
- Centralize endpoint strings in `ApiEndpoints`.
- Service functions use `{verb}{Entity}` names such as `fetchUserList`, `createUser`, `modifyUser`, and `deleteUser`.
- Service functions must declare `Promise<ResponseWithMetadata<T>>` style return types.
- Use one shared axios instance from `infrastructure/client/`.
- Use axios `params` or `qs` for query strings.
- Use `pathToUrl` or an equivalent helper for URL parameters.
- Put UI-specific derived types in Presentation or Application, not DTO files.

## Testing

- Test tooling is not assumed to be installed. Add Vitest/Jest, Testing Library, MSW, scripts, and config before writing tests that import them.
- Prefer unit tests for utilities and pure hooks.
- Use integration tests for Feature View plus hook/component composition.
- Use E2E tests only for core happy paths.
- Keep tests next to the target file where practical.
- Test names should describe behavior and expected result.
- Avoid blind render snapshots.
- Mock network with MSW. Do not mock axios directly from Presentation tests.
- Fix time, randomness, and timers in tests.
- Storybook stories should include `Default`, `Playground`, and relevant `Loading`, `Empty`, or `Error` states.

## Build And Workflow

- Before build or PR, run `yarn lint`, `yarn type-check`, then `yarn build`.
- Add a `type-check` script as `tsc --noEmit` if missing.
- Keep `.env.*.local` files uncommitted.
- Never put secrets in `NEXT_PUBLIC_*` values.
- Keep Node/Yarn versions pinned through `.nvmrc`, Volta, or Yarn Berry config.
- Use multi-stage Docker builds.
- Tag images with a timestamp tag plus `latest`.
- Deployment updates should be rolling, health-checked, and rollback-capable.
- Keep deployment-specific commands in runbooks or skills, not general coding rules.
