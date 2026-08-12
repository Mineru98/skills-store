# 다음 행동 4지선다

issue-viz 를 끝낼 때 AskUserQuestion 으로 아래를 제시한다.

```text
1. 다음 착수 (권장)   issue-onboard의 우선순위 이슈를 골라 /issue-start #N.
2. 그래프 갱신        새 이슈·의존이 생겼으면 issue-sync 후 다시 render.
3. 다른 뷰            ego/critical-path 등 다른 관점으로 다시 본다.
4. 종료              HTML 만 남기고 마친다.
```

- issue-viz 는 읽기 전용 시각화다. 그래프를 갱신하려면 issue-sync를 실행한다.
- 파이프라인: issue-create → issue-start → issue-end → issue-merge. issue-onboard/issue-viz 는
  그 위에서 "무엇을 다음에 할지" 를 정하고 보여주는 계획·시각화 레이어다.
