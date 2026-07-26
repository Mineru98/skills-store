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
 * REST v3 는 본문이 ADF(Atlassian Document Format) 라는 JSON 문서 트리라 마크다운을
 * 그대로 못 넣는다. 변환기를 직접 쓰는 비용이 이 스킬의 목적에 비해 크다.
 * v2 는 문자열 본문을 받으므로 마크다운 원문을 손실 없이 저장할 수 있다.
 * 렌더는 Jira wiki markup 기준이라 표·코드펜스 일부가 그대로 보이지 않을 수 있다.
 *
 * 의존성 없음. Node 18+, curl.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';
import {
  run, fail, detectBase, listEvidence, evidenceRel, repoSlugFromRemote, readIssueSettings,
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
      return token ? { scheme: 'Bearer', token } : null;
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

function jiraTracker(cfg) {
  const base = String(cfg.baseUrl ?? '').replace(/\/+$/, '');
  const projectKey = cfg.projectKey;
  const email = cfg.email;
  const tokenEnv = cfg.tokenEnv ?? 'JIRA_API_TOKEN';
  const token = process.env[tokenEnv];
  const issueType = cfg.issueType ?? 'Task';
  const doneStatus = (Array.isArray(cfg.doneStatus) ? cfg.doneStatus : [cfg.doneStatus ?? 'Done']).filter(Boolean);

  const auth = email && token ? Buffer.from(`${email}:${token}`).toString('base64') : null;
  const api = (p) => `${base}/rest/api/2${p}`;
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
      body: f.description ?? '',
      url: browse(it.key),
      labels: (f.labels ?? []).map((name) => ({ name })),
      assignees: f.assignee ? [{ login: f.assignee.displayName ?? f.assignee.accountId }] : [],
      milestone: null,
      comments: (f.comment?.comments ?? []).map((c) => ({
        author: { login: c.author?.displayName ?? 'unknown' },
        body: c.body ?? '',
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
        description,
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

    issueComment(number, bodyFile) {
      const body = existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : '';
      const r = call('POST', `/issue/${key(number)}/comment`, { body });
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
      return auth ? { scheme: 'Basic', token: auth } : null;
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

/* --------------------------------------------------------- 증거 URL */

/** 증거 파일들의 raw.githubusercontent URL 을 만든다. 코드 호스트 기준이라 gitHost 소관이다. */
export function evidenceUrls({ root, key, issue, branch, mirrorRef, base }) {
  const repo = gitHost.repoInfo(root);
  if (!repo?.nameWithOwner) fail('저장소 식별 실패. gh 로그인 상태 또는 origin 설정을 확인하세요.');
  const ref = mirrorRef || detectBase(root, 'origin', base);
  const files = listEvidence(root, key);
  if (files.length === 0) fail(`증거 파일이 없습니다: ${evidenceRel(root, key)}`);

  const raw = (r, p) => `https://raw.githubusercontent.com/${repo.nameWithOwner}/${r}/${p}`;
  return {
    repo: repo.nameWithOwner,
    isPrivate: repo.isPrivate,
    issue,
    branch,
    mirrorRef: ref,
    note: repo.isPrivate
      ? 'private 저장소는 raw URL 이 코멘트에서 렌더링되지 않습니다. 이미지를 웹 UI 로 직접 첨부하고 raw URL 은 보조 링크로만 남기세요.'
      : null,
    images: files.map((p) => ({
      path: p,
      phase: p.includes('/before/') ? 'before' : p.includes('/after/') ? 'after' : 'other',
      branchUrl: branch ? raw(branch, p) : null,
      mirrorUrl: raw(ref, p),
    })),
  };
}
