# JavaScript 코딩 컨벤션 (Airbnb Style Guide)

## 개요
Airbnb JavaScript Style Guide는 가장 널리 사용되는 JavaScript 스타일 가이드 중 하나입니다. 이 가이드는 명확하고 읽기 쉬운 JavaScript 코드를 작성하는 데 도움을 줍니다.

## 변수와 참조

### const와 let
- **const**를 기본으로 사용 (재할당 방지)
- 재할당이 필요한 경우에만 **let** 사용
- **var**는 절대 사용하지 않음

```javascript
// 올바른 예
const name = 'John';
let count = 0;
count += 1;

// 잘못된 예
var name = 'John';
```

### 블록 스코프
- `let`과 `const`는 블록 스코프
- `var`는 함수 스코프 (사용 금지)

```javascript
// 올바른 예
if (true) {
    const blockScoped = 'only available here';
}
// blockScoped는 여기서 접근 불가
```

## 객체

### 객체 생성
- 리터럴 문법 사용

```javascript
// 올바른 예
const item = {};

// 잘못된 예
const item = new Object();
```

### 단축 속성
- 속성 단축 구문 사용

```javascript
const name = 'John';
const age = 30;

// 올바른 예
const user = {
    name,
    age,
};

// 잘못된 예
const user = {
    name: name,
    age: age,
};
```

### 메서드 단축
- 메서드 단축 구문 사용

```javascript
// 올바른 예
const obj = {
    getValue() {
        return this.value;
    },
};

// 잘못된 예
const obj = {
    getValue: function() {
        return this.value;
    },
};
```

### 계산된 속성 이름
- 동적 속성 이름은 객체 생성 시 정의

```javascript
function getKey(k) {
    return `key_${k}`;
}

// 올바른 예
const obj = {
    id: 5,
    [getKey('enabled')]: true,
};
```

## 배열

### 배열 생성
- 리터럴 문법 사용

```javascript
// 올바른 예
const items = [];

// 잘못된 예
const items = new Array();
```

### 배열 복사
- 스프레드 연산자 사용

```javascript
const items = [1, 2, 3];

// 올바른 예
const itemsCopy = [...items];

// 잘못된 예
const itemsCopy = items.slice();
```

### 배열 변환
- Array.from 사용

```javascript
const nodes = document.querySelectorAll('.node');

// 올바른 예
const nodesArray = Array.from(nodes);

// 스프레드도 가능
const nodesArray = [...nodes];
```

## 구조 분해 (Destructuring)

### 객체 구조 분해
- 여러 속성에 접근할 때 사용

```javascript
// 올바른 예
function getFullName({ firstName, lastName }) {
    return `${firstName} ${lastName}`;
}

const { firstName, lastName } = user;

// 잘못된 예
function getFullName(user) {
    const firstName = user.firstName;
    const lastName = user.lastName;
    return `${firstName} ${lastName}`;
}
```

### 배열 구조 분해
- 배열 값 할당에 사용

```javascript
const arr = [1, 2, 3, 4];

// 올바른 예
const [first, second] = arr;

// 나머지 요소
const [first, ...rest] = arr;
```

## 문자열

### 따옴표
- **작은따옴표** `''` 사용

```javascript
// 올바른 예
const name = 'John Doe';

// 잘못된 예
const name = "John Doe";
```

### 템플릿 리터럴
- 문자열 연결 대신 템플릿 리터럴 사용

```javascript
// 올바른 예
const greeting = `Hello, ${name}!`;

// 잘못된 예
const greeting = 'Hello, ' + name + '!';
```

### 긴 문자열
- 템플릿 리터럴 사용

```javascript
// 올바른 예
const message = `This is a very long message that
spans multiple lines using template literals.`;

// 잘못된 예
const message = 'This is a very long message that \
spans multiple lines using backslash.';
```

## 함수

### 함수 선언 vs 표현식
- 화살표 함수 사용 권장

```javascript
// 올바른 예 - 화살표 함수
const add = (a, b) => a + b;

// 함수 선언 (호이스팅이 필요한 경우)
function multiply(a, b) {
    return a * b;
}

// 잘못된 예
const add = function(a, b) {
    return a + b;
};
```

### 화살표 함수
- 간결한 문법 사용
- `this` 바인딩이 필요한 경우 유용

```javascript
// 올바른 예
[1, 2, 3].map(number => number * 2);

// 여러 줄인 경우
[1, 2, 3].map(number => {
    const doubled = number * 2;
    return doubled;
});

// 객체 반환 시 괄호로 감싸기
[1, 2, 3].map(number => ({ value: number }));
```

### 기본 매개변수
- 기본값이 필요한 경우 사용

```javascript
// 올바른 예
function greet(name = 'Guest') {
    return `Hello, ${name}!`;
}

// 잘못된 예
function greet(name) {
    name = name || 'Guest';
    return `Hello, ${name}!`;
}
```

### 나머지 매개변수
- `arguments` 대신 사용

```javascript
// 올바른 예
function sum(...numbers) {
    return numbers.reduce((total, num) => total + num, 0);
}

// 잘못된 예
function sum() {
    const numbers = Array.prototype.slice.call(arguments);
    return numbers.reduce((total, num) => total + num, 0);
}
```

## 클래스

### 클래스 사용
- `prototype` 조작 대신 `class` 사용

```javascript
// 올바른 예
class User {
    constructor(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }
}

// 잘못된 예
function User(name) {
    this.name = name;
}

User.prototype.getName = function() {
    return this.name;
};
```

### 상속
- `extends` 사용

```javascript
class Animal {
    constructor(name) {
        this.name = name;
    }

    speak() {
        return `${this.name} makes a sound.`;
    }
}

class Dog extends Animal {
    constructor(name, breed) {
        super(name);
        this.breed = breed;
    }

    speak() {
        return `${this.name} barks.`;
    }
}
```

### 메서드 체이닝
- `this` 반환

```javascript
class User {
    setName(name) {
        this.name = name;
        return this;
    }

    setAge(age) {
        this.age = age;
        return this;
    }
}

// 사용
const user = new User()
    .setName('John')
    .setAge(30);
```

## 모듈

### Import/Export
- ES6 모듈 시스템 사용

```javascript
// 올바른 예 - Named exports
export const name = 'John';
export function greet() { }

// Import
import { name, greet } from './user';

// Default export (하나만 export할 때)
export default class User { }

// Import
import User from './user';
```

### 단일 Import
- 같은 경로에서 한 번만 import

```javascript
// 올바른 예
import { name, age, greet } from './user';

// 잘못된 예
import { name } from './user';
import { age } from './user';
import { greet } from './user';
```

## 비교 연산자

### 일치 연산자
- `===`와 `!==` 사용
- `==`와 `!=` 사용 금지

```javascript
// 올바른 예
if (value === 'test') { }
if (count !== 0) { }

// 잘못된 예
if (value == 'test') { }
if (count != 0) { }
```

### 단축 평가
- Boolean 값에 직접 비교 피하기

```javascript
// 올바른 예
if (isValid) { }
if (!isEmpty) { }

// 잘못된 예
if (isValid === true) { }
if (isEmpty === false) { }
```

## 코드 블록

### 중괄호
- 항상 중괄호 사용

```javascript
// 올바른 예
if (test) {
    return true;
}

// 잘못된 예
if (test) return true;
```

### 여러 줄 블록
- else는 if 블록의 닫는 중괄호와 같은 줄에

```javascript
// 올바른 예
if (test) {
    thing1();
} else {
    thing2();
}

// 잘못된 예
if (test) {
    thing1();
}
else {
    thing2();
}
```

## 주석

### 여러 줄 주석
- `/** ... */` 사용

```javascript
/**
 * 사용자를 생성합니다.
 * @param {string} name - 사용자 이름
 * @param {number} age - 사용자 나이
 * @return {User} 생성된 사용자 객체
 */
function createUser(name, age) {
    // ...
}
```

### 한 줄 주석
- `//` 사용, 코드 위에 작성

```javascript
// 올바른 예
// 사용자 활성화 상태 확인
const isActive = true;

// 잘못된 예
const isActive = true; // 사용자 활성화 상태 확인
```

## 공백

### 들여쓰기
- **2칸 공백** 사용

```javascript
function example() {
  const name = 'test';
  if (name === 'test') {
    return true;
  }
  return false;
}
```

### 연산자 주변
- 연산자 전후에 공백

```javascript
// 올바른 예
const x = y + 5;

// 잘못된 예
const x=y+5;
```

## 명명 규칙

### 변수와 함수
- **camelCase** 사용

```javascript
const userName = 'John';
const isValid = true;

function getUserName() { }
```

### 클래스와 생성자
- **PascalCase** 사용

```javascript
class UserAccount { }
const user = new UserAccount();
```

### 상수
- **UPPER_CASE_WITH_UNDERSCORES** 사용

```javascript
const MAX_COUNT = 100;
const API_KEY = 'your-api-key';
```

### Private
- 앞에 언더스코어 사용 (컨벤션)

```javascript
class User {
    constructor() {
        this._privateProperty = 'private';
    }

    _privateMethod() {
        // ...
    }
}
```

## 비동기 처리

### Promises
- async/await 선호

```javascript
// 올바른 예
async function getUser(id) {
    try {
        const response = await fetch(`/api/users/${id}`);
        const user = await response.json();
        return user;
    } catch (error) {
        console.error(error);
    }
}

// Promise 체이닝도 가능
function getUser(id) {
    return fetch(`/api/users/${id}`)
        .then(response => response.json())
        .catch(error => console.error(error));
}
```

## 테스팅

### 프레임워크
- Mocha, Jest 사용
- 100% 테스트 커버리지 목표

```javascript
describe('User', () => {
    it('should create a user with name and age', () => {
        const user = new User('John', 30);
        expect(user.name).toBe('John');
        expect(user.age).toBe(30);
    });
});
```

### 버그 수정
- 회귀 테스트 작성

```javascript
// 버그 수정 시 테스트 추가
it('should handle empty array correctly', () => {
    const result = processArray([]);
    expect(result).toEqual([]);
});
```

## 자동화 도구

### ESLint
- Airbnb ESLint 설정 사용

```bash
npm install --save-dev eslint-config-airbnb
```

```json
{
    "extends": "airbnb"
}
```

### Prettier
- 코드 자동 포맷팅

```json
{
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5"
}
```

## 참고 자료
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [Airbnb React/JSX Style Guide](https://airbnb.io/javascript/react/)
- [ESLint Airbnb Config](https://www.npmjs.com/package/eslint-config-airbnb)
