#!/usr/bin/env node
/**
 * gh-env.mjs — gh(GitHub CLI) 설치·로그인 부트스트랩 (Node 구현).
 *
 * 서브커맨드:
 *   detect              OS·터미널·다운로더·패키지매니저 감지 → ~/.issue/settings.json
 *   status              gh 설치/인증 상태 확인 → settings.gh 갱신
 *   plan                설치 명령 목록 출력 (자동 실행 가능 여부 표시)
 *   install [--dry-run] 권한이 필요 없는 명령만 실행
 *   login               로그인 방법 안내
 *   config get [key]    설정 읽기
 *   config set <k> <v>  terminals / downloaders 순서 변경 (쉼표 구분)
 *
 * 옵션:
 *   --os <macos|linux|wsl|windows>  감지 결과 대신 강제 (테스트용)
 *   --distro <id>                   배포판 강제 (ubuntu|debian|fedora|arch|alpine|opensuse)
 *   --downloader <curl|wget>        다운로더 강제
 *
 * 요구사항: Node 18+
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const RUNTIME = 'node';
const SETTINGS_DIR = path.join(os.homedir(), '.issue');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');
// 구 경로. 새 경로가 없을 때만 읽어서 1회 옮긴다. issue-common.mjs 와 같은 규칙이다.
const LEGACY_SETTINGS_PATH = path.join(os.homedir(), '.issue-plugin', 'settings.json');
const SETTINGS_VERSION = 1;

const TERMINAL_PROGRAMS = {
  'iTerm.app': 'iterm',
  Apple_Terminal: 'apple-terminal',
  vscode: 'vscode',
  WarpTerminal: 'warp',
  ghostty: 'ghostty',
  Hyper: 'hyper',
  tabby: 'tabby',
  alacritty: 'alacritty',
  WezTerm: 'wezterm',
};

function usage(exitCode = 1) {
  console.error(`Usage:
  node gh-env.mjs detect [--os <o>] [--distro <d>]
  node gh-env.mjs status
  node gh-env.mjs plan [--os <o>] [--distro <d>] [--downloader <curl|wget>]
  node gh-env.mjs install [--dry-run]
  node gh-env.mjs login
  node gh-env.mjs config get [key]
  node gh-env.mjs config set <key> <value>
`);
  process.exit(exitCode);
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  if (res.error) return { status: 127, stdout: '', stderr: String(res.error.message) };
  return { status: res.status ?? 1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function has(cmd) {
  const probe = process.platform === 'win32' ? ['where', [cmd]] : ['command', ['-v', cmd]];
  if (process.platform === 'win32') return run(probe[0], probe[1]).status === 0;
  return run('sh', ['-c', `command -v ${cmd}`]).status === 0;
}

/* --------------------------------------------------------------- settings */

function parseSettingsFile(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    console.error(`! 설정 파일을 읽지 못했다(JSON 오류): ${file}`);
    return null;
  }
}

/** 구 경로의 설정을 새 경로로 복사한다. 원본은 지우지 않는다. */
function migrateSettings() {
  if (existsSync(SETTINGS_PATH) || !existsSync(LEGACY_SETTINGS_PATH)) return false;
  const prev = parseSettingsFile(LEGACY_SETTINGS_PATH);
  if (!prev) return false;
  mkdirSync(SETTINGS_DIR, { recursive: true });
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(prev, null, 2)}\n`);
  console.error(`! 설정을 ${LEGACY_SETTINGS_PATH} 에서 ${SETTINGS_PATH} 로 옮겼다. 구 파일은 그대로 둔다.`);
  return true;
}

function readSettings() {
  migrateSettings();
  if (existsSync(SETTINGS_PATH)) return parseSettingsFile(SETTINGS_PATH);
  if (existsSync(LEGACY_SETTINGS_PATH)) return parseSettingsFile(LEGACY_SETTINGS_PATH);
  return null;
}

function writeSettings(settings) {
  mkdirSync(SETTINGS_DIR, { recursive: true });
  settings.updatedAt = new Date().toISOString();
  writeFileSync(SETTINGS_PATH, `${JSON.stringify(settings, null, 2)}\n`);
  return settings;
}

/** 기존 순서를 보존하고, 감지값 중 없는 것만 뒤에 덧붙인다. */
export function mergePreference(existing, detected) {
  const base = Array.isArray(existing) && existing.length ? [...existing] : [...detected];
  for (const item of detected) if (!base.includes(item)) base.push(item);
  return base;
}

/* ----------------------------------------------------------------- detect */

function detectOs() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'macos';
  if (process.env.WSL_DISTRO_NAME) return 'wsl';
  try {
    if (/microsoft/i.test(readFileSync('/proc/version', 'utf8'))) return 'wsl';
  } catch {
    /* not linux */
  }
  return 'linux';
}

function detectDistro() {
  if (!existsSync('/etc/os-release')) return null;
  const text = readFileSync('/etc/os-release', 'utf8');
  const id = text.match(/^ID=(.*)$/m)?.[1]?.replace(/"/g, '').trim() ?? null;
  const like = text.match(/^ID_LIKE=(.*)$/m)?.[1]?.replace(/"/g, '').trim() ?? '';
  return id ? { id, like } : null;
}

export function normalizeFamily(distro) {
  const id = (distro?.id ?? '').toLowerCase();
  const like = (distro?.like ?? '').toLowerCase();
  const all = `${id} ${like}`;
  if (/\b(debian|ubuntu|linuxmint|pop|elementary|raspbian)\b/.test(all)) return 'debian';
  if (/\b(fedora|rhel|centos|rocky|almalinux)\b/.test(all)) return 'fedora';
  if (/\b(arch|manjaro|endeavouros)\b/.test(all)) return 'arch';
  if (/\balpine\b/.test(all)) return 'alpine';
  if (/\b(opensuse|suse|sles)\b/.test(all)) return 'opensuse';
  return 'unknown';
}

function detectTerminals(osName) {
  const found = [];
  const push = (v) => {
    if (v && !found.includes(v)) found.push(v);
  };

  if (osName === 'windows') {
    push(process.env.PSModulePath ? 'powershell' : 'cmd');
  } else {
    push(process.env.SHELL ? path.basename(process.env.SHELL) : null);
  }

  const program = process.env.TERM_PROGRAM;
  if (program) push(TERMINAL_PROGRAMS[program] ?? program.toLowerCase());
  if (process.env.WT_SESSION) push('windows-terminal');
  if (process.env.TMUX) push('tmux');

  if (osName !== 'windows') {
    // 부모 프로세스가 셸이면 후보로 쓴다. 스크립트 런타임 이름은 걸러 낸다.
    const parent = run('sh', ['-c', 'ps -o comm= -p $PPID 2>/dev/null'])
      .stdout.trim()
      .replace(/^-/, '')
      .split('/')
      .pop()
      ?.toLowerCase();
    if (parent && !/^(node|deno|bun|python3?|ruby|perl|sh|claude|codex)$/.test(parent)) push(parent);
  }
  return found.filter(Boolean);
}

function detectDownloaders() {
  return ['curl', 'wget'].filter((c) => has(c));
}

function detectPackageManagers(osName) {
  const candidates =
    osName === 'windows'
      ? ['winget', 'scoop', 'choco']
      : osName === 'macos'
        ? ['brew', 'port']
        : ['apt-get', 'dnf', 'yum', 'pacman', 'apk', 'zypper', 'brew'];
  return candidates.filter((c) => has(c));
}

function cmdDetect(opts) {
  const osName = opts.os ?? detectOs();
  const distro = opts.distro ? { id: opts.distro, like: '' } : detectDistro();
  const prev = readSettings() ?? {};

  // prev 를 먼저 펼쳐 이 스크립트가 모르는 키(issue-* 의 worktree/issue 등)를 보존한다.
  const settings = {
    ...prev,
    version: SETTINGS_VERSION,
    platform: {
      os: osName,
      distro: distro?.id ?? null,
      family: osName === 'linux' || osName === 'wsl' ? normalizeFamily(distro) : osName,
      arch: process.arch,
    },
    runtime: RUNTIME,
    terminals: mergePreference(prev.terminals, detectTerminals(osName)),
    downloaders: mergePreference(prev.downloaders, detectDownloaders()),
    packageManagers: mergePreference(prev.packageManagers, detectPackageManagers(osName)),
    gh: prev.gh ?? { installed: false, version: null, authenticated: false, account: null },
  };
  writeSettings(settings);

  console.log(`  OS        : ${settings.platform.os}${distro?.id ? ` (${distro.id})` : ''} / ${settings.platform.arch}`);
  console.log(`  터미널     : ${settings.terminals.join(', ') || '(감지 실패)'}`);
  console.log(`  다운로더   : ${settings.downloaders.join(', ') || '(없음)'}`);
  console.log(`  패키지관리 : ${settings.packageManagers.join(', ') || '(없음)'}`);
  console.log('');
  emit(settings);
}

/* ----------------------------------------------------------------- status */

function ghState() {
  const version = run('gh', ['--version']);
  const installed = version.status === 0;
  const versionText = installed ? (version.stdout.match(/gh version (\S+)/)?.[1] ?? null) : null;
  if (!installed) return { installed: false, version: null, authenticated: false, account: null };
  const auth = run('gh', ['auth', 'status']);
  const text = `${auth.stdout}\n${auth.stderr}`;
  return {
    installed: true,
    version: versionText,
    authenticated: auth.status === 0,
    account: text.match(/account (\S+)/)?.[1] ?? null,
  };
}

function cmdStatus() {
  const settings = readSettings() ?? loadOrDetect();
  settings.gh = ghState();
  writeSettings(settings);

  console.log(`  gh        : ${settings.gh.installed ? `설치됨 (${settings.gh.version})` : '없음'}`);
  console.log(
    `  로그인     : ${settings.gh.authenticated ? `됨 (${settings.gh.account ?? 'unknown'})` : '안 됨'}`,
  );
  console.log('');
  emit(settings);
}

function loadOrDetect() {
  const existing = readSettings();
  if (existing) return existing;
  cmdDetect({});
  return readSettings();
}

/* ------------------------------------------------------------------- plan */

/** @returns {{run: string, sudo: boolean, auto: boolean, note: string}[]} */
export function buildPlan({ family, arch, downloader, managers }) {
  const dl = downloader === 'wget' ? 'wget -qO-' : 'curl -fsSL';
  const step = (cmd, { sudo = false, auto = false, note = '' } = {}) => ({ run: cmd, sudo, auto, note });

  const binaryFallback = () => {
    const ext = family === 'macos' ? 'zip' : 'tar.gz';
    const plat = family === 'macos' ? 'macOS' : 'linux';
    const cpu = arch === 'arm64' ? 'arm64' : 'amd64';
    const fetch = downloader === 'wget' ? 'wget -qO' : 'curl -fsSL -o';
    return [
      step(
        `GH_VER=$(${dl} https://api.github.com/repos/cli/cli/releases/latest | grep -m1 '"tag_name"' | cut -d'"' -f4 | tr -d v) && \\\n` +
          `  ${fetch} /tmp/gh.${ext} "https://github.com/cli/cli/releases/download/v\${GH_VER}/gh_\${GH_VER}_${plat}_${cpu}.${ext}" && \\\n` +
          `  mkdir -p "$HOME/.local/bin" && cd /tmp && ${ext === 'zip' ? 'unzip -oq gh.zip' : 'tar xzf gh.tar.gz'} && \\\n` +
          `  cp gh_\${GH_VER}_${plat}_${cpu}/bin/gh "$HOME/.local/bin/gh"`,
        { note: '공식 릴리스 바이너리를 ~/.local/bin 에 설치. PATH 에 ~/.local/bin 이 있어야 한다' },
      ),
    ];
  };

  switch (family) {
    case 'macos':
      if (managers.includes('brew')) return [step('brew install gh', { auto: true })];
      return [
        step('/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"', {
          sudo: true,
          note: 'Homebrew 설치 (관리자 비밀번호 필요). 설치 후 brew install gh',
        }),
        ...binaryFallback(),
      ];

    case 'windows':
      if (managers.includes('winget')) return [step('winget install --id GitHub.cli --source winget', { auto: true })];
      if (managers.includes('scoop')) return [step('scoop install gh', { auto: true })];
      if (managers.includes('choco')) return [step('choco install gh -y', { sudo: true, note: '관리자 PowerShell 필요' })];
      return [
        step('winget install --id GitHub.cli --source winget', {
          note: 'winget 이 없으면 https://github.com/cli/cli/releases 에서 .msi 를 받아 설치',
        }),
      ];

    case 'debian':
      return [
        step('sudo mkdir -p -m 755 /etc/apt/keyrings', { sudo: true }),
        step(
          `${dl} https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null`,
          { sudo: true, note: 'GitHub CLI 공식 keyring 등록' },
        ),
        step('sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg', { sudo: true }),
        step(
          'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null',
          { sudo: true },
        ),
        step('sudo apt update && sudo apt install gh -y', { sudo: true }),
      ];

    case 'fedora':
      return [
        step(`sudo ${!managers.includes('dnf') && managers.includes('yum') ? 'yum' : 'dnf'} install -y gh`, {
          sudo: true,
        }),
      ];

    case 'arch':
      return [step('sudo pacman -S --needed github-cli', { sudo: true })];

    case 'alpine':
      return [step('sudo apk add github-cli', { sudo: true, note: 'community 저장소가 켜져 있어야 한다' })];

    case 'opensuse':
      return [step('sudo zypper install -y gh', { sudo: true })];

    default:
      if (managers.includes('brew')) return [step('brew install gh', { auto: true })];
      return binaryFallback();
  }
}

function planContext(settings, opts) {
  const osName = opts.os ?? settings.platform?.os ?? detectOs();
  const family =
    osName === 'macos' || osName === 'windows'
      ? osName
      : opts.distro
        ? normalizeFamily({ id: opts.distro, like: '' })
        : (settings.platform?.family ?? normalizeFamily(detectDistro()));
  return {
    family,
    arch: settings.platform?.arch ?? process.arch,
    downloader: opts.downloader ?? settings.downloaders?.[0] ?? 'curl',
    managers: settings.packageManagers ?? [],
  };
}

function cmdPlan(opts) {
  const settings = loadOrDetect();
  const ctx = planContext(settings, opts);
  const steps = buildPlan(ctx);

  console.log(`  대상: ${ctx.family} / ${ctx.arch} / 다운로더 ${ctx.downloader}`);
  console.log('');
  steps.forEach((s, i) => {
    console.log(`  ${i + 1}. [${s.auto ? 'auto' : s.sudo ? 'user' : 'guide'}] ${s.run}`);
    if (s.note) console.log(`     → ${s.note}`);
  });
  console.log('');
  console.log(`PLAN_STEPS=${steps.length}`);
  console.log(`AUTO_STEPS=${steps.filter((s) => s.auto).length}`);
  console.log(`NEEDS_SUDO=${steps.some((s) => s.sudo) ? 1 : 0}`);
  emit(settings, { OS: ctx.family, DOWNLOADER: ctx.downloader });
}

/* ---------------------------------------------------------------- install */

function cmdInstall(opts) {
  const settings = loadOrDetect();
  const current = ghState();
  if (current.installed) {
    console.log(`✓ gh 가 이미 설치되어 있다 (${current.version})`);
    settings.gh = current;
    writeSettings(settings);
    emit(settings);
    return;
  }

  const ctx = planContext(settings, opts);
  const steps = buildPlan(ctx);
  const auto = steps.filter((s) => s.auto);
  const manual = steps.filter((s) => !s.auto);

  if (!auto.length) {
    console.log('자동으로 실행할 수 있는 명령이 없다. 아래를 직접 실행하라.');
    manual.forEach((s) => console.log(`  ${s.sudo ? '! ' : ''}${s.run}`));
    console.log('');
    console.log('INSTALLED=0');
    console.log(`NEEDS_USER_ACTION=${manual.length}`);
    emit(settings, { OS: ctx.family });
    return;
  }

  for (const s of auto) {
    console.log(`$ ${s.run}`);
    if (opts.dryRun) continue;
    const res = run('sh', ['-c', s.run], { stdio: ['ignore', 'inherit', 'inherit'] });
    if (res.status !== 0) {
      console.error(`✗ 실패: ${s.run}`);
      break;
    }
  }
  if (opts.dryRun) {
    console.log('\n(dry-run) 아무것도 실행하지 않았다.');
    manual.forEach((s) => console.log(`  남은 수동 단계: ${s.sudo ? '! ' : ''}${s.run}`));
    emit(settings, { OS: ctx.family });
    return;
  }

  settings.gh = ghState();
  writeSettings(settings);
  console.log('');
  console.log(`INSTALLED=${settings.gh.installed ? 1 : 0}`);
  if (!settings.gh.installed) manual.forEach((s) => console.log(`  남은 단계: ${s.sudo ? '! ' : ''}${s.run}`));
  emit(settings, { OS: ctx.family });
}

/* ------------------------------------------------------------------ login */

function cmdLogin() {
  const settings = loadOrDetect();
  settings.gh = ghState();
  writeSettings(settings);

  if (!settings.gh.installed) {
    console.log('gh 가 없다. 먼저 install 을 끝내라.');
    emit(settings);
    return;
  }
  if (settings.gh.authenticated) {
    console.log(`✓ 이미 로그인되어 있다 (${settings.gh.account ?? 'unknown'})`);
    emit(settings);
    return;
  }

  const hasToken = Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  const headless = Boolean(process.env.SSH_CONNECTION) || (process.platform === 'linux' && !process.env.DISPLAY);

  console.log('로그인이 필요하다. 아래 명령을 터미널에서 직접 실행하라 (대화형이라 대신 실행할 수 없다).');
  console.log('');
  if (hasToken) {
    console.log('  환경변수 토큰이 이미 있다. 다음으로 확인만 하면 된다.');
    console.log('  gh auth status');
  } else if (headless) {
    console.log('  1) https://github.com/settings/tokens 에서 repo 스코프 PAT 발급');
    console.log('  2) ! gh auth login --hostname github.com --git-protocol https --with-token < <(pbpaste)');
    console.log('     또는 파일에 저장했다면: ! gh auth login --with-token < token.txt');
  } else {
    console.log('  ! gh auth login --hostname github.com --git-protocol https --web');
  }
  console.log('');
  console.log('  완료 후 확인: gh auth status');
  console.log('');
  console.log('LOGIN_REQUIRED=1');
  emit(settings);
}

/* ----------------------------------------------------------------- config */

const LIST_KEYS = new Set(['terminals', 'downloaders', 'packageManagers']);

function cmdConfig(action, key, value) {
  const settings = loadOrDetect();
  if (action === 'get') {
    if (!key) {
      console.log(JSON.stringify(settings, null, 2));
    } else {
      const found = key.split('.').reduce((acc, k) => (acc == null ? acc : acc[k]), settings);
      console.log(Array.isArray(found) ? found.join(',') : JSON.stringify(found ?? null));
    }
    console.log('');
    emit(settings);
    return;
  }
  if (action !== 'set' || !key || value === undefined) usage();

  if (LIST_KEYS.has(key)) {
    settings[key] = value.split(',').map((v) => v.trim()).filter(Boolean);
  } else {
    console.error(`✗ 배열 설정만 바꿀 수 있다: ${[...LIST_KEYS].join(', ')}`);
    process.exit(1);
  }
  writeSettings(settings);
  console.log(`✓ ${key} = ${settings[key].join(', ')}`);
  console.log('');
  emit(settings);
}

/* ------------------------------------------------------------------ emit */

function emit(settings, extra = {}) {
  const out = {
    RUNTIME,
    OS: settings.platform?.os ?? 'unknown',
    FAMILY: settings.platform?.family ?? 'unknown',
    TERMINAL: settings.terminals?.[0] ?? '',
    DOWNLOADER: settings.downloaders?.[0] ?? '',
    GH_INSTALLED: settings.gh?.installed ? 1 : 0,
    GH_AUTHENTICATED: settings.gh?.authenticated ? 1 : 0,
    SETTINGS_PATH,
    ...extra,
  };
  for (const [k, v] of Object.entries(out)) console.log(`${k}=${v}`);
}

/* ------------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('-h') || argv.includes('--help')) usage(argv.length ? 0 : 1);

  const mode = argv[0];
  const opts = { dryRun: false };
  const positional = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--os') opts.os = argv[++i];
    else if (arg === '--distro') opts.distro = argv[++i];
    else if (arg === '--downloader') opts.downloader = argv[++i];
    else if (arg.startsWith('--')) {
      console.error(`✗ 알 수 없는 옵션: ${arg}`);
      usage();
    } else positional.push(arg);
  }

  if (mode === 'detect') cmdDetect(opts);
  else if (mode === 'status') cmdStatus();
  else if (mode === 'plan') cmdPlan(opts);
  else if (mode === 'install') cmdInstall(opts);
  else if (mode === 'login') cmdLogin();
  else if (mode === 'config') cmdConfig(positional[0], positional[1], positional[2]);
  else {
    console.error(`✗ 알 수 없는 모드: ${mode}`);
    usage();
  }
}

/**
 * 이 파일이 직접 실행된 진입점인지 판별한다.
 *
 * 경로 문자열끼리 비교한다. `file://` 를 손으로 이어붙이면 공백·특수문자가 든 경로에서
 * 퍼센트 인코딩이 빠져 어긋나므로 fileURLToPath 를 쓴다.
 *
 * 심볼릭 링크로 설치된 스킬(`~/.claude/skills/<name>` → 저장소)에서는 두 값의 기준이 다르다.
 * Node ESM 로더는 모듈 URL 을 realpath 로 정규화하는 반면 `process.argv[1]` 은 링크 경로
 * 그대로다. 그래서 **양쪽 모두** realpath 로 풀어 비교한다. 한쪽만 풀면
 * `--preserve-symlinks-main` 으로 실행할 때 반대 방향으로 다시 어긋난다.
 */
function isMainModule(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  const here = fileURLToPath(metaUrl);
  const resolved = path.resolve(entry);
  if (here === resolved) return true;   // 일반 실행 — 파일시스템 접근 없이 끝난다
  try {
    return realpathSync(here) === realpathSync(resolved);
  } catch {
    // 같은 경로였다면 위에서 이미 true 다. 여기서 실패했다면 진입점이 아니다.
    return false;
  }
}

if (isMainModule(import.meta.url)) main();
