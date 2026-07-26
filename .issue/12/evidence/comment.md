## REST v3 보완 완료 — 기존 REST v2 리포트 대체

기존 구현은 Jira REST v2를 사용했습니다. 이 보완 커밋에서는 이슈의 완료 기준에 맞춰 모든 Jira 요청을 REST v3로 전환하고, 본문·코멘트를 ADF 문서로 변환했습니다.

### v3 검증

- [REST v3·ADF 재검증 원본](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/05-jira-rest-v3-adf.txt)
  - `/rest/api/3` 경로만 사용
  - 생성 본문·코멘트 `version: 1`, `type: "doc"` ADF 검증
  - 제목·문단·목록·코드·링크 변환 및 ADF 응답 정규화
- [최신 main 통합 검증 원본](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/06-main-integration.txt)
  - `test-common`, `test-tracker`, `test-issue-create`, `test-flow`, 공유 사본 검사 통과
  - 상태 라벨 통합 감사 98개와 단계 배너 감사 통과

### 변경 요약

- `tools/issue-tracker.mjs` — Jira REST v3·Markdown↔ADF 변환, 상태 라벨 트래커 경계화
- 네 스킬의 `.claude` / `.codex` 사본 — 최신 상태 라벨·워크트리·단계 배너 동작을 보존하며 동기화
- 설정은 `~/.issue/settings.json`을 정본으로 쓰고, 기존 `~/.issue-plugin/settings.json`은 1회 이관합니다.

실제 Jira Cloud 인스턴스의 프로젝트별 필수 커스텀 필드와 권한은 이 저장소의 가짜 서버로 대체할 수 없으므로, 첫 운영 연결에서 별도 확인이 필요합니다.
