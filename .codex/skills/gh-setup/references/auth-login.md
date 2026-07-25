# 로그인

`gh auth login` 은 대화형이다. 에이전트가 대신 실행하면 입력 프롬프트에서 멈춘다.
그래서 **상황을 판별해 사용자가 붙여 넣을 명령 하나**를 제시하는 것이 이 단계의 전부다.

```bash
sh <skill>/scripts/gh-env.sh login
```

## 분기

### 1. 환경변수 토큰이 이미 있음

`GH_TOKEN` 또는 `GITHUB_TOKEN` 이 설정되어 있으면 `gh` 가 그대로 쓴다. 추가 로그인이 필요 없다.

```bash
gh auth status
```

### 2. 브라우저를 쓸 수 있는 환경 (기본)

```text
! gh auth login --hostname github.com --git-protocol https --web
```

- 8자리 코드가 뜨면 브라우저에서 붙여 넣는다.
- SSH 로 push 하는 팀이면 `--git-protocol ssh` 로 바꾼다.

### 3. 헤드리스 · 원격 SSH · 브라우저 없음

`SSH_CONNECTION` 이 있거나 Linux 에 `DISPLAY` 가 없으면 토큰 방식으로 안내한다.

```text
1) https://github.com/settings/tokens 에서 PAT 발급
   스코프: repo, read:org  (워크플로 수정이 필요하면 workflow 추가)
2) ! gh auth login --hostname github.com --git-protocol https --with-token < token.txt
3) 사용이 끝나면 token.txt 삭제
```

## 확인

```bash
gh auth status
sh <skill>/scripts/gh-env.sh status   # settings.gh 갱신까지
```

`GH_AUTHENTICATED=1` 이면 끝이다.

## 자주 걸리는 것

```text
계정은 맞는데 권한 부족    gh auth refresh -h github.com -s repo,read:org
회사 SSO 저장소            토큰 발급 후 "Configure SSO" 에서 조직 승인 필요
여러 계정                  gh auth switch 로 전환. gh auth status 로 활성 계정 확인
GitHub Enterprise          --hostname 을 사내 도메인으로 바꾼다
```

## 금지

- 토큰 값을 대화에 출력하지 않는다.
- 토큰을 저장소 안 파일이나 설정 파일(`~/.issue-plugin/settings.json`)에 쓰지 않는다.
- `gh auth login` 을 에이전트가 직접 실행하지 않는다.
