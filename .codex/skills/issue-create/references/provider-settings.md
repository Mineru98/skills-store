# 이슈 백엔드 설정

`issue-create` / `issue-start` / `issue-end` / `issue-merge` 는 이슈를 어디에 둘지 스스로 정하지 않는다.
`~/.issue/settings.json` 의 `provider` 가 정한다. 네 스킬이 같은 파일을 읽는다.

## 축이 둘이다

```text
tracker   이슈 생성·조회·검색·코멘트·라벨·종료   github | jira   설정으로 분기
gitHost   PR 목록·체크·머지, 저장소 메타          gh 고정         분기 없음
```

Jira 에는 PR 이라는 개념이 없다. Jira 로 이슈를 관리하는 팀도 코드는 GitHub 에 둔다.
그래서 **Jira 를 쓰더라도 `gh` 로그인은 여전히 필요하다.** PR 을 만들고 merge 하는 것은 `gh` 다.

## 파일 위치

```text
~/.issue/settings.json          정본
~/.issue-plugin/settings.json   구 경로. 새 경로가 없으면 1회 복사해 옮기고 그 사실을 알린다
```

구 파일은 지우지 않는다. 구 버전 스킬이 아직 깔린 환경에서 설정을 통째로 잃는 것보다
파일이 두 벌 남는 쪽이 안전하다.

## GitHub (기본값)

`provider` 를 아예 안 쓰면 GitHub 으로 동작한다. 기존 사용자는 아무것도 안 해도 된다.

```json
{
  "provider": { "type": "github" }
}
```

## Jira

```json
{
  "provider": {
    "type": "jira",
    "jira": {
      "baseUrl": "https://acme.atlassian.net",
      "projectKey": "ACME",
      "email": "me@acme.com",
      "tokenEnv": "JIRA_API_TOKEN",
      "issueType": "Task",
      "doneStatus": ["Done", "완료"]
    }
  }
}
```

| 키 | 필수 | 설명 |
| --- | --- | --- |
| `baseUrl` | ✓ | Jira 인스턴스 주소. 끝의 `/` 는 있어도 된다 |
| `projectKey` | ✓ | 프로젝트 키. 이슈 번호 12 → `ACME-12` |
| `email` | ✓ | Atlassian 계정 이메일. API 토큰과 짝을 이룬다 |
| `tokenEnv` | | 토큰이 든 **환경변수 이름** (기본 `JIRA_API_TOKEN`) |
| `issueType` | | 만들 이슈 타입 (기본 `Task`) |
| `doneStatus` | | 완료로 볼 상태 이름들 (기본 `["Done"]`) |

**토큰 값은 설정 파일에 넣지 않는다.** 환경변수 이름만 적는다.

```bash
export JIRA_API_TOKEN='...'   # https://id.atlassian.com/manage-profile/security/api-tokens
```

## 번호와 키

브랜치 이름과 `.issue/<n>/` 경로는 **항상 숫자**를 쓴다. 프로젝트 키는 설정에 있으므로
번호만 있으면 언제든 `ACME-12` 를 다시 조립할 수 있다.

```text
입력    12 · #12 · ACME-12 · .../browse/ACME-12 · .../issues/12   전부 12 로 읽는다
브랜치  feat/12-tracker-provider
경로    .issue/12/
표시    ACME-12  (github 면 #12)
```

## Jira 에서 달라지는 것

```text
본문 서식     REST v3 로 제목·문단·목록·코드·링크를 ADF 문서로 변환해 넣는다. 지원하지 않는
              표·코드펜스 일부가 원문 그대로 보일 수 있다. 내용이 없어지지는 않는다
라벨          Jira 라벨은 공백을 못 쓴다. "good first issue" → "good-first-issue" 로 바꾸고 알린다
라벨 생성     Jira 에는 라벨을 미리 만드는 개념이 없다. ensure-label 은 NOOP=1 로 통과한다
상태          status 이름이 doneStatus 에 있으면 CLOSED, 아니면 OPEN
이슈 종료     상태를 직접 못 바꾼다. 완료로 가는 전이(transition) 를 찾아 실행한다.
              전이가 없으면 가능한 전이 목록을 오류에 담아 알린다
```

## 인증 실패

이슈를 건드리는 모드는 인증이 안 되어 있으면 **exit 4** 로 빠진다. 무엇이 비었는지 함께 낸다.

```text
✗ jira 인증 실패: Jira 설정이 비어 있습니다: provider.jira.projectKey (예: ACME), 환경변수 JIRA_API_TOKEN
  ~/.issue/settings.json 의 provider.jira 를 채우고 토큰을 환경변수로 내보내세요.
```

## 참고

- 구현: `tools/issue-tracker.mjs` (정본), 각 스킬의 `scripts/issue-tracker.mjs` (사본)
- 테스트: `scripts/test-tracker.mjs` — 가짜 Jira 서버로 요청을 대조한다
- 워크트리 배치도 같은 파일의 `worktree.layout` 이 정한다. `issue-start/references/worktree.md` 참고
