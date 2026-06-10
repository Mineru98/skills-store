import time
import cv2
import numpy as np
import pyautogui
import pyperclip
from PIL import ImageGrab

# 기본 안전 설정 적용
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.1

def get_screen_info():
    """현재 화면의 해상도와 마우스 위치를 반환합니다."""
    width, height = pyautogui.size()
    x, y = pyautogui.position()
    return {
        "resolution": (width, height),
        "mouse_position": (x, y),
        "is_on_screen": pyautogui.onScreen(x, y)
    }

def safe_type(text, is_mac=False):
    """
    한글 및 특수문자가 포함된 문자열을 클립보드를 통해 안전하게 붙여넣어 입력합니다.
    """
    pyperclip.copy(text)
    modifier = 'command' if is_mac else 'ctrl'
    pyautogui.hotkey(modifier, 'v')

def hold_key_for_duration(key, duration):
    """
    지정한 키를 일정 시간 동안 누르고 있도록 제어합니다.
    """
    with pyautogui.hold(key):
        pyautogui.sleep(duration)

def capture_screen_opencv(region=None):
    """
    Pillow의 ImageGrab을 사용하여 화면(또는 지정 영역)을 캡처하고
    OpenCV에서 바로 사용할 수 있는 BGR 넘파이 배열로 변환합니다.
    """
    # region: (left, top, width, height) -> bbox: (left, top, right, bottom)
    bbox = None
    if region is not None:
        bbox = (region[0], region[1], region[0] + region[2], region[1] + region[3])
    
    screenshot = ImageGrab.grab(bbox=bbox)
    open_cv_image = np.array(screenshot)
    # RGB에서 OpenCV 표준인 BGR로 색상 채널 변경
    return cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2BGR)

def locate_on_screen_opencv(template_path, threshold=0.9, region=None, use_gray=True):
    """
    OpenCV의 템플릿 매칭(TM_CCOEFF_NORMED)을 사용하여 대상을 초고속으로 정밀 검색합니다.
    기본 PyAutoGUI 검색보다 속도가 빠르고 세밀한 정확도 조절이 가능합니다.
    """
    # 1. 대상 템플릿 이미지 로드
    template_flag = cv2.IMREAD_GRAYSCALE if use_gray else cv2.IMREAD_COLOR
    template = cv2.imread(template_path, template_flag)
    if template is None:
        raise FileNotFoundError(f"템플릿 이미지를 읽을 수 없습니다: {template_path}")
    
    h, w = template.shape[:2]

    # 2. 현재 화면 캡처 및 전처리
    screen = capture_screen_opencv(region=region)
    if use_gray:
        screen = cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY)

    # 3. 템플릿 매칭 수행
    res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

    # 4. 임계값 검증 및 좌표 계산
    if max_val >= threshold:
        # 매칭된 영역의 중심점 좌표 계산
        center_x = max_loc[0] + int(w / 2)
        center_y = max_loc[1] + int(h / 2)
        
        # region이 설정되어 있었을 경우 전체 화면 기준 절대 좌표로 복원
        if region is not None:
            center_x += region[0]
            center_y += region[1]
            
        return (center_x, center_y), max_val
    return None, max_val

def wait_and_click_opencv(template_path, timeout=10, initial_threshold=0.95, region=None):
    """
    OpenCV 기반 템플릿 매칭을 사용하여 대상이 화면에 나타날 때까지 대기 후 클릭합니다.
    정확도(threshold) 임계값을 점진적으로 조절하여 유연한 매칭을 보장합니다.
    """
    start_time = time.time()
    curr_threshold = initial_threshold
    
    while True:
        pos, max_val = locate_on_screen_opencv(template_path, threshold=curr_threshold, region=region)
        if pos is not None:
            pyautogui.click(pos[0], pos[1])
            return True
            
        if time.time() - start_time > timeout:
            print(f"[오류] 이미지 인식 시간 초과: {template_path} (최대 매칭값: {max_val:.4f})")
            return False
            
        # 매칭 임계값을 서서히 낮추며 재시도 (최소 0.65까지 완화)
        curr_threshold = max(0.65, curr_threshold - 0.02)
        time.sleep(0.3)

def locate_all_on_screen_opencv(template_path, threshold=0.85, region=None, use_gray=True):
    """
    화면에 존재하는 동일한 템플릿 이미지의 모든 매칭 위치를 찾아 중심 좌표 리스트로 반환합니다.
    중복 매칭을 필터링하기 위해 Non-Maximum Suppression과 유사한 근접 좌표 그룹화 처리를 수행합니다.
    """
    template_flag = cv2.IMREAD_GRAYSCALE if use_gray else cv2.IMREAD_COLOR
    template = cv2.imread(template_path, template_flag)
    if template is None:
        raise FileNotFoundError(f"템플릿 이미지를 읽을 수 없습니다: {template_path}")
    
    h, w = template.shape[:2]
    screen = capture_screen_opencv(region=region)
    if use_gray:
        screen = cv2.cvtColor(screen, cv2.COLOR_BGR2GRAY)

    res = cv2.matchTemplate(screen, template, cv2.TM_CCOEFF_NORMED)
    loc = np.where(res >= threshold)
    
    points = []
    for pt in zip(*loc[::-1]): # x, y 좌표
        center_x = pt[0] + int(w / 2)
        center_y = pt[1] + int(h / 2)
        if region is not None:
            center_x += region[0]
            center_y += region[1]
        points.append((center_x, center_y))
        
    # 근접 좌표 중복 제거 (단순 필터링)
    if not points:
        return []
        
    unique_points = [points[0]]
    for p in points[1:]:
        # 기존 유니크 포인트들과의 거리가 템플릿 크기 절반 이상인 경우만 추가
        if all(abs(p[0] - u[0]) > w/2 or abs(p[1] - u[1]) > h/2 for u in unique_points):
            unique_points.append(p)
            
    return unique_points

if __name__ == "__main__":
    # 헬퍼 유틸리티 모듈 동작 테스트
    info = get_screen_info()
    print(f"화면 해상도: {info['resolution']}")
    print(f"현재 마우스 위치: {info['mouse_position']}")
