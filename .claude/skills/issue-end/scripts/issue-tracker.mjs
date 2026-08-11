// !!! VENDORED FILE — DO NOT EDIT !!!
// canonical: tools/issue-tracker.mjs
// resync   : sh scripts/sync-shared.sh
/**
 * issue-tracker.mjs — issue-create / issue-start / issue-end / issue-merge 공용 프로바이더 계층.
 *
 * 이 파일이 정본이다. 각 스킬의 scripts/ 아래 사본은 scripts/sync-shared.sh 가 만든다.
 * 사본을 직접 고치지 말고 이 파일을 고친 뒤 sync 를 다시 돌려라.
 *
 * ## 왜 축이 둘인가
 *
 * 이슈를 어디에 두느냐(tracker) 와 PR 을 어디에 올리느냐(gitHost) 는 다른 문제다.
 * Jira 로 이슈를 관리하는 팀도 코드는 GitHub 에 둔다. Jira 에는 PR 이라는 개념 자체가 없다.
 * 그래서 하나로 묶지 않는다.
 *
 *   tracker   이슈 생성·조회·검색·코멘트·라벨·종료   github | jira   (설정으로 분기)
 *   gitHost   PR 목록·체크·머지, 저장소 메타          gh 고정         (분기 없음)
 *
 * 이 모듈 밖에서는 `gh` 를 직접 부르지 않는다. 분기가 없는 gitHost 도 여기로 모은다.
 *
 * ## Jira 어댑터의 선택
 *
 * Jira REST v3 는 본문을 ADF(Atlassian Document Format) JSON 문서 트리로 받는다.
 * 이 모듈은 스킬 리포트에서 쓰는 제목·문단·목록·코드 펜스·링크를 의존성 없이 ADF로
 * 바꾸고, 응답 ADF는 사람이 읽을 수 있는 Markdown 텍스트로 되돌린다.
 *
 * 의존성 없음. Node 18+, curl.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {
  run, fail, detectBase, listEvidence, evidenceRel, repoSlugFromRemote, readIssueSettings,
  isStatusLabel, resolveStatus, STATUS_LABELS, mainCheckout, patchGraphNode,
} from './issue-common.mjs';

export const PROVIDERS = ['github', 'jira'];

/* ------------------------------------------------------------------ 설정 */

/** settings.provider 를 정규화한다. 미설정이면 github. */
export function resolveProviderConfig(settings = readIssueSettings()) {
  const raw = settings.provider ?? {};
  const type = PROVIDERS.includes(raw.type) ? raw.type : 'github';
  return { type, github: raw.github ?? {}, jira: raw.jira ?? {} };
}

export function providerType(settings) {
  return resolveProviderConfig(settings).type;
}

/* ------------------------------------------------------------------ gitHost */

function ghJson(args, opts = {}) {
  const r = run('gh', args, opts);
  if (r.code !== 0) return null;
  try {
    return JSON.parse(r.out);
  } catch {
    return null;
  }
}

/**
 * PR 과 저장소 메타. 트래커가 Jira 여도 코드 호스트는 GitHub 이므로 분기하지 않는다.
 */
export const gitHost = {
  name: 'github',

  auth() {
    const r = run('gh', ['auth', 'status']);
    return { ok: r.code === 0, detail: r.code === 0 ? (r.err || r.out) : null };
  },

  /** owner/name + private 여부. gh 실패 시 origin URL 파싱으로 낮춰 잡는다. */
  repoInfo(root) {
    const opts = root ? { cwd: root } : {};
    const j = ghJson(['repo', 'view', '--json', 'nameWithOwner,isPrivate,defaultBranchRef'], opts);
    if (j) return j;
    return repoSlugFromRemote(root);
  },

  prForBranch(branch, opts = {}) {
    const list = ghJson(
      ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,state,url,isDraft,mergeable'],
      opts,
    );
    return list?.[0] ?? null;
  },

  /** 'pass' | 'fail' | 'pending' | 'none' | null(조회 실패) */
  prChecks(number, opts = {}) {
    const r = run('gh', ['pr', 'checks', String(number), '--json', 'state'], opts);
    if (r.code !== 0) return 'none';
    try {
      const states = JSON.parse(r.out).map((c) => c.state);
      if (states.some((s) => s === 'FAILURE' || s === 'ERROR')) return 'fail';
      if (states.some((s) => s === 'PENDING' || s === 'IN_PROGRESS')) return 'pending';
      return states.length ? 'pass' : 'none';
    } catch {
      return null;
    }
  },

  prMerge(number, method = 'squash', opts = {}) {
    const r = run('gh', ['pr', 'merge', String(number), `--${method}`], opts);
    return { ok: r.code === 0, out: r.out, err: r.err };
  },

  hasPrHistory(opts = {}) {
    const r = run('gh', ['pr', 'list', '--state', 'all', '--limit', '1', '--json', 'number'], opts);
    return r.code === 0 && r.out.trim() !== '[]';
  },

  /** gh-attach 확장(sudosubin/gh-attach) 설치 여부. private 저장소 이미지 자동 업로드에 쓴다. */
  hasAttachExtension(opts = {}) {
    const r = run('gh', ['extension', 'list'], opts);
    return r.code === 0 && /\bsudosubin\/gh-attach\b/i.test(r.out);
  },

  /**
   * 로컬 파일을 GitHub user-attachments 로 올려 인라인 렌더링 가능한 URL 을 받는다.
   * gh-attach 는 gh 의 OAuth 토큰이 아니라 로그인된 브라우저의 세션 쿠키(또는
   * GH_ATTACH_SESSION_TOKEN)로 업로드한다. 로컬에 github.com 에 로그인된 브라우저가
   * 없으면 실패하는 게 정상이라 예외를 던지지 않고 ok:false 로 알려 호출부가
   * 기존 수동 업로드 안내로 조용히 폴백하게 한다.
   */
  uploadAttachment(filePath, repo, opts = {}) {
    if (!this.hasAttachExtension(opts)) return { ok: false, reason: 'gh-attach 확장이 설치되어 있지 않음' };
    const r = run('gh', ['attach', 'upload', filePath, '-R', repo, '--json', 'href,name'], opts);
    if (r.code !== 0) return { ok: false, reason: (r.err || r.out || 'gh attach 실패').split('\n')[0] };
    try {
      const [item] = JSON.parse(r.out);
      if (!item?.href) return { ok: false, reason: 'gh attach 응답에 href 없음' };
      return { ok: true, href: item.href };
    } catch {
      return { ok: false, reason: 'gh attach 응답 파싱 실패' };
    }
  },
};

/* ------------------------------------------------------- GitHub 트래커 */

function githubTracker(root, cfg) {
  const repoArgs = (base) => (cfg.repo ? [...base, '--repo', cfg.repo] : base);
  const opts = { cwd: root };

  /** gh 이슈 JSON 을 정규화 모양으로. gh 는 이미 이 모양이라 통과시킨다. */
  const normalize = (it) => (it ? { ...it, key: `#${it.number}` } : null);

  return {
    provider: 'github',

    auth() {
      const r = run('gh', ['auth', 'status']);
      return {
        ok: r.code === 0,
        detail: r.code === 0 ? '로그인 상태' : (r.err || r.out || 'gh 인증 실패'),
        hint: r.code === 0 ? null : 'gh-setup 스킬로 설치·로그인을 끝내세요.',
      };
    },

    /** 이 트래커의 이슈 번호 표기. 워크트리·경로는 숫자를 쓰므로 표시용이다. */
    displayKey(number) {
      return `#${number}`;
    },

    hasIssueHistory() {
      const r = run('gh', repoArgs(['issue', 'list', '--state', 'all', '--limit', '1', '--json', 'number']), opts);
      return r.code === 0 && r.out.trim() !== '[]';
    },

    labelList() {
      const j = ghJson(repoArgs(['label', 'list', '--limit', '100', '--json', 'name,description']), opts);
      return j ?? null;
    },

    labelCreate(name, { color, description } = {}) {
      const args = repoArgs(['label', 'create', name, '--color', color ?? 'ededed']);
      if (description) args.push('--description', description);
      const r = run('gh', args, opts);
      return { created: r.code === 0, noop: false, err: r.err };
    },

    issueCreate({ title, bodyFile, labels = [], assignee }) {
      const args = repoArgs(['issue', 'create', '--title', title, '--body-file', bodyFile]);
      for (const l of labels) args.push('--label', l);
      if (assignee) args.push('--assignee', assignee);
      const r = run('gh', args, { ...opts, stdio: ['ignore', 'pipe', 'inherit'] });
      if (r.code !== 0) return { ok: false, err: r.err || r.out };
      const url = (r.out.split('\n').find((l) => l.includes('/issues/')) ?? r.out).trim();
      const number = Number(url.match(/\/issues\/(\d+)/)?.[1]);
      return number ? { ok: true, number, url } : { ok: false, err: `이슈 번호 파싱 실패:\n${r.out}` };
    },

    issueView(number) {
      const fields = [
        'number', 'title', 'state', 'body', 'labels', 'assignees',
        'milestone', 'comments', 'url', 'createdAt', 'updatedAt',
      ].join(',');
      return normalize(ghJson(repoArgs(['issue', 'view', String(number), '--json', fields]), opts));
    },

    issueList({ state = 'open', limit = 50, search, fields } = {}) {
      const f = fields ?? 'number,title,labels,url,createdAt';
      const args = repoArgs(['issue', 'list', '--state', state, '--limit', String(limit), '--json', f]);
      if (search) args.push('--search', search);
      const j = ghJson(args, opts);
      return j ? j.map(normalize) : null;
    },

    issueAddLabels(number, labels) {
      const args = repoArgs(['issue', 'edit', String(number)]);
      for (const l of labels) args.push('--add-label', l);
      const r = run('gh', args, opts);
      return { ok: r.code === 0, err: r.err };
    },

    issueRemoveLabels(number, labels) {
      const args = repoArgs(['issue', 'edit', String(number)]);
      for (const l of labels) args.push('--remove-label', l);
      const r = run('gh', args, opts);
      return { ok: r.code === 0, err: r.err };
    },

    issueUpdateLabels(number, { add = [], remove = [] }) {
      const args = repoArgs(['issue', 'edit', String(number)]);
      for (const label of add) args.push('--add-label', label);
      for (const label of remove) args.push('--remove-label', label);
      const r = run('gh', args, opts);
      return { ok: r.code === 0, err: r.err };
    },

    issueComment(number, bodyFile) {
      const r = run('gh', repoArgs(['issue', 'comment', String(number), '--body-file', bodyFile]), opts);
      return { ok: r.code === 0, err: r.err };
    },

    issueClose(number) {
      const r = run('gh', repoArgs(['issue', 'close', String(number)]), opts);
      return { ok: r.code === 0, err: r.err };
    },

    /** 첨부 이미지를 받을 때 쓸 토큰. */
    attachmentAuth() {
      const token = run('gh', ['auth', 'token']).out;
      return token ? {
        scheme: 'Bearer',
        token,
        trustedHosts: ['github.com', 'api.github.com', 'raw.githubusercontent.com'],
      } : null;
    },
  };
}

/* --------------------------------------------------------- Jira 트래커 */

/**
 * curl 로 동기 HTTP 를 친다.
 *
 * 이 저장소의 스크립트는 전부 동기(spawnSync) 다. fetch 를 쓰면 호출부를 전부
 * async 로 물들여야 해서, 이미 전제 조건에 들어 있는 curl 을 그대로 쓴다.
 */
export function curlJson({ method = 'GET', url, auth, body, timeout = 30 }) {
  const args = ['-sS', '--max-time', String(timeout), '-X', method, '-w', '\n%{http_code}'];
  if (auth) args.push('-H', `Authorization: Basic ${auth}`);
  args.push('-H', 'Accept: application/json');
  if (body !== undefined) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  }
  args.push(url);

  const res = spawnSync('curl', args, {
    encoding: 'utf8',
    input: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status !== 0) {
    return { ok: false, status: 0, err: (res.stderr || '').trim() || `curl exit ${res.status}` };
  }
  const out = (res.stdout || '').trim();
  const nl = out.lastIndexOf('\n');
  const status = Number(nl === -1 ? out : out.slice(nl + 1));
  const payload = nl === -1 ? '' : out.slice(0, nl);
  let json = null;
  try {
    json = payload ? JSON.parse(payload) : null;
  } catch {
    json = null;
  }
  return { ok: status >= 200 && status < 300, status, json, raw: payload };
}

/** Jira 라벨은 공백을 허용하지 않는다. 조용히 버리지 않고 바꾼 뒤 알린다. */
export function sanitizeJiraLabel(label) {
  const safe = String(label).trim().replace(/\s+/g, '-');
  return { label: safe, changed: safe !== String(label).trim() };
}

const adfText = (text, marks) => ({ type: 'text', text, ...(marks?.length ? { marks } : {}) });

/** 스킬 리포트에 필요한 Markdown 부분집합을 Jira REST v3 ADF로 바꾼다. */
export function markdownToAdf(markdown) {
  const lines = String(markdown ?? '').replace(/\r\n/g, '\n').split('\n');
  const content = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: [adfText(heading[2])] });
      continue;
    }
    if (/^```/.test(line)) {
      const code = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      content.push({ type: 'codeBlock', content: code.length ? [adfText(code.join('\n'))] : [] });
      continue;
    }
    const list = line.match(/^([-*+] |\d+\. )(.+)$/);
    if (list) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length) {
        const item = lines[i].match(ordered ? /^\d+\.\s+(.+)$/ : /^[-*+]\s+(.+)$/);
        if (!item) break;
        items.push({ type: 'listItem', content: [{ type: 'paragraph', content: inlineToAdf(item[1]) }] });
        i += 1;
      }
      i -= 1;
      content.push({ type: ordered ? 'orderedList' : 'bulletList', content: items });
      continue;
    }
    content.push({ type: 'paragraph', content: inlineToAdf(line) });
  }
  return { version: 1, type: 'doc', content };
}

function inlineToAdf(text) {
  const nodes = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  let at = 0;
  for (const hit of text.matchAll(re)) {
    if (hit.index > at) nodes.push(adfText(text.slice(at, hit.index)));
    nodes.push(adfText(hit[1], [{ type: 'link', attrs: { href: hit[2] } }]));
    at = hit.index + hit[0].length;
  }
  if (at < text.length) nodes.push(adfText(text.slice(at)));
  return nodes.length ? nodes : [];
}

/** Jira v3 ADF 응답을 스킬의 기존 문자열 body 계약으로 정규화한다. */
export function adfToMarkdown(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const text = (node) => (node?.content ?? []).map((child) => {
    if (child.type === 'text') {
      const link = child.marks?.find((mark) => mark.type === 'link')?.attrs?.href;
      return link ? `[${child.text ?? ''}](${link})` : (child.text ?? '');
    }
    if (child.type === 'hardBreak') return '\n';
    return text(child);
  }).join('');
  const block = (node) => {
    const body = text(node);
    if (node.type === 'heading') return `${'#'.repeat(node.attrs?.level ?? 1)} ${body}`;
    if (node.type === 'codeBlock') return `\`\`\`\n${body}\n\`\`\``;
    if (node.type === 'bulletList') return (node.content ?? []).map((item) => `- ${text(item)}`).join('\n');
    if (node.type === 'orderedList') return (node.content ?? []).map((item, i) => `${i + 1}. ${text(item)}`).join('\n');
    return body;
  };
  return (value.content ?? []).map(block).filter(Boolean).join('\n\n');
}

function jiraTracker(cfg) {
  const base = String(cfg.baseUrl ?? '').replace(/\/+$/, '');
  const projectKey = cfg.projectKey;
  const email = cfg.email;
  const tokenEnv = cfg.tokenEnv ?? 'JIRA_API_TOKEN';
  const token = process.env[tokenEnv];
  const issueType = cfg.issueType ?? 'Task';
  const doneStatus = (Array.isArray(cfg.doneStatus) ? cfg.doneStatus : [cfg.doneStatus ?? 'Done']).filter(Boolean);

  const auth = email && token ? Buffer.from(`${email}:${token}`).toString('base64') : null;
  const api = (p) => `${base}/rest/api/3${p}`;
  const key = (n) => (/^[A-Za-z]/.test(String(n)) ? String(n) : `${projectKey}-${n}`);
  const numberOf = (k) => Number(String(k).split('-').pop());
  const browse = (k) => `${base}/browse/${k}`;

  const call = (method, p, body) => curlJson({ method, url: api(p), auth, body });

  const isDone = (statusName) => doneStatus.some((s) => String(s).toLowerCase() === String(statusName ?? '').toLowerCase());

  /** Jira 이슈를 gh JSON 과 같은 모양으로 맞춘다. 호출부를 안 고치기 위해서다. */
  const normalize = (it) => {
    if (!it) return null;
    const f = it.fields ?? {};
    return {
      number: numberOf(it.key),
      key: it.key,
      title: f.summary ?? '',
      state: isDone(f.status?.name) ? 'CLOSED' : 'OPEN',
      statusName: f.status?.name ?? null,
      body: adfToMarkdown(f.description),
      url: browse(it.key),
      labels: (f.labels ?? []).map((name) => ({ name })),
      assignees: f.assignee ? [{ login: f.assignee.displayName ?? f.assignee.accountId }] : [],
      milestone: null,
      comments: (f.comment?.comments ?? []).map((c) => ({
        author: { login: c.author?.displayName ?? 'unknown' },
        body: adfToMarkdown(c.body),
        createdAt: c.created ?? '',
      })),
      createdAt: f.created ?? null,
      updatedAt: f.updated ?? null,
    };
  };

  const missing = () => {
    const gaps = [];
    if (!base) gaps.push(`provider.jira.baseUrl (예: https://acme.atlassian.net)`);
    if (!projectKey) gaps.push('provider.jira.projectKey (예: ACME)');
    if (!email) gaps.push('provider.jira.email');
    if (!token) gaps.push(`환경변수 ${tokenEnv} (provider.jira.tokenEnv 로 이름을 바꿀 수 있다)`);
    return gaps;
  };

  return {
    provider: 'jira',
    projectKey,

    auth() {
      const gaps = missing();
      if (gaps.length) {
        return {
          ok: false,
          detail: `Jira 설정이 비어 있습니다: ${gaps.join(', ')}`,
          hint: '~/.issue/settings.json 의 provider.jira 를 채우고 토큰을 환경변수로 내보내세요.',
        };
      }
      const r = call('GET', '/myself');
      return {
        ok: r.ok,
        detail: r.ok ? `${r.json?.displayName ?? email} 로 인증됨` : `Jira 인증 실패 (HTTP ${r.status})`,
        hint: r.ok ? null
          : `${base} 와 ${tokenEnv} 토큰이 유효한지 확인하세요. Jira Cloud 는 계정 이메일 + API 토큰 조합입니다.`,
      };
    },

    displayKey(number) {
      return key(number);
    },

    hasIssueHistory() {
      const r = call('GET', `/search?jql=${encodeURIComponent(`project = ${projectKey}`)}&maxResults=1&fields=key`);
      return r.ok && (r.json?.issues?.length ?? 0) > 0;
    },

    labelList() {
      const r = call('GET', '/label?maxResults=100');
      if (!r.ok) return null;
      return (r.json?.values ?? []).map((name) => ({ name, description: null }));
    },

    /**
     * Jira 에는 라벨을 미리 만드는 개념이 없다. 이슈에 붙이는 순간 생긴다.
     * 실패로 보고하면 호출부가 막히므로 성공 + noop 으로 알린다.
     */
    labelCreate() {
      return { created: false, noop: true, note: 'Jira 는 라벨을 미리 만들지 않는다. 부착 시 자동 생성된다.' };
    },

    issueCreate({ title, bodyFile, labels = [], assignee }) {
      const description = existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : '';
      const clean = labels.map(sanitizeJiraLabel);
      for (const c of clean.filter((x) => x.changed)) {
        console.error(`! Jira 라벨은 공백을 허용하지 않아 "${c.label}" 로 바꿔 붙입니다.`);
      }
      const fields = {
        project: { key: projectKey },
        summary: title,
        description: markdownToAdf(description),
        issuetype: { name: issueType },
        labels: clean.map((c) => c.label),
      };
      if (assignee) fields.assignee = { accountId: assignee };
      const r = call('POST', '/issue', { fields });
      if (!r.ok) return { ok: false, err: `Jira 이슈 생성 실패 (HTTP ${r.status}): ${r.raw ?? ''}` };
      return { ok: true, number: numberOf(r.json.key), key: r.json.key, url: browse(r.json.key) };
    },

    issueView(number) {
      const r = call('GET', `/issue/${key(number)}?fields=summary,description,status,labels,assignee,comment,created,updated`);
      return r.ok ? normalize(r.json) : null;
    },

    issueList({ state = 'open', limit = 50, search } = {}) {
      const clauses = [`project = ${projectKey}`];
      if (state === 'open') clauses.push('statusCategory != Done');
      else if (state === 'closed') clauses.push('statusCategory = Done');
      if (search) clauses.push(`text ~ ${JSON.stringify(search)}`);
      const jql = `${clauses.join(' AND ')} ORDER BY created DESC`;
      const r = call(
        'GET',
        `/search?jql=${encodeURIComponent(jql)}&maxResults=${limit}&fields=summary,status,labels,created`,
      );
      if (!r.ok) return null;
      return (r.json?.issues ?? []).map(normalize);
    },

    issueAddLabels(number, labels) {
      const clean = labels.map((l) => sanitizeJiraLabel(l).label);
      const r = call('PUT', `/issue/${key(number)}`, {
        update: { labels: clean.map((l) => ({ add: l })) },
      });
      return { ok: r.ok, err: r.ok ? null : `HTTP ${r.status}: ${r.raw ?? ''}` };
    },

    issueRemoveLabels(number, labels) {
      const clean = labels.map((l) => sanitizeJiraLabel(l).label);
      const r = call('PUT', `/issue/${key(number)}`, {
        update: { labels: clean.map((l) => ({ remove: l })) },
      });
      return { ok: r.ok, err: r.ok ? null : `HTTP ${r.status}: ${r.raw ?? ''}` };
    },

    issueComment(number, bodyFile) {
      const body = existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : '';
      const r = call('POST', `/issue/${key(number)}/comment`, { body: markdownToAdf(body) });
      return { ok: r.ok, err: r.ok ? null : `HTTP ${r.status}: ${r.raw ?? ''}` };
    },

    /** Jira 는 상태를 직접 못 바꾼다. 완료 상태로 가는 전이를 찾아 실행한다. */
    issueClose(number) {
      const k = key(number);
      const list = call('GET', `/issue/${k}/transitions`);
      if (!list.ok) return { ok: false, err: `전이 목록 조회 실패 (HTTP ${list.status})` };
      const transitions = list.json?.transitions ?? [];
      const hit = transitions.find((t) => isDone(t.to?.name) || isDone(t.name));
      if (!hit) {
        const names = transitions.map((t) => t.name).join(', ') || '(없음)';
        return {
          ok: false,
          err: `완료 상태(${doneStatus.join(' / ')})로 가는 전이가 없습니다. 가능한 전이: ${names}`,
        };
      }
      const r = call('POST', `/issue/${k}/transitions`, { transition: { id: hit.id } });
      return { ok: r.ok, err: r.ok ? null : `전이 실행 실패 (HTTP ${r.status}): ${r.raw ?? ''}` };
    },

    /** Jira 첨부는 같은 Basic 인증을 쓴다. */
    attachmentAuth() {
      let hostname = null;
      try {
        hostname = new URL(base).hostname;
      } catch {
        hostname = null;
      }
      return auth ? {
        scheme: 'Basic',
        token: auth,
        trustedHosts: hostname ? [hostname] : [],
      } : null;
    },
  };
}

/* ------------------------------------------------------------- 팩토리 */

export function createTracker(root, { settings, repo } = {}) {
  const cfg = resolveProviderConfig(settings);
  if (cfg.type === 'jira') return jiraTracker(cfg.jira);
  return githubTracker(root, { ...cfg.github, repo: repo ?? cfg.github.repo });
}

/**
 * 트래커 인증을 확인하고, 실패하면 무엇을 채워야 하는지 함께 보고한다.
 * exit 코드로 막지 않고 결과만 돌려준다. 호출부가 상황에 맞게 정한다.
 */
export function checkTrackerAuth(tracker) {
  const r = tracker.auth();
  if (!r.ok) {
    console.error(`✗ ${tracker.provider} 인증 실패: ${r.detail}`);
    if (r.hint) console.error(`  ${r.hint}`);
  }
  return r;
}

/** 진행 상태 라벨을 트래커 안에서만 교체한다. Jira도 labels 필드로 같은 메타데이터를 유지한다. */
export function setTrackerStatus(tracker, number, status, { dryRun = false, quiet = false } = {}) {
  const target = resolveStatus(status);
  if (!target) return { ok: false, changed: false, status: null, previous: null, err: `모르는 상태: ${status}` };
  const issue = tracker.issueView(number);
  if (!issue) return { ok: false, changed: false, status: target, previous: null, err: '이슈 라벨을 읽지 못했습니다.' };
  const labels = (issue.labels ?? []).map((label) => label.name);
  const stale = labels.filter((label) => isStatusLabel(label) && label !== target);
  const previous = stale[0] ?? (labels.includes(target) ? target : null);
  if (labels.includes(target) && !stale.length) return { ok: true, changed: false, status: target, previous };
  if (dryRun) return { ok: true, changed: false, status: target, previous };
  if (!labels.includes(target) && tracker.provider === 'github') {
    // 이미 있는 라벨 생성은 GitHub가 거절하지만, 뒤의 issue edit은 그대로 성공한다.
    // 사전 목록 조회를 피하면 상태 전환이 한 번의 읽기와 쓰기로 끝난다.
    tracker.labelCreate(target, STATUS_LABELS[target]);
  }
  if (tracker.provider === 'github') {
    const update = tracker.issueUpdateLabels(number, { add: labels.includes(target) ? [] : [target], remove: stale });
    if (!update.ok) return { ok: false, changed: false, status: target, previous, err: update.err };
  } else {
    if (!labels.includes(target)) {
      const added = tracker.issueAddLabels(number, [target]);
      if (!added.ok) return { ok: false, changed: false, status: target, previous, err: added.err };
    }
    if (stale.length) {
      const removed = tracker.issueRemoveLabels(number, stale);
      if (!removed.ok) return { ok: false, changed: false, status: target, previous, err: removed.err };
    }
  }
  if (!quiet) console.log(`✓ ${tracker.displayKey(number)} ${previous ?? '(없음)'} → ${target}`);
  // 상태 전환은 모든 스킬이 이 한 곳을 지난다. 여기서 DAG 노드를 자동 갱신한다.
  // graph.json 이 없으면 no-op 이고, 실패해도 상태 전환 결과를 바꾸지 않는다.
  // repoRoot() 는 저장소가 아니면 process.exit 하는데(try/catch 로 못 막음) 상태 전환은
  // 이미 성공했으므로 절대 죽으면 안 된다. 안전하게 top-level 을 구하고, 워크트리가 아니라
  // base 를 담은 메인 체크아웃의 graph 를 갱신해 모든 워크트리가 같은 그래프를 본다.
  try {
    const top = run('git', ['rev-parse', '--show-toplevel']);
    const graphRoot = top.code === 0 && top.out ? (mainCheckout(top.out) ?? top.out) : null;
    if (graphRoot) {
      patchGraphNode(graphRoot, {
        number, title: issue.title, url: issue.url,
        labels: (issue.labels ?? []).map((l) => l.name),
        status: target.slice('status:'.length),
      });
    }
  } catch { /* 그래프 갱신 실패는 상태 전환을 막지 않는다 */ }
  return { ok: true, changed: true, status: target, previous };
}

/* --------------------------------------------------------- 증거 URL */

/** 증거 파일들의 raw.githubusercontent URL 을 만든다. 코드 호스트 기준이라 gitHost 소관이다. */
export function evidenceUrls({ root, key, issue, branch, mirrorRef, base }) {
  const repo = gitHost.repoInfo(root);
  if (!repo?.nameWithOwner) fail('저장소 식별 실패. gh 로그인 상태 또는 origin 설정을 확인하세요.');
  const ref = mirrorRef || detectBase(root, 'origin', base);
  const files = listEvidence(root, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${evidenceRel(root, key)}`);

  const raw = (r, p) => `https://raw.githubusercontent.com/${repo.nameWithOwner}/${r}/${p}`;
  // private 저장소는 GitHub 이 Sec-Fetch-Site 로 응답을 가른다.
  // 주소창으로 열면 서명 토큰이 붙어 보이지만, 코멘트의 <img> 요청에는 붙지 않아 무조건 깨진다.
  // 저장소 파일 URL 계열(raw / github.com/raw / release)은 전부 같은 제약을 받으므로
  // user-attachments URL 외에는 인라인 방법이 없다. gh-attach 확장이 있으면 그 URL을
  // 자동으로 만들고, 없거나(로컬에 로그인된 브라우저가 없어) 실패하면 사람이 웹 UI로
  // 직접 올리는 기존 경로로 이미지별로 폴백한다.
  const manual = Boolean(repo.isPrivate);
  const images = files.map((p) => {
    const localPath = path.join(root, p);
    const entry = {
      path: p,
      localPath,
      phase: p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other',
      branchUrl: branch ? raw(branch, p) : null,
      mirrorUrl: raw(ref, p),
    };
    if (!manual) return { ...entry, inlineUrl: raw(ref, p), auxUrl: null, autoUploaded: false, autoUploadError: null };

    const uploaded = gitHost.uploadAttachment(localPath, repo.nameWithOwner, root ? { cwd: root } : {});
    return {
      ...entry,
      // 인라인 이미지로 써도 되는 URL. gh-attach 자동 업로드가 실패했으면 null.
      inlineUrl: uploaded.ok ? uploaded.href : null,
      // 이미지가 아닌 보조 링크로만 쓰는 URL.
      auxUrl: raw(ref, p),
      autoUploaded: uploaded.ok,
      autoUploadError: uploaded.ok ? null : uploaded.reason,
    };
  });
  const pendingManual = manual ? images.filter((img) => !img.inlineUrl) : [];

  return {
    repo: repo.nameWithOwner,
    isPrivate: repo.isPrivate,
    issue,
    branch,
    mirrorRef: ref,
    renderMode: !manual ? 'raw' : pendingManual.length ? 'manual-upload' : 'auto-upload',
    uploadUrl: pendingManual.length && issue ? `https://github.com/${repo.nameWithOwner}/issues/${issue}` : null,
    note: !manual
      ? null
      : pendingManual.length
        ? 'private 저장소입니다. raw URL 은 <img> 로는 렌더링되지 않습니다(주소창으로는 열립니다). '
          + `gh-attach 자동 업로드로 안 된 ${pendingManual.length}장이 있습니다(${pendingManual.map((img) => `${img.path}: ${img.autoUploadError}`).join('; ')}). `
          + 'uploadUrl 의 이슈 코멘트 입력창에 해당 images[].localPath 의 webp 를 끌어다 놓아 user-attachments URL 을 얻은 뒤 '
          + 'comment.md 의 ![설명](...) 에 그 URL 을 넣으세요. raw URL 은 이미지가 아닌 보조 링크 [파일명](auxUrl) 로만 남깁니다.'
        : 'private 저장소입니다. 모든 이미지를 gh-attach 로 자동 업로드해 inlineUrl 을 채웠습니다. 그대로 comment.md 의 ![설명](inlineUrl) 에 쓰세요.',
    images,
  };
}
