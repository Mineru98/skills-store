/**
 * issue-media.mjs — 이슈 이미지 링크 수집, 다운로드, 리포트 검증 공용 모듈.
 *
 * 이 파일이 정본이다. scripts/sync-shared.sh 로 각 스킬에 배포한다.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync, readFileSync, renameSync, rmSync,
} from 'node:fs';
import path from 'node:path';

const IMAGE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i;
const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

function resolveUrl(rawUrl, sourceUrl) {
  try {
    return new URL(rawUrl, sourceUrl).href;
  } catch {
    return null;
  }
}

function githubParts(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname === 'raw.githubusercontent.com' && parts.length >= 4) {
    return {
      host: 'raw', owner: parts[0], repo: parts[1], ref: parts[2], file: parts.slice(3).join('/'),
    };
  }
  if (parsed.hostname !== 'github.com' || parts.length < 2) return null;
  const [owner, repo] = parts;
  // github.com/<o>/<r>/raw/... 은 raw.githubusercontent.com 으로 302 되는 같은 자산이다.
  // blob 과 달리 이미지 자체를 가리키므로 raw 로 취급한다.
  if ((parts[2] === 'blob' || parts[2] === 'raw') && parts.length >= 5) {
    return {
      host: 'github', type: parts[2], owner, repo, ref: parts[3], file: parts.slice(4).join('/'),
    };
  }
  if (parts[2] === 'releases' && parts[3] === 'download' && parts.length >= 6) {
    return {
      host: 'github', type: 'release', owner, repo, tag: parts[4], name: parts.slice(5).join('/'),
    };
  }
  if (parts[2] === 'user-attachments') {
    return { host: 'github', type: 'user-attachment', owner, repo };
  }
  return { host: 'github', type: 'page', owner, repo };
}

export function classifyImageUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'invalid';
  }
  const gh = githubParts(url);
  if (gh?.host === 'raw' || gh?.type === 'raw') return 'raw';
  if (gh?.type === 'blob') return 'blob';
  if (gh?.type === 'release') return 'release';
  if (parsed.hostname === 'github.com' && parsed.pathname.startsWith('/user-attachments/assets/')) {
    return 'user-attachment';
  }
  if (parsed.hostname === 'github.com') return 'page';
  return IMAGE_EXT_RE.test(parsed.pathname + parsed.search) ? 'direct-image' : 'direct-unknown';
}

function makeReference({
  syntax, alt = '', rawUrl, source, sourceUrl, inline, start, end,
}) {
  const resolvedUrl = resolveUrl(rawUrl, sourceUrl);
  return {
    syntax,
    alt,
    originalUrl: rawUrl,
    resolvedUrl,
    source,
    sourceUrl,
    inline,
    kind: resolvedUrl ? classifyImageUrl(resolvedUrl) : 'invalid',
    start,
    end,
  };
}

/**
 * sources: [{ text, source, sourceUrl }]
 * HTML 이미지는 입력 호환을 위해 읽지만 출력 정규형은 Markdown 이미지다.
 */
export function collectImageReferences(sources) {
  const input = typeof sources === 'string'
    ? [{ text: sources, source: 'text', sourceUrl: undefined }]
    : sources;
  const found = [];

  for (const item of input ?? []) {
    const text = String(item.text ?? '');
    const occupied = [];
    const add = (ref) => {
      found.push(ref);
      occupied.push([ref.start, ref.end]);
    };

    for (const match of text.matchAll(/!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^"']*["'])?\s*\)/g)) {
      add(makeReference({
        syntax: 'markdown-image',
        alt: match[1],
        rawUrl: match[2] ?? match[3],
        source: item.source,
        sourceUrl: item.sourceUrl,
        inline: true,
        start: match.index,
        end: match.index + match[0].length,
      }));
    }

    for (const match of text.matchAll(/<img\b[^>]*>/gi)) {
      const src = match[0].match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
      if (!src) continue;
      const alt = match[0].match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
      add(makeReference({
        syntax: 'html-image',
        alt,
        rawUrl: src,
        source: item.source,
        sourceUrl: item.sourceUrl,
        inline: true,
        start: match.index,
        end: match.index + match[0].length,
      }));
    }

    for (const match of text.matchAll(/(?<!!)\[[^\]]+\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
      const rawUrl = match[1] ?? match[2];
      const resolvedUrl = resolveUrl(rawUrl, item.sourceUrl);
      if (!resolvedUrl) continue;
      const kind = classifyImageUrl(resolvedUrl);
      if (!IMAGE_EXT_RE.test(rawUrl) && !['blob', 'raw', 'release', 'user-attachment'].includes(kind)) continue;
      add(makeReference({
        syntax: 'markdown-link',
        rawUrl,
        source: item.source,
        sourceUrl: item.sourceUrl,
        inline: false,
        start: match.index,
        end: match.index + match[0].length,
      }));
    }

    for (const match of text.matchAll(URL_RE)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some(([a, b]) => start >= a && end <= b)) continue;
      const kind = classifyImageUrl(match[0]);
      if (!IMAGE_EXT_RE.test(match[0]) && !['blob', 'raw', 'release', 'user-attachment'].includes(kind)) continue;
      add(makeReference({
        syntax: 'bare-url',
        rawUrl: match[0],
        source: item.source,
        sourceUrl: item.sourceUrl,
        inline: false,
        start,
        end,
      }));
    }
  }
  return found;
}

export function isTrustedAuthUrl(url, auth) {
  if (!auth?.token) return false;
  try {
    return (auth.trustedHosts ?? []).includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function curlToFile(url, file, auth, { accept } = {}) {
  const args = [
    '-sSL', '--max-time', '60', '-o', file,
    '-w', '%{http_code}\n%{content_type}',
  ];
  if (accept) args.push('-H', `Accept: ${accept}`);
  if (isTrustedAuthUrl(url, auth)) {
    args.push('-H', `Authorization: ${auth.scheme} ${auth.token}`);
  }
  args.push(url);
  const res = spawnSync('curl', args, { encoding: 'utf8' });
  if (res.status !== 0) {
    return { ok: false, status: 0, contentType: '', reason: (res.stderr || '').trim() || `curl exit ${res.status}` };
  }
  const [statusText, contentTypeText = ''] = String(res.stdout ?? '').trim().split('\n');
  const status = Number(statusText);
  const contentType = contentTypeText.split(';')[0].trim().toLowerCase();
  return {
    ok: status >= 200 && status < 300,
    status,
    contentType,
    reason: status >= 200 && status < 300 ? null : `HTTP ${status}`,
  };
}

function curlJson(url, auth) {
  const args = ['-sSL', '--max-time', '30', '-w', '\n%{http_code}', '-H', 'Accept: application/vnd.github+json'];
  if (isTrustedAuthUrl(url, auth)) {
    args.push('-H', `Authorization: ${auth.scheme} ${auth.token}`);
  }
  args.push(url);
  const res = spawnSync('curl', args, { encoding: 'utf8' });
  if (res.status !== 0) return { ok: false, reason: (res.stderr || '').trim() || `curl exit ${res.status}` };
  const output = String(res.stdout ?? '');
  const split = output.lastIndexOf('\n');
  const status = Number(output.slice(split + 1));
  if (status < 200 || status >= 300) return { ok: false, reason: `GitHub API HTTP ${status}` };
  try {
    return { ok: true, json: JSON.parse(output.slice(0, split)) };
  } catch {
    return { ok: false, reason: 'GitHub API 응답이 JSON이 아님' };
  }
}

function detectImage(file) {
  const data = readFileSync(file);
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { type: 'image/png', ext: '.png' };
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return { type: 'image/jpeg', ext: '.jpg' };
  }
  if (data.length >= 6 && ['GIF87a', 'GIF89a'].includes(data.subarray(0, 6).toString('ascii'))) {
    return { type: 'image/gif', ext: '.gif' };
  }
  if (data.length >= 12
      && data.subarray(0, 4).toString('ascii') === 'RIFF'
      && data.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { type: 'image/webp', ext: '.webp' };
  }
  const head = data.subarray(0, 1024).toString('utf8').replace(/^\uFEFF/, '').trimStart();
  if (/^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(head)) return { type: 'image/svg+xml', ext: '.svg' };
  return null;
}

export function resolveDownloadTarget(url, auth) {
  const gh = githubParts(url);
  const apiBase = auth?.githubApiBase ?? 'https://api.github.com';
  if (gh?.host === 'raw') return { ok: true, url, accept: null };
  if (gh?.type === 'blob' || gh?.type === 'raw') {
    return {
      ok: true,
      url: `https://raw.githubusercontent.com/${gh.owner}/${gh.repo}/${gh.ref}/${gh.file}`,
      accept: null,
    };
  }
  if (gh?.type === 'release') {
    const release = curlJson(
      `${apiBase}/repos/${gh.owner}/${gh.repo}/releases/tags/${encodeURIComponent(gh.tag)}`,
      auth,
    );
    if (!release.ok) return release;
    const asset = release.json?.assets?.find((candidate) => candidate.name === gh.name);
    if (!asset) return { ok: false, reason: `release asset을 찾지 못함: ${gh.name}` };
    return {
      ok: true,
      url: `${apiBase}/repos/${gh.owner}/${gh.repo}/releases/assets/${asset.id}`,
      accept: 'application/octet-stream',
    };
  }
  return { ok: true, url, accept: null };
}

export function downloadImageReference(reference, dir, index, auth) {
  const originalUrl = typeof reference === 'string' ? reference : reference.originalUrl;
  const resolvedUrl = typeof reference === 'string' ? reference : reference.resolvedUrl;
  const base = {
    url: originalUrl,
    originalUrl,
    resolvedUrl,
    source: typeof reference === 'string' ? undefined : reference.source,
  };
  if (!resolvedUrl) return { ...base, ok: false, reason: 'URL 해석 실패' };

  const targetInfo = resolveDownloadTarget(resolvedUrl, auth);
  if (!targetInfo.ok) return { ...base, ok: false, reason: targetInfo.reason };

  const stem = path.join(dir, `image-${String(index).padStart(2, '0')}`);
  const tmp = `${stem}.download`;
  const response = curlToFile(targetInfo.url, tmp, auth, { accept: targetInfo.accept });
  if (!response.ok) {
    if (existsSync(tmp)) rmSync(tmp);
    return { ...base, ok: false, reason: response.reason };
  }

  const detected = detectImage(tmp);
  const allowedContentType = response.contentType.startsWith('image/')
    || (targetInfo.accept === 'application/octet-stream' && response.contentType === 'application/octet-stream');
  const normalizedContentType = response.contentType === 'image/jpg' ? 'image/jpeg' : response.contentType;
  if (!allowedContentType || !detected) {
    if (existsSync(tmp)) rmSync(tmp);
    const reason = !allowedContentType
      ? `이미지가 아님 (content-type: ${response.contentType || 'unknown'})`
      : '이미지가 아님 (파일 시그니처 불일치)';
    return { ...base, ok: false, reason };
  }

  const target = `${stem}${detected.ext}`;
  if (existsSync(target)) rmSync(target);
  renameSync(tmp, target);
  return {
    ...base,
    ok: true,
    path: target,
    fetchedUrl: targetInfo.url,
    contentType: response.contentType,
    detectedType: detected.type,
    warning: response.contentType !== 'application/octet-stream' && normalizedContentType !== detected.type
      ? `서버 형식과 시그니처가 다름 (${response.contentType} → ${detected.type})`
      : null,
  };
}

export function validateEvidenceReport(markdown, { isPrivate = false } = {}) {
  const refs = collectImageReferences([{
    text: markdown,
    source: 'comment.md',
    sourceUrl: 'https://github.com/example/repo/issues/1',
  }]);
  const errors = [];
  // private 저장소는 인라인 렌더링이 불가능해서 raw/blob 링크를 "보조 링크"로 남기도록 안내한다.
  // 그 안내대로 쓴 링크를 검증기가 되받아치면 마무리가 영원히 막힌다.
  const isAuxLink = (ref) => isPrivate
    && ref.syntax === 'markdown-link'
    && ['raw', 'release', 'blob'].includes(ref.kind);
  const pendingUploads = [];

  for (const ref of refs) {
    if (isAuxLink(ref)) continue;
    if (ref.syntax === 'html-image') {
      errors.push('HTML <img> 대신 ![설명](직접 이미지 링크)를 사용하세요.');
    }
    if (ref.syntax === 'markdown-image' && !ref.alt.trim()) {
      errors.push(`이미지 설명(alt)이 비어 있습니다: ${ref.originalUrl}`);
    }
    if (ref.syntax === 'markdown-link') {
      errors.push(`이미지가 일반 링크로 작성되었습니다: ${ref.originalUrl}`);
    }
    if (ref.syntax === 'bare-url') {
      errors.push(`이미지 URL이 bare URL로 작성되었습니다: ${ref.originalUrl}`);
    }
    if (ref.kind === 'blob' || ref.kind === 'page') {
      errors.push(`GitHub 페이지 URL은 직접 이미지 링크가 아닙니다: ${ref.originalUrl}`);
    }
    if (isPrivate && ['raw', 'release'].includes(ref.kind)) {
      // GitHub 은 이 자산을 Sec-Fetch-Site 로 갈라서 준다.
      // 주소창으로 열면 보이지만 <img> 요청에는 서명 토큰을 붙이지 않아 깨진다.
      pendingUploads.push(ref.originalUrl);
      errors.push(`private 저장소라 인라인 렌더링이 안 됩니다(주소창으로는 열려도 <img>로는 깨집니다): ${ref.originalUrl}\n  → 이슈 웹 UI에 해당 webp를 끌어다 놓고 생성된 user-attachments URL로 바꾸세요. raw 링크를 남기려면 이미지가 아닌 보조 링크 [파일명](URL) 형태로 쓰세요.`);
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    references: refs,
    // 실패 원인이 "사람이 업로드해야 하는 건"인지 스킬이 기계적으로 구분할 수 있게 한다.
    needsManualUpload: pendingUploads.length > 0,
    pendingUploads,
  };
}
