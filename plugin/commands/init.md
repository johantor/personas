---
description: Set up personas for this project — check Node and the Playwright browsers, interview you about the site, then write .personas/personas.json and .personas/brief.md that /personas:run can use as they are
argument-hint: "[url]"
---

Set up personas for this project. Arguments: `$ARGUMENTS`

## 1. Check what exists

If `.personas/personas.json` or `.personas/brief.md` exists, show it and ask whether to replace
it. Never overwrite one without a yes.

## 2. Check the dependencies

Run `persona-browser check`. If it fails, show its install command and say that `/personas:run`
needs it. Go on with the setup either way: the files do not depend on the browsers.

## 3. Interview

Ask, one question at a time, and keep each answer short:

1. The site URL, unless the arguments give one. Use the staging or local URL, never production
   unless the person says so.
2. What the site is and who it is for, in one or two sentences.
3. Two to five tasks a visitor comes to do, such as "find the opening hours" or "book a visit".
4. What is out of bounds: paths, forms and actions never to touch, such as `/logout`, checkout
   or a contact form on production.
5. Other hosts a visit needs, such as a CDN, a login provider or an API on another domain.
6. The site's main language and time zone, for the defaults below.
7. Whether to add the CMS editor persona. It needs a test login, saved as a Playwright storage
   state, and the path of the editor (such as `/episerver/cms`).

## 4. Write `.personas/personas.json`

Start from this starter set. Replace each `goal` with one of the person's tasks that suits the
persona, set `defaults.locale` and `defaults.timezone` from answer 6, and keep the Swedish-locale
persona's own `sv-SE`. Leave out `editor` unless answer 7 was yes; with yes, set its `startPath`.

```json
{
  "version": 1,
  "defaults": { "maxSteps": 40, "locale": "en-GB", "timezone": "Europe/London" },
  "personas": [
    {
      "id": "first-timer-mobile",
      "name": "A first visit on a phone",
      "background": "Found the site from a search ad. Not technical. Impatient.",
      "goal": "TASK",
      "device": "iPhone 15",
      "patience": "low",
      "input": "touch"
    },
    {
      "id": "returning-desktop",
      "name": "A returning customer on a laptop",
      "background": "Has used the site before and knows roughly where things are.",
      "goal": "TASK",
      "viewport": { "width": 1440, "height": 900 },
      "browser": "chromium",
      "patience": "medium"
    },
    {
      "id": "keyboard-only",
      "name": "A keyboard and screen reader user",
      "background": "Uses the keyboard only and relies on headings, landmarks and focus order.",
      "goal": "TASK",
      "viewport": { "width": 1366, "height": 768 },
      "browser": "chromium",
      "input": "keyboard",
      "reducedMotion": "reduce",
      "patience": "high"
    },
    {
      "id": "swedish-slow-network",
      "name": "A Swedish visitor on a slow connection",
      "background": "Reads Swedish first and browses on a weak mobile connection.",
      "goal": "TASK",
      "viewport": { "width": 1280, "height": 800 },
      "browser": "chromium",
      "locale": "sv-SE",
      "timezone": "Europe/Stockholm",
      "network": "slow-3g",
      "patience": "medium"
    },
    {
      "id": "editor",
      "name": "A new CMS editor",
      "background": "In the first week with the CMS.",
      "goal": "Create and publish a news page with an image",
      "browser": "chromium",
      "viewport": { "width": 1440, "height": 900 },
      "auth": "auth/editor.json",
      "startPath": "/episerver/cms",
      "allowWrites": true,
      "maxSteps": 60
    }
  ]
}
```

## 5. Write `.personas/brief.md`

```markdown
# Brief

## Site

URL: <url>

<answer 2>

## Tasks

- <each task from answer 3>

## Out of bounds

- <each item from answer 4>

## Allowed hosts

- <each host from answer 5; leave the section out when there are none>
```

`persona-browser` reads `## Allowed hosts` and `## Blocked hosts` (extra analytics hosts to
block). The visitors read the rest.

## 6. Check and finish

1. Run `personas-check personas .personas/personas.json`. Fix the file until it passes.
2. Add `.personas/runs/` and `.personas/auth/` to `.gitignore`, each on its own line, unless the
   file already has them. Create `.gitignore` if there is none.
3. With the editor persona, say how to save its login once:
   `npx playwright codegen --save-storage=.personas/auth/editor.json <url>`.
4. Say that `/personas:run` runs them, and print its cost estimate: the number of personas
   times their `maxSteps`.
