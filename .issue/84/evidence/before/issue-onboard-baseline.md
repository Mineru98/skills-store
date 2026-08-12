# Before: issue-onboard 부재

2026-08-12, 링크 워크트리에서 `.issue/graph.json`이 없는 상태를 확인했다.

기존 그래프 명령의 plan 실행은 그래프 부재로 종료되었다. 따라서 이름 전환 전에는
온보딩이 GitHub 스냅샷을 생성하거나 HTML·webp·우선순위를 한 번에 제공하지 못했다.

구현 후 검증은 `after/issue-onboard.html`과 `after/issue-onboard.webp`에 기록한다.
