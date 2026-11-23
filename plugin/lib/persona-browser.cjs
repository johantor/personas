'use strict';
// persona-browser: one Playwright browser context per session id, owned by a background daemon,
// so parallel visitor subagents never share tabs, cookies, storage or auth (#1, browser isolation).
// The CLI sends one JSON line per command over a local socket; the daemon answers with one line.

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');

const INSTALL_HINT = 'npm install -D playwright && npx playwright install chromium webkit';
const IDLE_MS = 30 * 60 * 1000; // a visitor that never calls stop must not leave a browser behind
const ACTION_TIMEOUT_MS = 10_000;
const NAV_TIMEOUT_MS = 30_000;

// Analytics and tag hosts, blocked so runs don't skew the site's statistics. A brief adds more
// under "## Blocked hosts". An entry matches the host and its subdomains.
const DEFAULT_BLOCKED_HOSTS = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'doubleclick.net',
  'googleadservices.com', 'cdn.optimizely.com', 'logx.optimizely.com', 'hotjar.com', 'hotjar.io',
  'clarity.ms', 'connect.facebook.net', 'segment.com', 'segment.io', 'mixpanel.com',
  'plausible.io', 'matomo.cloud', 'siteimproveanalytics.com', 'siteimproveanalytics.io',
];

// Chrome DevTools-style presets; latency in ms, throughput in bytes per second.
const NETWORK_PRESETS = {
  'slow-3g': { latency: 2000, downloadThroughput: 50_000, uploadThroughput: 50_000 },
  'fast-3g': { latency: 563, downloadThroughput: 180_000, uploadThroughput: 84_375 },
  'slow-4g': { latency: 150, downloadThroughput: 200_000, uploadThroughput: 93_750 },
};

const USAGE = `usage:
  persona-browser start --session <id> --persona <personas.json> --persona-id <id> --run <dir> --url <base-url> [--brief <brief.md>]
  persona-browser look  --session <id>
  persona-browser act   --session <id> --ref <ref> --do click|hover|scroll|select [--value <v>]
  persona-browser act   --session <id> --do scroll [--value up|down]
  persona-browser type  --session <id> --ref <ref> --text <text> [--submit]
  persona-browser key   --session <id> --key <key>
  persona-browser goto  --session <id> --url <url>
  persona-browser stop  --session <id>`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new UsageError(`unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === 'submit') { opts.submit = true; continue; }
    if (i + 1 >= argv.length) throw new UsageError(`${arg} needs a value`);
    opts[key] = argv[++i];
  }
  return opts;
}

function need(opts, ...keys) {
  for (const key of keys) if (opts[key] === undefined) throw new UsageError(`--${key} is required`);
}

// The id becomes part of a socket path, so it is restricted to a safe file name.
function socketPath(session) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(session)) {
    throw new UsageError('--session must be 1-64 letters, digits, dots, dashes or underscores');
  }
  if (process.platform === 'win32') return `\\\\.\\pipe\\persona-browser-${session}`;
  const { uid } = os.userInfo();
  const dir = path.join(os.tmpdir(), `persona-browser-${uid}`);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Other local users must not drive a session, so a directory they made or can enter is refused.
  const stat = fs.statSync(dir);
  if (stat.uid !== uid || (stat.mode & 0o077) !== 0) throw new Error(`${dir} must be yours with mode 0700`);
  return path.join(dir, `${session}.sock`);
}

// --- client -------------------------------------------------------------------------------------

function send(sock, request) {
  return new Promise((resolve, reject) => {
    const conn = net.connect(sock);
    let data = '';
    conn.on('connect', () => conn.write(JSON.stringify(request) + '\n'));
    conn.on('data', (chunk) => { data += chunk; });
    conn.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { reject(new Error(`bad reply from the session daemon: ${data}`)); }
    });
    conn.on('error', reject);
  });
}

async function runClient(command, opts) {
  need(opts, 'session');
  const sock = socketPath(opts.session);
  if (command === 'start') return start(sock, opts);
  let reply;
  try {
    reply = await send(sock, { command, opts });
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ECONNREFUSED') {
      throw new Error(`no session "${opts.session}"; run persona-browser start first`);
    }
    throw err;
  }
  if (!reply.ok) throw new Error(reply.error);
  process.stdout.write(reply.output + '\n');
}

async function start(sock, opts) {
  need(opts, 'persona', 'persona-id', 'run', 'url');
  const config = buildConfig(opts);
  fs.mkdirSync(path.join(config.personaDir, 'shots'), { recursive: true });
  const log = fs.openSync(path.join(config.personaDir, 'daemon.log'), 'a');
  const child = spawn(process.execPath, [__filename, '__daemon', sock, JSON.stringify(config)], {
    detached: true,
    stdio: ['ignore', 'pipe', log],
  });
  // The daemon prints exactly one JSON line: ready, or the reason it could not start.
  const line = await new Promise((resolve) => {
    let data = '';
    child.stdout.on('data', (chunk) => {
      data += chunk;
      if (data.includes('\n')) resolve(data.split('\n')[0]);
    });
    child.on('exit', () => resolve(data || JSON.stringify({ ok: false, error: `daemon exited; see ${path.join(config.personaDir, 'daemon.log')}` })));
  });
  child.stdout.destroy();
  child.unref();
  const reply = JSON.parse(line);
  if (!reply.ok) throw new Error(reply.error);
  process.stdout.write(reply.output + '\n');
}

// Everything that can be wrong with the inputs fails here, before a daemon is spawned.
function buildConfig(opts) {
  const personaFile = path.resolve(opts.persona);
  const file = readJson(personaFile);
  const found = (file.personas || []).find((p) => p.id === opts['persona-id']);
  if (!found) throw new Error(`no persona "${opts['persona-id']}" in ${personaFile}`);
  // A leading dot would allow "." and "..", which put the run output outside <run>/<persona-id>.
  if (!/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(found.id)) throw new Error(`persona id "${found.id}" is not a safe folder name`);
  const persona = { ...file.defaults, ...found };
  if (persona.allowWrites !== undefined && typeof persona.allowWrites !== 'boolean') {
    throw new Error(`allowWrites must be true or false, not ${JSON.stringify(persona.allowWrites)}`);
  }

  const base = new URL(opts.url);
  if (!/^https?:$/.test(base.protocol)) throw new Error(`--url must be http or https: ${opts.url}`);
  const briefFile = path.resolve(opts.brief || path.join(path.dirname(personaFile), 'brief.md'));
  const brief = fs.existsSync(briefFile) ? fs.readFileSync(briefFile, 'utf8') : '';
  if (opts.brief && !brief) throw new Error(`cannot read the brief: ${briefFile}`);
  if (persona.network && !NETWORK_PRESETS[persona.network]) {
    throw new Error(`unknown network "${persona.network}"; use one of ${Object.keys(NETWORK_PRESETS).join(', ')}`);
  }
  return {
    persona,
    personaDir: path.resolve(opts.run, persona.id),
    authFile: persona.auth ? path.resolve(path.dirname(personaFile), persona.auth) : null,
    startUrl: new URL(persona.startPath || '/', base).href,
    allowedHosts: [base.hostname, ...briefList(brief, 'Allowed hosts')],
    blockedHosts: [...DEFAULT_BLOCKED_HOSTS, ...briefList(brief, 'Blocked hosts')],
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${file}: ${err.message}`);
  }
}

// The bullets under a "## <heading>" in brief.md. An entry is a host or a URL.
function briefList(brief, heading) {
  const items = [];
  let inside = false;
  for (const line of brief.split(/\r?\n/)) {
    const h = line.match(/^#{1,6}\s+(.*?)\s*$/);
    if (h) { inside = h[1].toLowerCase() === heading.toLowerCase(); continue; }
    const item = inside && line.match(/^\s*[-*]\s+`?([^`\s]+)`?/);
    if (item) items.push(item[1].includes('://') ? new URL(item[1]).hostname : item[1].toLowerCase());
  }
  return items;
}

function hostMatches(host, entries) {
  return entries.some((e) => host === e || host.endsWith('.' + e));
}

// --- daemon -------------------------------------------------------------------------------------

function loadPlaywright() {
  // The user's project first, then the normal lookup (beside the plugin, NODE_PATH, global).
  for (const req of [createRequire(path.join(process.cwd(), 'package.json')), require]) {
    try { return req('playwright'); } catch { /* try the next location */ }
  }
  throw new Error(`Playwright is not installed. Install it: ${INSTALL_HINT}`);
}

// Listening is the lock on the session id: a second daemon gets EADDRINUSE. A socket nobody
// answers on was left by a crash, so it is removed once and the listen retried.
async function listen(server, sock) {
  const attempt = () => new Promise((resolve, reject) => {
    server.once('error', reject).listen(sock, () => { server.off('error', reject); resolve(); });
  });
  try {
    await attempt();
  } catch (err) {
    if (err.code !== 'EADDRINUSE') throw err;
    if (await send(sock, { command: 'ping' }).then(() => true, () => false)) {
      throw new Error('this session is already running; stop it first');
    }
    if (process.platform !== 'win32') fs.rmSync(sock, { force: true });
    await attempt();
  }
}

async function runDaemon(sock, config) {
  let s = null;
  let idle;
  const touch = () => { clearTimeout(idle); idle = setTimeout(() => shutdown(s, server), IDLE_MS); };
  let queue = Promise.resolve(); // one command at a time, in arrival order
  const server = net.createServer((conn) => {
    let data = '';
    conn.on('data', (chunk) => {
      data += chunk;
      if (!data.includes('\n')) return;
      const request = JSON.parse(data.split('\n')[0]);
      touch();
      queue = queue.then(async () => {
        let reply;
        try {
          if (!s && request.command !== 'ping') throw new Error('the session is still starting');
          reply = { ok: true, output: await handle(s, request) };
        } catch (err) {
          reply = { ok: false, error: err.message };
        }
        conn.end(JSON.stringify(reply) + '\n');
        if (request.command === 'stop' && reply.ok) shutdown(s, server);
      });
    });
    conn.on('error', () => {}); // a client that went away must not take the session down
  });
  await listen(server, sock);
  touch();
  s = await openSession(config).catch((err) => {
    if (!/Executable doesn't exist/.test(err.message)) throw err;
    throw new Error('Playwright browsers are missing. Install them: npx playwright install chromium webkit');
  });
  const out = await handle(s, { command: 'goto', opts: { url: config.startUrl } }).catch((err) => `start page failed: ${err.message}`);
  return [
    `started session with persona ${config.persona.id} (${s.browserName})`,
    `allowed hosts: ${config.allowedHosts.join(', ')}`,
    `writes: ${config.persona.allowWrites ? 'allowed' : 'refused'}`,
    ...s.warnings.map((w) => `warning: ${w}`),
    out,
  ].join('\n');
}

async function openSession(config) {
  const pw = loadPlaywright();
  const { persona } = config;
  const device = persona.device ? pw.devices[persona.device] : {};
  if (!device) throw new Error(`unknown device "${persona.device}"; use a name from Playwright's device list`);
  const { defaultBrowserType, ...deviceOptions } = device;
  const browserName = persona.browser || defaultBrowserType || 'chromium';
  if (!pw[browserName]) throw new Error(`unknown browser "${browserName}"; use chromium, firefox or webkit`);

  const browser = await pw[browserName].launch();
  const context = await browser.newContext({
    ...deviceOptions,
    ...(persona.viewport && { viewport: persona.viewport }),
    ...(persona.locale && { locale: persona.locale }),
    ...(persona.timezone && { timezoneId: persona.timezone }),
    ...(persona.colorScheme && { colorScheme: persona.colorScheme }),
    ...(persona.reducedMotion && { reducedMotion: persona.reducedMotion }),
    ...(config.authFile && { storageState: config.authFile }),
    serviceWorkers: 'block', // a service worker's requests would bypass the routing below
  });
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

  const s = {
    config, browser, context, browserName, page: null,
    shot: fs.readdirSync(path.join(config.personaDir, 'shots')).length, refusals: [], blocked: new Map(), warnings: [],
    stepsFile: path.join(config.personaDir, 'steps.jsonl'),
  };
  if (persona.network && browserName !== 'chromium') {
    s.warnings.push(`network "${persona.network}" needs chromium; not throttled in ${browserName}`);
  }
  await context.route('**/*', (route) => routeRequest(s, route));
  if (!persona.allowWrites) await refuseFormSubmits(s);
  // A link that opens a new tab moves the visitor there, as it would a person.
  context.on('page', async (page) => {
    s.page = page;
    page.on('close', () => { if (s.page === page) s.page = context.pages().at(-1) || null; });
    if (persona.network && browserName === 'chromium') {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.emulateNetworkConditions', { offline: false, ...NETWORK_PRESETS[persona.network] });
    }
  });
  await context.newPage();
  return s;
}

// A GET form passes the method check in routeRequest, so submits are stopped in the page: a
// capture listener runs before the site's own handlers, and form.submit() fires no event.
async function refuseFormSubmits(s) {
  await s.context.exposeBinding('__personaBrowserSubmit', (_source, action) => {
    s.refusals.push(`refused: submit ${action} (writes are off (allowWrites is not set))`);
    logStep(s, 'refused', `submit ${action}`, 'writes are off (allowWrites is not set)');
  });
  await s.context.addInitScript(() => {
    const refuse = (form) => window.__personaBrowserSubmit(form.action);
    window.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); refuse(e.target); }, true);
    HTMLFormElement.prototype.submit = function submit() { refuse(this); };
  });
}

function routeRequest(s, route) {
  const req = route.request();
  const url = new URL(req.url());
  const host = url.hostname;
  if (hostMatches(host, s.config.blockedHosts)) {
    s.blocked.set(host, (s.blocked.get(host) || 0) + 1);
    return route.abort('blockedbyclient');
  }
  if (req.isNavigationRequest() && isTopLevel(req) && !hostMatches(host, s.config.allowedHosts)) {
    return refuse(s, route, `${req.method()} ${url.href}`, 'host not on the allowlist');
  }
  if (!['GET', 'HEAD'].includes(req.method()) && !s.config.persona.allowWrites) {
    return refuse(s, route, `${req.method()} ${url.href}`, 'writes are off (allowWrites is not set)');
  }
  return route.continue();
}

// A new tab's first navigation has no frame yet, and frame() throws; it is a top-level page.
function isTopLevel(req) {
  try { return !req.frame().parentFrame(); } catch { return true; }
}

function refuse(s, route, target, reason) {
  s.refusals.push(`refused: ${target} (${reason})`);
  logStep(s, 'refused', target, reason);
  return route.abort('blockedbyclient');
}

// A redirect's follow-up request skips context.route(), so the page URL is checked around every
// command as well. The redirected GET has reached the other host by then (README, Known gaps).
async function leaveIfOffAllowlist(s) {
  const url = s.page.url();
  if (!/^https?:/.test(url) || hostMatches(new URL(url).hostname, s.config.allowedHosts)) return;
  s.refusals.push(`refused: ${url} (redirected off the allowlist)`);
  logStep(s, 'refused', url, 'redirected off the allowlist');
  await s.page.goto('about:blank');
}

function logStep(s, action, target, result) {
  const url = s.page ? s.page.url() : null;
  fs.appendFileSync(s.stepsFile, JSON.stringify({ ts: new Date().toISOString(), url, action, target, result }) + '\n');
}

async function handle(s, { command, opts = {} }) {
  if (command === 'ping') return 'pong';
  if (command === 'stop') return stopSummary(s);
  if (!s.page) throw new Error('the session has no open page');
  const action = ACTIONS[command];
  if (!action) throw new UsageError(`unknown command: ${command}`);
  s.refusals = [];
  const target = opts.ref || opts.url || opts.key || null;
  let result;
  try {
    await leaveIfOffAllowlist(s);
    result = await action(s, opts);
  } catch (err) {
    const message = err.message.split('\n')[0];
    const refused = s.refusals.length ? s.refusals.join('\n') : null;
    logStep(s, command, target, refused ? 'refused' : `error: ${message}`);
    throw new Error(refused || message);
  }
  if (command !== 'look') {
    await s.page.waitForLoadState('domcontentloaded').catch(() => {});
    await leaveIfOffAllowlist(s);
    result = `${result}\nnow at ${s.page.url()} "${await s.page.title().catch(() => '')}"`;
  }
  logStep(s, command, target, s.refusals.length ? 'ok, with refusals' : 'ok');
  return [result, ...s.refusals].join('\n');
}

// A ref names an element in the last look; an unknown one would otherwise wait for the timeout.
async function locate(s, opts) {
  need(opts, 'ref');
  const el = s.page.locator(`aria-ref=${opts.ref}`);
  if (await el.count().catch(() => 0) === 0) throw new Error(`unknown ref ${opts.ref}; run look again`);
  return el;
}

const ACTIONS = {
  async look(s) {
    s.shot += 1;
    const file = path.join(s.config.personaDir, 'shots', `${String(s.shot).padStart(3, '0')}.png`);
    await s.page.screenshot({ path: file });
    const tree = await s.page.ariaSnapshot({ mode: 'ai' });
    return `url: ${s.page.url()}\ntitle: ${await s.page.title()}\nscreenshot: ${file}\n${tree}`;
  },
  async act(s, opts) {
    need(opts, 'do');
    if (!['click', 'hover', 'scroll', 'select'].includes(opts.do)) {
      throw new UsageError(`--do must be click, hover, scroll or select, not "${opts.do}"`);
    }
    if (opts.do === 'scroll' && !opts.ref) {
      const height = s.page.viewportSize()?.height || 600;
      await s.page.mouse.wheel(0, (opts.value === 'up' ? -0.8 : 0.8) * height);
      return `scrolled ${opts.value === 'up' ? 'up' : 'down'}`;
    }
    const el = await locate(s, opts);
    if (opts.do === 'click') await el.click();
    else if (opts.do === 'hover') await el.hover();
    else if (opts.do === 'scroll') await el.scrollIntoViewIfNeeded();
    else { need(opts, 'value'); await el.selectOption(opts.value); }
    return `${opts.do} ${opts.ref}`;
  },
  async type(s, opts) {
    need(opts, 'text');
    const el = await locate(s, opts);
    await el.fill(opts.text);
    if (opts.submit) await el.press('Enter');
    return `typed into ${opts.ref}${opts.submit ? ' and submitted' : ''}`;
  },
  async key(s, opts) {
    need(opts, 'key');
    await s.page.keyboard.press(opts.key);
    return `pressed ${opts.key}`;
  },
  async goto(s, opts) {
    need(opts, 'url');
    // After a refused or failed navigation the page shows an error page, not the site.
    const current = s.page.url();
    const url = new URL(opts.url, /^https?:/.test(current) ? current : s.config.startUrl);
    if (!/^https?:$/.test(url.protocol)) throw new Error(`refused: ${url.href} (only http and https)`);
    const response = await s.page.goto(url.href);
    return `goto ${url.href}: ${response ? response.status() : 'no response'}`;
  },
};

function stopSummary(s) {
  logStep(s, 'stop', null, 'ok');
  const blocked = [...s.blocked].map(([host, n]) => `${host} (${n})`).join(', ');
  return `stopped; steps in ${s.stepsFile}\nblocked: ${blocked || 'none'}`;
}

function shutdown(s, server) {
  server.close();
  if (!s) process.exit(0);
  s.browser.close().finally(() => process.exit(0));
}

// --- entry --------------------------------------------------------------------------------------

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === '__daemon') {
    const [sock, config] = rest;
    try {
      const output = await runDaemon(sock, JSON.parse(config));
      process.stdout.write(JSON.stringify({ ok: true, output }) + '\n');
    } catch (err) {
      process.stdout.write(JSON.stringify({ ok: false, error: err.message }) + '\n');
      process.exit(1);
    }
    return;
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) throw new Error(`Node.js 20 or later is required; this is ${process.version}`);
  if (!['start', 'look', 'act', 'type', 'key', 'goto', 'stop'].includes(command)) throw new UsageError(command ? `unknown command: ${command}` : 'no command');
  await runClient(command, parseArgs(rest));
}

main().catch((err) => {
  process.stderr.write(`persona-browser: ${err.message}\n`);
  if (err instanceof UsageError) process.stderr.write(USAGE + '\n');
  process.exit(1);
});
