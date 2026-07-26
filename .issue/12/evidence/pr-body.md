관련 이슈: [#12 이슈 백엔드를 프로바이더로 추상화하고 Jira 를 지원한다](https://github.com/Mineru98/skills-store/issues/12) (통합 테스트 뒤 close)

## 변경 내용

- 이슈 생성·조회·검색·코멘트·라벨·종료를 GitHub/Jira 프로바이더 경계로 분리했습니다.
- Jira 요청을 REST v3로 통일하고, Markdown 본문·코멘트를 ADF 문서로 변환합니다.
- 설정 정본을 `~/.issue/settings.json`으로 이전하고 기존 경로는 한 번만 이관합니다.
- 네 스킬의 공유 사본을 동기화해 상태 전환·워크트리·단계 배너 동작을 보존했습니다.

## 검증

- `node scripts/test-common.mjs`
- `node scripts/test-tracker.mjs`
- `sh scripts/test-issue-create.sh`
- `sh scripts/test-flow.sh`
- `sh scripts/check-shared.sh`
- `sh scripts/verify-ignore.sh`
- 상태 라벨 통합 감사 98개, 단계 배너 감사 통과

## 증거

[REST v3·ADF 및 main 통합 검증 리포트](https://github.com/Mineru98/skills-store/issues/12#issuecomment-5082769130)

실제 Jira Cloud의 프로젝트별 필수 커스텀 필드와 권한은 첫 운영 연결에서 별도 확인이 필요합니다.
