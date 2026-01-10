# Python 코딩 컨벤션 (PEP 8)

## 개요
PEP 8은 Python의 공식 스타일 가이드로, 2001년 Guido van Rossum, Barry Warsaw, Alyssa Coghlan에 의해 작성되었습니다. 코드는 작성하는 것보다 읽는 횟수가 훨씬 많기 때문에, 가독성과 일관성을 높이는 것이 목표입니다.

## 핵심 원칙
- 코드는 작성하는 것보다 읽는 것이 훨씬 많다
- 일관성 있는 코드가 좋은 코드다
- 프로젝트 내에서 일관성 유지가 가장 중요하다

## 코드 레이아웃

### 들여쓰기
- **4개의 공백(space)**을 사용
- 탭(tab)은 사용하지 않음

```python
# 올바른 예
def long_function_name(
        var_one, var_two, var_three,
        var_four):
    print(var_one)
```

### 줄 길이
- 최대 **79자**로 제한
- 독스트링이나 주석은 **72자**로 제한

```python
# 긴 줄은 괄호를 사용하여 나눔
result = some_function_that_takes_arguments(
    'argument one', 'argument two',
    'argument three', 'argument four'
)
```

### 빈 줄
- 최상위 함수와 클래스 정의는 **2줄**로 구분
- 클래스 내 메서드 정의는 **1줄**로 구분

```python
class MyClass:
    """클래스 설명"""

    def first_method(self):
        pass

    def second_method(self):
        pass


def standalone_function():
    pass
```

### 임포트
- 각 임포트는 별도의 줄에 작성
- 임포트 순서: 표준 라이브러리 → 서드파티 → 로컬
- 각 그룹 사이에 빈 줄 추가

```python
# 올바른 예
import os
import sys

from subprocess import Popen, PIPE

from mypackage import mymodule
```

## 명명 규칙

### 변수와 함수
- **snake_case** 사용 (소문자 + 언더스코어)

```python
my_variable = 10
user_name = "John"

def calculate_total_price():
    pass
```

### 클래스
- **PascalCase** 사용 (각 단어의 첫 글자 대문자)

```python
class UserProfile:
    pass

class DataProcessor:
    pass
```

### 상수
- **UPPER_CASE_WITH_UNDERSCORES** 사용

```python
MAX_CONNECTIONS = 100
DEFAULT_TIMEOUT = 30
API_KEY = "your-api-key"
```

### 비공개(Private) 변수/메서드
- 앞에 언더스코어 1개: 내부 사용 표시
- 앞에 언더스코어 2개: Name mangling

```python
class MyClass:
    def __init__(self):
        self._internal_var = 1  # 내부 사용
        self.__private_var = 2  # Name mangling

    def _internal_method(self):
        pass

    def __private_method(self):
        pass
```

## 문자열

### 따옴표
- 작은따옴표와 큰따옴표 중 하나를 선택하여 일관성 유지
- 독스트링은 항상 큰따옴표 3개 사용

```python
# 둘 다 가능 (일관성 유지)
my_string = 'Hello'
another_string = "World"

def my_function():
    """이것은 독스트링입니다."""
    pass
```

## 공백

### 권장
- 연산자 주변, 쉼표 뒤, 콜론 뒤

```python
x = 1
y = 2
result = x + y

my_list = [1, 2, 3, 4]
my_dict = {'key': 'value'}
```

### 비권장
- 괄호 안쪽
- 쉼표/세미콜론/콜론 앞
- 함수 호출 괄호 앞

```python
# 잘못된 예
spam( ham[ 1 ], { eggs: 2 } )
func (arg)

# 올바른 예
spam(ham[1], {eggs: 2})
func(arg)
```

## 주석

### 블록 주석
- 코드와 같은 들여쓰기 수준
- `#` 뒤에 공백 하나

```python
# 이것은 블록 주석입니다.
# 여러 줄에 걸쳐 작성할 수 있습니다.
x = x + 1
```

### 인라인 주석
- 코드와 최소 2칸 공백
- 가급적 사용 자제

```python
x = x + 1  # 카운터 증가
```

### 독스트링
- 모든 공개 모듈, 함수, 클래스, 메서드에 작성

```python
def calculate_average(numbers):
    """
    숫자 리스트의 평균을 계산합니다.

    Args:
        numbers (list): 숫자들의 리스트

    Returns:
        float: 평균값
    """
    return sum(numbers) / len(numbers)
```

## 프로그래밍 권장사항

### 비교
- `None`과 비교할 때는 `is` 또는 `is not` 사용
- `not ...` 보다는 `... is not ...` 선호

```python
# 올바른 예
if x is not None:
    pass

# 잘못된 예
if not x is None:
    pass
```

### Boolean 비교
- Boolean 값을 `==`로 비교하지 않음

```python
# 올바른 예
if is_valid:
    pass

# 잘못된 예
if is_valid == True:
    pass
```

### 예외 처리
- 구체적인 예외를 명시
- bare `except:` 사용 자제

```python
# 올바른 예
try:
    value = int(input())
except ValueError:
    print("잘못된 입력입니다")

# 잘못된 예
try:
    value = int(input())
except:
    print("에러 발생")
```

## 도구

### 코드 검사
- **pycodestyle**: PEP 8 준수 확인
- **pylint**: 종합적인 코드 분석
- **flake8**: pycodestyle + pyflakes + mccabe

### 자동 포맷팅
- **autopep8**: PEP 8에 맞게 자동 수정
- **black**: 의견이 강한 코드 포맷터
- **yapf**: Google 스타일 포맷터

## 참고 자료
- [PEP 8 공식 문서](https://peps.python.org/pep-0008/)
- [Real Python PEP 8 가이드](https://realpython.com/python-pep8/)
- [DataCamp PEP 8 튜토리얼](https://www.datacamp.com/tutorial/pep8-tutorial-python-code)
