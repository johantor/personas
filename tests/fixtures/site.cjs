'use strict';
// A local site for tests/persona-browser.test.sh. Prints its port, then appends "METHOD path" for
// every request it gets to the log file given as the first argument.
const fs = require('node:fs');
const http = require('node:http');

const log = process.argv[2];
const page = (body) => `<!doctype html><title>Fixture</title>${body}`;

http.createServer((req, res) => {
  fs.appendFileSync(log, `${req.method} ${req.url}\n`);
  const url = new URL(req.url, 'http://localhost');
  res.setHeader('content-type', 'text/html');
  if (url.pathname === '/set') {
    res.setHeader('set-cookie', `who=${url.searchParams.get('v')}; Path=/`);
    return res.end(page('<p>cookie set</p>'));
  }
  if (url.pathname === '/redirect') {
    res.writeHead(302, { location: `http://127.0.0.1:${req.socket.localPort}/` });
    return res.end();
  }
  if (url.pathname === '/away') {
    return res.end(page(`<a href="http://127.0.0.1:${req.socket.localPort}/">Elsewhere</a>`));
  }
  if (url.pathname === '/form') {
    return res.end(page('<form method="post" action="/submit"><input name="n" aria-label="Name"><button>Send</button></form><button type="button" onclick="fetch(\'/submit\', { method: \'POST\' })">Ping</button>'));
  }
  if (url.pathname === '/search') {
    return res.end(page('<form action="/found"><input name="q" aria-label="Query"></form><a href="/" target="_blank">New tab</a>'));
  }
  if (url.pathname === '/submit') return res.end(page('<p>thanks</p>'));
  res.end(page(`<h1>Home</h1><p>cookie: ${req.headers.cookie || 'none'}</p>
<script src="https://www.google-analytics.com/analytics.js"></script>
<img src="http://tracker.test/pixel.gif" alt="">`));
}).listen(0, '127.0.0.1', function () {
  process.stdout.write(`${this.address().port}\n`);
});
