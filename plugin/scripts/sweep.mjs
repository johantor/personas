// personas-sweep: the scripted phase of /personas:diff (#7). For each URL it loads the old and the
// new page, records what a migration tends to break and a full-page screenshot, and writes
// <out>/sweep.json. No model calls, so it can cover hundreds of URLs cheaply.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DEFAULT_BLOCKED_HOSTS, hostMatches, loadPlaywright } = require('../lib/browser-common.cjs');

const USAGE = 'usage: personas-sweep --old <url> --new <url> --out <dir> [--sitemap <url> | --urls <file>]';
const PARALLEL = 4; // URLs at a time; each loads two pages
const PIXEL_THRESHOLD = 1; // percent of pixels that differ before the screenshots count as different

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(USAGE);
    opts[argv[i].slice(2)] = argv[i + 1];
  }
  for (const key of ['old', 'new', 'out']) if (!opts[key]) throw new Error(USAGE);
  if (opts.sitemap && opts.urls) throw new Error('use --sitemap or --urls, not both');
  for (const key of ['old', 'new']) {
    if (!/^https?:$/.test(new URL(opts[key]).protocol)) throw new Error(`--${key} must be http or https`);
  }
  return opts;
}

// The paths to compare, from a URL file (one path or URL per line) or a sitemap, by default
// <old>/sitemap.xml. A sitemap index is followed one level.
async function listPaths(opts) {
  const toPath = (u) => { const url = new URL(u, opts.old); return url.pathname + url.search; };
  let urls;
  if (opts.urls) {
    urls = fs.readFileSync(opts.urls, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  } else {
    const locs = async (u) => {
      const res = await fetchOnSites(u, opts);
      if (!res.ok) throw new Error(`cannot read the sitemap ${u}: HTTP ${res.status}`);
      const xml = await res.text();
      const found = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
      return { found, index: /<sitemapindex[\s>]/.test(xml) };
    };
    const root = await locs(opts.sitemap || new URL('/sitemap.xml', opts.old).href);
    urls = root.index ? (await Promise.all(root.found.map(async (u) => (await locs(u)).found))).flat() : root.found;
  }
  return [...new Set(urls.map(toPath))];
}

// A sitemap, its index entries and their redirects are fetched only from the two sites' own
// hosts, so a sitemap cannot send the sweep to another host, analytics or internal.
async function fetchOnSites(u, opts) {
  const hosts = [new URL(opts.old).hostname, new URL(opts.new).hostname];
  for (let hops = 0; hops <= 5; hops++) {
    const host = new URL(u).hostname;
    if (!hosts.includes(host) || hostMatches(host, DEFAULT_BLOCKED_HOSTS)) throw new Error(`refused: the sitemap names ${u}, which is not on the old or the new site`);
    const res = await fetch(u, { redirect: 'manual' });
    if (res.status < 300 || res.status >= 400 || !res.headers.get('location')) return res;
    u = new URL(res.headers.get('location'), u).href;
  }
  throw new Error(`too many redirects for the sitemap ${u}`);
}

// One context per site: the sweep only reads, so it refuses writes, analytics hosts and
// navigation to any host but the site's own, as persona-browser does.
async function openSite(browser, base) {
  const hosts = [new URL(base).hostname];
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const req = route.request();
    const host = new URL(req.url()).hostname;
    if (hostMatches(host, DEFAULT_BLOCKED_HOSTS) || !['GET', 'HEAD'].includes(req.method())) return route.abort('blockedbyclient');
    if (req.isNavigationRequest() && !hosts.includes(host)) return route.abort('blockedbyclient');
    return route.continue();
  });
  return { context, base };
}

async function capture(site, p, shot) {
  const page = await site.context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  const url = new URL(p, site.base).href;
  try {
    const response = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
    const redirects = [];
    for (let r = response?.request().redirectedFrom(); r; r = r.redirectedFrom()) redirects.unshift(r.url());
    // A redirect's follow-up skips the route, so an off-site landing page is refused here.
    if (new URL(page.url()).hostname !== new URL(site.base).hostname) {
      return { url, status: response?.status() ?? null, redirects, finalUrl: page.url(), error: `refused: redirected off the site to ${page.url()}`, consoleErrors };
    }
    const data = await page.evaluate(() => {
      const main = document.querySelector('main, [role=main]') || document.body;
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content ?? null,
        canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
        h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim()),
        text: (main?.innerText || '').replace(/\s+/g, ' ').trim(),
        links: document.querySelectorAll('a[href]').length,
      };
    });
    await page.screenshot({ path: shot, fullPage: true });
    const { text, ...rest } = data;
    return {
      url, status: response?.status() ?? null, redirects, finalUrl: page.url(), ...rest,
      textHash: crypto.createHash('sha256').update(text).digest('hex').slice(0, 16),
      textSample: text.slice(0, 300), consoleErrors, screenshot: shot,
    };
  } catch (err) {
    return { url, error: err.message.split('\n')[0], consoleErrors };
  } finally {
    await page.close();
  }
}

// The browser decodes both PNGs on a canvas, so no image library is needed. Pixels outside the
// smaller image count as different.
async function pixelDiff(page, a, b) {
  const src = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  return page.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = s; });
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    const w = Math.max(ia.width, ib.width);
    const h = Math.max(ia.height, ib.height);
    const pixels = (img) => {
      const c = new OffscreenCanvas(w, h);
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, w, h).data;
    };
    const [pa, pb] = [pixels(ia), pixels(ib)];
    let differ = 0;
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) + Math.abs(pa[i + 3] - pb[i + 3]) > 48) differ += 1;
    }
    return Math.round((differ / (w * h)) * 10000) / 100;
  }, [src(a), src(b)]);
}

// The fields that differ. A URL on a site's own origin is compared as its path, since the two
// sites run on different hosts; any other origin is kept, so a canonical that still names the
// old host shows as a difference.
function differs(row, opts) {
  const { old: o, new: n } = row;
  if (o.error || n.error) return o.error && n.error && o.error === n.error ? [] : ['error'];
  const local = (u, base) => {
    if (!u) return null;
    const url = new URL(u);
    return url.origin === new URL(base).origin ? url.pathname + url.search : url.href;
  };
  const fields = [];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const chain = (side, base) => [...side.redirects, side.finalUrl].map((u) => local(u, base));
  if (o.status !== n.status) fields.push('status');
  if (!same(chain(o, opts.old), chain(n, opts.new))) fields.push('redirect');
  for (const key of ['title', 'description', 'h1', 'textHash', 'links']) if (!same(o[key], n[key])) fields.push(key);
  if (local(o.canonical, opts.old) !== local(n.canonical, opts.new)) fields.push('canonical');
  if (n.consoleErrors.some((e) => !o.consoleErrors.includes(e))) fields.push('consoleErrors');
  if (row.pixelDiff > PIXEL_THRESHOLD) fields.push('pixels');
  return fields;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const paths = await listPaths(opts);
  if (!paths.length) throw new Error('no URLs to sweep');
  const dirs = { old: path.join(opts.out, 'sweep', 'old'), new: path.join(opts.out, 'sweep', 'new') };
  for (const d of Object.values(dirs)) fs.mkdirSync(d, { recursive: true });

  const browser = await loadPlaywright().chromium.launch();
  try {
    const sites = { old: await openSite(browser, opts.old), new: await openSite(browser, opts.new) };
    const diffPage = await browser.newPage();
    const rows = new Array(paths.length);
    let next = 0;
    const worker = async () => {
      while (next < paths.length) {
        const i = next++;
        const name = `${String(i + 1).padStart(3, '0')}-${paths[i].replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'home'}.png`;
        const [o, n] = await Promise.all(['old', 'new'].map((k) => capture(sites[k], paths[i], path.join(dirs[k], name))));
        const row = { path: paths[i], old: o, new: n, pixelDiff: o.screenshot && n.screenshot ? await pixelDiff(diffPage, o.screenshot, n.screenshot) : null };
        row.differs = differs(row, opts);
        for (const side of [o, n]) if (side.screenshot) side.screenshot = path.relative(opts.out, side.screenshot);
        rows[i] = row;
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    // sweep-changes.json holds only the rows that differ: what the reporter reads.
    const write = (name, list) => fs.writeFileSync(path.join(opts.out, name), JSON.stringify({ old: opts.old, new: opts.new, generatedAt: new Date().toISOString(), rows: list }, null, 2) + '\n');
    const changed = rows.filter((r) => r.differs.length);
    write('sweep.json', rows);
    write('sweep-changes.json', changed);
    process.stdout.write(`${rows.length} URLs swept, ${changed.length} differ; ${path.join(opts.out, 'sweep.json')}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  process.stderr.write(`personas-sweep: ${err.message}\n`);
  process.exit(1);
});
