# Star Inbox

[简体中文](README.md) · [English](README.en.md)

> Your GitHub Stars are an inbox, not a knowledge base.

Star Inbox is a zero-install, local-first decision app that compresses a large Stars backlog into a small number of explainable, batch-confirmable decisions, then helps you clean up, search, rediscover, verify, and export useful projects.

- No product account
- No GitHub OAuth
- No business backend
- Your GitHub token stays in page memory
- Your data stays in your browser
- GitHub is read-only by default; remote Star/Unstar writes require explicit Action Mode
- Suggestions never override user decisions

## Current scope

The current implementation provides a complete local workflow from import to knowledge export:

- React, TypeScript, Vite, React Router, and Tailwind CSS
- Versioned Dexie / IndexedDB storage
- In-memory token session, read-only import, and explicitly armed write mode
- Paginated GitHub Stars import with progress, cancellation, retries, and failed-page resume
- Zod validation, response normalization, and deduplication by GitHub repository ID
- Landing, Import, Privacy, Dashboard, and Review Queue pages
- Pending/reviewed views, intent, tags, reasons, summaries, and private notes
- A save-and-next workflow whose review results survive refreshes in IndexedDB
- A complete Stars table with 20/50/100-item pagination, sticky headers, and current-page bulk classification
- Per-repository detail editing and user-triggered, on-demand README previews
- Smart Triage with explainable rules, five decision queues, batch confirmation, and cleanup plans
- Action Center with a dry run, double confirmation, batch Star/Unstar, progress, cancellation, retry, and safe audit records
- Ask My Stars with local task search, shortlists, candidate comparison, and on-demand README enrichment
- Forgotten Gems based on star age, recent pushes, and verification state
- Knowledge Export with verification conclusions, individual Obsidian notes, and verified-project collections
- A prefilled fine-grained token shortcut with a visual, step-by-step guide
- Vitest, Testing Library, and Playwright automation

The app never bulk-fetches READMEs and does not fetch releases, issues, commits, or repository source code. A README is fetched only after the user requests it for a repository detail or Ask My Stars candidate, and it remains in page memory. The app does not require a business backend.

Import, rule analysis, and a local “dropped” state never modify GitHub. A write request is possible only after the user reviews a visible Action Center plan, selects records, supplies an in-memory write-capable token, enables Action Mode, and enters the confirmation phrase.

GitHub Star Lists remain in public preview, and the official REST/GraphQL APIs do not expose supported endpoints for creating or updating those lists. Star Inbox therefore does not call private APIs or automatically modify GitHub Lists with a token.

## Quick start

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:5173`.

## Quality checks

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Install Chromium before the first end-to-end test run:

```bash
npx playwright install chromium
npm run test:e2e
```

## Privacy boundary

The token is held only by the current React session. It never enters `localStorage`, `sessionStorage`, IndexedDB, URLs, logs, error messages, or exported files. Refreshing or closing the page destroys it.

Stars, review data, suggestions, and action records are stored in the current browser's IndexedDB. Tokens, README bodies, and confirmation phrases are never persisted. Clearing site data can remove local content.

## Project structure

```text
src/
├── app/          # Router and providers
├── components/   # Shared interface components
├── pages/        # Route-level pages
├── features/     # Import, triage, actions, search, gems, verification, and export
├── github/       # GitHub API, schemas, pagination, normalization
├── db/           # Dexie schema and data access
├── domain/       # Domain models
└── security/     # In-memory token session
```

## Documentation

- [Architecture](docs/architecture.md)
- [Privacy and security](docs/privacy.md)
- [Data model](docs/data-model.md)
- [Agent development rules](AGENTS.md)

For the default Chinese documentation, see [README.md](README.md).
