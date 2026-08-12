# render — HTML 생성

```bash
node <skill>/scripts/issue-viz.mjs render [옵션]
```

`.issue/graph.json` 을 읽어 **자립형 HTML 1파일**을 만든다. 그래프 데이터를 HTML 안에 인라인으로
임베드하고, force-directed 시뮬레이션·렌더·컨트롤을 바닐라 JS 로 넣는다. 외부 CDN 을 쓰지 않아
오프라인에서도 열린다.

## 옵션

```text
--out <path>      출력 경로 (기본 .issue/viz/graph.html)
--view <mode>     초기 뷰: full | ready | critical-path | ego (기본 full)
--focus <n>       ego 뷰의 중심 이슈 번호
--open            생성 후 OS 기본 브라우저로 연다
```

## 출력 위치

- 기본 `.issue/viz/graph.html` — `.issue/viz/` 는 `.gitignore` 로 무시된다(런타임 산출물).
- 이슈 리포트에 붙일 증거는 브라우저로 열어 스크린샷(webp)으로 남긴다. graph.html 자체는 커밋하지 않는다.

## graph.json 이 없을 때

```bash
node <issue-todo>/scripts/issue-todo.mjs sync   # 그래프 먼저 생성
node <skill>/scripts/issue-viz.mjs render        # 다시 렌더
```

render 는 graph.json 이 없으면 exit 1 로 멈추고 sync 를 먼저 하라고 알린다.

## 데이터 흐름

```text
트래커 → issue-todo sync → .issue/graph.json → issue-viz render → graph.html (브라우저)
```

issue-viz 는 graph.json 을 읽기만 한다. 노드 분류(ready/blocked/…)와 critical-path 계산은
브라우저에서 하므로, 스크립트는 데이터 로드와 템플릿 조립만 한다.
