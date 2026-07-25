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
