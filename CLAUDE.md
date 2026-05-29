# slack-viewer — LLM Context

This file is the primary entry point for an LLM working on this codebase. It describes what the project is, how to run it, how the code is structured, and how to make safe changes. Update it at the end of each completed development phase.

## Project Summary

A read-only CLI explorer and export tool for Slack. The user navigates workspaces and channels interactively from the terminal, views message history and threads, and exports conversations to JSON, Markdown, or HTML.

**Hard constraints:**
- Read-only. No message sending, reactions, or any write operation is implemented or should be added.
- User tokens only (`xoxp-`). Bot tokens (`xoxb-`) are not supported.
- No file downloads. File metadata (name, URL) is exported; the files themselves are not fetched.

## Build Status

| Phase | Name | Status |
|---|---|---|
| 1 | Scaffolding | complete |
| 2 | Config & API Client | complete |
| 3 | Channel & Message Fetching | complete |
| 4 | CLI Navigation | pending |
| 5 | Export Formatters | pending |
| 6 | Polish & Edge Cases | pending |

Update the status column to `complete` as each phase finishes.

## Tech Stack

| Concern | Library | Notes |
|---|---|---|
| Language | TypeScript 5 | Strict mode, ESM (`"type": "module"`) |
| Package manager | pnpm | Use `pnpm` for all installs — never `npm` or `yarn` |
| Slack API | `@slack/web-api` v7 | Official SDK; built-in retry for network errors |
| Interactive prompts | `@inquirer/prompts` v7 | Arrow-key menus and searchable lists |
| Colours | `chalk` v5 | ESM-only; import as `import chalk from 'chalk'` |
| Spinners | `ora` v8 | ESM-only; import as `import ora from 'ora'` |
| Dev runner | `tsx` | Runs TypeScript directly without a compile step |

## Running the Project

```bash
# Install dependencies
pnpm install

# Development — run without compiling
pnpm dev

# Production — compile then run
pnpm build
pnpm start

# Compiled binary directly
node dist/index.js

# CLI flags
node dist/index.js --help
node dist/index.js --version
```

## Configuration

`workspaces.json` in the project root maps workspace names to user tokens. This file is gitignored.

```json
{
  "workspace-name": "xoxp-your-token-here"
}
```

Multiple workspaces are supported. The user selects one at startup (skipped if only one is configured).

See `workspaces.json.example` for the template.

## Project Structure

```
src/
├── index.ts                  Entry point. Handles --help/--version, non-interactive subcommands,
│                             and the interactive navigation loop.
├── config/
│   └── workspaces.ts         Reads workspaces.json, validates tokens, returns WorkspaceProfile[].
├── api/
│   ├── client.ts             Creates WebClient instances. Wraps calls with 429 handling.
│   ├── channels.ts           conversations.list — returns Channel[] with pagination, archived excluded.
│   │                         Public channels not joined are marked isMember:false ([no access]).
│   ├── messages.ts           conversations.history — paginated, chronological, resolves user IDs,
│   │                         handles bot_message subtype, filters system subtypes.
│   ├── threads.ts            conversations.replies + Slack URL parser.
│   └── users.ts              users.info with in-memory display-name cache (scoped per teamId).
├── cli/
│   ├── selectWorkspace.ts    Workspace selection prompt (skipped if only one).
│   ├── selectChannel.ts      Searchable channel list. "Switch workspace" option if multiple profiles.
│   │                         Public channels not joined shown as [no access] (disabled), not hidden.
│   ├── selectAction.ts       Per-channel action menu (view / thread / export / back).
│   │                         Thread view offers "Export this thread".
│   │                         Export offers date-range filtering.
│   └── prompts.ts            Shared helpers: spinner, confirm, displayMessages, inputPath.
├── export/
│   ├── types.ts              ExportDoc and ExportMessage interfaces.
│   ├── json.ts               JSON formatter.
│   ├── markdown.ts           Markdown formatter.
│   ├── html.ts               Self-contained HTML formatter (system-ui font, no external deps).
│   └── index.ts              formatDoc(), defaultOutputPath(), runExportCommand(), runThreadCommand().
├── utils/
│   └── mrkdwn.ts             Slack mrkdwn → plain/markdown/html converter.
└── types/
    └── slack.ts              Local Channel, Message, Reaction, FileAttachment types.
```

## Non-interactive Mode

For scripting and LLM use — no menus, no prompts:

```bash
# Export a channel
slack-viewer export --channel general --format json
slack-viewer export --channel general --format markdown --output ./out.md
slack-viewer export --channel C12345678 --format html --from 2026-01-01 --to 2026-03-31

# Export a thread
slack-viewer thread https://workspace.slack.com/archives/C12345678/p1234567890123456 --format json
slack-viewer thread <url> --format markdown --output ./thread.md
```

Arg parsing uses `parseArgs` from `node:util` (Node 24 built-in). Required flags missing → exit 1 with usage message. Output defaults to `./exports/<name>-<date>.<ext>`.

## Key Patterns

### Rate Limiting

Slack API has tiered rate limits. The approach:

1. `@slack/web-api` handles network errors and 5xx retries automatically (`retryConfig: { retries: 3 }`).
2. Slack 429 errors come back as structured API errors (not HTTP errors), so `client.ts` wraps calls to catch them explicitly, reads `retry_after` from the error, sleeps `(retry_after * 1000) + 500ms`, and retries — **looping** up to a max-attempts cap (a burst can yield several consecutive 429s), then re-throws.
3. `users.info` results are cached per session to avoid hammering Tier 4 limits during exports. The cache is a `Map<teamId, Map<userId, displayName>>` — scoped per workspace so switching workspaces never serves stale names.

When adding new API calls, always wrap them with the `withRateLimit` helper from `src/api/client.ts`.

### Pagination

All list-fetching functions (`listChannels`, `fetchHistory`, `fetchThread`) handle Slack's cursor-based pagination. They return `{ data, hasMore, nextCursor }` so the caller decides whether to fetch the next page. The CLI layer calls "load more" lazily — it does not pre-fetch all pages.

### User Display Names

Never display raw Slack user IDs to the user. Always resolve via `getDisplayName(client, teamId, userId)` from `src/api/users.ts`. Resolution order: `profile.display_name` → `real_name` → `id` (fallback).

Bot messages (`subtype: 'bot_message'`) have no `user` field — use `message.username` directly. System messages (`channel_join`, `channel_leave`, `channel_topic`) should be filtered out entirely.

### Slack mrkdwn

Message text from the API contains Slack's mrkdwn syntax (`<@U123>`, `<#C123|name>`, `*bold*`, `_italic_`, `<url|text>`). Always pass text through `mrkdwnToText()` or `mrkdwnToTextAsync()` from `src/utils/mrkdwn.ts` before rendering to the terminal or writing to an export. Raw mrkdwn in exports is unreadable.

**HTML escaping lives in the converter.** In `html` mode the converter escapes text segments (so `<script>` → `&lt;script&gt;`) and emits its own tags (`<strong>`, `<a>`). `src/export/html.ts` treats that output as trusted HTML and must **not** escape it again, or generated tags get double-escaped.

**Slack `ts` is float-seconds.** Convert with `parseFloat(ts) * 1000` before `new Date(...)`; the raw string is not milliseconds.

**Reaction `name` is a shortcode** (`thumbsup`, `+1`), not a glyph. Render as `:name:` — there is no shortcode→emoji map.

### Export Pipeline

The CLI layer builds an `ExportDoc` (defined in `src/export/types.ts`) and passes it to `formatDoc(doc, format)`. Formatters never call the Slack API — they only transform the `ExportDoc`. To add a new export format, add a new file in `src/export/` and register it in `src/export/index.ts`.

**Channel exports do not include reply bodies.** `conversations.history` returns top-level messages and thread parents (with `reply_count` → `ExportMessage.replyCount`) but not the replies. A channel export shows a `↳ N replies` indicator; only a *thread* export (via URL) populates `ExportMessage.replies`. This is intentional — see `plan/overview.md` Non-goals.

### Thread URL Parsing

`parseThreadUrl(url)` in `src/api/threads.ts` handles:
- `https://<workspace>.slack.com/archives/<channelId>/p<ts>`
- With optional `?thread_ts=<ts>&cid=<channelId>` query params (prefer `thread_ts` param when present)

The `p`-number encodes the timestamp: `p1234567890123456` → `"1234567890.123456"` (insert dot 10 digits from left). Returns `null` for unrecognised URLs.

## Navigation Flow

```
main()
  loadWorkspaces()                     exits if workspaces.json missing/empty
  selectWorkspace()                    skipped if only 1 profile
  createClient(token) + auth.test()    exits if token invalid
  loop:
    selectChannel()                    searchable list
    selectAction()                     loops until "Back"
      view messages → displayMessages() → "Load more?" loop
      paste thread URL → parseThreadUrl() → fetchThread() → displayMessages()
      export → selectFormat() → inputPath() → fetchAll() → formatDoc() → writeFile()
      back → breaks inner loop, returns to channel selection
```

## Adding New Features

**New export format:**
1. Add `src/export/<format>.ts` implementing `(doc: ExportDoc) => string`
2. Add the format to `ExportFormat` union type in `src/export/index.ts`
3. Register it in `formatDoc()`, `getExtension()`, and the format select prompt in `selectAction.ts`

**New API call:**
1. Add the function to the relevant file in `src/api/`
2. Wrap with `withRateLimit` from `src/api/client.ts`
3. Resolve any user IDs via `getDisplayName` from `src/api/users.ts`

**New CLI action:**
1. Add the case to `selectAction.ts`
2. Add a new choice to the `select` prompt choices array

## TypeScript Notes

- `"module": "NodeNext"` and `"moduleResolution": "NodeNext"` — all local imports must include the `.js` extension even when importing `.ts` files: `import { foo } from './foo.js'`
- ESM-only packages (`chalk`, `ora`) must be imported with `import`, not `require`
- Avoid `any` — use `unknown` and narrow with type guards if the shape is uncertain

## Security

**This is a public repository. Never commit sensitive data.**

| File | Contains | Gitignored? |
|---|---|---|
| `workspaces.json` | Slack user tokens (`xoxp-...`) | Yes |
| `.env` | Any environment secrets | Yes |
| `exports/` | Exported conversation data | Yes |

Before every push, run a token scan:

```bash
git grep "xoxp-"
git log --all -S "xoxp-" --oneline
```

If a token appears in git history, it must be considered compromised — revoke it at api.slack.com/apps immediately. Rewriting git history does not make a public repo safe.

When generating or suggesting code that handles tokens:
- Tokens are always read from `workspaces.json` at runtime, never hardcoded
- Never log or print a token value — not even a truncated version in debug output
- Never pass tokens as CLI arguments (they appear in shell history and `ps` output)
- `workspaces.json` is the only place tokens should ever exist on disk

## Completion Checklist

After finishing each phase or task, always do ALL of the following before stopping:
1. Run `pnpm test` — all tests must pass
2. Run `pnpm typecheck` — zero errors
3. Update the Build Status table in this file (change `pending` → `complete`)
4. Commit the changes

**Never skip any step. Never forget to mark the phase complete in the Build Status table.**

## Development Notes

- Phase plan files live in `plan/` — consult them before starting a new phase
- The `workspaces.json` file used for testing is gitignored; never commit tokens
- When testing, use a real Slack token — there is no mock/stub layer for the API
- Channel listing uses `conversations.list` (not `users.conversations`) so unjoined public channels can be shown as `[no access]`. Tradeoff: it enumerates every public channel in the workspace, so the list is larger in big workspaces
- Export date range: `oldest` = start-of-day, `latest` = **next day's** start so the end date is inclusive (UTC boundaries). Start-of-day for `latest` silently drops the whole end day
- `displayMessages` is **async** and takes `(client, teamId, messages)` — it resolves in-body `<@U123>` mentions via `mrkdwnToTextAsync`
- Open-in-browser (Phase 6) uses `child_process.execFile(opener, [path])`, never `exec` with an interpolated string — the output path is user-controlled (shell-injection risk)
- `parseArgs` (non-interactive mode) needs `allowPositionals: true` — the subcommand and thread URL are positionals
