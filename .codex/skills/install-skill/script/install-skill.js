#!/usr/bin/env node
// Skills Store - GitHub URL 기반 스킬 설치 스크립트
// Usage: node install-skill.js <github-url> [--target <path>]
// Example: node install-skill.js https://github.com/Mineru98/skills-store/tree/main/.codex/skills/commit

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── 색상 ──
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  blue: (s) => `\x1b[34m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// ── GitHub URL 파싱 ──
function parseGitHubUrl(url) {
  // 지원 형식:
  //   https://github.com/{owner}/{repo}/tree/{branch}/{path}
  //   https://github.com/{owner}/{repo}/blob/{branch}/{path}
  const match = url.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:tree|blob)\/([^/]+)\/(.+)$/
  );
  if (!match) {
    return null;
  }
  return {
    owner: match[1],
    repo: match[2],
    branch: match[3],
    path: match[4],
  };
}

// ── HTTPS GET 요청 ──
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = {
      "User-Agent": "skills-store-installer",
      ...headers,
    };

    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (token) {
      reqHeaders["Authorization"] = `token ${token}`;
    }

    https
      .get(url, { headers: reqHeaders }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return httpGet(res.headers.location, headers).then(resolve, reject);
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({ statusCode: res.statusCode, body, headers: res.headers });
        });
      })
      .on("error", reject);
  });
}

// ── GitHub API: 디렉터리 트리 재귀 조회 ──
async function fetchTree(owner, repo, branch, dirPath) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(dirPath).replace(/%2F/g, "/")}?ref=${branch}`;
  const res = await httpGet(apiUrl, { Accept: "application/vnd.github.v3+json" });

  if (res.statusCode === 404) {
    throw new Error(`경로를 찾을 수 없습니다: ${dirPath}`);
  }
  if (res.statusCode === 403) {
    throw new Error(
      "GitHub API 속도 제한에 도달했습니다. GITHUB_TOKEN 환경변수를 설정하세요."
    );
  }
  if (res.statusCode !== 200) {
    throw new Error(`GitHub API 오류 (${res.statusCode}): ${res.body.toString()}`);
  }

  const items = JSON.parse(res.body.toString());

  if (!Array.isArray(items)) {
    // 단일 파일인 경우
    return [{ path: items.path, type: "file", download_url: items.download_url }];
  }

  const files = [];
  for (const item of items) {
    if (item.type === "file") {
      files.push({
        path: item.path,
        type: "file",
        download_url: item.download_url,
      });
    } else if (item.type === "dir") {
      const subFiles = await fetchTree(owner, repo, branch, item.path);
      files.push(...subFiles);
    }
  }

  return files;
}

// ── 파일 다운로드 및 저장 ──
async function downloadFile(url, destPath) {
  const res = await httpGet(url);
  if (res.statusCode !== 200) {
    throw new Error(`파일 다운로드 실패: ${url} (${res.statusCode})`);
  }

  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(destPath, res.body);
}

// ── 스킬 이름 추출 ──
function extractSkillName(ghPath) {
  // .codex/skills/commit/... → commands-creator
  // some/path/my-skill → my-skill
  const parts = ghPath.replace(/\/$/, "").split("/");
  return parts[parts.length - 1];
}

// ── 메인 ──
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(c.bold("Skills Store - GitHub URL 기반 스킬 설치\n"));
    console.log("사용법:");
    console.log("  node install-skill.js <github-url> [옵션]\n");
    console.log("옵션:");
    console.log("  --target <path>  설치 경로 (기본: ./.codex/skills/)");
    console.log("  --global         ~/.codex/skills/ 에 전역 설치");
    console.log("  --name <name>    스킬 폴더명 직접 지정");
    console.log("  --dry-run        실제 설치 없이 파일 목록만 출력");
    console.log("\n예시:");
    console.log(
      "  node install-skill.js https://github.com/Mineru98/skills-store/tree/main/.codex/skills/commit"
    );
    console.log(
      "  node install-skill.js https://github.com/user/repo/tree/main/my-skill --global"
    );
    process.exit(0);
  }

  const url = args.find((a) => a.startsWith("http"));
  if (!url) {
    console.error(c.red("오류: GitHub URL을 입력하세요."));
    process.exit(1);
  }

  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    console.error(c.red("오류: 올바른 GitHub URL 형식이 아닙니다."));
    console.error("  형식: https://github.com/{owner}/{repo}/tree/{branch}/{path}");
    process.exit(1);
  }

  const isGlobal = args.includes("--global");
  const dryRun = args.includes("--dry-run");

  // --target 옵션
  const targetIdx = args.indexOf("--target");
  let targetBase;
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    targetBase = path.resolve(args[targetIdx + 1]);
  } else if (isGlobal) {
    targetBase = path.join(
      process.env.HOME || process.env.USERPROFILE,
      ".codex",
      "skills"
    );
  } else {
    targetBase = path.resolve(".codex", "skills");
  }

  // --name 옵션
  const nameIdx = args.indexOf("--name");
  const skillName =
    nameIdx !== -1 && args[nameIdx + 1]
      ? args[nameIdx + 1]
      : extractSkillName(parsed.path);

  const installDir = path.join(targetBase, skillName);

  console.log(c.blue("╔══════════════════════════════════════════╗"));
  console.log(c.blue("║     Skills Store - Skill Installer       ║"));
  console.log(c.blue("╚══════════════════════════════════════════╝"));
  console.log();
  console.log(`  저장소:  ${c.bold(`${parsed.owner}/${parsed.repo}`)}`);
  console.log(`  브랜치:  ${c.bold(parsed.branch)}`);
  console.log(`  경로:    ${c.bold(parsed.path)}`);
  console.log(`  스킬명:  ${c.bold(skillName)}`);
  console.log(`  설치위치: ${c.bold(installDir)}`);
  console.log();

  // 파일 트리 조회
  console.log(c.yellow("파일 목록을 가져오는 중..."));
  let files;
  try {
    files = await fetchTree(parsed.owner, parsed.repo, parsed.branch, parsed.path);
  } catch (err) {
    console.error(c.red(`오류: ${err.message}`));
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(c.red("오류: 해당 경로에 파일이 없습니다."));
    process.exit(1);
  }

  console.log(c.green(`  ${files.length}개 파일 발견\n`));

  // 상대 경로 계산
  const basePath = parsed.path;
  const fileEntries = files.map((f) => {
    const relativePath = f.path.startsWith(basePath + "/")
      ? f.path.slice(basePath.length + 1)
      : f.path.startsWith(basePath)
        ? f.path.slice(basePath.length)
        : path.basename(f.path);
    return {
      relativePath: relativePath.replace(/^\//, ""),
      downloadUrl: f.download_url,
    };
  });

  // 파일 목록 출력
  for (const entry of fileEntries) {
    const destPath = path.join(installDir, entry.relativePath);
    const exists = fs.existsSync(destPath);
    const tag = exists ? c.yellow("[UPDATE]") : c.green("[NEW]   ");
    console.log(`  ${tag} ${entry.relativePath}`);
  }
  console.log();

  if (dryRun) {
    console.log(c.yellow("(dry-run 모드 - 실제 설치를 건너뜁니다)"));
    process.exit(0);
  }

  // 다운로드 및 설치
  console.log(c.yellow("파일 다운로드 중..."));
  let installed = 0;
  let failed = 0;

  for (const entry of fileEntries) {
    const destPath = path.join(installDir, entry.relativePath);
    try {
      await downloadFile(entry.downloadUrl, destPath);
      installed++;
    } catch (err) {
      console.error(c.red(`  실패: ${entry.relativePath} - ${err.message}`));
      failed++;
    }
  }

  console.log();
  console.log(c.green("╔══════════════════════════════════════════╗"));
  console.log(c.green("║     설치 완료!                           ║"));
  console.log(c.green("╚══════════════════════════════════════════╝"));
  console.log();
  console.log(`  설치됨:  ${c.green(String(installed))}개 파일`);
  if (failed > 0) {
    console.log(`  실패:    ${c.red(String(failed))}개 파일`);
  }
  console.log(`  위치:    ${c.blue(installDir)}`);
  console.log();
}

main().catch((err) => {
  console.error(c.red(`오류: ${err.message}`));
  process.exit(1);
});
