# Star Inbox agent guide

This file applies to the entire repository.

## Product invariant

Star Inbox is a zero-install, local-first GitHub Stars decision app. It is an inbox workflow, not a folder manager or a hosted knowledge base. GitHub access is read-only by default; remote Star/Unstar writes exist only inside an explicitly armed Action Mode.

Do not add OAuth, accounts, a business backend, cloud persistence, automatic/background GitHub writes, README crawling, AI classification, MCP, browser extensions, or background synchronization unless the user explicitly expands scope.

## Non-negotiable security boundary

- GitHub tokens may exist only in ephemeral React/page memory.
- Never write a token to `localStorage`, `sessionStorage`, IndexedDB, OPFS, a URL, logs, analytics, error text, snapshots, fixtures, or exports.
- Never echo request headers or GitHub response bodies into user-facing errors.
- Import may call only `GET /user` and `GET /user/starred`.
- Repository detail and Ask My Stars may call `GET /repos/{owner}/{repo}/readme` only after an explicit per-repository user action; never turn this into a bulk README crawl.
- Action Mode may call only `PUT /user/starred/{owner}/{repo}` and `DELETE /user/starred/{owner}/{repo}`. It must remain off by default and require a visible plan, selected records, an in-memory write-capable Token, an explicit acknowledgement, and a confirmation phrase.
- A local `dropped` state never triggers a remote write. Rules, suggestions, page load, import, refresh, or background work must never execute a GitHub write.
- Do not add third-party analytics or telemetry.

Any change touching `src/security`, `src/github`, import persistence, backups, or exports must include a regression test for the relevant boundary.

## Data ownership

Keep the three write authorities separate:

```text
GitHub import or sync → GitHub repository data
Rules or future AI   → suggestion data
Explicit user action → user metadata and action plan
Explicit armed action → GitHub Star/Unstar
```

GitHub data and suggestions must never overwrite user-confirmed metadata. Use GitHub's numeric repository ID as repository identity; names can change.

## Architecture

- `src/app`: routing and top-level providers.
- `src/pages`: route composition and interaction state.
- `src/features`: testable product workflows.
- `src/github`: transport schemas, API client, pagination, and normalization.
- `src/db`: versioned Dexie schema and repository functions.
- `src/domain`: app-owned types independent of GitHub response shapes.
- `src/security`: ephemeral credential handling.

Validate every GitHub response with Zod before normalization. Keep UI code independent from raw GitHub response shapes. Database schema changes require a new Dexie version and an explicit migration; do not edit a released version in place.

## Interface expectations

- Preserve the warm editorial visual system defined in `src/styles.css`.
- Prefer semantic HTML, accessible labels, keyboard support, and visible focus states.
- Motion must respect `prefers-reduced-motion`.
- Long-running operations require visible progress, cancellation, and safe recovery.
- Keep the app shell as a full-height flex column so the footer stays at the viewport bottom on short pages.

## Commands

Run these before handing off a change:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Run `npm run test:e2e` for routing or user-flow changes. Do not commit generated `dist`, coverage, Playwright reports, or test results.

## Documentation

`README.md` is the default Simplified Chinese README. Keep `README.en.md` as the corresponding English version, and maintain reciprocal language links at the top of both files.
