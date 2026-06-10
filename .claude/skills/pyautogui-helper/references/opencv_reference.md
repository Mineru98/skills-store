# OpenCV Screen Recognition API Reference

이 문서는 GUI 자동화 강화에 필수적인 OpenCV(Open Source Computer Vision)의 핵심 화면 인식 API와 파라미터 명세를 정리한 참고 자료입니다 [1].

## 1. 이미지 읽기 및 색상 변환 (Image I/O & Color Conversion)

| API | 설명 | 주요 파라미터 및 반환값 |
|---|---|---|
| `cv2.imread(filename, flags)` | 이미지를 파일에서 로드합니다 [1]. | `flags`: `cv2.IMREAD_COLOR` (기본 BGR), `cv2.IMREAD_GRAYSCALE` (단색) |
| `cv2.cvtColor(src, code)` | 이미지의 색상 공간을 변환합니다 [3]. | `code`: `cv2.COLOR_BGR2GRAY` (그레이스케일), `cv2.COLOR_BGR2HSV` (색상 추출용) |
| `cv2.inRange(src, lowerb, upperb)` | 지정한 범위 내의 픽셀만 흰색(255), 나머지는 검은색(0)으로 하는 마스크를 생성합니다 [3]. | `lowerb`/`upperb`: HSV 또는 BGR 범위 경계 (Numpy Array 형태) |

---

## 2. 템플릿 매칭 (Template Matching)

큰 이미지(Haystack) 내에서 작은 이미지(Needle)를 슬라이딩하며 가장 유사한 위치를 찾는 핵심 알고리즘입니다 [1].

```python
result = cv2.matchTemplate(image, templ, method)
min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)
```

### 템플릿 매칭 비교 메서드 (`method`) [1]

| 메서드 상수 | 설명 | 최적의 매칭 위치 결정 |
|---|---|---|
| `cv2.TM_CCOEFF_NORMED` | 상관계수 매칭을 정규화한 방식으로, 조명 변화에 가장 강건하여 **기본값으로 강력히 권장**됩니다. | `max_loc` (최대값 위치) |
| `cv2.TM_CCORR_NORMED` | 정규화된 상호 상관 매칭 방식으로 패턴 인식에 자주 쓰입니다. | `max_loc` (최대값 위치) |
| `cv2.TM_SQDIFF_NORMED` | 정규화된 제곱 차이 매칭 방식으로 값이 작을수록 일치합니다. | `min_loc` (최소값 위치) |

### 위치 추출 (`cv2.minMaxLoc`) [1]
* **설명**: 매칭 결과 행렬에서 전역 최소값과 최대값, 그리고 그 위치 좌표를 반환합니다.
* **다중 객체 검출**: 화면 내 동일한 아이콘이 여러 개 존재할 때는 `minMaxLoc` 대신 `np.where(result >= threshold)`를 활용하여 임계값을 넘는 모든 매칭 좌표를 추출합니다 [1].

---

## 3. 이미지 전처리 및 노이즈 제거 (Preprocessing & Blurring)

매칭 정확도를 높이고 오작동을 줄이기 위해 원본 화면 캡처본을 정제하는 기법입니다 [6].

* **블러링 (Smoothing)**
  * `cv2.GaussianBlur(src, ksize, sigmaX)`: 가우시안 노이즈 제거에 탁월하며, 템플릿 매칭 전에 디테일 노이즈를 뭉개는 데 효과적입니다 [6].
  * `cv2.medianBlur(src, ksize)`: 소금-후추(Salt-and-Pepper) 형태의 점박이 노이즈를 완벽히 제거합니다 [6].
  * `cv2.bilateralFilter(src, d, sigmaColor, sigmaSpace)`: 에지(경계선)는 선명하게 유지하면서 내부 텍스처 노이즈만 제거하므로 UI 경계 분석 시 유용합니다 [6].
* **임계값 처리 (Binarization)**
  * `cv2.threshold(src, thresh, maxval, type)`: 고정 임계값으로 이미지를 이진화(흑백)합니다 [5]. `cv2.THRESH_OTSU` 플래그를 추가하면 최적 임계값을 자동 계산합니다 [5].
  * `cv2.adaptiveThreshold(src, maxValue, adaptiveMethod, thresholdType, blockSize, C)`: 조명이 불균일한 화면 영역에서 주변 픽셀값 분포를 기반으로 국소 이진화를 수행합니다 [5].
* **모폴로지 연산 (Morphological Operations)**
  * `cv2.morphologyEx(src, op, kernel)`: 침식(Erosion)과 팽창(Dilation)을 결합하여 노이즈를 제거하거나 구멍을 메웁니다 [4].
    * `cv2.MORPH_OPEN`: 열기 연산(침식 후 팽창). 미세한 흰색 노이즈 제거에 적합합니다 [4].
    * `cv2.MORPH_CLOSE`: 닫기 연산(팽창 후 침식). UI 내부의 미세한 검은 구멍이나 끊어진 선을 메우는 데 적합합니다 [4].

---

## 4. 고급 인식: 특징점 검출 및 매칭 (Feature Matching)

크기 변화(Scale)나 회전(Rotation)이 발생하는 동적인 GUI 환경 또는 게임 화면에서 고유한 특징점을 추출해 대상을 식별합니다 [2].

* **ORB (Oriented FAST and Rotated BRIEF)**
  * **설명**: 특허료가 없는 고성능 초고속 특징점 검출 알고리즘으로 실시간 자동화에 가장 적합합니다 [7].
  * **객체 생성**: `orb = cv2.ORB_create(nfeatures=500)` [7]
  * **검출 및 계산**: `keypoints, descriptors = orb.detectAndCompute(image, mask)` [2]
* **BFMatcher (Brute-Force Matcher)**
  * **설명**: 첫 번째 이미지의 특징점 디스크립터를 두 번째 이미지의 모든 특징점과 1:1로 거리 비교하여 가장 유사한 쌍을 찾습니다 [2].
  * **객체 생성**: `bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)` (ORB 디스크립터 매칭 시 반드시 `cv2.NORM_HAMMING` 거리를 사용해야 함) [2] [7].
  * **매칭 수행**: `matches = bf.match(des1, des2)` [2]
