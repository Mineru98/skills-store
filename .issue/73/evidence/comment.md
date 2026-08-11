## ✅ 리뷰 후속 하드닝 완료 (5건)

#60·#61·#62 merge 후 적대적 코드 리뷰에서 발견된 결함을 수정했습니다.

### HIGH
- **issue-viz `</script>` 이스케이프** — `<script>` 에 넣는 GRAPH JSON 의 `<`/`>`/`&` 를 `<` 등으로 이스케이프. 이슈 제목에 `</script>` 가 있어도 페이지가 안 깨지고 XSS 차단.
- **setTrackerStatus 훅 process.exit 제거** — `repoRoot()`(→`fail()`→`process.exit`, try/catch 로 못 막음)를 제거하고, 안전한 top-level 해석 + `mainCheckout` 으로 base 공유 graph 를 갱신하며 전체를 try/catch 로 감쌈. 상태 전환 성공 후 그래프 갱신이 프로세스를 죽이지 않음.

### MED
- **patchGraphNode 정렬** — `saveGraph` 와 같은 노드 번호순·엣지순 정렬로 공유 커밋 파일의 노이즈 diff·머지 충돌 방지.
- **classify 미지 선행** — 그래프에 없는 depends-on 대상을 blocker 로 치지 않음(영구 blocked 방지). dangling 은 `validate` 가 계속 경고.
- **parseDependencies "needs #N" 제거** — "needs #2 more tests" 오탐 차단.

### 검증
```
HIGH-1 GRAPH 데이터 원문 </script>: 0 / 이스케이프 u003c/script: 1
HIGH-2 훅 실제 repoRoot() 호출: 0 (mainCheckout 사용) — 남은 1건은 설명 주석
MED-6 needs 무시: [{"to":5}] PASS
MED-4 미지선행 ready: [10] PASS
MED-3 정렬: ["5","12","20"] PASS
회귀: test-common 통과 / test-tracker 통과 / sync-shared 드리프트 없음
```

### 범위 밖 (후속, 낮은 우선순위)
다중 의존 파싱(#5), 뷰 classify 비표준 status(#7), `window.open` scheme 검사(#8).

- 증거: [1-fixes.txt](https://github.com/Mineru98/skills-store/blob/main/.issue/73/evidence/after/1-fixes.txt)

관련 이슈: #73
