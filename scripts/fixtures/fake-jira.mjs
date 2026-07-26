#!/usr/bin/env node
/**
 * 테스트용 가짜 Jira 서버.
 *
 * **반드시 별도 프로세스로 띄운다.** issue-tracker.mjs 는 curl 을 spawnSync 로 부르는데,
 * 그동안 호출한 쪽의 이벤트 루프가 멈춘다. 같은 프로세스 안에 서버를 두면 요청을
 * 받아줄 주체가 없어 영원히 응답이 오지 않는다.
 *
 *   node scripts/fixtures/fake-jira.mjs
 *   → stdout 첫 줄에 "READY <port>" 를 출력한다.
 *
 * 받은 요청은 전부 기록해 두고 GET /__seen 으로 돌려준다. 테스트가 이것으로
 * 어댑터가 실제로 보낸 메서드·경로·본문을 대조한다.
 */
import { createServer } from 'node:http';

const seen = [];

const server = createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const send = (obj, code = 200) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const url = req.url;

    if (url === '/__seen') return send(seen);
    if (url === '/__shutdown') {
      send({ ok: true });
      setTimeout(() => process.exit(0), 10);
      return undefined;
    }

    seen.push({
      method: req.method,
      url,
      auth: req.headers.authorization ?? null,
      body: body ? JSON.parse(body) : null,
    });

    if (url.startsWith('/rest/api/3/myself')) return send({ displayName: '테스터' });
    if (url.startsWith('/rest/api/3/label')) return send({ values: ['bug', 'enhancement'] });
    if (url === '/rest/api/3/issue' && req.method === 'POST') return send({ key: 'ACME-77' }, 201);
    if (url.startsWith('/rest/api/3/issue/ACME-77/transitions') && req.method === 'GET') {
      return send({ transitions: [{ id: '31', name: '완료로', to: { name: 'Done' } }] });
    }
    if (url.startsWith('/rest/api/3/issue/ACME-77/transitions') && req.method === 'POST') return send({}, 204);
    if (url.startsWith('/rest/api/3/issue/ACME-77/comment')) return send({ id: '1' }, 201);
    if (url.startsWith('/rest/api/3/issue/ACME-77') && req.method === 'PUT') return send({}, 204);
    if (url.startsWith('/rest/api/3/issue/ACME-77')) {
      return send({
        key: 'ACME-77',
        fields: {
          summary: '주문 목록이 빈다',
          description: { version: 1, type: 'doc', content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: '배경' }] },
            { type: 'paragraph', content: [{ type: 'text', text: '마크다운 원문' }] },
          ] },
          status: { name: 'In Progress' },
          labels: ['bug', 'status:open'],
          assignee: { displayName: '담당자' },
          comment: { comments: [{ author: { displayName: '리뷰어' }, body: { version: 1, type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '재현됨' }] }] }, created: '2026-07-01' }] },
          created: '2026-06-01',
          updated: '2026-07-01',
        },
      });
    }
    if (url.startsWith('/rest/api/3/search')) {
      return send({
        issues: [{
          key: 'ACME-42',
          fields: { summary: '검색 결과', status: { name: 'Done' }, labels: [], created: '2026-05-01' },
        }],
      });
    }
    return send({ errorMessages: [`알 수 없는 경로: ${url}`] }, 404);
  });
});

server.listen(0, '127.0.0.1', () => {
  console.log(`READY ${server.address().port}`);
});
