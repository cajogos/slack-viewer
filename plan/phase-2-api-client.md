# Phase 2 — Config & Slack API Client

Build the foundation layer: load workspace profiles, create authenticated Slack clients, and cache user info.

## Goals

- [ ] `loadWorkspaces()` reads and validates `workspaces.json`; exits with a clear message if missing or empty
- [ ] `createClient()` returns a configured `WebClient` with retry support
- [ ] `auth.test` is called on startup to confirm the token is valid; workspace name is extracted
- [ ] 429 errors are caught and the process sleeps for `retry_after + 0.5s` before retrying
- [ ] `getDisplayName()` resolves a user ID to a display name
- [ ] User lookups are cached in memory — repeated calls for the same ID do not make extra API requests
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
- Maintain a `Map<string, string>` (user ID → display name) per client instance
- `getDisplayName(client, userId): Promise<string>`
  - Return from cache if present
  - Call `users.info` and cache result
  - Fall back to `userId` if the call fails (deleted user, no permission)
- Display name resolution order: `profile.display_name` → `real_name` → `id`

**Why cache?**
A channel export may contain hundreds of messages from a handful of users. Without caching, each message triggers a `users.info` call and quickly exhausts the Tier 4 limit.

---

## Verification

```bash
pnpm dev
```

Expected: startup calls `auth.test`, prints `Connected to: <workspace name>`. If `workspaces.json` is missing, prints a clear error and exits.
