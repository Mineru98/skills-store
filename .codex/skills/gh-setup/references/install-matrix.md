# 설치 매트릭스

`plan` 이 이 표를 그대로 명령으로 만든다. 표시는 세 가지다.

```text
[auto]   권한 없이 실행 가능 → install 이 자동 실행
[user]   sudo·관리자 권한 필요 → 사용자가 직접 실행
[guide]  선택지가 여럿이거나 수동 판단이 필요 → 명령만 제시
```

## macOS

```bash
brew install gh                        # [auto] brew 가 있을 때
```

brew 가 없으면 두 갈래다.

```bash
# [user] Homebrew 먼저 설치 (관리자 비밀번호 필요)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# [guide] 또는 공식 릴리스 바이너리를 ~/.local/bin 에 배치 (권한 불필요)
```

## Windows

```powershell
winget install --id GitHub.cli --source winget   # [auto] 권장
scoop install gh                                 # [auto] scoop 사용자
choco install gh -y                              # [user] 관리자 PowerShell 필요
```

셋 다 없으면 <https://github.com/cli/cli/releases> 에서 `.msi` 를 받아 설치하도록 안내한다.

## Debian / Ubuntu 계열

공식 apt 저장소를 등록한다. keyring 다운로드는 `downloaders[0]` 에 맞춰 `curl -fsSL` 또는 `wget -qO-` 로 생성된다.

```bash
# [user] 전 단계 sudo 필요
sudo mkdir -p -m 755 /etc/apt/keyrings
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null
sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh -y
```

## 그 외 Linux

```bash
sudo dnf install -y gh          # [user] Fedora / RHEL / Rocky / Alma
sudo pacman -S --needed github-cli   # [user] Arch / Manjaro
sudo apk add github-cli         # [user] Alpine (community 저장소 필요)
sudo zypper install -y gh       # [user] openSUSE
```

## WSL

WSL 은 배포판을 감지해 위 Linux 경로를 그대로 쓴다. Windows 쪽 `gh` 와 별개로 리눅스 쪽에 설치해야 한다.
`/proc/version` 의 `microsoft` 문자열 또는 `$WSL_DISTRO_NAME` 으로 판별한다.

## 공통 폴백 — 릴리스 바이너리

패키지 매니저를 못 쓰거나 권한이 없을 때. `~/.local/bin` 에 넣으므로 sudo 가 필요 없다.

```bash
GH_VER=$(curl -fsSL https://api.github.com/repos/cli/cli/releases/latest \
  | grep -m1 '"tag_name"' | cut -d'"' -f4 | tr -d v)
curl -fsSL -o /tmp/gh.tar.gz \
  "https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_linux_amd64.tar.gz"
mkdir -p "$HOME/.local/bin" && cd /tmp && tar xzf gh.tar.gz
cp gh_${GH_VER}_linux_amd64/bin/gh "$HOME/.local/bin/gh"
```

macOS 는 `macOS` + `.zip`, arm 은 `arm64` 로 바뀐다. `~/.local/bin` 이 `PATH` 에 있어야 한다.

## 사용자에게 전달하는 방식

`[user]` 단계는 실행하지 말고 이렇게 넘긴다. 비밀번호 프롬프트가 뜨면 에이전트 쪽에서는 멈춘다.

```text
아래를 프롬프트에 그대로 붙여 실행해 주세요.

! sudo apt update && sudo apt install gh -y
```

실행 후 `status` 로 결과를 확인하고, 실패했으면 다음 후보 경로(바이너리 폴백)를 제안한다.

## gh-attach 확장 — private 저장소 이미지 자동 업로드

`gh` 자체가 설치·인증된 뒤, `install` 단계가 이어서 아래를 **자동 실행**한다. 확장 설치는
플랫폼과 무관하게 `gh` 하나로 끝나고 sudo 도 필요 없어 항상 `[auto]` 다.

```bash
gh extension install sudosubin/gh-attach   # [auto] gh 만 있으면 OS 무관
```

`issue-start` / `issue-end` 가 비공개 저장소 증거 이미지를 코멘트에 인라인으로 넣을 때 이 확장으로
`gh attach upload` 를 호출해 `user-attachments` URL 을 직접 만든다. 이 확장은 `gh` 의 OAuth
토큰이 아니라 **로컬에 로그인된 브라우저의 세션 쿠키**로 업로드하므로, 로컬에 github.com 에
로그인된 브라우저가 없는 순수 헤드리스 환경에서는 확장이 설치돼 있어도 업로드가 실패할 수
있다. 그 경우 해당 스킬이 이미지 단위로 기존 수동 업로드(이슈 웹 UI 드래그)로 폴백하므로
`gh-setup` 은 설치 여부만 보장하면 된다 — 쿠키 유무까지 검증하거나 실패를 재시도하지 않는다.

`status` 출력의 `gh-attach` 줄과 `GH_ATTACH_INSTALLED` 로 설치 여부를 확인한다. `login` 단계에는
포함되지 않는다(확장 설치에 로그인 자체가 필요하지 않다).

## Ubuntu server 등 헤드리스 환경 대안 — `GH_ATTACH_SESSION_TOKEN`

브라우저 자체가 없는 서버(CI 러너, 헤드리스 Ubuntu server 등)에서는 쿠키 탐색이 원천적으로
안 된다. 이때는 GitHub API 토큰(`gh auth token`, PAT)이 **아니라** 브라우저의 `user_session`
쿠키 값을 `GH_ATTACH_SESSION_TOKEN` 환경변수로 넘기는 방법을 쓴다. `gh-attach` 가 이 환경변수를
`--session-token` 플래그 없이 자동으로 읽으므로, `gitHost.uploadAttachment()` 쪽 코드 변경은
필요 없다 — 서버 환경변수만 채우면 지금 코드가 그대로 동작한다.

```bash
GH_ATTACH_SESSION_TOKEN=<user_session 쿠키 값> gh attach upload ./evidence.webp -R owner/repo --json href
```

값을 구하는 법: 이미 github.com 에 로그인된 아무 브라우저에서 개발자도구 → Application(또는
Storage) → Cookies → `github.com` → `user_session` 값을 복사한다. API 로 발급하는 값이 아니다.

**보통의 API 토큰과 다른 점 — 다루는 방식도 달라야 한다.**

| | PAT / `gh auth token` | `GH_ATTACH_SESSION_TOKEN` |
| --- | --- | --- |
| 발급 | GitHub 설정 화면에서 스코프를 골라 발급 | 로그인된 브라우저 쿠키를 수동으로 복사 |
| 권한 범위 | 스코프로 제한 가능 | 계정 전체 — 웹으로 로그인한 것과 동일 |
| 만료 | 직접 설정(길게 가능) | 브라우저 세션 수명을 따름. 비밀번호 변경·전체 로그아웃·GitHub 의
  주기적 세션 로테이션에 걸리면 무효화되어 재발급(재복사) 필요 |
| 저장 | 시크릿 매니저 또는 CI 시크릿 | 반드시 환경변수로만. 파일·리포지토리·로그에 남기지 않는다 |

`gh-setup` 은 이 값을 **읽거나 저장하지 않는다.** `status` 는 `GH_ATTACH_SESSION_TOKEN` 이
설정돼 있는지 boolean 으로만 확인하고(`GH_ATTACH_SESSION_TOKEN_SET`), 값 자체는 절대 출력하지
않는다. 값을 발급·회전·서버에 배치하는 것은 사용자의 몫이다.

### 배치 예시 — 쉘 프로파일 / `.env` 파일

값을 `~/.bashrc` 에 직접 `export` 로 박아 넣지 않는다. 셸 시작 로그·`set -x` 추적·`history`에
남을 수 있다. 별도 파일로 분리하고 그 파일만 읽어 들인다.

```bash
mkdir -p ~/.config/gh-attach
# GH_ATTACH_SESSION_TOKEN=<user_session 쿠키 값> 한 줄만 넣는다. 편집기는 GUI 없이도 쓸 수 있는 걸로.
nano ~/.config/gh-attach/session.env
chmod 600 ~/.config/gh-attach/session.env   # 소유자만 읽기 — 다중 사용자 서버에서 필수
```

셸 프로파일에는 **파일 경로만** 적고 값 자체는 적지 않는다.

```bash
# ~/.bashrc 또는 ~/.profile 끝에 추가
if [ -r ~/.config/gh-attach/session.env ]; then
  set -a
  . ~/.config/gh-attach/session.env
  set +a
fi
```

새 셸을 열고 확인한다. **값은 절대 echo 하지 않는다** — 존재 여부만 본다.

```bash
node <skill>/scripts/gh-env.mjs status   # "세션 토큰: GH_ATTACH_SESSION_TOKEN 설정됨" 이 나오면 성공
```

### 다중 사용자 서버 주의

- `~/.config/gh-attach/` 는 홈 디렉터리 권한(보통 `700`)에 이미 보호되지만, `chmod 600` 을 파일에도
  한 번 더 건다. 홈 디렉터리 권한이 느슨한 서버(공유 계정 등)에서는 이것만으로 부족할 수 있다 —
  그런 서버라면 셸 프로파일/`.env` 대신 위 표의 "외부 시크릿 매니저" 경로를 쓴다.
- 이 파일을 백업·동기화 도구(dotfiles 리포, rsync 홈 디렉터리 백업 등)에 포함하지 않는다.
  `.gitignore`/백업 제외 목록에 `~/.config/gh-attach/` 를 추가해 둔다.

### 만료됐을 때 신호

세션 쿠키가 무효화되면 `gh attach upload` 가 조용히 브라우저 탐색으로 넘어가지 않고
그 자리에서 인증 오류(HTTP 401/404)로 실패한다. `evidence-urls` 의 `images[].autoUploadError`
에 그 이유가 그대로 찍히므로, 그 값이 바뀌었으면(예: "쿠키 없음" → "HTTP 401") 세션이 만료된
것으로 보고 위 과정을 다시 밟아 값을 새로 복사한다.
