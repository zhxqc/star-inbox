# Privacy and security boundaries

## Token handling

The GitHub Token is held only by `TokenSessionProvider` in React component memory.

It is never written to:

- `localStorage` or `sessionStorage`;
- IndexedDB;
- a URL or query parameter;
- logs or analytics;
- exported data;
- error messages.

Refreshing or closing the page destroys the in-memory Token. The Token is sent only in the HTTPS `Authorization` header for direct requests from the browser to `https://api.github.com`.

Token fields disable browser autocomplete and include common password-manager ignore hints. These are defense-in-depth hints; users should still decline any browser or extension prompt that offers to save a Token.

## GitHub permissions and endpoints

Users should create a fine-grained personal access token with only **Starring: Read** for import. Import calls two read-only endpoints:

- `GET /user` to validate the Token. Fine-grained personal access tokens do not require an additional permission for this endpoint according to [GitHub's authenticated user documentation](https://docs.github.com/en/rest/users/users#get-the-authenticated-user).
- `GET /user/starred` to list the authenticated user's Stars. GitHub documents **Starring: Read** as the required fine-grained permission in the [starring endpoint documentation](https://docs.github.com/en/rest/activity/starring#list-repositories-starred-by-the-authenticated-user).

Repository detail and Ask My Stars can optionally call `GET /repos/{owner}/{repo}/readme` after the user clicks “Load README.” Public repositories can be read without authentication; private repositories require **Contents: Read**. README text stays in page memory and is not written to IndexedDB, logs, backups, or exports.

Action Center optionally uses **Starring: Read and write** together with GitHub's baseline **Metadata: Read** permission for the selected repositories. Private repositories must also be included in the fine-grained Token's repository access scope. It calls two official endpoints:

- `DELETE /user/starred/{owner}/{repo}` to cancel a selected Star;
- `PUT /user/starred/{owner}/{repo}` to execute a selected restoration plan.

Write access is off by default. A write requires a visible persisted plan, selected queued records, a Token held only in current React memory, an acknowledgement checkbox, the `EXECUTE` confirmation phrase, and a final click. Import, Smart Triage, local lifecycle changes, route loading, and cancellation recovery never automatically issue writes.

Batch execution stops after authentication, rate-limit, network, service, interruption, or local-persistence uncertainty. Later records remain queued. Result-unknown records are excluded from ordinary retries and require a manual GitHub status check first.

Star Inbox does not bulk-request README content and does not request Releases, Issues, Pull Requests, Commits, contributors, dependency files, or repository source code.

## Browser persistence

Repository metadata, user decisions, suggestions, import bookkeeping, and sanitized action records live in IndexedDB on the user's device. Clearing browser site data can delete them. Token values, README bodies, confirmation phrases, headers, and GitHub response bodies never enter IndexedDB.

## Network and third parties

The application has no business backend and includes no analytics or advertising scripts. Aside from static asset delivery, application data requests are direct browser calls to the documented GitHub API. GitHub's own privacy and access policies apply to those requests.

## Error safety

User-facing errors are created from status codes and local messages. Response bodies and request headers are not echoed, preventing accidental Token disclosure in the UI.
