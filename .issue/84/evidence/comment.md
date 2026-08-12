## 작업 요약

`issue-todo`를 `issue-onboard`로 완전히 전환했습니다. 그래프가 없으면 `issue-sync`가 GitHub
완전 스냅샷을 생성하고, 온보딩이 HTML·webp·최대 6개 우선순위·다음 행동을 함께 제공합니다.

## 검증

- 그래프 없는 링크 워크트리에서 `issue-sync` 자동 호출 및 `SNAPSHOT_STATUS=complete` 확인
- 44개 노드·5개 엣지 HTML과 1440×900 webp 생성 확인
- 열린 이슈 2개를 ready → in-progress → blocked 우선순위 규칙으로 출력 확인
- 레거시 `todo` 명령 거부, Codex·Claude의 `needs #N` 의존성 해석 일치 확인
- GitHub URL 속성 이스케이프 및 저장소 밖 렌더 출력 거부 확인
- `node scripts/test-issue-graph-v2.mjs`, `node scripts/test-issue-viz-v2.mjs`, skill quick validation 통과

## 증거

- 변경 전: `before/issue-onboard-baseline.md`, `before/issue-onboard.html`
- 변경 후 HTML: `after/issue-onboard.html`

### 변경 전

![기존 issue-todo plan 출력](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/84/evidence/before/issue-onboard.webp)

### 변경 후

![issue-onboard 그래프 온보딩 결과](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/84/evidence/after/issue-onboard.webp)

## 남은 이슈

- 없음
