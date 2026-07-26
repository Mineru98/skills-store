#!/usr/bin/env node
import { createServer } from 'node:http';

const pages = [];
const uploads = [];
let nextId = 100;

const server = createServer((req, res) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const url = new URL(req.url, 'http://127.0.0.1');
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'GET' && url.pathname === '/__seen') return send(200, { pages, uploads });
    if (req.method === 'GET' && url.pathname === '/__shutdown') {
      send(200, { ok: true });
      server.close();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/rest/api/content') {
      const title = url.searchParams.get('title');
      return send(200, { results: pages.filter((page) => page.title === title) });
    }
    if (req.method === 'POST' && url.pathname === '/rest/api/content') {
      const body = JSON.parse(raw);
      const page = {
        id: String(nextId++),
        ...body,
        version: { number: 1 },
        _links: { base: `http://127.0.0.1:${server.address().port}`, webui: '/pages/created' },
      };
      pages.push(page);
      return send(200, page);
    }
    const update = url.pathname.match(/^\/rest\/api\/content\/(\d+)$/);
    if (req.method === 'PUT' && update) {
      const page = pages.find((item) => item.id === update[1]);
      Object.assign(page, JSON.parse(raw));
      page._links = { base: `http://127.0.0.1:${server.address().port}`, webui: '/pages/updated' };
      return send(200, page);
    }
    const attachment = url.pathname.match(/^\/rest\/api\/content\/(\d+)\/child\/attachment$/);
    if (req.method === 'POST' && attachment) {
      uploads.push({ pageId: attachment[1], raw, auth: req.headers.authorization, token: req.headers['x-atlassian-token'] });
      return send(200, { results: [] });
    }
    send(404, { message: 'not found' });
  });
});

server.listen(0, '127.0.0.1', () => console.log(`READY ${server.address().port}`));
