## Confluence 리포트·증거 게시 지원

docs.type이 없거나 none이면 기존 GitHub 이슈 코멘트 흐름을 그대로 유지합니다. confluence를 설정하면 issue-start와 issue-end의 증거 커밋이 같은 이슈 페이지를 생성 또는 갱신하고, webp 증거를 첨부해 본문에서 참조합니다.

### 설정

    {
      "docs": {
        "type": "confluence",
        "confluence": {
          "baseUrl": "https://acme.atlassian.net/wiki",
          "spaceKey": "ENG",
          "parentPageId": "123456",
          "email": "me@acme.com",
          "tokenEnv": "CONFLUENCE_API_TOKEN"
        }
      }
    }

토큰 값은 환경변수에만 둡니다. 게시 실패는 경고로만 처리하므로 커밋·PR 흐름을 막지 않습니다.

### 검증

- [가짜 Confluence 서버 검증 원본](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/13/evidence/after/01-confluence-publishing.txt)
- test-docs, test-common, test-tracker, test-issue-create, test-flow, 공유 사본·무시 규칙 검사를 모두 통과했습니다.
- 가짜 서버에서 페이지 생성, 동일 페이지 갱신(중복 없음), webp multipart 첨부와 storage image 참조, 실패 비차단을 확인했습니다.

### 증거 형식

화면이 없는 CLI·설정 변경이라 webp 브라우저 캡처는 만들지 않았습니다. 대신 변경 전 기능 부재와 가짜 Confluence 서버의 요청·응답 검증 원문을 남겼습니다.

실제 Confluence Cloud의 공간 권한, API 토큰과 부모 페이지 정책은 이 저장소의 가짜 서버로 대체할 수 없으므로 첫 운영 연결에서 확인이 필요합니다.
