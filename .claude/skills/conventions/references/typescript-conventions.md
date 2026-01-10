# TypeScript 코딩 컨벤션

## 개요
TypeScript는 JavaScript에 타입 시스템을 추가한 언어로, 여러 주요 조직에서 스타일 가이드를 제공합니다. Google, Microsoft, 그리고 커뮤니티에서 제공하는 가이드가 주요 참고 자료입니다.

## 주요 스타일 가이드

### Google TypeScript Style Guide
- Google 내부 스타일 가이드 기반
- RFC 2119 용어 사용 (must, should, may 등)
- **gts** 도구: 포맷터, 린터, 자동 수정 제공

### Microsoft TypeScript Coding Guidelines
- TypeScript 팀이 직접 사용하는 컨벤션
- TypeScript 공식 저장소에서 관리

## 명명 규칙

### 클래스
- **PascalCase** 사용

```typescript
class UserAccount {
    // ...
}

class DataProcessor {
    // ...
}
```

### 인터페이스
- **PascalCase** 사용
- `I` 접두사 사용하지 않음

```typescript
// 올바른 예
interface User {
    name: string;
    age: number;
}

// 잘못된 예 (I 접두사)
interface IUser {
    name: string;
    age: number;
}
```

### 타입 별칭
- **PascalCase** 사용

```typescript
type UserCallback = (user: User) => void;
type StringOrNumber = string | number;
```

### 열거형 (Enum)
- **PascalCase** 사용 (이름과 멤버 모두)

```typescript
enum Color {
    Red,
    Green,
    Blue
}

enum HttpStatus {
    Ok = 200,
    NotFound = 404,
    InternalServerError = 500
}
```

### 함수와 메서드
- **camelCase** 사용

```typescript
function calculateTotal(items: Item[]): number {
    // ...
}

class ShoppingCart {
    addItem(item: Item): void {
        // ...
    }
}
```

### 변수와 상수
- **camelCase** 사용
- 상수도 camelCase 사용 (UPPER_CASE 아님)

```typescript
const maxRetries = 3;
const apiEndpoint = 'https://api.example.com';
let userCount = 0;
```

### Private 속성/메서드
- 앞이나 뒤에 언더스코어 사용하지 않음
- `private` 키워드 사용

```typescript
class User {
    private password: string;  // 올바른 예
    private _password: string; // 잘못된 예
    private password_: string; // 잘못된 예

    private validatePassword(): boolean {
        // ...
    }
}
```

### Observable 변수
- 팀 판단에 따라 `$` 접미사 사용 가능
- 프로젝트 내에서 일관성 유지

```typescript
// RxJS를 사용하는 경우
const user$ = new Observable<User>();
const data$ = this.http.get('/api/data');
```

## 타입 사용

### 타입 추론
- 타입이 명확한 경우 생략

```typescript
// 올바른 예 (타입 추론)
const count = 10;
const name = "John";

// 불필요한 타입 명시
const count: number = 10;
```

### 명시적 타입 선언
- 함수 반환 타입은 명시
- 공개 API는 타입 명시

```typescript
// 올바른 예
function getUser(id: string): User {
    // ...
}

// 복잡한 타입은 명시
const complexData: Map<string, User[]> = new Map();
```

### any 사용 자제
- 가급적 구체적인 타입 사용
- 필요한 경우 `unknown` 고려

```typescript
// 잘못된 예
function process(data: any): any {
    return data;
}

// 올바른 예
function process<T>(data: T): T {
    return data;
}
```

### Type vs Interface
- 객체 구조에는 **Interface** 선호
- Union, Intersection에는 **Type** 사용

```typescript
// Interface 사용
interface User {
    id: string;
    name: string;
}

// Type 사용
type Status = 'pending' | 'active' | 'inactive';
type UserOrAdmin = User | Admin;
```

## 코드 구조

### 파일 구조
- 하나의 파일에 하나의 논리적 컴포넌트
- export는 파일 하단에 모음 (선호)

```typescript
// user.ts
class User {
    // ...
}

interface UserOptions {
    // ...
}

function createUser(options: UserOptions): User {
    // ...
}

export { User, UserOptions, createUser };
```

### Import 순서
1. 외부 라이브러리
2. 내부 모듈 (절대 경로)
3. 상대 경로 모듈

```typescript
// 외부 라이브러리
import { Component } from '@angular/core';
import * as _ from 'lodash';

// 내부 모듈 (절대 경로)
import { UserService } from '@app/services/user';

// 상대 경로
import { User } from './user';
import { formatDate } from '../utils/date';
```

### Export
- 한 경로에서 한 번만 import
- Default export보다 Named export 선호

```typescript
// 올바른 예 - Named exports
export class User { }
export function createUser() { }

// 사용 시
import { User, createUser } from './user';

// Default export (필요한 경우에만)
export default class User { }
```

## 문자열

### 따옴표
- Microsoft 가이드: **큰따옴표** 사용
- Google/커뮤니티: **작은따옴표** 선호
- 템플릿 리터럴: 변수 삽입 시 사용

```typescript
// Microsoft 스타일
const name = "John";

// Google/커뮤니티 스타일
const name = 'John';

// 템플릿 리터럴
const greeting = `Hello, ${name}!`;
```

## 함수

### Arrow Function
- 간결한 경우 선호
- `this` 바인딩이 필요한 경우 사용

```typescript
// 올바른 예
const numbers = [1, 2, 3].map(n => n * 2);

// 여러 줄
const process = (data: Data) => {
    const result = transform(data);
    return result;
};
```

### 함수 오버로드
- 명확한 타입 시그니처 제공

```typescript
function format(value: string): string;
function format(value: number): string;
function format(value: Date): string;
function format(value: string | number | Date): string {
    // 구현
}
```

## 주석과 문서화

### JSDoc
- 공개 API에 JSDoc 주석 작성
- 타입은 TypeScript 타입 시스템 사용

```typescript
/**
 * 사용자 정보를 가져옵니다.
 *
 * @param id - 사용자 ID
 * @returns 사용자 객체 또는 null
 */
function getUser(id: string): User | null {
    // ...
}
```

### 주석
- 코드만으로 이해하기 어려운 경우에만
- "무엇"보다 "왜"를 설명

```typescript
// 올바른 예: "왜"를 설명
// API 속도 제한을 피하기 위해 캐싱 사용
const cachedData = cache.get(key);

// 불필요한 주석: "무엇"을 반복
// 사용자 이름을 설정
user.name = "John";
```

## 비동기 처리

### async/await 선호
- Promise 체이닝보다 async/await 사용

```typescript
// 올바른 예
async function fetchUser(id: string): Promise<User> {
    const response = await fetch(`/api/users/${id}`);
    const data = await response.json();
    return data;
}

// 잘못된 예 (불필요한 체이닝)
function fetchUser(id: string): Promise<User> {
    return fetch(`/api/users/${id}`)
        .then(response => response.json())
        .then(data => data);
}
```

## 자동화 도구

### ESLint
- TypeScript용 린터
- `@typescript-eslint` 플러그인 사용

```json
{
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended"
    ]
}
```

### Prettier
- 코드 포맷터
- ESLint와 함께 사용

```json
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5"
}
```

### gts (Google TypeScript Style)
- Google 스타일 가이드 자동 적용
- ESLint + Prettier 포함

```bash
npx gts init
```

## 모범 사례

### Null/Undefined 처리
- Optional chaining 사용
- Nullish coalescing 사용

```typescript
// Optional chaining
const userName = user?.profile?.name;

// Nullish coalescing
const displayName = userName ?? 'Guest';
```

### Type Guards
- 타입 좁히기 사용

```typescript
function isString(value: unknown): value is string {
    return typeof value === 'string';
}

if (isString(data)) {
    // 여기서 data는 string 타입
    console.log(data.toUpperCase());
}
```

### Enum vs Union
- 간단한 경우 Union Type 선호

```typescript
// Union Type (선호)
type Status = 'pending' | 'active' | 'inactive';

// Enum (복잡한 경우)
enum HttpMethod {
    Get = 'GET',
    Post = 'POST',
    Put = 'PUT',
    Delete = 'DELETE'
}
```

## 참고 자료
- [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- [Microsoft TypeScript Coding Guidelines](https://github.com/Microsoft/TypeScript/wiki/Coding-guidelines)
- [TypeScript Deep Dive Style Guide](https://basarat.gitbook.io/typescript/styleguide)
- [gts - Google TypeScript Style](https://github.com/google/gts)
