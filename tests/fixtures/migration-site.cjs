'use strict';
// An old and a new version of one small site, for tests/sweep.test.sh. Run with "old" or "new",
// and for "new" the old site's port; prints its port. The new version changes a title, drops a page, redirects one, and adds a
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
  if (p === '/index.xml') {
    res.setHeader('content-type', 'application/xml');
    return res.end('<?xml version="1.0"?><sitemapindex><sitemap><loc>http://www.google-analytics.com/collect</loc></sitemap></sitemapindex>');
  }
  if (p.endsWith('.xml')) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', 'text/html');
  if (p === '/same') return res.end(page('Same', '<p>Nothing changes here.</p>'));
  if (p === '/visit') return res.end(page(version === 'old' ? 'Visit' : 'Visit us', '<p>Open Mon-Fri 9-17.</p>'));
  if (p === '/gone' && version === 'new') { res.statusCode = 404; return res.end(page('Not found', '<p>Gone.</p>')); }
  if (p === '/gone') return res.end(page('Gone', '<p>Still here in the old site.</p>'));
  if (p === '/moved' && version === 'new') { res.writeHead(301, { location: '/same' }); return res.end(); }
  // Both versions land on /same; the new one takes an extra hop.
  if (p === '/hop' && version === 'old') { res.writeHead(301, { location: '/same' }); return res.end(); }
  if (p === '/hop') { res.writeHead(301, { location: '/step' }); return res.end(); }
  if (p === '/step') { res.writeHead(301, { location: '/same' }); return res.end(); }
  // The new version redirects off the site.
  if (p === '/out' && version === 'new') { res.writeHead(302, { location: `http://127.0.0.1:${req.socket.localPort}/same` }); return res.end(); }
  if (p === '/out') return res.end(page('Out', '<p>Stays on the old site.</p>'));
  // Both versions keep the old site's canonical; only the new one is wrong to.
  if (p === '/canon') return res.end(page('Canon', '<p>Same text.</p>').replace(/href="\/canon"/, `href="http://localhost:${version === 'new' ? process.argv[3] : req.socket.localPort}/canon"`));
  if (p === '/moved') return res.end(page('Moved', '<p>The old page.</p>'));
  const extra = version === 'new' ? '<script>console.error("booking.js failed")</script>' : '';
  res.end(page('Home', '<p>Welcome.</p>', extra));
}).listen(0, '127.0.0.1', function () {
  process.stdout.write(`${this.address().port}\n`);
});
