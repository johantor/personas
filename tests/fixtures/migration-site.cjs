'use strict';
// An old and a new version of one small site, for tests/sweep.test.sh. Run with "old" or "new";
// prints its port. The new version changes a title, drops a page, redirects one, and adds a
// console error, and keeps /same unchanged.
const http = require('node:http');

const version = process.argv[2];
const page = (title, body, extra = '') => `<!doctype html><html lang="en"><head><title>${title}</title>
<meta name="description" content="About ${title}"><link rel="canonical" href="/${title.toLowerCase()}">${extra}</head>
<body><nav><a href="/">Home</a> <a href="/visit">Visit</a></nav><main><h1>${title}</h1>${body}</main></body></html>`;

http.createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/sitemap.xml') {
    res.setHeader('content-type', 'application/xml');
    return res.end(`<?xml version="1.0"?><urlset><url><loc>http://localhost/same</loc></url><url><loc>http://localhost/visit</loc></url>
<url><loc>http://localhost/gone</loc></url><url><loc>http://localhost/moved</loc></url></urlset>`);
  }
  if (p.endsWith('.xml')) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', 'text/html');
  if (p === '/same') return res.end(page('Same', '<p>Nothing changes here.</p>'));
  if (p === '/visit') return res.end(page(version === 'old' ? 'Visit' : 'Visit us', '<p>Open Mon-Fri 9-17.</p>'));
  if (p === '/gone' && version === 'new') { res.statusCode = 404; return res.end(page('Not found', '<p>Gone.</p>')); }
  if (p === '/gone') return res.end(page('Gone', '<p>Still here in the old site.</p>'));
  if (p === '/moved' && version === 'new') { res.writeHead(301, { location: '/same' }); return res.end(); }
  if (p === '/moved') return res.end(page('Moved', '<p>The old page.</p>'));
  const extra = version === 'new' ? '<script>console.error("booking.js failed")</script>' : '';
  res.end(page('Home', '<p>Welcome.</p>', extra));
}).listen(0, '127.0.0.1', function () {
  process.stdout.write(`${this.address().port}\n`);
});
