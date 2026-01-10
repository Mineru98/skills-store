# Go (Golang) 코딩 컨벤션

## 개요
Go는 명확하고 읽기 쉬운 코드를 작성하는 것을 중요시합니다. 공식 문서 "Effective Go"와 Google Go Style Guide가 주요 참고 자료입니다.

## 핵심 철학
- 명확성(Clarity)이 가장 중요
- 간결함(Simplicity) 추구
- 가독성(Readability) 우선
- 관용적(Idiomatic) 코드 작성

## 명명 규칙

### 패키지
- **소문자 단일 단어** 사용
- 언더스코어나 mixedCaps 사용하지 않음
- 간결하고 명확한 이름

```go
// 올바른 예
package user
package http
package models

// 잘못된 예
package user_service
package httpUtils
package myModels
```

### 변수와 함수
- **MixedCaps** 또는 **mixedCaps** 사용
- 언더스코어 사용하지 않음
- 공개(exported): 대문자로 시작
- 비공개(unexported): 소문자로 시작

```go
// 공개 (exported)
var UserName string
func GetUser() {}

// 비공개 (unexported)
var userName string
func getUser() {}

// 잘못된 예
var user_name string
func get_user() {}
```

### 상수
- MixedCaps 사용
- ALL_CAPS 사용하지 않음

```go
// 올바른 예
const MaxRetries = 3
const defaultTimeout = 30

// 잘못된 예
const MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 30
```

### 인터페이스
- 단일 메서드 인터페이스: **메서드명 + er**
- 여러 메서드: 명확한 이름 사용

```go
// 단일 메서드 인터페이스
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Writer interface {
    Write(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

// 여러 메서드 인터페이스
type ReadWriter interface {
    Reader
    Writer
}

type UserService interface {
    GetUser(id string) (*User, error)
    CreateUser(user *User) error
}
```

### 구조체
- PascalCase 사용

```go
type User struct {
    ID        string
    FirstName string
    LastName  string
    Email     string
}

type UserProfile struct {
    User      *User
    Bio       string
    AvatarURL string
}
```

### Getter/Setter
- Getter: `Get` 접두사 없이 필드명만 사용
- Setter: `Set` 접두사 사용

```go
type User struct {
    name string
}

// Getter (Get 접두사 없음)
func (u *User) Name() string {
    return u.name
}

// Setter
func (u *User) SetName(name string) {
    u.name = name
}
```

## 코드 구조

### 패키지 구성
- 기능별로 패키지 분리
- 순환 의존성 피하기

```
project/
├── cmd/
│   └── myapp/
│       └── main.go
├── internal/
│   ├── user/
│   │   ├── user.go
│   │   └── service.go
│   └── auth/
│       ├── auth.go
│       └── middleware.go
├── pkg/
│   └── util/
│       └── helper.go
└── go.mod
```

### Import
- 표준 라이브러리, 외부 패키지, 내부 패키지 순서
- 그룹 간 빈 줄로 구분
- goimports 사용

```go
import (
    // 표준 라이브러리
    "context"
    "fmt"
    "time"

    // 외부 패키지
    "github.com/gin-gonic/gin"
    "go.uber.org/zap"

    // 내부 패키지
    "myapp/internal/user"
    "myapp/pkg/util"
)
```

## 포맷팅

### gofmt
- 항상 `gofmt` 또는 `goimports` 사용
- 들여쓰기: 탭 사용 (공백 아님)
- 자동으로 코드 정렬

```bash
# 코드 포맷팅
gofmt -w .

# 포맷팅 + import 정리
goimports -w .
```

### 줄 길이
- 공식 제한 없음
- 일반적으로 80-120자 권장
- 가독성 우선

## 주석

### 패키지 주석
- package 선언 위에 작성
- 패키지명으로 시작

```go
// Package user provides user management functionality.
// It includes user creation, authentication, and profile management.
package user
```

### 함수/메서드 주석
- 함수명으로 시작
- godoc으로 문서 생성

```go
// GetUser retrieves a user by ID from the database.
// It returns an error if the user is not found.
func GetUser(id string) (*User, error) {
    // ...
}

// String returns the string representation of the User.
func (u *User) String() string {
    return fmt.Sprintf("User{ID: %s, Name: %s}", u.ID, u.Name)
}
```

### Exported 심볼
- 모든 exported 심볼에 주석 작성

```go
// MaxRetries is the maximum number of retry attempts.
const MaxRetries = 3

// User represents a user in the system.
type User struct {
    ID   string
    Name string
}

// NewUser creates a new user with the given name.
func NewUser(name string) *User {
    return &User{Name: name}
}
```

## 에러 처리

### 에러 반환
- 마지막 반환값으로 error 반환
- 에러 먼저 처리 (early return)

```go
// 올바른 예
func GetUser(id string) (*User, error) {
    if id == "" {
        return nil, fmt.Errorf("id cannot be empty")
    }

    user, err := db.FindUser(id)
    if err != nil {
        return nil, fmt.Errorf("find user: %w", err)
    }

    return user, nil
}
```

### 에러 체크
- 항상 에러 체크
- `_`로 무시하지 않기

```go
// 올바른 예
file, err := os.Open("file.txt")
if err != nil {
    return fmt.Errorf("open file: %w", err)
}
defer file.Close()

// 잘못된 예
file, _ := os.Open("file.txt") // 에러 무시
```

### 에러 래핑
- `fmt.Errorf`와 `%w` 사용
- 에러 체인 유지

```go
func ProcessUser(id string) error {
    user, err := GetUser(id)
    if err != nil {
        return fmt.Errorf("process user: %w", err)
    }
    // ...
}
```

### 커스텀 에러
- 의미 있는 에러 타입 정의

```go
// 에러 타입 정의
type NotFoundError struct {
    ID string
}

func (e *NotFoundError) Error() string {
    return fmt.Sprintf("user not found: %s", e.ID)
}

// 사용
func GetUser(id string) (*User, error) {
    user, ok := users[id]
    if !ok {
        return nil, &NotFoundError{ID: id}
    }
    return user, nil
}
```

## 구조체

### 초기화
- 구조체 리터럴 사용
- 생성자 함수 제공

```go
// 구조체 정의
type User struct {
    ID        string
    Name      string
    CreatedAt time.Time
}

// 생성자 함수
func NewUser(id, name string) *User {
    return &User{
        ID:        id,
        Name:      name,
        CreatedAt: time.Now(),
    }
}

// 사용
user := NewUser("123", "John")
```

### 필드 태그
- JSON, DB 매핑 등에 사용

```go
type User struct {
    ID        string    `json:"id" db:"id"`
    FirstName string    `json:"first_name" db:"first_name"`
    LastName  string    `json:"last_name" db:"last_name"`
    Email     string    `json:"email" db:"email"`
    CreatedAt time.Time `json:"created_at" db:"created_at"`
}
```

## 함수

### 짧은 함수 선호
- 한 가지 일만 수행
- 명확한 함수명

```go
// 올바른 예
func validateEmail(email string) error {
    if !strings.Contains(email, "@") {
        return fmt.Errorf("invalid email: %s", email)
    }
    return nil
}

func createUser(name, email string) (*User, error) {
    if err := validateEmail(email); err != nil {
        return nil, err
    }
    return &User{Name: name, Email: email}, nil
}
```

### 여러 반환값
- 에러와 함께 값 반환
- Named return values (필요 시)

```go
// 일반 반환
func Divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}

// Named return (복잡한 경우)
func ProcessData(data []byte) (result string, count int, err error) {
    // ...
    return
}
```

## 동시성

### Goroutine
- 명시적으로 goroutine 시작
- WaitGroup 또는 channel로 동기화

```go
// WaitGroup 사용
var wg sync.WaitGroup

for i := 0; i < 10; i++ {
    wg.Add(1)
    go func(id int) {
        defer wg.Done()
        processItem(id)
    }(i)
}

wg.Wait()
```

### Channel
- 채널로 통신
- 적절한 버퍼 크기 설정

```go
// Unbuffered channel
ch := make(chan int)

// Buffered channel
ch := make(chan int, 10)

// 사용
go func() {
    ch <- 42
}()

value := <-ch
```

### Context
- 타임아웃, 취소에 context 사용

```go
func FetchData(ctx context.Context, url string) ([]byte, error) {
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    return io.ReadAll(resp.Body)
}

// 사용
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

data, err := FetchData(ctx, "https://api.example.com")
```

## 인터페이스

### 작은 인터페이스
- 필요한 메서드만 정의
- 인터페이스는 사용하는 쪽에서 정의

```go
// 올바른 예 - 작은 인터페이스
type Reader interface {
    Read(p []byte) (n int, err error)
}

type Closer interface {
    Close() error
}

// 조합
type ReadCloser interface {
    Reader
    Closer
}
```

### 암시적 구현
- 명시적 implements 없음
- 메서드만 구현하면 자동으로 인터페이스 충족

```go
type Animal interface {
    Speak() string
}

type Dog struct {
    Name string
}

// 암시적으로 Animal 인터페이스 구현
func (d Dog) Speak() string {
    return "Woof!"
}

// 사용
var animal Animal = Dog{Name: "Buddy"}
```

## 테스팅

### 테스트 파일
- `_test.go` 접미사
- 같은 패키지에 위치

```go
// user.go
package user

type User struct {
    Name string
}

// user_test.go
package user

import "testing"

func TestUser(t *testing.T) {
    user := User{Name: "John"}
    if user.Name != "John" {
        t.Errorf("expected John, got %s", user.Name)
    }
}
```

### 테이블 주도 테스트
- 여러 케이스를 표로 정의

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive numbers", 1, 2, 3},
        {"negative numbers", -1, -2, -3},
        {"zero", 0, 0, 0},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d",
                    tt.a, tt.b, result, tt.expected)
            }
        })
    }
}
```

### 벤치마크
- `Benchmark` 접두사

```go
func BenchmarkFibonacci(b *testing.B) {
    for i := 0; i < b.N; i++ {
        Fibonacci(10)
    }
}
```

## 자동화 도구

### 필수 도구
```bash
# 코드 포맷팅
go fmt ./...
goimports -w .

# 린팅
golangci-lint run

# 테스트
go test ./...
go test -race ./...  # race detector

# 벤치마크
go test -bench=.

# 커버리지
go test -cover ./...
```

### golangci-lint
- 여러 린터를 통합한 도구
- 프로젝트 표준으로 권장

```yaml
# .golangci.yml
linters:
  enable:
    - gofmt
    - golint
    - govet
    - errcheck
    - staticcheck
```

## 모범 사례

### Zero Values
- Zero value가 유용하도록 설계

```go
// 올바른 예
var mu sync.Mutex  // 바로 사용 가능
var buf bytes.Buffer  // 바로 사용 가능
```

### 포인터 vs 값
- 작은 구조체: 값 전달
- 큰 구조체 또는 수정 필요: 포인터 전달

```go
// 작은 구조체 - 값 전달
func (p Point) Distance(other Point) float64 {
    // ...
}

// 수정이 필요한 경우 - 포인터
func (u *User) UpdateName(name string) {
    u.Name = name
}
```

### Defer
- 리소스 정리에 사용

```go
func ReadFile(path string) ([]byte, error) {
    file, err := os.Open(path)
    if err != nil {
        return nil, err
    }
    defer file.Close()  // 함수 종료 시 자동 닫기

    return io.ReadAll(file)
}
```

## 참고 자료
- [Effective Go](https://go.dev/doc/effective_go)
- [Google Go Style Guide](https://google.github.io/styleguide/go/)
- [Uber Go Style Guide](https://github.com/uber-go/guide/blob/master/style.md)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
