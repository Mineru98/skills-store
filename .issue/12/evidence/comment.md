## 착수 리포트 — 이슈 백엔드 프로바이더 추상화

브랜치 `feat/12-tracker-provider` · 커밋 [`1f616fd`](https://github.com/Mineru98/skills-store/commit/1f616fd)

UI 가 없는 CLI 변경이라 스크린샷 대신 터미널 출력 원문을 증거로 남깁니다.

---

### 설계에서 갈린 지점 — 축이 둘이다

이슈를 어디에 두느냐와 PR 을 어디에 올리느냐는 다른 문제입니다. Jira 에는 PR 이라는 개념이 없고, Jira 로 이슈를 관리하는 팀도 코드는 GitHub 에 둡니다. 하나의 provider 로 묶으면 `gh pr merge` 를 Jira 로 보내려는 모순이 생깁니다.

```
tracker   이슈 생성·조회·검색·코멘트·라벨·종료   github | jira   설정으로 분기
gitHost   PR 목록·체크·머지, 저장소 메타          gh 고정         분기 없음
```

둘 다 `tools/issue-tracker.mjs` 안에 넣어 "gh 직접 호출은 프로바이더 파일 안에만" 이라는 완료 기준은 그대로 만족시켰습니다. **Jira 를 쓰더라도 `gh` 로그인은 여전히 필요합니다.**

---

### before → after

**gh 결합도** — 5개 파일에 흩어져 있던 호출이 한 곳으로 모였습니다.

| | before | after |
| --- | --- | --- |
| `tools/issue-common.mjs` | 1곳 | **0곳** |
| `issue-create.mjs` | 10곳 | **0곳** |
| `issue-start.mjs` | 2곳 | **0곳** |
| `issue-end.mjs` | 3곳 | **0곳** |
| `issue-merge.mjs` | 6곳 | **0곳** |
| `tools/issue-tracker.mjs` | — | 13곳 (신규) |
| 코드 내 `provider` 언급 | 0건 | 프로바이더 계층 |

- before: [01-gh-coupling.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/before/01-gh-coupling.txt)
- after: [01-gh-decoupled.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/01-gh-decoupled.txt)

**GitHub 경로 회귀 없음** — `labels` / `search` / `unlabeled` / `context` 출력이 그대로입니다.

- before: [03-github-behavior.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/before/03-github-behavior.txt)
- after: [02-github-no-regression.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/02-github-no-regression.txt)

`SCANNED` 만 6 → 8 로 늘었는데 코드 때문이 아니라 그 사이 이슈 #14 · #15 가 등록된 결과입니다. 증거 파일에 근거를 함께 적었습니다.

**Jira 경로** — 실제 인스턴스가 없어 가짜 Jira 서버를 별도 프로세스로 띄우고 어댑터가 보낸 메서드·경로·본문을 대조했습니다. 49개 항목 통과.

- [03-jira-verified.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/03-jira-verified.txt)

서버를 같은 프로세스에 두면 안 됩니다. 어댑터가 curl 을 `spawnSync` 로 부르는 동안 이벤트 루프가 멈춰서 서버가 요청을 받지 못하고 그대로 멈춥니다. 처음에 이렇게 짰다가 걸렸습니다.

**테스트 전체 + 오류 안내**

- [04-tests-and-errors.txt](https://raw.githubusercontent.com/Mineru98/skills-store/main/.issue/12/evidence/after/04-tests-and-errors.txt)

```
test-common: 통과      test-tracker: 통과      test-flow: 통과
check-shared: 통과     verify-ignore: 통과
```

Jira 설정이 비면 무엇을 채워야 하는지 이름까지 찍고 exit 4 로 빠집니다.

```
✗ jira 인증 실패: Jira 설정이 비어 있습니다: provider.jira.baseUrl (예: https://acme.atlassian.net),
  provider.jira.projectKey (예: ACME), provider.jira.email,
  환경변수 JIRA_API_TOKEN (provider.jira.tokenEnv 로 이름을 바꿀 수 있다)
  ~/.issue/settings.json 의 provider.jira 를 채우고 토큰을 환경변수로 내보내세요.
```

---

### 완료 기준 점검

- [x] `~/.issue/settings.json` 이 정본으로 읽히고 기존 경로에서 마이그레이션된다 — 실행 시 실제로 옮겨졌고 구 파일은 롤백용으로 남습니다
- [x] `provider.type: "github"` 에서 네 스킬이 기존과 동일하게 동작한다
- [x] `provider.type: "jira"` 로 생성·검색·조회·코멘트·라벨·종료가 동작한다
- [x] 프로바이더 구현 파일 밖에 `gh` 직접 호출이 남아 있지 않다
- [x] 설정 누락 / 인증 실패 시 어느 값을 채워야 하는지 알려준다
- [x] 네 스킬의 SKILL.md · references 에서 GitHub 전용 표현을 프로바이더 중립으로 고쳤다

---

### 결정과 한계

**Jira REST v2 를 씁니다.** v3 는 본문이 ADF(JSON 문서 트리) 라 마크다운을 그대로 못 넣습니다. 변환기를 직접 쓰는 비용이 이 스킬의 목적에 비해 큽니다. v2 는 문자열 본문을 받으므로 마크다운 원문이 손실 없이 저장됩니다. 다만 Jira 는 이를 wiki markup 으로 렌더하므로 **표·코드펜스 일부가 원문 그대로 보일 수 있습니다.** 내용이 없어지지는 않습니다.

**구 설정 파일을 지우지 않습니다.** 복사만 합니다. 구 버전 스킬이 아직 깔린 환경에서 설정을 통째로 잃는 것보다 파일이 두 벌 남는 쪽이 안전합니다.

**번호와 키.** 브랜치 이름과 `.issue/<n>/` 경로는 트래커와 무관하게 항상 숫자입니다. 프로젝트 키는 설정에 있으므로 `12` 에서 `ACME-12` 를 언제든 다시 만들 수 있습니다. 입력은 `12` · `#12` · `ACME-12` · browse URL 을 모두 받습니다.

**실제 Jira 인스턴스로는 검증하지 못했습니다.** 가짜 서버는 어댑터가 보내는 요청이 규격에 맞는지까지만 보증합니다. 실 인스턴스의 필수 필드(커스텀 필드가 required 인 프로젝트 등)나 권한 문제는 첫 실사용에서 드러날 수 있습니다.

### 새 파일

```
tools/issue-tracker.mjs                                프로바이더 계층 (정본)
scripts/test-tracker.mjs                               가짜 Jira 서버 기반 테스트
scripts/fixtures/fake-jira.mjs                         가짜 Jira 서버
issue-create/references/provider-settings.md           설정 문서
```

다음: `issue-end` 로 PR 생성.
