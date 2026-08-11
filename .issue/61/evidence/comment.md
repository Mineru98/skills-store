## ✅ issue-viz 스킬 구현 완료

issue-todo 가 만든 `.issue/graph.json` 을 **외부 CDN 없이 오프라인에서 열리는 자립형 HTML(force-directed)** 로 렌더합니다. semantica 의 Knowledge Explorer(force-directed + ego-mode)를 참고했습니다.

### 시각 인코딩
- **노드**: status 별 색(open 파랑 / plan 노랑 / in-process 초록 / review 보라 / close 회색·흐림), 성격 라벨로 모양, ready 는 굵은 테두리.
- **엣지**: type 별 선·색 + 방향 화살표. `from --depends-on--> to`.
- **뷰**: 전체 / 착수가능(ready) / 임계경로(critical-path) / ego(한 이슈+N홉).
- hover 툴팁(제목·상태·라벨), 클릭 시 이슈 URL 오픈.

### 전체 뷰 (dogfooding — 이 저장소 실제 DAG)
#61·#62 가 #60 으로 향하는 빨간 `depends-on` 화살표로 이어지고, #60 은 close(흐림), #61 은 ready 강조로 표시됩니다.

![전체 뷰](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/61/evidence/after/1-full.webp)

### 착수 가능(ready) 뷰
ready-frontier 만 남깁니다 (이 시점 #3·#62).

![ready 뷰](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/61/evidence/after/2-ready.webp)

### 검증
- 실제 graph.json(33노드/2엣지) 으로 HTML 생성 → 브라우저에서 노드·엣지·색·화살표·뷰 토글 정상.
- 전체·ready 뷰 헤드리스 크롬 캡처로 확인, sync-shared 드리프트 없음.

참고: 전체 그래프가 새로 생기는 산출물이라 별도 변경-구간 박스는 넣지 않았습니다(before 대비 영역 개념이 없음).

### 범위
- 그래프 구축·질의(sync/link/plan/next)는 issue-todo(#60, merged) 의 몫. 이 스킬은 시각화만.

관련 이슈: #61
