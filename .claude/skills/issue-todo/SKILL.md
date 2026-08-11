---
name: issue-todo
description: 열린·닫힌 이슈를 DAG(방향성 비순환 그래프)로 묶어 "남은 이슈를 리스트업하고 우선순위대로 그래프 todo 로 정리"하고 싶을 때 씁니다. "남은 이슈 정리", "우선순위 그래프", "다음에 뭐부터 할까", "이슈 의존성 정리", "todo 그래프", "이슈 DAG", "다음 작업 연결", "/issue-todo" 요청에 해당합니다. `.issue/graph.json` 에 이슈(노드)와 의존(엣지)을 저장하고, 트래커에서 이슈를 끌어와 본문의 "depends on #N" 참조를 엣지로 자동 감지하며(sync), 손으로 의존을 걸고(link), 위상정렬 + ready-frontier + 우선순위로 착수 가능/막힘/진행중/완료를 분류해 todo 를 냅니다(plan). 다음 착수 1건 추천(next)과 사이클·dangling·close 불일치 점검(validate)도 합니다. 만들어진 그래프의 시각화는 issue-viz 가, 새 이슈 등록은 issue-create, 착수는 issue-start, PR 은 issue-end, 통합은 issue-merge 가 맡으니 그 일에는 쓰지 않습니다. 코드는 건드리지 않고 그래프만 다룹니다.
---

<skill>
  <purpose>
    이슈를 독립 단위로만 다루던 파이프라인 위에 "의존 그래프" 레이어를 얹는다.
    이슈=노드, 의존=타입 엣지로 `.issue/graph.json` 에 저장하고, ready-frontier 와
    우선순위를 반영한 todo 를 산출한다. 그래서 "남은 이슈 그래프 todo" 를 매번
    손으로 재구성하지 않고, 한 이슈가 닫히면 새로 풀리는 이슈를 바로 잇는다.
    그래프 구축·유지·질의가 목표다. 시각화는 issue-viz, 등록·착수·통합은 다른 스킬의 몫이다.
  </purpose>

  <inputs>
    <arg name="$ARGUMENTS" required="false">
      서브커맨드와 인자. 생략하면 plan(todo) 을 낸다.
      sync / link &lt;from&gt; &lt;to&gt; / unlink &lt;from&gt; &lt;to&gt; / plan / next / validate
    </arg>
  </inputs>

  <preconditions>
    <item>현재 디렉터리가 git 저장소</item>
    <item>트래커 인증 통과 — provider.type 이 github 면 `gh auth status`, jira 면 baseUrl·projectKey·토큰</item>
    <item>git, Node 18+</item>
  </preconditions>

  <routing>
    <always>references/graph-v2.md — GitHub 정본, V2 스키마, 구조화 승인 및 중복 판정</always>
    <always>references/next-actions.md — 마무리 뒤 다음 행동 4지선다</always>
  </routing>

  <hard-rules>
    <rule>코드를 수정하지 않는다. graph.json 과 그 질의만 다룬다.</rule>
    <rule>GitHub 이슈와 구조화된 결정 코멘트가 정본이다. graph.json은 로컬 재생성 캐시이며 커밋하지 않는다.</rule>
    <rule>V2 관계는 depends-on, parent-of, duplicate-of, relates-to, supersedes다. 실행 순서는 depends-on만 사용한다.</rule>
    <rule>관계·중복·override는 GitHub 구조화 승인 코멘트가 정본이다. link/unlink는 로컬 캐시를 바꾸지 않는다.</rule>
    <rule>불완전·실패·미검증 snapshot, 순환 의존, 지원하지 않는 스키마에서는 plan/next를 fail-closed 한다.</rule>
    <rule>sync 는 트래커를 정본으로 노드를 갱신하고, 본문에서 자동 감지한 엣지(createdBy=sync)만 다시 계산한다. 손으로 건 엣지(createdBy=link)는 보존한다.</rule>
    <rule>이슈를 만들거나 상태를 바꾸거나 PR·코멘트를 남기지 않는다. 그건 issue-create/start/end/merge 의 몫이다.</rule>
  </hard-rules>

  <next>
    끝날 때는 항상 references/next-actions.md 의 4지선다를 제시한다.
    ready-frontier 의 첫 이슈로 issue-start 를 잇는 것이 기본 다음 행동이다.
  </next>
</skill>

# 스크립트 경로

아래 중 **존재하는 첫 번째 경로**를 `<skill>` 로 쓴다.

```text
.claude/skills/issue-todo      # 현재 프로젝트 (Claude Code)
.codex/skills/issue-todo       # 현재 프로젝트 (Codex)
~/.claude/skills/issue-todo    # 홈 설치
~/.codex/skills/issue-todo     # 홈 설치
```

# 실행 순서

## 0단계 — 전제 확인

```bash
git rev-parse --show-toplevel
```

트래커 인증은 스크립트가 issue-tracker.mjs 를 거쳐 확인한다. github 인증 실패는 `gh-setup` 스킬로 먼저 끝낸다.

## 1단계 — 그래프 갱신 (sync)

```bash
node <skill>/scripts/issue-todo.mjs sync
```

트래커의 열린·닫힌 이슈를 노드로 갱신하고, 본문의 "depends on #N" 류 참조를 엣지로 자동 감지한다.
출력의 `CYCLE=` 이 비어 있지 않으면 순환이 있으니 `validate` 로 확인한다. 세부는 `references/dag-ops.md`.

## 2단계 — 의존 보강 (link, 선택)

자동 감지로 안 잡히는 의존은 근거와 함께 손으로 건다.

```bash
node <skill>/scripts/issue-todo.mjs link <from> <to> --type depends-on --why "<근거>"
```

순환을 만드는 엣지는 거부된다. 잘못 건 엣지는 `unlink <from> <to>` 로 뗀다.

## 3단계 — todo 산출 (plan)

```bash
node <skill>/scripts/issue-todo.mjs plan
```

위상정렬 + ready-frontier + 우선순위로 **착수 가능 / 진행 중 / 막힘 / 완료** 를 분류해 낸다.
`--json` 으로 기계 출력. 인자 없이 `issue-todo` 만 부르면 이 단계를 낸다.

## 4단계 — 다음 착수 추천 (next)

```bash
node <skill>/scripts/issue-todo.mjs next
```

ready-frontier 에서 우선순위·번호 순 첫 이슈를 골라 `/issue-start #N` 을 제안한다.

## 5단계 — 점검 (validate)

```bash
node <skill>/scripts/issue-todo.mjs validate
```

사이클(있으면 exit 2), dangling 엣지, close 불일치를 점검한다.

## 마무리 보고

```text
그래프    .issue/graph.json (노드 <n>개 / 엣지 <m>개)
착수 가능  #<..> (ready-frontier)
막힘      #<..> ← 대기 #<..>
진행 중    #<..>
점검      사이클 <유/무> / dangling <n> / 불일치 <n>
다음      <사용자가 고른 행동>
```
