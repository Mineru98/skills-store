#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import {
  mkdtempSync, readdirSync, rmSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyImageUrl,
  collectImageReferences,
  downloadImageReference,
  isTrustedAuthUrl,
  resolveDownloadTarget,
  validateEvidenceReport,
} from '../tools/issue-media.mjs';

let failed = 0;
function check(name, ok, detail) {
  if (ok) return;
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}
function eq(name, actual, expected) {
  check(name, actual === expected, `기대 ${JSON.stringify(expected)} / 실제 ${JSON.stringify(actual)}`);
}

const sourceUrl = 'https://github.com/acme/private/issues/7';
const refs = collectImageReferences([{
  source: '#7 본문',
  sourceUrl,
  text: [
    '![절대](https://cdn.example.com/a.png)',
    '![상대](../blob/main/docs/a.png?raw=true)',
    '<img alt="HTML 절대" src="https://cdn.example.com/b.webp">',
    '<img alt="HTML 상대" src="../blob/main/docs/b.webp?raw=true">',
    '[페이지](../blob/main/docs/c.png)',
    'https://cdn.example.com/bare.png',
  ].join('\n'),
}]);
eq('Markdown·HTML·링크·bare 수집', refs.length, 6);
eq('인라인 이미지 4건', refs.filter((ref) => ref.inline).length, 4);
eq('상대경로 절대화', refs[1].resolvedUrl, 'https://github.com/acme/private/blob/main/docs/a.png?raw=true');
eq('HTML 상대경로 절대화', refs[3].resolvedUrl, 'https://github.com/acme/private/blob/main/docs/b.webp?raw=true');
eq('blob 페이지 분류', refs[4].kind, 'blob');
eq('bare URL 분류', refs[5].syntax, 'bare-url');
eq('raw 분류', classifyImageUrl('https://raw.githubusercontent.com/acme/private/main/a.png'), 'raw');
eq('release 분류', classifyImageUrl('https://github.com/acme/private/releases/download/v1/a.png'), 'release');
eq('user-attachments 분류', classifyImageUrl('https://github.com/user-attachments/assets/abc'), 'user-attachment');

const githubAuth = {
  scheme: 'Bearer',
  token: 'secret',
  trustedHosts: ['github.com', 'api.github.com', 'raw.githubusercontent.com'],
};
check('GitHub 호스트에는 인증 허용', isTrustedAuthUrl('https://github.com/a/b', githubAuth));
check('외부 호스트에는 인증 차단', !isTrustedAuthUrl('https://cdn.example.com/a.png', githubAuth));
eq(
  'blob은 raw 경로로 전환',
  resolveDownloadTarget('https://github.com/acme/private/blob/main/docs/a.png', githubAuth).url,
  'https://raw.githubusercontent.com/acme/private/main/docs/a.png',
);

const here = path.dirname(fileURLToPath(import.meta.url));
const server = spawn(process.execPath, [path.join(here, 'fixtures', 'fake-images.mjs')], {
  stdio: ['ignore', 'pipe', 'inherit'],
});
const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('가짜 이미지 서버 시작 실패')), 5000);
  server.stdout.on('data', (chunk) => {
    const match = String(chunk).match(/READY (\d+)/);
    if (match) {
      clearTimeout(timer);
      resolve(Number(match[1]));
    }
  });
});
const base = `http://127.0.0.1:${port}`;
const tmp = mkdtempSync(path.join(os.tmpdir(), 'issue-images-test-'));

const external = downloadImageReference(`${base}/external.png`, tmp, 1, githubAuth);
check('외부 직접 이미지 다운로드', external.ok, external.reason);
check('시그니처 기반 png 확장자', external.path?.endsWith('.png'));

const html = downloadImageReference(`${base}/html.png`, tmp, 2, githubAuth);
check('HTML 응답 거부', !html.ok && html.reason.includes('content-type'), html.reason);
check('HTML 실패 파일 삭제', !readdirSync(tmp).some((name) => name.startsWith('image-02')));

const fake = downloadImageReference(`${base}/fake.png`, tmp, 3, githubAuth);
check('가짜 이미지 시그니처 거부', !fake.ok && fake.reason.includes('시그니처'), fake.reason);
check('시그니처 실패 파일 삭제', !readdirSync(tmp).some((name) => name.startsWith('image-03')));

const mismatch = downloadImageReference(`${base}/mismatch.webp`, tmp, 4, githubAuth);
check('실제 이미지면 잘못된 서버 형식도 시그니처 기준 저장', mismatch.ok && mismatch.path.endsWith('.jpg'), mismatch.reason);
check('서버 형식 불일치 경고', mismatch.warning?.includes('image/webp'));

const releaseAuth = {
  scheme: 'Bearer',
  token: 'secret',
  trustedHosts: ['127.0.0.1'],
  githubApiBase: base,
};
const release = downloadImageReference(
  'https://github.com/acme/private/releases/download/v1/shot.png',
  tmp,
  5,
  releaseAuth,
);
check('private release asset API 다운로드', release.ok, release.reason);

const seen = JSON.parse(spawnSync('curl', ['-sS', `${base}/__seen`], { encoding: 'utf8' }).stdout);
const externalRequest = seen.find((request) => request.url === '/external.png');
eq('외부 이미지에 토큰 미전달', externalRequest.authorization, null);
const apiRequests = seen.filter((request) => request.url.startsWith('/repos/'));
check('release API에 토큰 전달', apiRequests.length === 2 && apiRequests.every((request) => request.authorization === 'Bearer secret'));

const valid = validateEvidenceReport('![목록 화면](https://github.com/user-attachments/assets/abc)', { isPrivate: true });
check('설명 있는 user-attachments Markdown 허용', valid.ok, valid.errors.join(', '));
const invalid = validateEvidenceReport([
  '![](https://cdn.example.com/empty.png)',
  '<img src="https://cdn.example.com/html.png">',
  'https://cdn.example.com/bare.png',
  '![blob](https://github.com/acme/private/blob/main/a.png)',
  '![raw](https://raw.githubusercontent.com/acme/private/main/a.png)',
].join('\n'), { isPrivate: true });
check('잘못된 리포트 거부', !invalid.ok);
check('빈 alt 검출', invalid.errors.some((error) => error.includes('alt')));
check('HTML 검출', invalid.errors.some((error) => error.includes('HTML')));
check('bare URL 검출', invalid.errors.some((error) => error.includes('bare URL')));
check('blob 페이지 검출', invalid.errors.some((error) => error.includes('페이지 URL')));
check('private raw 검출', invalid.errors.some((error) => error.includes('user-attachments')));
check('사람 업로드가 필요한 실패로 구분', invalid.needsManualUpload === true, JSON.stringify(invalid.pendingUploads));

// github.com/<o>/<r>/raw/... 는 raw.githubusercontent.com 으로 302 되는 같은 자산이다.
eq('github raw 경로 분류', classifyImageUrl('https://github.com/acme/private/raw/main/a.webp'), 'raw');
eq(
  'github raw 다운로드 대상 치환',
  resolveDownloadTarget('https://github.com/acme/private/raw/main/docs/a.webp').url,
  'https://raw.githubusercontent.com/acme/private/main/docs/a.webp',
);

// public 저장소면 두 형태 모두 인라인으로 렌더링된다.
const publicRaw = validateEvidenceReport([
  '![전](https://raw.githubusercontent.com/acme/open/main/a.webp)',
  '![후](https://github.com/acme/open/raw/main/b.webp)',
].join('\n'), { isPrivate: false });
check('public raw 인라인 허용', publicRaw.ok, publicRaw.errors.join(', '));

// private 안내문이 시키는 "보조 링크" 를 검증기가 되받아치면 마무리가 영원히 막힌다.
const auxLink = validateEvidenceReport([
  '![목록 화면](https://github.com/user-attachments/assets/abc)',
  '원본: [before/list.webp](https://raw.githubusercontent.com/acme/private/main/.issue/7/evidence/before/list.webp)',
  '[after/list.webp](https://github.com/acme/private/blob/main/.issue/7/evidence/after/list.webp)',
].join('\n'), { isPrivate: true });
check('private 보조 링크 허용', auxLink.ok, auxLink.errors.join(', '));
check('보조 링크는 업로드 대기로 세지 않음', auxLink.needsManualUpload === false);

// public 에서는 보조 링크 예외가 없다. 이미지는 이미지 문법으로 써야 한다.
const publicAux = validateEvidenceReport(
  '[list.webp](https://raw.githubusercontent.com/acme/open/main/list.webp)',
  { isPrivate: false },
);
check('public 은 일반 링크 이미지 거부', !publicAux.ok);

const bareRawPrivate = validateEvidenceReport(
  'https://raw.githubusercontent.com/acme/private/main/after.webp',
  { isPrivate: true },
);
check('private bare raw URL은 문법 오류로만 거부', !bareRawPrivate.ok);
check('private bare raw URL은 업로드 대기가 아님', bareRawPrivate.needsManualUpload === false, JSON.stringify(bareRawPrivate.pendingUploads));
check('private bare raw URL은 pendingUploads 비어있음', bareRawPrivate.pendingUploads.length === 0);

const bareRawPrivateFixed = validateEvidenceReport(
  '[after.webp](https://raw.githubusercontent.com/acme/private/main/after.webp)',
  { isPrivate: true },
);
check('bare URL을 보조 링크로 고치면 사람 개입 없이 통과', bareRawPrivateFixed.ok, bareRawPrivateFixed.errors.join(', '));

spawnSync('curl', ['-sS', `${base}/__shutdown`]);
server.kill();
rmSync(tmp, { recursive: true, force: true });

if (failed) {
  console.error(`\ntest-images: 실패 ${failed}건`);
  process.exit(1);
}
console.log('test-images: 통과');
