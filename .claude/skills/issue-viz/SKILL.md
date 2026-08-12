---
name: issue-viz
description: issue-todo 가 만든 `.issue/graph.json` 을 인터랙티브 HTML(force-directed) 그래프로 그려 이슈 간 연관성을 시각적으로 탐색하고 싶을 때 씁니다. "이슈 그래프 그려줘", "DAG 시각화", "의존성 그림으로", "이슈 관계 시각화", "그래프 보여줘", "issue-viz", "/issue-viz" 요청에 해당합니다. graph.json 을 읽어 외부 CDN 없이 오프라인에서 열리는 자립형 HTML 1파일을 만듭니다. 노드는 status 로 색(open/plan/in-process/review/close)·성격 라벨로 모양, 엣지는 type 별 선·방향 화살표로 그리고, 전체/착수가능(ready)/임계경로(critical-path)/ego(한 이슈+N홉) 뷰 토글, hover 툴팁, 클릭 시 이슈 열기를 지원합니다. 그래프 자체를 만들거나 갱신하는 일(sync·link·plan)은 issue-todo, 이슈 등록·착수·PR·통합은 issue-create/start/end/merge 가 맡으니 그 일에는 쓰지 않습니다. 코드는 건드리지 않고 시각화 산출만 합니다.
---

<skill>
  <purpose>
    issue-todo 가 저장한 의존 그래프(.issue/graph.json)를 사람이 한눈에 보도록
    인터랙티브 HTML 로 렌더한다. semantica 의 Knowledge Explorer(force-directed + ego-mode)를
    참고하되, 외부 CDN 없이 바닐라 JS 로 자립형 HTML 1파일을 만들어 오프라인에서도 연다.
    그래프 구축·질의는 issue-todo 의 몫이고, 이 스킬은 시각화만 한다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" required="false">
      render [--out &lt;path&gt;] [--view full|ready|critical-path|ego] [--focus &lt;n&gt;] [--open]
      생략하면 render 를 기본 뷰(full)로 실행한다.
    </arg>
  </inputs>

  <preconditions>
    <item>현재 디렉터리가 git 저장소</item>
    <item>`.issue/graph.json` 존재 — 없으면 먼저 issue-todo sync 를 실행한다</item>
    <item>Node 18+ (렌더 자체는 브라우저만 있으면 됨)</item>
  </preconditions>

  <routing>
    <always>references/render.md — render 명령·옵션·출력 위치</always>
    <always>references/views.md — full·ready·critical-path·ego 뷰와 시각 인코딩</always>
    <always>references/next-actions.md — 마무리 뒤 다음 행동 4지선다</always>
  </routing>

  <hard-rules>
    <rule>코드나 graph.json 을 수정하지 않는다. graph.json 을 읽어 HTML 만 만든다.</rule>
    <rule>graph.json 이 없으면 렌더하지 않고 issue-todo sync 를 먼저 하도록 안내한다.</rule>
    <rule>외부 CDN·네트워크에 의존하는 HTML 을 만들지 않는다. 자립형 1파일로 오프라인에서 열려야 한다.</rule>
    <rule>이슈를 만들거나 상태를 바꾸거나 PR·코멘트를 남기지 않는다.</rule>
  </hard-rules>

  <next>
    끝날 때는 references/next-actions.md 의 4지선다를 제시한다.
    보통 그래프를 본 뒤 issue-todo next 로 다음 착수를 고르는 것이 자연스러운 다음 행동이다.
  </next>
</skill>

# 스크립트 경로

아래 중 **존재하는 첫 번째 경로**를 `<skill>` 로 쓴다.

```text
.claude/skills/issue-viz      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-viz       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-viz    # 홈 설치
~/.codex/skills/issue-viz     # 홈 설치
```

# 실행 순서

## 0단계 — 전제 확인

```bash
git rev-parse --show-toplevel
test -f .issue/graph.json || echo "graph.json 없음 — issue-todo sync 먼저"
```

graph.json 이 없으면 issue-todo 로 만든 뒤 이어서 진행한다.

## 1단계 — 렌더

```bash
node <skill>/scripts/issue-viz.mjs render [--out <path>] [--view full|ready|critical-path|ego] [--focus <n>] [--open]
```

`.issue/graph.json` 을 읽어 자립형 HTML 을 만든다. 기본 출력은 `.issue/viz/graph.html`.
`--open` 이면 생성 후 브라우저로 연다. 세부는 `references/render.md`.

## 2단계 — 뷰 안내

생성된 HTML 상단 컨트롤로 뷰를 바꾼다.

```text
전체        모든 노드·엣지
착수 가능    ready-frontier 만 (선행이 전부 close 인 open 이슈)
임계 경로    최장 의존 사슬
ego         입력한 이슈 + N홉 이웃
```

노드 hover 로 제목·상태·라벨, 클릭으로 이슈를 연다. 세부는 `references/views.md`.

## 마무리 보고

```text
출력      .issue/viz/graph.html (노드 <n>개 / 엣지 <m>개)
뷰        전체 / 착수가능 / 임계경로 / ego (토글)
증거      렌더 스크린샷 (webp)
다음      <사용자가 고른 행동>
```
