#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { publishDocumentation, resolveDocsConfig } from '../tools/issue-docs.mjs';

let failed = 0;
function check(name, ok, detail) {
  if (ok) return;
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  check(name, actual === expected, `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(here, 'fixtures', 'fake-confluence.mjs')], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('가짜 Confluence 서버가 5초 안에 뜨지 않았다')), 5000);
  child.stdout.on('data', (chunk) => {
    const match = String(chunk).match(/READY (\d+)/);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const seen = async () => (await (await fetch(`${baseUrl}/__seen`)).json());

const root = mkdtempSync(path.join(os.tmpdir(), 'issue-docs-test-'));
const key = '13';
const reportFile = path.join(root, '.issue', key, 'evidence', 'comment.md');
mkdirSync(path.dirname(reportFile), { recursive: true });
mkdirSync(path.join(root, '.issue', key, 'evidence', 'after'), { recursive: true });
writeFileSync(path.join(root, '.issue', key, 'issue.json'), JSON.stringify({ key: '#13', title: 'Confluence 게시' }));
writeFileSync(reportFile, '## 리포트\n\n증거 <보존>');
writeFileSync(path.join(root, '.issue', key, 'evidence', 'after', 'report.webp'), 'fake-webp');

eq('docs 기본값은 none', resolveDocsConfig({}).type, 'none');
const disabled = publishDocumentation({ root, key, reportFile, settings: {} });
check('docs 미설정은 건너뜀', disabled.ok && disabled.skipped);

process.env.TEST_CONFLUENCE_TOKEN = 'fake-token';
const settings = {
  docs: {
    type: 'confluence',
    confluence: {
      baseUrl,
      spaceKey: 'ENG',
      parentPageId: '77',
      email: 'me@example.com',
      tokenEnv: 'TEST_CONFLUENCE_TOKEN',
    },
  },
};
const first = publishDocumentation({ root, key, reportFile, settings });
const firstSeen = await seen();
check('Confluence 페이지 생성', first.ok && first.created, first.warning);
eq('페이지는 한 개', firstSeen.pages.length, 1);
eq('첨부는 webp 한 개', firstSeen.uploads.length, 1);
check('Basic 인증 전송', String(firstSeen.uploads[0]?.auth).startsWith('Basic '));
eq('첨부 CSRF 헤더', firstSeen.uploads[0]?.token, 'no-check');
check('첨부 파일명 전송', firstSeen.uploads[0]?.raw.includes('report.webp'));
check('storage 본문이 첨부 이미지를 참조', firstSeen.pages[0]?.body.storage.value.includes('ac:image'));
check('storage 본문이 리포트를 escape', firstSeen.pages[0]?.body.storage.value.includes('&lt;보존&gt;'));
check('리포트에 페이지 URL 기록', readFileSync(reportFile, 'utf8').includes(first.url));

writeFileSync(reportFile, '## 마무리 리포트\n\n갱신됨');
const second = publishDocumentation({ root, key, reportFile, settings });
const secondSeen = await seen();
check('같은 페이지 갱신', second.ok && !second.created, second.warning);
eq('갱신 뒤에도 페이지 한 개', secondSeen.pages.length, 1);
eq('갱신 version', secondSeen.pages[0]?.version.number, 2);
eq('갱신도 첨부 처리', secondSeen.uploads.length, 2);

const failedPublish = publishDocumentation({
  root,
  key,
  reportFile,
  settings: { docs: { type: 'confluence', confluence: { ...settings.docs.confluence, baseUrl: 'http://127.0.0.1:1' } } },
});
check('게시 실패는 결과로만 보고', failedPublish.ok === false && Boolean(failedPublish.warning));

child.kill();
rmSync(root, { recursive: true, force: true });
if (failed) {
  console.error(`\ntest-docs: 실패 ${failed}건`);
  process.exit(1);
}
console.log('test-docs: 통과');
