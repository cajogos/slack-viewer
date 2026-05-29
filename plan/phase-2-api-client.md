# Phase 2 — Config & Slack API Client

Build the foundation layer: load workspace profiles, create authenticated Slack clients, and cache user info.

## Goals

- [ ] `loadWorkspaces()` reads and validates `workspaces.json`; exits with a clear message if missing or empty
- [ ] Token format validated at load time — warns if any token does not start with `xoxp-`
- [ ] `createClient()` returns a configured `WebClient` with retry support
- [ ] `auth.test` is called on startup to confirm the token is valid; workspace `team_id` and name are extracted
- [ ] 429 errors are caught and the process sleeps for `retry_after + 0.5s` before retrying (not just once — loops until success or max attempts)
- [ ] `getDisplayName()` resolves a user ID to a display name
- [ ] User display-name cache is scoped per workspace (`teamId`) — switching workspaces in the same session does not serve stale names from a previous workspace
- [ ] Invalid or expired tokens produce a clear error message and exit 1
- [ ] `README.md` — "Get a Slack user token" and "Create workspaces.json" sections verified against actual setup experience; scope list confirmed complete
- [ ] `CLAUDE.md` — Phase 2 marked `complete`; update the Rate Limiting and User Display Names sections if the implementation differed from the plan; confirm `withRateLimit` usage note is accurate

## Files to Create

```
src/config/workspaces.ts
src/api/client.ts
src/api/users.ts
```

---

## src/config/workspaces.ts

Reads `workspaces.json` from the project root and returns a typed list of profiles.

**Responsibilities:**
- Load and parse `workspaces.json`
- Validate at least one entry exists
- Validate token format: warn (but do not exit) if any token does not begin with `xoxp-`
- Return `WorkspaceProfile[]` — `{ name: string, token: string }`
- Throw a clear error if the file is missing or malformed

**Shape:**

```ts
interface WorkspaceProfile {
  name: string;
  token: string;
}

function loadWorkspaces(): WorkspaceProfile[]
```

---

## src/api/client.ts

Factory that creates a `WebClient` per workspace and wraps calls with rate-limit handling.

**Responsibilities:**
- Create `WebClient` with `retryConfig: { retries: 3 }` and `logLevel: LogLevel.WARN`
- Export `createClient(token: string): WebClient`
- Provide a `withRateLimit<T>(fn: () => Promise<T>): Promise<T>` wrapper that:
  - Catches 429 errors
  - Reads the `retry_after` value from the error
  - Sleeps `(retry_after * 1000) + 500` ms then retries once more
- On startup, call `auth.test` to validate the token and return the workspace name/team ID

**Why not rely solely on SDK retries?**
The SDK's `retryConfig` handles network errors and 5xx responses. Slack 429s come back as structured API errors, not HTTP errors, so they need an additional explicit check.

---

## src/api/users.ts

Fetches Slack user display names with session-scoped in-memory caching.

**Responsibilities:**
- Maintain a `Map<string, Map<string, string>>` — outer key is `teamId`, inner key is `userId`, value is display name
- `getDisplayName(client, teamId, userId): Promise<string>`
  - Return from cache if present
  - Call `users.info` and cache result under `teamId`
  - Fall back to `userId` if the call fails (deleted user, no permission)
- Display name resolution order: `profile.display_name` → `real_name` → `id`

**Why scope by teamId?**
If the user switches workspaces within a session, user IDs can overlap or conflict across workspaces. A flat cache would return stale display names from a previous workspace.

**Why cache at all?**
A channel export may contain hundreds of messages from a handful of users. Without caching, each message triggers a `users.info` call and quickly exhausts the Tier 4 limit.

---

## Web UI Compatibility

`src/api/` and `src/config/` are the reusable server-side layer that a future Web UI will use unchanged. Keep them clean:

- **No imports from `src/cli/`** — no `chalk`, `ora`, or `@inquirer/prompts` in this layer
- **No `process.exit()` calls** — throw typed errors instead; the CLI entry point catches and exits, and a future HTTP layer will catch and return a status code
- **`withRateLimit` and the user display-name cache work as-is** for a local server serving a single user. If multiple browser tabs hit the server concurrently, the per-call retry approach means simultaneous 429s are each retried independently rather than queued — acceptable for a local tool, but worth noting

`WorkspaceProfile` and the `WebClient` factory are the natural building blocks for per-request authenticated Slack clients in a Web UI context.

## Verification

```bash
pnpm dev
```

Expected: startup calls `auth.test`, prints `Connected to: <workspace name>`. If `workspaces.json` is missing, prints a clear error and exits.
