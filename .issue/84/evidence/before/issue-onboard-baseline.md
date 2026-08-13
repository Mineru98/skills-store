# Before — current main still has issue-todo

## skill dirs

## issue-todo SKILL name
---
name: issue-todo
description: 열린·닫힌 이슈를 DAG(방향성 비순환 그래프)로 묶어 "남은 이슈를 리스트업하고 우선순위대로 그래프 todo 로 정리"하고 싶을 때 씁니다. "남은 이슈 정리", "우선순위 그래프", "다음에 뭐부터 할까", "이슈 의존성 정리", "todo 그래프", "이슈 DAG", "다음 작업 연결", "/issue-todo" 요청에 해당합니다. `.issue/graph.json` 에 이슈(노드)와 의존(엣지)을 저장하고, 트래커에서 이슈를 끌어와 본문의 "depends on #N" 참조를 엣지로 자동 감지하며(sync), 손으로 의존을 걸고(link), 위상정렬 + ready-frontier + 우선순위로 착수 가능/막힘/진행중/완료를 분류해 todo 를 냅니다(plan). 다음 착수 1건 추천(next)과 사이클·dangling·close 불일치 점검(validate)도 합니다. 만들어진 그래프의 시각화는 issue-viz 가, 새 이슈 등록은 issue-create, 착수는 issue-start, PR 은 issue-end, 통합은 issue-merge 가 맡으니 그 일에는 쓰지 않습니다. 코드는 건드리지 않고 그래프만 다룹니다.

## issue-todo plan (no graph)
✗ 안전하지 않은 그래프라 plan을 만들지 않는다: 불완전하거나 실패한 source snapshot
READY_NUMBERS=

## skill dirs (relisted)
[1m[36missue-create[39;49m[0m
[1m[36missue-end[39;49m[0m
[1m[36missue-merge[39;49m[0m
[1m[36missue-start[39;49m[0m
[1m[36missue-todo[39;49m[0m
[1m[36missue-viz[39;49m[0m
[1m[36missue-create[39;49m[0m
[1m[36missue-end[39;49m[0m
[1m[36missue-graph-sync[39;49m[0m
[1m[36missue-merge[39;49m[0m
[1m[36missue-start[39;49m[0m
[1m[36missue-todo[39;49m[0m
[1m[36missue-viz[39;49m[0m
