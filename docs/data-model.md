# Data model

Database name: `star-inbox`  
Current schema version: `2`

## Canonical GitHub repository data

`repositories` uses GitHub's numeric repository ID (`githubId`) as its primary key. Repository names and owners can change, so `fullName` is searchable metadata rather than identity.

```ts
type GitHubRepository = {
  githubId: number
  nodeId: string
  name: string
  fullName: string
  ownerLogin: string
  ownerAvatarUrl?: string
  htmlUrl: string
  description?: string
  homepage?: string
  topics: string[]
  primaryLanguage?: string
  licenseSpdx?: string
  fork: boolean
  isTemplate: boolean
  defaultBranch?: string
  starredAt?: string
  createdAt?: string
  updatedAt?: string
  pushedAt?: string
  archived: boolean
  disabled: boolean
  private: boolean
  visibility?: string
  stargazersCount: number
  forksCount: number
  openIssuesCount: number
  size: number
  fetchedAt: string
  lastSeenAt: string
  snapshotId: string
}
```

## Import staging and snapshots

`importStaging` has a compound `[snapshotId+githubId]` primary key. Page writes are deduplicated within a run. It isolates incomplete downloads from canonical data.

`importSnapshots` records:

- status: pending, running, completed, failed, or cancelled;
- start and completion timestamps;
- repository count;
- last completed and failed page;
- authenticated account login.

It never contains the Token.

## User-confirmed data

`userMetadata` uses `repositoryId` as its primary key and holds intent, lifecycle status, titles, summaries, reasons, notes, tags, verification conclusions, use cases, alternatives, and review/verification timestamps. Only explicit user actions may update this table.

## Suggestions

`suggestions` holds script, rule, or future AI output, including queue, proposed intent/status, reasons, confidence, grouping key, and matched rule IDs. Suggestions are separate records and cannot overwrite `userMetadata`. Smart Triage excludes records with `confirmedAt` from rule regeneration.

## GitHub action plan

Schema V2 adds `actions`, keyed by an auto-incrementing local ID. Each record contains only safe execution state:

- numeric repository ID and the full name observed when queued;
- `star` or `unstar` action;
- queued, running, succeeded, failed, or cancelled status;
- user-visible reason, attempt count, timestamps, and a sanitized failure code.

The table never contains a Token, request headers, response bodies, or raw exception messages. A successful Unstar keeps the repository record and user notes locally; it does not physically delete IndexedDB data. A successful restoration moves a locally dropped project back to `reviewed` without downgrading projects in any other lifecycle state.

Interrupted requests and remote-success/local-persistence failures are recorded as result-unknown `cancelled` actions. They cannot enter the ordinary retry path until the user checks the final state on GitHub. Authentication, rate-limit, network, service, interruption, and local-persistence uncertainty stop the remaining batch and leave untouched actions queued.

## Write authority

```text
GitHub import/sync          → repositories
Rules or future AI          → suggestions
Explicit user confirmation  → userMetadata and actions
Armed Action Center         → remote GitHub Star state
```

Database schema changes must add a new Dexie version and a reviewed migration; released versions are never edited in place.
