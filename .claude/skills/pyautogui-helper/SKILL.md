---
name: pyautogui-helper
description: PyAutoGUI와 OpenCV를 결합하여 화면 고속 캡처, 고정밀 템플릿 매칭, 멀티스레딩 병렬 제어 및 다국어 텍스트 입력 우회를 지원하는 강력한 GUI 자동화 스킬입니다.
---

# PyAutoGUI & OpenCV Helper

PyAutoGUI는 운영체제의 마우스와 키보드를 제어하고 화면 이미지를 분석하여 다양한 GUI 환경을 자동화할 수 있는 직관적인 라이브러리입니다 [1]. 하지만 단순한 API 호출만으로는 화면 로딩 지연, 이미지 해상도 미세 오차, 다국어 입력 오류, 그리고 실시간 화면 인식 시의 연산 병목 현상에 직면하게 됩니다 [3] [8].

이 스킬은 **PyAutoGUI의 강력한 제어 기능**과 **OpenCV의 초고속·고정밀 이미지 분석 기술**을 융합하여, 오작동 없이 안정적으로 구동되는 고품질 자동화 파이프라인을 구축하기 위한 최적의 개발 지침과 검증된 유틸리티를 제공합니다 [1] [2].

## 1. 핵심 사용 시나리오

이 스킬은 다음과 같은 고급 GUI 자동화가 필요한 프로젝트에서 필수적으로 사용됩니다:
* **고속 화면 분석 및 실시간 반응**: 프레임 변화가 빠른 게임이나 실시간 대시보드 화면을 캡처하고 대상을 지연 없이 검출해야 할 때 [8].
* **고정밀 이미지 검색 (Template Matching)**: 미세한 픽셀 오차나 압축 손실이 있는 이미지 환경에서 정확도 임계값(`threshold`)을 점진적으로 완화하며 대상을 검출할 때 [2].
* **다중 객체 동시 검출**: 화면 내 동일한 아이콘이나 체크박스가 여러 개 존재할 때 이를 모두 식별하고 중복 매칭 좌표를 정교하게 필터링할 때 [1].
* **멀티스레딩 기반 제어**: 화면 인식 연산과 마우스/키보드 제어 동작이 서로를 방해하지 않도록 병렬 처리 아키텍처를 설계할 때 [8].
* **안전장치 및 한글 입력 우회**: 제어권 상실을 방지하는 Fail-Safe 안전장치 설계 및 클립보드를 활용한 한글 타이핑이 필요할 때 [1] [3].

---

## 2. 권장 개발 워크플로우

PyAutoGUI와 OpenCV를 결합한 고성능 자동화 스크립트를 작성할 때는 다음 4단계 표준 프로세스를 준수하십시오.

```
+------------------------+      +------------------------+
| 1. 환경 구성 및 패키지  | ---> | 2. 안전 설정 및 초기화  |
+------------------------+      +------------------------+
                                             |
                                             v
+------------------------+      +------------------------+
| 4. 멀티스레딩 및 복구  | <--- | 3. 고속 캡처 및 매칭   |
+------------------------+      +------------------------+
```

### 1단계: 환경 구성 및 패키지 설치
* **필수 종속성**: 고성능 템플릿 매칭과 클립보드 제어를 위해 다음 패키지들을 사전에 설치하십시오.
  ```bash
  sudo pip3 install pyautogui opencv-python pyperclip pillow numpy
  ```
* **OS별 권한**: macOS 환경에서는 반드시 **시스템 설정 > 화면 기록** 권한을 부여하고 실행 앱을 재시작해야 캡처가 정상 작동합니다 [3].

### 2단계: 안전 설정 및 초기화
스크립트 오작동 시 시스템 제어권을 완전히 상실하는 무한 루프 사고를 방지하기 위해, 시작부에 전역 안전장치와 지연 시간을 명시적으로 설정하십시오 [1].
```python
import pyautogui
pyautogui.FAILSAFE = True  # 마우스를 모서리로 가져가면 강제 종료
pyautogui.PAUSE = 0.1       # 모든 제어 명령 사이에 0.1초 미세 지연 부여
```

### 3단계: 고속 화면 캡처 및 점진적 매칭 (LOCATE-INTERACT)
순수 PyAutoGUI 이미지 매칭 대신, Pillow `ImageGrab` 메모리 캡처와 OpenCV `matchTemplate`을 조합하여 성능을 극대화하십시오 [2].
```python
from scripts.pyautogui_utils import wait_and_click_opencv

# 'button.png' 이미지가 화면에 로드될 때까지 최대 10초 대기 후 정밀 클릭
# 매칭 감도(threshold)를 자동으로 완화하며 유연하게 검색합니다.
success = wait_and_click_opencv('button.png', timeout=10, initial_threshold=0.95)
```

### 4단계: 멀티스레딩 기반 병렬 제어 구현
실시간 검출 성능을 유지하기 위해 화면을 지속해서 캡처·분석하는 스레드와 마우스/키보드를 제어하는 스레드를 분리하고, 스레드 간 데이터 전송 시 락(`threading.Lock`)을 걸어 동기화하십시오 [8].

---

## 3. 리소스 및 레퍼런스 안내

효과적인 개발을 위해 이 스킬에 내장된 상세 레퍼런스와 유틸리티 코드를 적극적으로 활용하십시오.

* **PyAutoGUI 핵심 API 레퍼런스**: [api_reference.md](references/api_reference.md)
  * 마우스 좌표계, 클릭 제어, 키보드 단축키 맵, 메시지 박스 등 기본 제어 명세.
* **OpenCV 화면 인식 API 레퍼런스**: [opencv_reference.md](references/opencv_reference.md)
  * 그레이스케일 변환, 템플릿 매칭 방식(`TM_CCOEFF_NORMED`), 이미지 블러링 및 이진화, ORB 특징점 검출 등 핵심 비전 API 상세 정리.
* **실전 문제 해결 및 고급 설계 패턴**: [best_practices.md](references/best_practices.md)
  * 고속 캡처 기법, 점진적 매칭 감도 제어 코드, 다중 객체 중복 제거 알고리즘 및 멀티스레딩 병렬 검출기 설계 가이드.
* **검증된 유틸리티 코드**: [pyautogui_utils.py](scripts/pyautogui_utils.py)
  * 화면 정보 획득, OpenCV 고속 캡처, 다중 객체 좌표 검출 및 안전한 한글 입력 기능이 즉시 구현된 완성형 유틸리티 스크립트.

---

## References
* [1] [PyAutoGUI Documentation](https://pyautogui.readthedocs.io/en/latest/) - PyAutoGUI 공식 사용자 가이드 및 API 개요
* [2] [PyAutoGUI Design Pattern](https://cardboardcode.github.io/PyAutoGUIDesignPattern/) - LOCATE-INTERACT 디자인 패턴 및 안정적인 이미지 매칭 설계
* [3] [PyAutoGUI Common Problems and Fixes](https://manuellevi.com/pyautogui-problems/) - OS별 권한 설정 및 다국어 입력 오류 해결을 위한 실전 트러블슈팅 가이드
* [8] [How To Build a Bot with OpenCV](https://learncodebygaming.com/blog/how-to-build-a-bot-with-opencv) - OpenCV 객체 검출과 PyAutoGUI 제어, 멀티스레딩(Threading) 연동 실전 가이드
