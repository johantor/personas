---
name: migration-diff
description: What counts as a meaningful difference between an old and a new site after a migration or upgrade, what to ignore, and the Optimizely CMS specifics. Load when reading sweep results or comparing persona reports from /personas:diff.
---

# Migration diff

A diff run compares the same pages and the same persona tasks on an old and a new site. The new
site is under test. A difference is a finding only when a visitor, a search engine or an editor
would notice it.

## Meaningful

- **Status and redirects**: a page that was 200 and is now 404 or 500; a new redirect, a longer
  redirect chain, or a redirect to a different page than the old URL's content.
- **Titles and meta**: a changed or missing `<title>`, meta description or canonical; a
  canonical that now points at another page, or at the old host.
- **Main content**: text that is missing, cut short or duplicated. A changed text hash only says
  that the text differs: compare the samples and the screenshots before you call it a finding.
- **Navigation**: menu items, breadcrumbs or footer links that are missing, reordered so a task
  takes longer, or that link to a 404. A large change in the link count points here.
- **Forms**: fields, labels, validation or error messages that changed; a form that no longer
  reaches its thank-you page.
- **Search**: other results, another order or no results for the same query.
- **Personalized blocks**: a block that shows for a visitor group on old and not on new.
- **New console errors** on the new site, when they break something the persona can see or use.
- **Visual changes**: a pixel diff above the threshold. Look at both screenshots; a moved block
  or a missing image is a finding, a one-pixel shift is not.

## Ignore

- Timestamps, dates and "last updated" lines, cache-busting query strings (`?v=123`), session or
  CSRF tokens, and build hashes in asset URLs.
- Ad slots, cookie banners, and content that rotates on each load (carousels, "related" lists).
- The host itself: compare paths, because the old and the new site run on different hosts.
- Differences that the brief names as intended, such as a redesigned header.

## Optimizely CMS

- **Find to Graph**: CMS 13 replaces Search & Navigation (Find) with Optimizely Graph. Expect
  other ranking, other facet counts and other handling of synonyms and best bets. A query that
  found the right page on old and does not on new is a finding; a different order of good
  results is a note.
- **Empty content areas**: a block type that was not migrated renders as nothing, often with no
  error. A section that is present on old and blank on new, with the same heading, is a
  `migration-diff` finding.
- **Friendly URLs and language branches**: a changed URL segment, a missing language prefix
  (`/sv/`), or a fallback language page where a translation used to be.
- **Visitor groups**: personalized content that the new site no longer shows.
- **Edit mode**: for the editor persona, the edit UI changed between CMS 12 and 13. Report what
  blocks the editor's task, not that the UI looks different.

## Reporting

- One finding per kind of change, not per URL: name the count and two or three example paths in
  `actual`, and use one of them as `url`.
- `site` is `new` for a regression, `old` for something only the old site has wrong, and a
  defect on both sites is one finding with `site: new` and "also on the old site" in `actual`.
- A sweep difference is category `migration-diff`. A persona finding keeps its own category.
