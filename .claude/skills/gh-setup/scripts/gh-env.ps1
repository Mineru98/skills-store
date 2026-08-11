# gh-env.ps1 — Windows 진입점.
#
# node 나 python 이 있으면 그 구현으로 라우팅하고, 둘 다 없으면
# 이 파일 안의 폴백으로 감지(detect)와 안내(status/plan/login)까지 처리한다.
# install / config set 은 폴백에서 지원하지 않는다.
#
# 사용: powershell -ExecutionPolicy Bypass -File gh-env.ps1 <detect|status|plan|install|login|config> [args...]

param(
  [Parameter(Position = 0)][string]$Mode = 'detect',
  [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest
)

$ErrorActionPreference = 'Continue'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SettingsDir = Join-Path $HOME '.issue'
$SettingsPath = Join-Path $SettingsDir 'settings.json'
# 구 경로. 새 경로가 없을 때만 읽어서 1회 옮긴다. gh-env.mjs 와 같은 규칙이다.
$LegacySettingsPath = Join-Path (Join-Path $HOME '.issue-plugin') 'settings.json'

function Test-Cmd([string]$name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

# ------------------------------------------------------------------ 라우팅
if (Test-Cmd 'node') {
  & node (Join-Path $Dir 'gh-env.mjs') $Mode @Rest
  exit $LASTEXITCODE
}
elseif (Test-Cmd 'python') {
  & python (Join-Path $Dir 'gh_env.py') $Mode @Rest
  exit $LASTEXITCODE
}
elseif (Test-Cmd 'python3') {
  & python3 (Join-Path $Dir 'gh_env.py') $Mode @Rest
  exit $LASTEXITCODE
}

# ------------------------------------------------------------------ 폴백
$OsName = 'windows'
$Arch = if ($env:PROCESSOR_ARCHITECTURE -match 'ARM') { 'arm64' } else { 'x64' }

$Terminal = if ($env:WT_SESSION) { 'windows-terminal' }
elseif ($env:TERM_PROGRAM) { $env:TERM_PROGRAM.ToLower() }
elseif ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh' }
else { 'powershell' }

$Downloader = if (Test-Cmd 'curl.exe') { 'curl' } elseif (Test-Cmd 'wget.exe') { 'wget' } else { 'invoke-webrequest' }

$Managers = @('winget', 'scoop', 'choco') | Where-Object { Test-Cmd $_ }

$GhInstalled = 0
$GhVersion = $null
$GhAuthenticated = 0
$GhAttachInstalled = 0
if (Test-Cmd 'gh') {
  $GhInstalled = 1
  $GhVersion = ((gh --version 2>$null) | Select-Object -First 1) -replace '^gh version (\S+).*$', '$1'
  gh auth status *> $null
  if ($LASTEXITCODE -eq 0) { $GhAuthenticated = 1 }
  $attachList = (gh extension list 2>$null) -join "`n"
  if ($attachList -match 'sudosubin/gh-attach') { $GhAttachInstalled = 1 }
}
# 존재 여부만 본다. 값은 절대 출력·저장하지 않는다 — 헤드리스 서버용 대안 인증 경로다.
$GhAttachSessionTokenSet = if ($env:GH_ATTACH_SESSION_TOKEN) { 1 } else { 0 }

function Move-LegacySettings {
  if ((-not (Test-Path $SettingsPath)) -and (Test-Path $LegacySettingsPath)) {
    New-Item -ItemType Directory -Force -Path $SettingsDir | Out-Null
    Copy-Item -Path $LegacySettingsPath -Destination $SettingsPath
    Write-Output "! 설정을 $LegacySettingsPath 에서 $SettingsPath 로 옮겼다. 구 파일은 그대로 둔다."
  }
}

function Write-Settings {
  Move-LegacySettings
  New-Item -ItemType Directory -Force -Path $SettingsDir | Out-Null
  $settings = [ordered]@{
    version         = 1
    platform        = [ordered]@{ os = $OsName; distro = $null; family = 'windows'; arch = $Arch }
    runtime         = 'ps1'
    terminals       = @($Terminal)
    downloaders     = @($Downloader)
    packageManagers = @($Managers)
    gh              = [ordered]@{
      installed       = [bool]$GhInstalled
      version         = $GhVersion
      authenticated   = [bool]$GhAuthenticated
      account         = $null
      attachExtension = [bool]$GhAttachInstalled
    }
    updatedAt       = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  }
  $settings | ConvertTo-Json -Depth 5 | Set-Content -Path $SettingsPath -Encoding UTF8
  Write-Output "! node/python 이 없어 폴백으로 기록했다. 배열 순서 편집은 파일을 직접 고쳐라: $SettingsPath"
}

function Write-Plan {
  Write-Output "  대상: windows / $Arch / 다운로더 $Downloader"
  Write-Output ''
  if ($Managers -contains 'winget') {
    Write-Output '  1. [auto] winget install --id GitHub.cli --source winget'
  }
  elseif ($Managers -contains 'scoop') {
    Write-Output '  1. [auto] scoop install gh'
  }
  elseif ($Managers -contains 'choco') {
    Write-Output '  1. [user] choco install gh -y      # 관리자 PowerShell 필요'
  }
  else {
    Write-Output '  1. [guide] winget install --id GitHub.cli --source winget'
    Write-Output '     → winget 이 없으면 https://github.com/cli/cli/releases 에서 .msi 를 받아 설치'
  }
  Write-Output ''
}

function Write-Login {
  if ($GhAuthenticated -eq 1) {
    Write-Output '✓ 이미 로그인되어 있다.'
  }
  elseif ($env:GH_TOKEN -or $env:GITHUB_TOKEN) {
    Write-Output '환경변수 토큰이 있다. 확인: gh auth status'
  }
  else {
    Write-Output '! gh auth login --hostname github.com --git-protocol https --web'
  }
}

switch ($Mode) {
  'detect' {
    Write-Output "  OS        : windows / $Arch"
    Write-Output "  터미널     : $Terminal"
    Write-Output "  다운로더   : $Downloader"
    Write-Output "  패키지관리 : $(if ($Managers) { $Managers -join ', ' } else { '(없음)' })"
    Write-Output ''
    Write-Settings
    Write-Output ''
  }
  'status' {
    Write-Output "  gh        : $(if ($GhInstalled -eq 1) { "설치됨 ($GhVersion)" } else { '없음' })"
    Write-Output "  로그인     : $(if ($GhAuthenticated -eq 1) { '됨' } else { '안 됨' })"
    Write-Output "  gh-attach  : $(if ($GhAttachInstalled -eq 1) { '설치됨' } else { '없음 (private 저장소 이미지 자동 업로드용)' })"
    Write-Output "  세션 토큰  : $(if ($GhAttachSessionTokenSet -eq 1) { 'GH_ATTACH_SESSION_TOKEN 설정됨 (헤드리스 업로드용)' } else { '없음 (브라우저 쿠키로 대체 시도)' })"
    Write-Output ''
    Write-Settings
    Write-Output ''
  }
  'plan' { Write-Plan }
  'login' { Write-Login; Write-Output '' }
  'install' {
    Write-Output '폴백에서는 자동 설치를 하지 않는다. 아래 명령을 직접 실행하라.'
    Write-Output ''
    Write-Plan
    if ($GhInstalled -eq 1 -and $GhAttachInstalled -ne 1) {
      Write-Output '  추가. [auto] gh extension install sudosubin/gh-attach   # private 저장소 이미지 자동 업로드용'
      Write-Output ''
    }
  }
  'config' {
    Write-Output "폴백에서는 설정 편집을 지원하지 않는다. 파일을 직접 고쳐라: $SettingsPath"
    Write-Output ''
  }
  default {
    Write-Error "✗ 알 수 없는 모드: $Mode (detect|status|plan|install|login|config)"
    exit 1
  }
}

Write-Output 'RUNTIME=ps1'
Write-Output "OS=$OsName"
Write-Output 'FAMILY=windows'
Write-Output "TERMINAL=$Terminal"
Write-Output "DOWNLOADER=$Downloader"
Write-Output "GH_INSTALLED=$GhInstalled"
Write-Output "GH_AUTHENTICATED=$GhAuthenticated"
Write-Output "GH_ATTACH_INSTALLED=$GhAttachInstalled"
Write-Output "GH_ATTACH_SESSION_TOKEN_SET=$GhAttachSessionTokenSet"
Write-Output "SETTINGS_PATH=$SettingsPath"
