#!/usr/bin/env node
/**
 * tools/issue-tracker.mjs 스모크 테스트.
 *
 *   node scripts/test-tracker.mjs
 *
 * Jira 경로는 실제 인스턴스 없이 검증한다. 가짜 Jira 서버를 **별도 프로세스로** 띄우고
 * 어댑터가 보낸 메서드·경로·본문을 그대로 되돌려받아 대조한다.
 * 네트워크가 없어도 재현되어야 하므로 외부 호출은 하나도 하지 않는다.
 *
 * 서버를 같은 프로세스에 두면 안 된다. 어댑터가 curl 을 spawnSync 로 부르는 동안
 * 이 프로세스의 이벤트 루프가 멈춰서 서버가 요청을 받지 못하고 그대로 멈춰버린다.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import {
  resolveProviderConfig, providerType, createTracker, sanitizeJiraLabel, curlJson, PROVIDERS,
  markdownToAdf, adfToMarkdown,
} from '../tools/issue-tracker.mjs';

let failed = 0;
function check(name, ok, detail) {
  if (ok) return;
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  check(name, actual === expected, `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
}

/* ------------------------------------------------------------ 설정 해석 */

eq('기본 provider 는 github', providerType({}), 'github');
eq('provider 미설정도 github', providerType({ provider: {} }), 'github');
eq('알 수 없는 type 은 github 로 낮춘다', providerType({ provider: { type: 'gitlab' } }), 'github');
eq('jira 설정을 인식', providerType({ provider: { type: 'jira' } }), 'jira');
check('PROVIDERS 목록', PROVIDERS.join(',') === 'github,jira');

const cfg = resolveProviderConfig({ provider: { type: 'jira', jira: { projectKey: 'ACME' } } });
eq('jira 하위 설정 보존', cfg.jira.projectKey, 'ACME');
check('github 하위 설정 기본값은 빈 객체', typeof cfg.github === 'object');

/* -------------------------------------------------------------- 라벨 */

eq('공백 없는 라벨은 그대로', sanitizeJiraLabel('enhancement').label, 'enhancement');
eq('콜론 라벨도 그대로', sanitizeJiraLabel('status:open').label, 'status:open');
eq('공백은 하이픈으로', sanitizeJiraLabel('good first issue').label, 'good-first-issue');
check('바뀐 사실을 알린다', sanitizeJiraLabel('good first issue').changed === true);
check('안 바뀌면 changed=false', sanitizeJiraLabel('bug').changed === false);

const adf = markdownToAdf('## 배경\n\n본문 [링크](https://example.com)\n\n- 하나\n- 둘\n\n```\nconst x = 1;\n```');
eq('ADF 문서 버전', adf.version, 1);
eq('ADF 문서 타입', adf.type, 'doc');
check('ADF 제목 변환', adf.content.some((node) => node.type === 'heading'));
check('ADF 목록 변환', adf.content.some((node) => node.type === 'bulletList'));
check('ADF 코드 변환', adf.content.some((node) => node.type === 'codeBlock'));
check('ADF 링크 변환', JSON.stringify(adf).includes('https://example.com'));
check('ADF 역변환', adfToMarkdown(adf).includes('## 배경'));

/* ------------------------------------------------ 가짜 Jira 서버로 검증 */

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(here, 'fixtures', 'fake-jira.mjs')], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('가짜 Jira 서버가 5초 안에 뜨지 않았다')), 5000);
  child.stdout.on('data', (chunk) => {
    const m = String(chunk).match(/READY (\d+)/);
    if (m) {
      clearTimeout(timer);
      resolve(Number(m[1]));
    }
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const stopServer = () => curlJson({ method: 'GET', url: `${baseUrl}/__shutdown` });
const requests = () => curlJson({ method: 'GET', url: `${baseUrl}/__seen` }).json ?? [];

process.env.TEST_JIRA_TOKEN = 'fake-token';
const settings = {
  provider: {
    type: 'jira',
    jira: {
      baseUrl,
      projectKey: 'ACME',
      email: 'me@acme.com',
      tokenEnv: 'TEST_JIRA_TOKEN',
      issueType: 'Task',
      doneStatus: ['Done'],
    },
  },
};
const jira = createTracker(process.cwd(), { settings });

eq('provider 이름', jira.provider, 'jira');
eq('번호를 프로젝트 키로 표기', jira.displayKey(77), 'ACME-77');
eq('이미 키면 그대로', jira.displayKey('ACME-77'), 'ACME-77');

const auth = jira.auth();
check('인증 성공', auth.ok, auth.detail);
check('인증 실패 시 안내가 붙는다', createTracker(process.cwd(), {
  settings: { provider: { type: 'jira', jira: {} } },
}).auth().hint !== null);

const labels = jira.labelList();
eq('라벨 목록 개수', labels.length, 2);
eq('라벨 이름', labels[0].name, 'bug');
check('Jira 라벨 생성은 noop', jira.labelCreate('chore').noop === true);

const view = jira.issueView(77);
eq('제목', view.title, '주문 목록이 빈다');
eq('완료 상태가 아니면 OPEN', view.state, 'OPEN');
eq('원래 상태 이름 보존', view.statusName, 'In Progress');
eq('키에서 번호 추출', view.number, 77);
eq('라벨을 gh 모양으로', view.labels[0].name, 'bug');
eq('담당자를 gh 모양으로', view.assignees[0].login, '담당자');
eq('코멘트를 gh 모양으로', view.comments[0].author.login, '리뷰어');
check('ADF 본문 정규화', view.body.startsWith('## 배경'));

const list = jira.issueList({ state: 'open', search: '주문' });
eq('검색 결과 개수', list.length, 1);
eq('완료 상태는 CLOSED 로', list[0].state, 'CLOSED');
const searchReq = requests().find((r) => r.url.startsWith('/rest/api/3/search'));
const jql = decodeURIComponent(searchReq.url.split('jql=')[1].split('&')[0]);
check('JQL 에 프로젝트 조건', jql.includes('project = ACME'), jql);
check('열린 이슈만 거르는 조건', jql.includes('statusCategory != Done'), jql);
check('검색어가 text ~ 로', jql.includes('text ~ "주문"'), jql);

const tmp = mkdtempSync(path.join(os.tmpdir(), 'issue-tracker-test-'));
const bodyFile = path.join(tmp, 'body.md');
writeFileSync(bodyFile, '## 배경\n\n본문이다\n');

const created = jira.issueCreate({ title: '새 이슈', bodyFile, labels: ['bug', 'good first issue'] });
check('이슈 생성 성공', created.ok, created.err);
eq('생성된 번호', created.number, 77);
eq('생성된 키', created.key, 'ACME-77');
eq('생성 URL', created.url, `${baseUrl}/browse/ACME-77`);
const createReq = requests().find((r) => r.url === '/rest/api/3/issue' && r.method === 'POST');
check('Basic 인증 헤더를 붙인다', String(createReq.auth ?? '').startsWith('Basic '), createReq.auth);
eq('프로젝트 키 전달', createReq.body.fields.project.key, 'ACME');
eq('이슈 타입 전달', createReq.body.fields.issuetype.name, 'Task');
eq('생성 본문은 ADF 문서', createReq.body.fields.description.type, 'doc');
eq('생성 본문 ADF 버전', createReq.body.fields.description.version, 1);
check('본문을 ADF로 넣는다', JSON.stringify(createReq.body.fields.description).includes('본문이다'));
eq('공백 라벨을 정리해 보낸다', createReq.body.fields.labels[1], 'good-first-issue');

check('라벨 부착 성공', jira.issueAddLabels(77, ['chore']).ok);
const labelReq = requests().find((r) => r.method === 'PUT');
eq('라벨은 add 연산으로', labelReq.body.update.labels[0].add, 'chore');

const commentFile = path.join(tmp, 'comment.md');
writeFileSync(commentFile, '리포트 본문');
check('코멘트 성공', jira.issueComment(77, commentFile).ok);
const commentReq = requests().find((r) => r.url.includes('/comment'));
eq('코멘트 본문은 ADF 문서', commentReq.body.body.type, 'doc');
check('코멘트 본문 ADF 전달', JSON.stringify(commentReq.body.body).includes('리포트 본문'));

check('종료 성공', jira.issueClose(77).ok);
const transitionPost = requests().find((r) => r.url.includes('/transitions') && r.method === 'POST');
eq('완료로 가는 전이 id 를 골랐다', transitionPost.body.transition.id, '31');

/* --------------------------------------------------- 실패 경로도 확인한다 */

const allJiraRequestsUseV3 = requests()
  .filter((r) => r.url.startsWith('/rest/api/'))
  .every((r) => r.url.startsWith('/rest/api/3/'));
check('모든 Jira 요청은 REST v3', allJiraRequestsUseV3);

const notFound = curlJson({ method: 'GET', url: `${baseUrl}/rest/api/3/nope` });
check('404 는 ok=false', notFound.ok === false);
eq('상태 코드 보존', notFound.status, 404);

const badTracker = createTracker(process.cwd(), {
  settings: { provider: { type: 'jira', jira: { baseUrl, projectKey: 'ACME', email: 'a@b.c', tokenEnv: 'TEST_JIRA_TOKEN' } } },
});
eq('없는 이슈는 null', badTracker.issueView(999), null);

/* -------------------------------------------------------- github 기본값 */

const gh = createTracker(process.cwd(), { settings: {} });
eq('설정이 비면 github 트래커', gh.provider, 'github');
eq('github 표기는 #번호', gh.displayKey(12), '#12');

stopServer();
child.kill();
rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error(`\ntest-tracker: 실패 ${failed}건`);
  process.exit(1);
}
console.log('test-tracker: 통과');
