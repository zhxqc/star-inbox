# Architecture

## Goal

Star Inbox is a browser-only React application. The deployment artifact is static HTML, CSS, and JavaScript. There is no business API, account service, cloud database, background sync, or server-side token handling.

## Runtime data flow

```text
Token input (React memory only)
        │
        ├── read path ── GET /user, GET /user/starred
        │                         │
        │                         ▼
        │            Zod → normalization → snapshot staging
        │                         │ complete snapshot only
        │                         ▼
        │                  repositories table
        │                         │
        │             ┌───────────┼───────────┐
        │             ▼           ▼           ▼
        │        Smart Triage  Ask My Stars  Forgotten Gems
        │             │           │           │
        │             └───────────┼───────────┘
        │                         ▼ explicit confirmation
        │                 userMetadata table
        │                         │
        │                  Verify → Export
        │
        └── write path ─ visible action plan → armed Action Mode
                                  │
                                  ▼
                    PUT/DELETE /user/starred/{owner}/{repo}
                                  │
                                  ▼
                           actions audit table
```

The starred repositories request uses the `application/vnd.github.star+json` media type so GitHub returns `starred_at`. It also sends `X-GitHub-Api-Version: 2026-03-10`, following the current [GitHub REST starring documentation](https://docs.github.com/en/rest/activity/starring).

Repository detail and Ask My Stars can make a user-triggered `GET /repos/{owner}/{repo}/readme` request using GitHub's raw README media type. This request is never part of import, triage generation, pagination, or background work, and its result remains in React memory rather than IndexedDB.

Action Center is read-only until the user explicitly arms it. A local action plan is not execution. Remote `PUT` or `DELETE` calls require selected queued records, a write-capable in-memory Token, an acknowledgement checkbox, the `EXECUTE` confirmation phrase, and a final button click. Rules, imports, route loads, and background work cannot reach the executor.

The executor processes selected actions sequentially. Authorization, rate-limit, network, service, interruption, or local-persistence uncertainty trips a circuit breaker and leaves untouched records queued. Only repository-specific failures may continue. Interrupted and remote-success/local-failure records are marked “result unknown” and cannot enter the ordinary retry path until the user checks GitHub.

## Layers

- `app/`: router and application providers.
- `pages/`: route-level UI with no direct GitHub response parsing.
- `features/github-import/`: import orchestration and resumable snapshot state.
- `features/review/`: pending/reviewed queue assembly and user-authoritative review writes.
- `features/library/`: IndexedDB pagination, current-page bulk actions, detail editing, and in-memory README presentation.
- `features/triage/`: deterministic, explainable suggestions and explicit batch confirmation.
- `features/actions/`: persisted plans and the only workflow allowed to invoke remote Star/Unstar methods.
- `features/ask/`: transparent local relevance search and shortlists.
- `features/gems/`: deterministic daily rediscovery ranking.
- `features/export/`: verification state and Markdown/Obsidian serialization.
- `github/`: API client, Zod schemas, pagination, and normalization.
- `db/`: versioned Dexie schema and repository functions.
- `domain/`: app-owned types, separate from GitHub transport types.
- `security/`: ephemeral Token session provider.

## Import behavior

1. `GET /user` validates the Token and returns the authenticated account.
2. A local import snapshot is created without storing the Token.
3. Pages of up to 100 starred repositories are fetched sequentially.
4. Each page is Zod-validated, normalized, deduplicated by `githubId`, and written to an IndexedDB staging table.
5. Transient network failures and retryable GitHub responses receive up to three attempts.
6. After an exhausted failure, the snapshot records `failedPage`; the UI can resume at that page.
7. Cancellation keeps completed staging pages so the user can resume.
8. Only a fully downloaded snapshot is committed to the canonical `repositories` table. Failed or cancelled runs never expose a partial collection to the Dashboard.

This page-at-a-time pipeline bounds parsing and rendering work to at most 100 repositories, making thousands of Stars practical without holding the full response in React state.

## Static deployment

`npm run build` emits a static `dist/` directory. A static host must serve `index.html` as the fallback for client-side routes such as `/import`, `/dashboard`, `/triage`, `/ask`, `/actions`, `/gems`, and `/knowledge`.

`index.html` includes a restrictive baseline Content Security Policy that permits application connections only to the same origin and `https://api.github.com`. Production hosts should also send equivalent CSP and anti-framing headers at the HTTP layer.

## Review behavior

The Dashboard links directly into a Review Queue that renders one repository at a time, even when the local collection contains thousands of records. Saving a review writes intent, summary, reason, tags, notes, and review timestamps only to `userMetadata`. The GitHub repository record is read for context but is never modified by the review workflow. Pending and reviewed views are reconstructed from IndexedDB after refresh.

## Decision authority

GitHub import updates only `repositories`. Rules update only `suggestions`. Explicit user confirmation updates `userMetadata` and may create an `actions` plan. Only the explicitly armed action executor can modify the authenticated user's Star state. This separation is present in schema version 2.
