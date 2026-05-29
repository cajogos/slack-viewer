# Phase 3 — Channel & Message Fetching

Implement the data layer: list channels, fetch message history, and load thread replies. All functions are pure data — no TUI rendering here.

## Goals

- [ ] `listChannels()` returns all channel types (public, private, DMs, group DMs) the user has access to
- [ ] `listChannels()` passes `exclude_archived: true` — archived channels never appear in the list
- [ ] Channel list handles pagination — fetches all pages, not just the first 200
- [ ] DM channels display the other user's name instead of a raw ID
- [ ] `fetchHistory()` returns messages in **chronological order** (oldest first) — results from the API are reversed before returning
- [ ] `fetchHistory()` returns messages with resolved display names, human-readable timestamps, reactions, and file metadata
- [ ] `fetchHistory()` supports cursor-based pagination and returns `hasMore` + `nextCursor`
- [ ] `fetchHistory()` uses a page size of 200 (Slack's max) rather than the default 100
- [ ] Messages with `subtype: 'bot_message'` use the `username` field as display name instead of calling `getDisplayName()`
- [ ] System subtypes (`channel_join`, `channel_leave`, `channel_topic`) are filtered out — they are noise in exports
- [ ] `fetchThread()` returns all replies for a given thread timestamp, including the parent message
- [ ] `parseThreadUrl()` correctly parses the p-number format into `channelId` + `threadTs`
- [ ] `parseThreadUrl()` returns `null` for unrecognised URL formats without throwing
- [ ] `src/utils/mrkdwn.ts` converts Slack mrkdwn syntax to plain text for terminal display and to the appropriate format for each exporter
- [ ] Local `Channel`, `Message`, `Reaction`, `FileAttachment` types defined in `src/types/slack.ts`
- [ ] `README.md` — no changes expected this phase; confirm existing content still accurate
- [ ] `CLAUDE.md` — Phase 3 marked `complete`; update the Pagination and Thread URL Parsing sections if behaviour differs from the plan; confirm the Project Structure file descriptions for `src/api/` are accurate

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

Lists all channels the authenticated user can access.

**Function:** `listChannels(client): Promise<Channel[]>`

- Calls `users.conversations` with `types: 'public_channel,private_channel,mpim,im'`
- Handles pagination via `cursor` — fetches all pages
- For IM channels: resolves the other user's display name as the channel name
- Returns channels sorted: joined channels first, then alphabetically within each group
- Uses `withRateLimit` wrapper from `client.ts`

- Pass `exclude_archived: true` — archived channels are not useful for reading or exporting

**Pagination note:** `users.conversations` is Tier 2 (~20 req/min). For workspaces with hundreds of channels, the page-fetching loop should include a small delay (100ms) between pages to stay safe.

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
- Returns `hasMore` and `nextCursor` so the CLI layer can offer "load more"

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

---

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
