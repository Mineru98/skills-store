/**
 * issue-docs.mjs — 선택적 문서 게시 대상.
 *
 * docs.type 이 없거나 none 이면 아무 동작도 하지 않는다.
 * confluence 은 Cloud content API로 페이지를 upsert 하고 webp 증거를 첨부한다.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { evidenceDir, issueDir, readIssueSettings } from './issue-common.mjs';

export const DOC_TYPES = ['none', 'confluence'];

export function resolveDocsConfig(settings = readIssueSettings()) {
  const raw = settings.docs ?? {};
  const type = DOC_TYPES.includes(raw.type) ? raw.type : 'none';
  return { type, confluence: raw.confluence ?? {} };
}

function normalizedBaseUrl(baseUrl) {
  return String(baseUrl ?? '').replace(/\/+$/, '');
}

function confluenceAuth(config) {
  const missing = [];
  if (!config.baseUrl) missing.push('docs.confluence.baseUrl');
  if (!config.spaceKey) missing.push('docs.confluence.spaceKey');
  if (!config.parentPageId) missing.push('docs.confluence.parentPageId');
  if (!config.email) missing.push('docs.confluence.email');
  const tokenEnv = config.tokenEnv || 'CONFLUENCE_API_TOKEN';
  if (!process.env[tokenEnv]) missing.push(`환경변수 ${tokenEnv}`);
  if (missing.length) {
    return {
      ok: false,
      warning: `Confluence 설정이 비어 있습니다: ${missing.join(', ')}`,
    };
  }
  return {
    ok: true,
    baseUrl: normalizedBaseUrl(config.baseUrl),
    spaceKey: config.spaceKey,
    parentPageId: config.parentPageId ? String(config.parentPageId) : null,
    email: config.email,
    token: process.env[tokenEnv],
  };
}

function requestJson({ method = 'GET', url, auth, body }) {
  const args = ['-sS', '--max-time', '30', '-u', `${auth.email}:${auth.token}`, '-X', method];
  args.push('-H', 'Accept: application/json');
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  args.push('-w', '\n%{http_code}', url);
  const res = spawnSync('curl', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status !== 0) {
    return { ok: false, status: 0, warning: (res.stderr || '').trim() || `curl exit ${res.status}` };
  }
  const out = (res.stdout || '').trim();
  const index = out.lastIndexOf('\n');
  const status = Number(index === -1 ? out : out.slice(index + 1));
  const raw = index === -1 ? '' : out.slice(0, index);
  let json = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
  return {
    ok: status >= 200 && status < 300,
    status,
    json,
    warning: status >= 200 && status < 300 ? null : `Confluence HTTP ${status}: ${raw || '(본문 없음)'}`,
  };
}

function uploadAttachment({ pageId, file, filename, auth }) {
  const url = `${auth.baseUrl}/rest/api/content/${encodeURIComponent(pageId)}/child/attachment`;
  const args = [
    '-sS', '--max-time', '30', '-u', `${auth.email}:${auth.token}`, '-X', 'POST',
    '-H', 'Accept: application/json', '-H', 'X-Atlassian-Token: no-check',
    '-F', `file=@${file};filename=${filename};type=image/webp`,
    '-F', 'comment=issue evidence',
    '-w', '\n%{http_code}', url,
  ];
  const res = spawnSync('curl', args, { encoding: 'utf8' });
  if (res.status !== 0) return { ok: false, warning: (res.stderr || '').trim() || `curl exit ${res.status}` };
  const out = (res.stdout || '').trim();
  const index = out.lastIndexOf('\n');
  const status = Number(index === -1 ? out : out.slice(index + 1));
  const raw = index === -1 ? '' : out.slice(0, index);
  return {
    ok: status >= 200 && status < 300,
    warning: status >= 200 && status < 300 ? null : `Confluence 첨부 HTTP ${status}: ${raw || '(본문 없음)'}`,
  };
}

function escapeStorage(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function attachmentName(root, file) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  return rel.replace(/[^A-Za-z0-9._-]+/g, '-');
}

function pageStorage({ title, markdown, attachments }) {
  const images = attachments.map((name) =>
    `<p><ac:image><ri:attachment ri:filename="${escapeStorage(name)}" /></ac:image></p>`,
  ).join('');
  return `<h1>${escapeStorage(title)}</h1><pre>${escapeStorage(markdown)}</pre>${images}`;
}

function cachedIssue(root, key) {
  const file = path.join(issueDir(root, key), 'issue.json');
  if (!existsSync(file)) return {};
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
}

function pageUrl(baseUrl, page) {
  const links = page?._links ?? {};
  if (links.webui) {
    if (/^https?:\/\//.test(links.webui)) return links.webui;
    const base = links.base || baseUrl;
    return `${String(base).replace(/\/$/, '')}/${String(links.webui).replace(/^\//, '')}`;
  }
  return page?.id ? `${baseUrl}/pages/viewpage.action?pageId=${page.id}` : null;
}

function upsertPage({ auth, title, storage }) {
  const query = new URLSearchParams({
    spaceKey: auth.spaceKey,
    title,
    expand: 'version,ancestors',
  });
  const found = requestJson({
    url: `${auth.baseUrl}/rest/api/content?${query}`,
    auth,
  });
  if (!found.ok) return found;
  const existing = (found.json?.results ?? []).find((page) => {
    if (!auth.parentPageId) return true;
    return (page.ancestors ?? []).some((ancestor) => String(ancestor.id) === auth.parentPageId);
  });
  if (existing) {
    const page = requestJson({
      method: 'PUT',
      url: `${auth.baseUrl}/rest/api/content/${encodeURIComponent(existing.id)}`,
      auth,
      body: {
        id: String(existing.id),
        type: 'page',
        title,
        version: { number: Number(existing.version?.number ?? 0) + 1 },
        body: { storage: { value: storage, representation: 'storage' } },
      },
    });
    return page.ok
      ? { ...page, page: page.json, created: false }
      : page;
  }
  const body = {
    type: 'page',
    title,
    space: { key: auth.spaceKey },
    body: { storage: { value: storage, representation: 'storage' } },
  };
  if (auth.parentPageId) body.ancestors = [{ id: auth.parentPageId }];
  const created = requestJson({
    method: 'POST',
    url: `${auth.baseUrl}/rest/api/content`,
    auth,
    body,
  });
  return created.ok
    ? { ...created, page: created.json, created: true }
    : created;
}

function replaceConfluenceLink(reportFile, url) {
  let body = readFileSync(reportFile, 'utf8').trimEnd();
  body = body.replace(/\n*## Confluence\n\n\[Confluence 리포트\]\([^\n]+\)\n*<!-- issue-docs:confluence -->\n*/g, '\n');
  body += `\n\n## Confluence\n\n[Confluence 리포트](${url})\n<!-- issue-docs:confluence -->\n`;
  writeFileSync(reportFile, body, 'utf8');
}

/**
 * reportFile의 Markdown과 evidence webp를 같은 Confluence 페이지에 게시한다.
 * 실패는 호출부가 커밋을 계속할 수 있도록 throw하지 않고 warning으로 돌린다.
 */
export function publishDocumentation({ root, key, reportFile, settings } = {}) {
  const cfg = resolveDocsConfig(settings);
  if (cfg.type === 'none') return { ok: true, skipped: true, url: null };
  if (!existsSync(reportFile)) return { ok: false, warning: `리포트 파일이 없습니다: ${reportFile}` };

  const auth = confluenceAuth(cfg.confluence);
  if (!auth.ok) return { ok: false, warning: auth.warning };

  const issue = cachedIssue(root, key);
  const issueKey = issue.key || `#${key}`;
  const title = `${issueKey} ${issue.title || `Issue ${key}`}`;
  const files = existsSync(evidenceDir(root, key))
    ? walkWebp(evidenceDir(root, key))
    : [];
  const attachments = files.map((file) => attachmentName(root, file));
  const page = upsertPage({
    auth,
    title,
    storage: pageStorage({ title, markdown: readFileSync(reportFile, 'utf8'), attachments }),
  });
  if (!page.ok || !page.page?.id) return { ok: false, warning: page.warning || 'Confluence 페이지 ID를 받지 못했습니다.' };

  for (let i = 0; i < files.length; i += 1) {
    const uploaded = uploadAttachment({ pageId: page.page.id, file: files[i], filename: attachments[i], auth });
    if (!uploaded.ok) return { ok: false, warning: uploaded.warning };
  }

  const url = pageUrl(auth.baseUrl, page.page);
  if (!url) return { ok: false, warning: 'Confluence 페이지 URL을 만들지 못했습니다.' };
  replaceConfluenceLink(reportFile, url);
  return { ok: true, skipped: false, created: page.created, url, attachments };
}

function walkWebp(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkWebp(file));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.webp')) out.push(file);
  }
  return out;
}
