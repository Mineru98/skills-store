# PyAutoGUI & OpenCV Integration Best Practices

PyAutoGUI의 마우스/키보드 제어력과 OpenCV의 초고속·고정밀 이미지 분석력을 결합하여 최상위 수준의 안정성을 갖춘 GUI 자동화 프로그램을 설계하는 핵심 패턴 가이드입니다 [1] [2].

---

## 1. 초고속 화면 캡처 및 전처리 패턴

PyAutoGUI의 순수 이미지 매칭은 내부적으로 다소 무겁게 작동하여 화면이 빠르게 변하는 동적인 환경(게임, 비디오 재생 등)에서는 오작동하기 쉽습니다 [10]. Pillow의 `ImageGrab`을 활용해 메모리 상에서 직접 화면을 캡처한 후, OpenCV의 넘파이(Numpy) 배열로 고속 변환해 다루는 구조를 강력히 권장합니다 [2].

```python
import cv2
import numpy as np
from PIL import ImageGrab

def get_high_speed_screen(region=None):
    """
    Pillow ImageGrab을 사용해 특정 영역 또는 전체 화면을 초고속으로 가져온 뒤
    OpenCV BGR 포맷 배열로 즉시 변환합니다.
    """
    bbox = None
    if region is not None:
        # region: (left, top, width, height) -> bbox: (left, top, right, bottom)
        bbox = (region[0], region[1], region[0] + region[2], region[1] + region[3])
        
    # 초고속 메모리 캡처 수행
    screenshot = ImageGrab.grab(bbox=bbox)
    # Numpy 배열 변환 및 BGR 채널 정렬
    return cv2.cvtColor(np.array(screenshot), cv2.COLOR_RGB2BGR)
```

---

## 2. 정밀 템플릿 매칭과 점진적 임계값 완화 (Adaptive Threshold)

단순 일회성 매칭은 화면 로딩 속도나 렌더링 미세 오차로 인해 `ImageNotFoundException`을 쉽게 유발합니다 [1]. 대기 시간 동안 매칭 임계값(`threshold`)을 점진적으로 완화하며 대상을 찾는 설계 패턴을 적용하면 예외 발생률을 비약적으로 낮출 수 있습니다 [2].

```python
import time
import cv2
import pyautogui

def wait_and_click_adaptive(template_path, timeout=10, initial_confidence=0.95):
    """
    템플릿 이미지를 화면에서 검색하며, 찾을 때까지 점진적으로 임계값(confidence)을 완화합니다.
    """
    start_time = time.time()
    confidence = initial_confidence
    template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
    h, w = template.shape[:2]

    while True:
        # 고속 화면 캡처 및 그레이스케일 변환
        screen = cv2.cvtColor(get_high_speed_screen(), cv2.COLOR_BGR2GRAY)
        
        # 템플릿 매칭 수행
        res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        if max_val >= confidence:
            # 매칭 성공 시 중심점 계산 후 클릭
            center_x = max_loc[0] + int(w / 2)
            center_y = max_loc[1] + int(h / 2)
            pyautogui.click(center_x, center_y)
            return True

        if time.time() - start_time > timeout:
            print(f"시간 초과: {template_path} 매칭 실패 (최대 유사도: {max_val:.4f})")
            return False

        # 매 시도마다 임계값을 조금씩 낮추어 일치 유연성 확보 (최소 0.65)
        confidence = max(0.65, confidence - 0.02)
        time.sleep(0.3)
```

---

## 3. 다중 객체 검출 및 중복 좌표 필터링 패턴

화면에 동일한 아이콘이나 타겟이 여러 개 존재하는 경우(예: 웹 페이지의 다중 체크박스, 게임 내 몬스터 등), `minMaxLoc`은 단 하나의 최적 위치만 반환하므로 사용할 수 없습니다 [1]. 이럴 때는 `np.where`를 사용하여 임계값 이상인 모든 위치를 검출한 뒤, 근접 좌표 간 중복을 제거하는 Non-Maximum Suppression(NMS) 기법을 단순화하여 필터링해야 합니다 [1].

```python
def locate_all_targets(template_path, threshold=0.85):
    """
    화면 내에서 템플릿 이미지와 일치하는 모든 고유 좌표 목록을 반환합니다.
    """
    template = cv2.imread(template_path, cv2.IMREAD_GRAYSCALE)
    h, w = template.shape[:2]
    
    screen = cv2.cvtColor(get_high_speed_screen(), cv2.COLOR_BGR2GRAY)
    res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
    
    # 임계값을 넘는 모든 픽셀 좌표 추출
    loc = np.where(res >= threshold)
    raw_points = []
    for pt in zip(*loc[::-1]):
        raw_points.append((pt[0] + int(w/2), pt[1] + int(h/2)))
        
    if not raw_points:
        return []

    # 근접한 중복 좌표 필터링 (동일 객체에 대해 수십 개의 매칭점이 발생하는 현상 제거)
    unique_points = [raw_points[0]]
    for p in raw_points[1:]:
        # 기존 유니크 포인트들과의 가로/세로 거리가 템플릿 크기의 절반 이상인 경우만 새 객체로 인정
        if all(abs(p[0] - u[0]) > w/2 or abs(p[1] - u[1]) > h/2 for u in unique_points):
            unique_points.append(p)
            
    return unique_points
```

---

## 4. 멀티스레딩(Multithreading)을 통한 병렬 파이프라인 구축

인식 연산과 제어 연산이 단일 스레드에서 동기적으로 일어나면, 화면 분석 중(약 0.1~0.5초 소요) 마우스 제어가 멈추거나 마우스 이동 및 클릭 대기 시간(예: 로딩 대기 `time.sleep`) 동안 화면 인식이 완전히 멈추는 병목 현상이 발생합니다 [8]. 

따라서 **화면 캡처 및 이미지 분석 스레드**와 **마우스/키보드 제어 스레드**를 철저히 분리하고, 스레드 간 데이터 공유 시 `threading.Lock`을 통해 데이터 레이스(Data Race)를 원천 차단하는 병렬 아키텍처 설계를 권장합니다 [8].

```python
import threading
import time

class ScreenDetector(threading.Thread):
    """별도 스레드에서 화면을 무한 루프로 분석하여 최신 타겟 좌표를 유지하는 검출기 클래스"""
    def __init__(self, template_path):
        super().__init__()
        self.template_path = template_path
        self.target_pos = None
        self.running = True
        self.lock = threading.Lock() # 스레드 안전성 확보를 위한 락

    def run(self):
        while self.running:
            # 고속 검출 수행
            points = locate_all_targets(self.template_path, threshold=0.85)
            
            self.lock.acquire()
            if points:
                self.target_pos = points[0] # 가장 첫 번째 타겟 좌표 저장
            else:
                self.target_pos = None
            self.lock.release()
            
            time.sleep(0.1) # CPU 과점 방지를 위한 미세 대기

    def get_target(self):
        self.lock.acquire()
        pos = self.target_pos
        self.lock.release()
        return pos

    def stop(self):
        self.running = False
```
