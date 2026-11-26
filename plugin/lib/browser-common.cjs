'use strict';
// What persona-browser and the sweep share: the analytics block list, host matching and how
// Playwright is found. One copy, so both refuse the same hosts.
const path = require('node:path');
const { createRequire } = require('node:module');

const INSTALL_HINT = 'npm install -D playwright && npx playwright install chromium webkit';

// Analytics and tag hosts, blocked so runs don't skew the site's statistics. A brief adds more
// under "## Blocked hosts". An entry matches the host and its subdomains.
const DEFAULT_BLOCKED_HOSTS = [
  'google-analytics.com', 'analytics.google.com', 'googletagmanager.com', 'doubleclick.net',
  'googleadservices.com', 'cdn.optimizely.com', 'logx.optimizely.com', 'hotjar.com', 'hotjar.io',
  'clarity.ms', 'connect.facebook.net', 'segment.com', 'segment.io', 'mixpanel.com',
  'plausible.io', 'matomo.cloud', 'siteimproveanalytics.com', 'siteimproveanalytics.io',
];

function hostMatches(host, entries) {
  return entries.some((e) => host === e || host.endsWith('.' + e));
}

function loadPlaywright() {
  // The user's project first, then the normal lookup (beside the plugin, NODE_PATH, global).
  for (const req of [createRequire(path.join(process.cwd(), 'package.json')), require]) {
    try { return req('playwright'); } catch { /* try the next location */ }
  }
  throw new Error(`Playwright is not installed. Install it: ${INSTALL_HINT}`);
}

module.exports = { INSTALL_HINT, DEFAULT_BLOCKED_HOSTS, hostMatches, loadPlaywright };
