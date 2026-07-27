#!/usr/bin/env node
import http from 'node:http';

const seen = [];
const png = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
]);
const jpeg = Buffer.from([255, 216, 255, 224, 0, 16, 74, 70, 73, 70]);

const server = http.createServer((req, res) => {
  seen.push({ url: req.url, authorization: req.headers.authorization ?? null });
  if (req.url === '/__seen') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(seen));
    return;
  }
  if (req.url === '/__shutdown') {
    res.end('bye');
    server.close();
    return;
  }
  if (req.url === '/image.png' || req.url === '/external.png') {
    res.setHeader('Content-Type', 'image/png');
    res.end(png);
    return;
  }
  if (req.url === '/html.png') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html>not an image</html>');
    return;
  }
  if (req.url === '/fake.png') {
    res.setHeader('Content-Type', 'image/png');
    res.end('not an image');
    return;
  }
  if (req.url === '/mismatch.webp') {
    res.setHeader('Content-Type', 'image/webp');
    res.end(jpeg);
    return;
  }
  if (req.url === '/repos/acme/private/releases/tags/v1') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ assets: [{ id: 7, name: 'shot.png' }] }));
    return;
  }
  if (req.url === '/repos/acme/private/releases/assets/7') {
    res.setHeader('Content-Type', 'application/octet-stream');
    res.end(png);
    return;
  }
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('not found');
});

server.listen(0, '127.0.0.1', () => {
  console.log(`READY ${server.address().port}`);
});
