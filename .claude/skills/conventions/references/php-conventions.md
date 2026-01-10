# PHP 코딩 컨벤션 (PSR Standards)

## 개요
PHP-FIG (PHP Framework Interop Group)에서 제공하는 PSR (PHP Standard Recommendation)은 PHP 커뮤니티의 표준 코딩 규칙입니다. 주요 표준으로는 PSR-1, PSR-12, PER Coding Style 3.0이 있습니다.

## PSR 표준 계층

### PSR-1: Basic Coding Standard
- 기본 코딩 표준
- 모든 PSR의 기초

### PSR-12: Extended Coding Style (2019)
- PSR-2를 확장하고 대체
- PSR-1을 기반으로 함
- 현재 가장 널리 사용됨

### PER Coding Style 3.0 (최신)
- PSR-12를 확장하고 대체
- PHP 최신 기능 반영
- PSR-1 준수 필요

## PSR-1: 기본 코딩 표준

### 파일
- **UTF-8 without BOM**만 사용
- `<?php` 또는 `<?=` 태그만 사용

```php
<?php
// UTF-8 without BOM

namespace App\User;

class UserService
{
    // ...
}
```

### 부수 효과 (Side Effects)
- 심볼 선언과 부수 효과를 분리

```php
// 잘못된 예 - 심볼 선언과 부수 효과 혼재
<?php
ini_set('error_reporting', E_ALL);  // 부수 효과

class User  // 심볼 선언
{
    // ...
}

// 올바른 예 - 분리
<?php
// config.php - 부수 효과만
ini_set('error_reporting', E_ALL);

// User.php - 심볼 선언만
<?php
namespace App;

class User
{
    // ...
}
```

### 네임스페이스와 클래스
- 네임스페이스는 오토로딩 표준(PSR-4) 준수
- 클래스명: **StudlyCaps** (PascalCase)

```php
<?php
namespace App\Service\User;

class UserAuthenticationService
{
    // ...
}
```

### 클래스 상수
- **대문자 + 언더스코어**

```php
class User
{
    const STATUS_ACTIVE = 'active';
    const STATUS_INACTIVE = 'inactive';
    const MAX_LOGIN_ATTEMPTS = 3;
}
```

### 메서드
- **camelCase** 사용

```php
class UserService
{
    public function getUserById($id)
    {
        // ...
    }

    public function createUser($data)
    {
        // ...
    }

    protected function validateEmail($email)
    {
        // ...
    }
}
```

### 프로퍼티
- 일관성 있는 스타일 선택 (권장: camelCase)

```php
class User
{
    // camelCase (권장)
    private $firstName;
    private $lastName;

    // 또는 snake_case (일관성 유지)
    private $first_name;
    private $last_name;
}
```

## PSR-12: 확장 코딩 스타일

### 들여쓰기
- **4개의 공백** 사용
- 탭 사용 금지

```php
class Example
{
    public function example()
    {
        if ($condition) {
            doSomething();
        }
    }
}
```

### 파일
- Unix LF 라인 엔딩
- 파일 끝에 빈 줄 하나
- 닫는 `?>` 태그 생략 (PHP 전용 파일)

```php
<?php

namespace App;

class User
{
    // ...
}
// 파일 끝에 빈 줄 (여기서 파일 종료, ?> 없음)
```

### 네임스페이스와 Use 선언
- 네임스페이스 선언 후 빈 줄
- Use 선언들 그룹화
- Use 선언 후 빈 줄

```php
<?php

namespace App\Controller;

use App\Service\UserService;
use App\Service\AuthService;
use App\Model\User;
use Psr\Log\LoggerInterface;

class UserController
{
    // ...
}
```

### 클래스, 프로퍼티, 메서드

#### 클래스 선언
- Extends와 Implements는 클래스명과 같은 줄
- 여러 인터페이스: 각각 들여쓰기하여 나열 가능

```php
<?php

namespace App;

class User extends BaseModel implements UserInterface, JsonSerializable
{
    // ...
}

// 긴 경우
class VeryLongClassName extends VeryLongParentClassName implements
    FirstInterface,
    SecondInterface,
    ThirdInterface
{
    // ...
}
```

#### 프로퍼티
- 가시성(visibility) 항상 선언
- `var` 키워드 사용 금지
- 한 줄에 하나의 프로퍼티만

```php
class User
{
    // 올바른 예
    public $name;
    protected $email;
    private $password;

    // 잘못된 예
    var $age;  // var 사용 금지
    public $firstName, $lastName;  // 한 줄에 여러 프로퍼티 금지
}
```

#### 메서드
- 가시성 항상 선언
- 여는 중괄호는 다음 줄
- 닫는 중괄호는 본문 다음 줄

```php
class User
{
    public function getName()
    {
        return $this->name;
    }

    protected function validateEmail($email)
    {
        // ...
    }

    private function hashPassword($password)
    {
        // ...
    }
}
```

#### 메서드 인자
- 인자 간 공백 하나
- 기본값이 있는 인자는 마지막에

```php
class User
{
    public function createUser($name, $email, $role = 'user')
    {
        // ...
    }

    // 긴 경우
    public function veryLongMethodName(
        $firstArgument,
        $secondArgument,
        $thirdArgument = null
    ) {
        // ...
    }
}
```

#### 타입 선언
- 타입 뒤에 공백 하나
- 반환 타입 선언

```php
class UserService
{
    public function getUser(int $id): ?User
    {
        // ...
    }

    public function createUser(string $name, string $email): User
    {
        // ...
    }

    public function deleteUser(int $id): void
    {
        // ...
    }
}
```

### 제어 구조

#### if, elseif, else
- 키워드 뒤에 공백 하나
- 여는 중괄호는 같은 줄
- 닫는 중괄호는 다음 줄
- else/elseif는 닫는 중괄호와 같은 줄

```php
if ($condition) {
    // ...
} elseif ($anotherCondition) {
    // ...
} else {
    // ...
}
```

#### switch, case
- case는 switch에서 한 번 들여쓰기
- break는 case 본문과 같은 들여쓰기

```php
switch ($value) {
    case 'first':
        // ...
        break;
    case 'second':
        // ...
        break;
    default:
        // ...
        break;
}
```

#### 반복문
- while, do-while, for, foreach 동일한 구조

```php
while ($condition) {
    // ...
}

do {
    // ...
} while ($condition);

for ($i = 0; $i < 10; $i++) {
    // ...
}

foreach ($items as $key => $value) {
    // ...
}
```

### 클로저
- function 키워드 뒤 공백
- use 키워드 전후 공백

```php
$closure = function ($arg1, $arg2) use ($var1, $var2) {
    // ...
};

// 긴 경우
$longClosure = function (
    $longArgument,
    $anotherLongArgument
) use (
    $longVariable,
    $anotherLongVariable
) {
    // ...
};
```

## PSR-4: 오토로딩

### 네임스페이스-디렉토리 매핑
- 네임스페이스와 디렉토리 구조 일치

```
src/
└── App/
    ├── Controller/
    │   └── UserController.php    // App\Controller\UserController
    ├── Service/
    │   └── UserService.php        // App\Service\UserService
    └── Model/
        └── User.php                // App\Model\User
```

### Composer 설정
```json
{
    "autoload": {
        "psr-4": {
            "App\\": "src/App/"
        }
    }
}
```

## 명명 규칙 요약

### 네임스페이스
- **StudlyCaps** (PascalCase)

```php
namespace App\Service\User;
```

### 클래스
- **StudlyCaps** (PascalCase)

```php
class UserAuthenticationService { }
```

### 인터페이스
- **StudlyCaps** + `Interface` 접미사

```php
interface UserServiceInterface { }
```

### Trait
- **StudlyCaps** + `Trait` 접미사

```php
trait TimestampableTrait { }
```

### 추상 클래스
- **StudlyCaps** + `Abstract` 접두사 (선택)

```php
abstract class AbstractController { }
```

### 메서드
- **camelCase**

```php
public function getUserById($id) { }
```

### 함수
- **snake_case** 또는 **camelCase**

```php
function get_user_name() { }  // snake_case
function getUserName() { }    // camelCase (권장)
```

### 변수
- **camelCase** 또는 **snake_case**

```php
$userName = 'John';      // camelCase (권장)
$user_name = 'John';     // snake_case
```

### 상수
- **UPPER_CASE_WITH_UNDERSCORES**

```php
const MAX_RETRIES = 3;
const API_KEY = 'your-key';
```

## 문서화 (PHPDoc)

### 클래스 문서화
```php
/**
 * User service class
 *
 * Handles user-related business logic including
 * authentication, registration, and profile management.
 *
 * @package App\Service
 * @author  John Doe <john@example.com>
 */
class UserService
{
    // ...
}
```

### 메서드 문서화
```php
/**
 * Get user by ID
 *
 * @param int $id User ID
 * @return User|null User object or null if not found
 * @throws UserNotFoundException When user is not found
 */
public function getUserById(int $id): ?User
{
    // ...
}
```

### 프로퍼티 문서화
```php
class User
{
    /**
     * @var string User's email address
     */
    private $email;

    /**
     * @var \DateTime Account creation date
     */
    private $createdAt;
}
```

## 모범 사례

### 의존성 주입
```php
class UserController
{
    private $userService;
    private $logger;

    public function __construct(
        UserServiceInterface $userService,
        LoggerInterface $logger
    ) {
        $this->userService = $userService;
        $this->logger = $logger;
    }
}
```

### 타입 힌팅
```php
// 올바른 예
public function setUser(User $user): void
{
    $this->user = $user;
}

public function getUsers(): array
{
    return $this->users;
}
```

### Null 안전성
```php
public function getUserEmail(int $id): ?string
{
    $user = $this->getUser($id);
    return $user?->getEmail();  // PHP 8.0+ null safe operator
}
```

### Strict Types
```php
<?php

declare(strict_types=1);

namespace App\Service;

class UserService
{
    public function add(int $a, int $b): int
    {
        return $a + $b;
    }
}
```

## 자동화 도구

### PHP_CodeSniffer
- PSR 표준 검사

```bash
# 설치
composer require --dev squizlabs/php_codesniffer

# 검사
./vendor/bin/phpcs --standard=PSR12 src/

# 자동 수정
./vendor/bin/phpcbf --standard=PSR12 src/
```

### PHP CS Fixer
- 코드 자동 포맷팅

```bash
# 설치
composer require --dev friendsofphp/php-cs-fixer

# 실행
./vendor/bin/php-cs-fixer fix src/
```

### PHPStan / Psalm
- 정적 분석 도구

```bash
# PHPStan
composer require --dev phpstan/phpstan
./vendor/bin/phpstan analyse src/

# Psalm
composer require --dev vimeo/psalm
./vendor/bin/psalm
```

## 참고 자료
- [PSR-1: Basic Coding Standard](https://www.php-fig.org/psr/psr-1/)
- [PSR-12: Extended Coding Style](https://www.php-fig.org/psr/psr-12/)
- [PER Coding Style 3.0](https://www.php-fig.org/per/coding-style/)
- [PSR-4: Autoloader](https://www.php-fig.org/psr/psr-4/)
- [PHP-FIG](https://www.php-fig.org/psr/)
