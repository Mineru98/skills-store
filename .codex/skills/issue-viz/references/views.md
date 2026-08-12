# 뷰와 시각 인코딩

## 시각 인코딩

**노드**
```text
색      status:  open=파랑 / plan=노랑 / in-process=초록 / review=보라 / close=회색(흐림)
모양    backend 라벨=사각형, frontend 라벨=원, 그 외=원
테두리  ready 이면 굵게, critical-path 이면 검은 테두리
투명도  close(done) 는 흐리게
```

**엣지**
```text
depends-on  빨강 실선 + 화살표   (순서 제약)
blocks      주황 실선 + 화살표   (순서 제약)
relates-to  회색 점선           (정보성)
parent-of   하늘 점선
duplicate-of 연회색 점선
```

화살표는 `from → to` 방향. `from --depends-on--> to` = "from 은 to 가 close 전엔 착수 불가".

## 뷰

상단 컨트롤로 전환한다. 상태 표시줄에 현재 뷰와 보이는 노드 수가 나온다.

```text
전체 (full)          모든 노드·엣지
착수 가능 (ready)     ready-frontier — 선행이 전부 close 인 open 이슈만
임계 경로 (critical)  최장 의존 사슬에 속한 노드만
ego                  입력한 이슈 번호 + N홉 이웃만 (semantica ego-mode)
```

- ego 뷰: 상단 `#번호` 입력 후 Enter 또는 ego 버튼.
- 분류 규칙은 issue-onboard 의 plan 과 같다(선행이 전부 close 여야 ready).

## 상호작용

```text
hover   노드: 제목·상태·분류·라벨 / 엣지: from --type--> to (근거)
click   노드의 이슈 URL 을 새 탭으로 연다
```

## 증거로 남길 때

브라우저로 열어 최소 2개 뷰(전체 + 착수가능 또는 임계경로)를 스크린샷(webp)으로 남긴다.
헤드리스 크롬으로도 캡처할 수 있다.

```bash
"Google Chrome" --headless=new --window-size=1440,900 --virtual-time-budget=1500 \
  --screenshot=/tmp/viz.png "file://$PWD/.issue/viz/graph.html"
cwebp -q 82 /tmp/viz.png -o evidence/after/viz.webp
```
