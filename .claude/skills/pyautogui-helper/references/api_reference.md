# PyAutoGUI API Reference

이 문서는 PyAutoGUI의 핵심 API 기능과 사용법을 정리한 참고 자료입니다.

## 1. 기본 설정 및 정보 (General & Fail-Safe)

| API | 설명 | 반환 값 / 사용법 |
|---|---|---|
| `pyautogui.size()` | 기본 모니터의 화면 해상도를 가져옵니다. | `(width, height)` 튜플 |
| `pyautogui.position()` | 마우스 커서의 현재 XY 좌표를 가져옵니다. | `(x, y)` 튜플 |
| `pyautogui.onScreen(x, y)` | 지정한 XY 좌표가 화면 범위 내에 있는지 확인합니다. | `True` / `False` |
| `pyautogui.PAUSE` | 모든 PyAutoGUI 함수 호출 후의 지연 시간(초)을 설정합니다. | 기본값 `0.1` |
| `pyautogui.FAILSAFE` | 마우스를 화면의 네 모서리 중 하나로 이동 시 예외를 발생시켜 프로그램을 강제 종료하는 안전 장치입니다. | 기본값 `True` (비활성화 금지 권장) |

## 2. 마우스 제어 (Mouse Control)

* **이동 및 드래그**
  * `pyautogui.moveTo(x, y, duration=0.0, tween=pyautogui.linear)`: 지정한 좌표로 마우스를 이동합니다. `None`을 입력하면 해당 축의 현재 위치를 유지합니다.
  * `pyautogui.move(xOffset, yOffset, duration=0.0)`: 현재 위치를 기준으로 상대적으로 마우스를 이동합니다. (구 버전의 `moveRel`과 동일)
  * `pyautogui.dragTo(x, y, duration=0.0, button='left')`: 마우스 버튼을 누른 채 지정한 좌표로 드래그합니다.
  * `pyautogui.drag(xOffset, yOffset, duration=0.0, button='left')`: 현재 위치를 기준으로 상대 드래그를 수행합니다. (구 버전의 `dragRel`과 동일)

* **클릭 및 스크롤**
  * `pyautogui.click(x=None, y=None, clicks=1, interval=0.0, button='left')`: 지정 좌표(또는 현재 위치)에서 클릭을 수행합니다. `button`은 `'left'`, `'middle'`, `'right'`를 지원합니다.
  * `pyautogui.doubleClick()`, `pyautogui.tripleClick()`, `pyautogui.rightClick()`: 더블클릭, 트리플클릭, 우클릭 편의 함수입니다.
  * `pyautogui.mouseDown()`, `pyautogui.mouseUp()`: 마우스 버튼을 누르거나 떼는 개별 이벤트를 처리합니다.
  * `pyautogui.scroll(clicks, x=None, y=None)`: 마우스 휠 스크롤을 수행합니다. 양수는 위로, 음수는 아래로 스크롤합니다.

* **감속/가속 함수 (Tweening/Easing)**
  * `pyautogui.easeInQuad`: 느리게 시작해서 빠르게 끝남
  * `pyautogui.easeOutQuad`: 빠르게 시작해서 느리게 끝남
  * `pyautogui.easeInOutQuad`: 처음과 끝은 빠르고 중간은 느림
  * `pyautogui.easeInBounce`: 끝에서 튕김 효과
  * `pyautogui.easeInElastic`: 고무줄처럼 끝에서 흔들림

## 3. 키보드 제어 (Keyboard Control)

* **텍스트 입력**
  * `pyautogui.write(message, interval=0.0)`: 문자열을 입력합니다. `interval`을 통해 글자 간 지연 시간을 줄 수 있습니다. (구 버전의 `typewrite`와 동일하나 `write` 사용 권장)
  * *주의*: `write()`는 영문 레이아웃(US) 기준이므로 한글이나 특수문자 입력 시 오작동할 수 있습니다.

* **단일 키 및 단축키**
  * `pyautogui.press(key, presses=1, interval=0.0)`: 지정한 키를 누릅니다. `KEYBOARD_KEYS`에 정의된 특수 키 이름을 사용할 수 있습니다. (예: `'enter'`, `'esc'`, `'f1'`)
  * `pyautogui.keyDown(key)`, `pyautogui.keyUp(key)`: 키를 누르거나 떼는 개별 이벤트를 처리합니다.
  * `pyautogui.hold(key)`: `with` 문과 함께 사용하여 블록 내에서 특정 키를 누르고 있는 상태를 유지하는 컨텍스트 매니저입니다.
  * `pyautogui.hotkey(*keys, interval=0.0)`: 여러 키를 순서대로 누른 뒤 역순으로 떼어 단축키를 실행합니다. (예: `pyautogui.hotkey('ctrl', 'c')`)

## 4. 스크린샷 및 이미지 인식 (Screenshot & Image Recognition)

* **스크린샷**
  * `pyautogui.screenshot(imageFilename=None, region=None)`: 화면 전체 또는 지정 영역(`(left, top, width, height)`)을 캡처하여 Pillow Image 객체로 반환하고, 파일명이 지정되면 저장합니다.

* **이미지 검색 (Locate)**
  * *주의*: 0.9.41 버전 이후부터 이미지를 찾지 못하면 `None` 대신 `pyautogui.ImageNotFoundException`을 발생시킵니다.
  * `pyautogui.locateOnScreen(image, grayscale=False, confidence=None, region=None)`: 화면에서 이미지와 일치하는 첫 번째 영역의 `(left, top, width, height)`를 반환합니다. `confidence` 옵션을 쓰려면 `opencv-python`이 설치되어 있어야 합니다.
  * `pyautogui.locateCenterOnScreen(image, grayscale=False, confidence=None, region=None)`: 찾은 이미지 영역의 중심부 `(x, y)` 좌표를 반환합니다.
  * `pyautogui.locateAllOnScreen(image, grayscale=False, confidence=None, region=None)`: 일치하는 모든 영역의 좌표를 생성하는 제너레이터(Generator)를 반환합니다.

## 5. 메시지 박스 (Message Box)

사용자와 상호작용하기 위한 크로스플랫폼 GUI 팝업 창을 제공합니다.

* `pyautogui.alert(text='', title='', button='OK')`: 메시지와 OK 버튼이 있는 간단한 알림창을 띄웁니다.
* `pyautogui.confirm(text='', title='', buttons=['OK', 'Cancel'])`: 선택 버튼이 있는 확인창을 띄우고, 클릭한 버튼의 텍스트를 반환합니다.
* `pyautogui.prompt(text='', title='', default='')`: 텍스트 입력창을 제공하고 입력된 문자열을 반환합니다. 취소 시 `None`을 반환합니다.
* `pyautogui.password(text='', title='', default='', mask='*')`: 입력 내용이 마스킹 처리되는 비밀번호 입력창을 제공합니다.
