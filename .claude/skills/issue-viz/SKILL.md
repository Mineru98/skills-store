---
name: issue-viz
description: issue-onboard 그래프를 오프라인 HTML과 webp 이미지로 렌더합니다. "이슈 그래프 그려줘", "DAG 시각화", "그래프 이미지", "/issue-viz" 요청에 사용합니다.
---

# Issue Viz

`.issue/graph.json`을 읽어 자립형 HTML과 선택적 webp 이미지를 만든다. 그래프를 수정하지 않는다.

그래프가 없으면 `issue-sync`를 먼저 실행한다.

```bash
node <issue-viz>/scripts/issue-viz.mjs render \
  --out .issue/viz/graph.html \
  --image-out .issue/viz/graph.webp
```

출력 HTML은 브라우저에서 상호작용하고, webp는 사용자에게 바로 보여 줄 수 있는 정적 이미지다.
온보딩 전체 흐름과 우선순위 추천은 `issue-onboard`가 담당한다.
