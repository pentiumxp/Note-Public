'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.join(process.cwd(), 'public');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const cleanPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.resolve(root, `.${cleanPath}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    response.end(content);
  });
});

server.listen(port, () => {
  console.log(`Note prototype listening at http://localhost:${port}`);
});

