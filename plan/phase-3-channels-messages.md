# Phase 3 — Channel & Message Fetching

Implement the data layer: list channels, fetch message history, and load thread replies. All functions are pure data — no TUI rendering here.

## Goals

- [x] `listChannels()` returns all channel types (public, private, DMs, group DMs) the user has access to
- [x] `listChannels()` passes `exclude_archived: true` — archived channels never appear in the list
- [x] Channel list handles pagination — fetches all pages, not just the first 200
- [x] DM channels display the other user's name instead of a raw ID
- [x] `fetchHistory()` returns messages in **chronological order** (oldest first) — results from the API are reversed before returning
- [x] `fetchHistory()` returns messages with resolved display names, human-readable timestamps, reactions, and file metadata
- [x] `fetchHistory()` supports cursor-based pagination and returns `hasMore` + `nextCursor`
- [x] `fetchHistory()` uses a page size of 200 (Slack's max) rather than the default 100
- [x] Messages with `subtype: 'bot_message'` use the `username` field as display name instead of calling `getDisplayName()`
- [x] System subtypes (`channel_join`, `channel_leave`, `channel_topic`) are filtered out — they are noise in exports
- [x] `fetchThread()` returns all replies for a given thread timestamp, including the parent message
- [x] `parseThreadUrl()` correctly parses the p-number format into `channelId` + `threadTs`
- [x] `parseThreadUrl()` returns `null` for unrecognised URL formats without throwing
- [x] `src/utils/mrkdwn.ts` converts Slack mrkdwn syntax to plain text for terminal display and to the appropriate format for each exporter
- [x] Local `Channel`, `Message`, `Reaction`, `FileAttachment` types defined in `src/types/slack.ts`
- [x] `README.md` — no changes expected this phase; confirm existing content still accurate
- [x] `CLAUDE.md` — Phase 3 marked `complete`; update the Pagination and Thread URL Parsing sections if behaviour differs from the plan; confirm the Project Structure file descriptions for `src/api/` are accurate

## Files to Create

```
src/api/channels.ts
src/api/messages.ts
src/api/threads.ts
src/types/slack.ts
src/utils/mrkdwn.ts
```

---

## src/types/slack.ts

Local type aliases used across the codebase, derived from `@slack/web-api` response types.

```ts
interface Channel {
  id: string;
  name: string;           // "#general" for channels, user name for DMs
  type: 'public' | 'private' | 'mpim' | 'im';
  memberCount?: number;
  isMember: boolean;
}

interface Message {
  ts: string;
  datetime: string;       // human-readable local time
  userId: string;
  user: string;           // resolved display name
  text: string;
  reactions?: Reaction[];
  files?: FileAttachment[];
  replyCount?: number;
  threadTs?: string;      // set if this message starts a thread
}

interface Reaction {
  name: string;
  count: number;
}

interface FileAttachment {
  name: string;
  url: string;            // permalink or download URL
  mimetype?: string;
}
```

---

## src/api/channels.ts

Lists the channels visible to the authenticated user.

**Function:** `listChannels(client): Promise<Channel[]>`

- Calls `conversations.list` with `types: 'public_channel,private_channel,mpim,im'`
- Handles pagination via `cursor` — fetches all pages
- Sets `isMember` from each conversation's `is_member` field (DMs/group DMs are always member channels)
- For IM channels (`is_im`): resolves the other user's display name (from the `user` field) as the channel name
- Returns channels sorted: joined channels first, then alphabetically within each group
- Uses `withRateLimit` wrapper from `client.ts`
- Pass `exclude_archived: true` — archived channels are not useful for reading or exporting

**Why `conversations.list`, not `users.conversations`?**
`users.conversations` returns only channels the user has **joined**, so it cannot surface public channels the user can see but hasn't joined — yet the UI deliberately shows those as `[no access]` (see Phase 4). `conversations.list` returns:
- All public channels (joined or not — `is_member` distinguishes them)
- Private channels, group DMs, and DMs the user **is a member of**

Note that Slack never reveals private channels the user is not in, so `[no access]` only ever applies to **public channels the user hasn't joined** — not private ones.

**Tradeoff:** `conversations.list` enumerates *every* public channel in the workspace, so in large workspaces the list is bigger and takes more paginated calls than `users.conversations` would. If the resulting list is unmanageably large, a future option could filter to members-only; for now the searchable picker (Phase 4) keeps it usable.

**Pagination note:** `conversations.list` is Tier 2 (~20 req/min). For workspaces with hundreds of channels, the page-fetching loop should include a small delay (100ms) between pages to stay safe.

---

## src/api/messages.ts

Fetches message history for a channel.

**Function:** `fetchHistory(client, channelId, opts?): Promise<{ messages: Message[], hasMore: boolean, nextCursor?: string }>`

Options:
```ts
interface FetchHistoryOpts {
  limit?: number;     // default 50
  cursor?: string;    // for pagination
  oldest?: string;    // Unix timestamp string
  latest?: string;
}
```

- Calls `conversations.history` with `limit: 200` (Slack's maximum per page)
- **Reverses the result** — API returns newest-first; consumers expect oldest-first chronological order
- Filters out system subtypes: `channel_join`, `channel_leave`, `channel_topic` — these are noise in display and exports
- Handles `bot_message` subtype: uses `message.username` as the display name instead of calling `getDisplayName()`
- Resolves user IDs to display names via `getDisplayName` from `users.ts` for all other messages
- Converts `ts` to a human-readable datetime string (local timezone)
- Maps `reactions` and `files` arrays to local types
- Sets `replyCount` from `reply_count` and `threadTs` from `thread_ts` when present, so the CLI can show a `↳ N replies` indicator
- Returns `hasMore` and `nextCursor` so the CLI layer can offer "load more"

**Thread replies are NOT included here.** `conversations.history` returns only top-level messages and thread *parents* (carrying `reply_count`); it does not return the reply bodies. Fetching replies requires a separate `conversations.replies` call per thread (see `threads.ts`). A channel export therefore contains parents with a reply count but not the reply text — this is the documented behaviour (see `overview.md` Non-goals). To capture a full thread, export it directly via its URL.

**Reaction `name` is a code, not a glyph.** Slack reactions arrive as `{ name: 'thumbsup', count: 3 }` — `name` is the emoji shortcode (`thumbsup`, `+1`, `heart`), not a Unicode character. Renderers display `:name: ×N`; there is no shortcode→glyph mapping in this project, so do not assume `name` can be printed as an emoji directly.

**Timestamp handling.** Slack `ts` values are float-seconds as a string (e.g. `"1700000000.123456"`). When converting to a `Date`, multiply by 1000: `new Date(parseFloat(ts) * 1000)` — passing the raw string to `new Date()` treats it as milliseconds and produces a wrong date.

---

## src/api/threads.ts

Fetches a thread (all replies to a parent message) and parses Slack thread URLs.

**Function:** `fetchThread(client, channelId, threadTs): Promise<Message[]>`

- Calls `conversations.replies` with full pagination
- First message in the result is the parent — include it
- Resolves all user IDs to display names
- Returns messages in chronological order

**Function:** `parseThreadUrl(url): { channelId: string, threadTs: string } | null`

Slack thread URL format:
```
https://<workspace>.slack.com/archives/<channelId>/p<ts_no_dot>[?thread_ts=<threadTs>]
```

Examples:
- `https://acme.slack.com/archives/C12345678/p1234567890123456`
  → `{ channelId: 'C12345678', threadTs: '1234567890.123456' }`
- `https://acme.slack.com/archives/C12345678/p1234567890123456?thread_ts=1234567890.123456&cid=C12345678`
  → prefer `thread_ts` query param if present, else derive from p-number

**p-number to ts conversion:**
The `p` number is the thread timestamp with the decimal point removed (microseconds). To convert:
```
"p1234567890123456" → "1234567890.123456"
```
i.e., insert a dot 10 digits from the left (Unix seconds part).

Returns `null` for unrecognised URL formats.

---

## src/utils/mrkdwn.ts

Converts Slack's `mrkdwn` markup to readable output. Raw Slack message text contains syntax that is unreadable in exports without this step.

**Function:** `mrkdwnToText(text: string, opts?: { format: 'plain' | 'markdown' | 'html' }): string`

Conversions:

| Slack mrkdwn | plain/terminal | markdown | html |
|---|---|---|---|
| `<@U12345>` | `@displayname` (resolved) | `@displayname` | `<span class="mention">@displayname</span>` |
| `<#C12345\|channel-name>` | `#channel-name` | `#channel-name` | `<span class="channel">#channel-name</span>` |
| `<https://url\|link text>` | `link text (https://url)` | `[link text](https://url)` | `<a href="https://url">link text</a>` |
| `<https://url>` | `https://url` | `https://url` | `<a href="https://url">https://url</a>` |
| `*bold*` | `bold` | `**bold**` | `<strong>bold</strong>` |
| `_italic_` | `italic` | `_italic_` | `<em>italic</em>` |
| `` `code` `` | `` `code` `` | `` `code` `` | `<code>code</code>` |
| `` ```block``` `` | `` ```block``` `` | `` ```\nblock\n``` `` | `<pre><code>block</code></pre>` |
| `&amp;` `&lt;` `&gt;` | `& < >` | `& < >` | `&amp; &lt; &gt;` |

User mention resolution (`<@U12345>`) calls `getDisplayName()` and is async — the function signature for this variant is `mrkdwnToTextAsync(text, client, teamId, format)`. The sync version passes through raw `<@U12345>` tokens unchanged (used during display where async isn't convenient).

**HTML escaping is owned by this converter, not the formatter.** In `html` mode, `mrkdwnToText` must escape the *text segments* as it parses (so `<script>` in a message becomes `&lt;script&gt;`) while emitting its own tags (`<strong>`, `<a>`, `<code>`) unescaped. The HTML formatter (`src/export/html.ts`) must therefore treat the converter's output as trusted HTML and **must not** escape it again — double-escaping would turn `<strong>` into `&lt;strong&gt;`. This single-ownership rule is what makes the Phase 5 XSS test (`<script>` → `&lt;script&gt;`) pass without breaking formatting.

---

## Web UI Compatibility

The functions in `src/api/` (`listChannels`, `fetchHistory`, `fetchThread`) will become the server-side handlers for a future Web UI's HTTP routes — thin wrappers that call these and return JSON. To keep that migration easy:

- **Return typed data only** — no `console.log`, no formatting, no process output from within `src/api/`
- **`src/types/slack.ts`** (`Channel`, `Message`, etc.) is the wire format between server and browser; keep it clean and avoid embedding CLI-specific fields
- **`src/utils/mrkdwn.ts`** runs server-side in both the CLI and Web UI; no changes needed
- The `{ data, hasMore, nextCursor }` pagination shape maps naturally to a paginated JSON API response

## Verification

Use a real token in `workspaces.json` and run:

```bash
pnpm dev
```

A temporary test in `src/index.ts` should:
1. Load workspaces, connect to Slack
2. Call `listChannels` and print the first 5
3. Call `fetchHistory` on a known channel ID and print the first 3 messages
4. Call `parseThreadUrl` with a real thread URL and print the parsed result

## Developer Checkpoint

Demonstrate the data layer with the **temporary probe** already described in **Verification** (see the policy in `overview.md`):

- The probe in `src/index.ts` lists the first 5 channels, prints the first 3 messages of a known channel (confirm chronological order and resolved names), and parses a real thread URL.
- Have the developer run `pnpm dev` and eyeball the output: mrkdwn rendered as plain text, system messages absent, bot messages showing `username`.
- Show `pnpm test` passing.
- **Remove the probe** and show `git diff --stat` before marking the phase complete.

## Testing

`parseThreadUrl` and `mrkdwnToText` are pure functions — no mocks needed. API functions use `createMockClient()` from `tests/__fixtures__/mockClient.ts`.

**New files:**
```
tests/__fixtures__/channels.ts     fake Channel[] fixture
tests/__fixtures__/messages.ts     fake Message[] (regular, bot, thread replies, system subtypes)
tests/api/channels.test.ts
tests/api/messages.test.ts
tests/api/threads.test.ts
tests/utils/mrkdwn.test.ts
```

**`tests/api/channels.test.ts`** cases:
- Returns all visible channels via `conversations.list` (excludes archived)
- Merges paginated results across two pages into a single list
- Sets `isMember: false` for public channels the user hasn't joined (these become `[no access]` in the picker) and `isMember: true` for joined ones
- Resolves the IM partner's display name as the channel name for `im` conversations

**`tests/api/messages.test.ts`** cases:
- Returns messages in chronological order (oldest first — API returns newest first; must be reversed)
- Resolves user IDs to display names via `getDisplayName`
- Bot messages (`subtype: 'bot_message'`) use `username` field directly, not `getDisplayName`
- System subtypes (`channel_join`, `channel_leave`, `channel_topic`) are filtered out
- Handles paginated history — returns `hasMore` and `nextCursor`

**`tests/api/threads.test.ts`** — `parseThreadUrl` only (pure function):
- Parses `https://workspace.slack.com/archives/C123/p1234567890123456` correctly
- Prefers `thread_ts` query param when present over the p-number
- `p1234567890123456` → `"1234567890.123456"` (dot inserted 10 digits from left)
- Returns `null` for unrecognised URL formats

**`tests/utils/mrkdwn.test.ts`** — pure function, all three output modes:
- `<@U123>` → `@U123` (sync) / resolved name (async)
- `<#C123|general>` → `#general`
- `<https://example.com|click here>` → format-appropriate output for plain, markdown, html
- `*bold*`, `_italic_`, `` `code` ``, ` ```block``` `
- HTML entities: `&amp;`, `&lt;`, `&gt;` escape correctly in html mode
- Unrecognised tokens passed through unchanged

**Run:** `pnpm test` — all cases pass without any network calls.
