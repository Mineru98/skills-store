# 다음 행동 4지선다

issue-todo 를 끝낼 때 AskUserQuestion 으로 아래를 제시한다. ready-frontier 가 비어 있지 않으면
"다음 착수" 를 첫 번째(권장)에 둔다.

```text
1. 다음 착수 (권장)   ready-frontier 첫 이슈로 /issue-start #N 을 잇는다.
2. 그래프 시각화       /issue-viz 로 graph.json 을 인터랙티브 그래프로 본다.
3. 의존 보강           빠진 의존을 link 로 걸고 다시 plan 을 낸다.
4. 종료               graph.json 만 갱신하고 마친다.
```

- ready 가 비어 있으면 1번을 "막힌 이슈의 선행부터 착수" 로 바꾼다.
- 여러 이슈가 ready 여도 한 번에 하나만 착수한다(워크트리 충돌 방지). 나머지는 안내만 한다.
- 파이프라인 순서: issue-create → issue-start → issue-end → issue-merge. issue-todo 는 그 위에서
  "무엇을 다음에 할지" 를 정하는 계획 레이어다.
