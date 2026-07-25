# 설정 파일

위치는 `~/.issue-plugin/settings.json` 하나로 고정한다. 없으면 `detect` 가 만든다.

## 스키마

```json
{
  "version": 1,
  "platform": { "os": "macos", "distro": null, "family": "macos", "arch": "arm64" },
  "runtime": "node",
  "terminals": ["zsh", "tmux"],
  "downloaders": ["curl", "wget"],
  "packageManagers": ["brew"],
  "gh": { "installed": true, "version": "2.95.0", "authenticated": true, "account": "octocat" },
  "updatedAt": "2026-07-26T00:00:00Z"
}
```

```text
platform.os       macos | linux | wsl | windows
platform.family   설치 경로 결정용. macos | windows | debian | fedora | arch | alpine | opensuse | unknown
runtime           이 파일을 마지막으로 쓴 구현. node | python | sh | ps1
terminals         선호 터미널·셸. 0번이 기본
downloaders       curl | wget 선호 순서. 0번을 설치 명령 생성에 쓴다
packageManagers   감지된 패키지 매니저
gh                status 실행 때마다 갱신
```

## 배열 규칙

- **0번이 우선.** 설치 명령은 `downloaders[0]` 기준으로 만든다.
- 처음 감지할 때는 감지 순서를 그대로 넣는다.
- 재감지할 때 **기존 순서를 바꾸지 않는다.** 새로 발견된 값만 뒤에 덧붙인다.
- 그래서 사용자가 한 번 정해 둔 선호는 계속 유지된다.

## 편집

```bash
sh <skill>/scripts/gh-env.sh config get
sh <skill>/scripts/gh-env.sh config get downloaders
sh <skill>/scripts/gh-env.sh config set downloaders wget,curl
sh <skill>/scripts/gh-env.sh config set terminals zsh,bash
```

`config set` 은 배열 키(`terminals`, `downloaders`, `packageManagers`)만 받는다.
폴백(sh / ps1) 런타임에서는 지원하지 않으므로 파일을 직접 고친다.

## 터미널 감지 순서

```text
POSIX    $SHELL → $TERM_PROGRAM(iTerm/Apple_Terminal/vscode/warp/ghostty …) → $TMUX → 부모 프로세스
         부모 프로세스가 node·python·sh 같은 런타임이면 후보에서 제외
Windows  $WT_SESSION(Windows Terminal) → $TERM_PROGRAM → PSEdition(pwsh/powershell) → cmd
WSL      $WSL_DISTRO_NAME 또는 /proc/version 의 microsoft 문자열로 판별하고 배포판은 /etc/os-release
```

## 주의

- 이 파일은 저장소가 아니라 **홈 디렉터리**에 있다. 프로젝트별 설정이 아니다.
- 토큰이나 비밀값을 여기에 넣지 않는다. 인증은 `gh` 자체 저장소(keyring)가 관리한다.
- JSON 이 깨지면 스크립트가 경고하고 새로 만든다. 손으로 고칠 때 문법을 확인한다.
