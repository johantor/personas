'use strict';
// The personas demo: a small museum site with 11 planted bugs, for the v1 acceptance run (#1).
// demo/EXPECTED.md is the answer key. Run: node demo/site.cjs [port], default 4400.
const http = require('node:http');

const port = Number(process.argv[2] || 4400);

// Bug 9: focus outlines are removed everywhere.
const css = `body{font-family:sans-serif;margin:0} nav{background:#234;padding:8px} nav a{color:#fff;margin-right:12px}
main{padding:16px;max-width:900px} *:focus{outline:none} .price{color:#ccc}
.menu{display:inline-block;color:#fff;cursor:pointer}`;

const nav = `<nav><a href="/">Home</a><a href="/visit">Visit</a><a href="/exhibitons">Exhibitions</a>
<a href="/search">Search</a><a href="/sv/">Svenska</a>
<div class="menu" onclick="document.getElementById('more').hidden=false">More ▾</div>
<span id="more" hidden><a href="/book">Book a visit</a></span></nav>`;

const page = (title, body, { lang = 'en', head = '' } = {}) => `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><style>${css}</style>${head}</head><body>${nav}<main>${body}</main></body></html>`;

const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200"><rect width="600" height="200" fill="#8ab"/></svg>');

const routes = {
  // Bug 6: the hero image has no alt text.
  '/': () => page('City Museum', `<h1>City Museum</h1><img src="${svg}" width="600" height="200">
<p>Art, history and dinosaurs in the heart of the city.</p>
<p><a href="/visit">Plan your visit</a> · <a href="/exhibitions">See what's on</a></p>`),

  // Bug 4: no weekend hours. Bug 5: the prices are light grey on white.
  '/visit': () => page('Visit', `<h1>Visit us</h1><h2>Opening hours</h2><p>Monday to Friday 10–17.</p>
<h2>Tickets</h2><p class="price">Adults 120 kr, children free.</p>
<p>Book your visit from the menu.</p>`),

  // Bug 1: Next does nothing. Bug 2: the date field has no label.
  '/book': () => page('Book a visit', `<h1>Book a visit</h1><form onsubmit="return false">
<input type="date" name="date"> <button type="button">Next</button></form>`),

  // Bug 3: every search returns no results, even for an exhibition that exists.
  '/search': (url) => {
    const q = url.searchParams.get('q');
    const results = q === null ? '' : `<p>No results for “${q.replace(/[<>&"]/g, '')}”.</p>`;
    return page('Search', `<h1>Search</h1><form action="/search"><label for="q">Search the museum</label>
<input id="q" name="q"> <button>Search</button></form>${results}`);
  },

  // Bug 8: a fixed 1200px table overflows a phone screen. Bug 11: the page takes 4 seconds.
  '/exhibitions': () => page('Exhibitions', `<h1>Exhibitions</h1><table style="width:1200px" border="1">
<tr><th>Exhibition</th><th>Where</th><th>Until</th></tr>
<tr><td>Dinosaurs of the North</td><td>Hall A</td><td>31 March</td></tr>
<tr><td>Light and Shadow</td><td>Hall B</td><td>15 May</td></tr></table>`),

  // Bug 10: the Swedish page has an untranslated heading and a US date.
  '/sv/': () => page('Stadsmuseet', `<h1>Stadsmuseet</h1><h2>Opening hours</h2>
<p>Måndag till fredag 10–17. Nästa visning: 03/14/2027.</p>`, { lang: 'sv' }),
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const route = routes[url.pathname];
  res.setHeader('content-type', 'text/html; charset=utf-8');
  // Bug 7: the Exhibitions link in the menu points to /exhibitons, which is a 404.
  if (!route) {
    res.statusCode = 404;
    return res.end(page('Not found', '<h1>Page not found</h1>'));
  }
  if (url.pathname === '/exhibitions') await new Promise((r) => setTimeout(r, 4000));
  res.end(route(url));
}).listen(port, '127.0.0.1', () => process.stdout.write(`demo site on http://localhost:${port}/\n`));
