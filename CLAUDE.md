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
| 1 | Scaffolding | pending |
| 2 | Config & API Client | pending |
| 3 | Channel & Message Fetching | pending |
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
├── index.ts                  Entry point. Loads config, runs auth.test, starts navigation loop.
├── config/
│   └── workspaces.ts         Reads workspaces.json, returns WorkspaceProfile[].
├── api/
│   ├── client.ts             Creates WebClient instances. Wraps calls with 429 handling.
│   ├── channels.ts           users.conversations — returns Channel[] with pagination.
│   ├── messages.ts           conversations.history — paginated, resolves user IDs.
│   ├── threads.ts            conversations.replies + Slack URL parser.
│   └── users.ts              users.info with in-memory display-name cache.
├── cli/
│   ├── selectWorkspace.ts    Workspace selection prompt (skipped if only one).
│   ├── selectChannel.ts      Searchable channel list.
│   ├── selectAction.ts       Per-channel action menu (view / thread / export / back).
│   └── prompts.ts            Shared helpers: spinner, confirm, displayMessages, inputPath.
├── export/
│   ├── types.ts              ExportDoc and ExportMessage interfaces.
│   ├── json.ts               JSON formatter.
│   ├── markdown.ts           Markdown formatter.
│   ├── html.ts               Self-contained HTML formatter.
│   └── index.ts              formatDoc(), getExtension(), defaultFilename() dispatcher.
└── types/
    └── slack.ts              Local Channel, Message, Reaction, FileAttachment types.
```

## Key Patterns

### Rate Limiting

Slack API has tiered rate limits. The approach:

1. `@slack/web-api` handles network errors and 5xx retries automatically (`retryConfig: { retries: 3 }`).
2. Slack 429 errors come back as structured API errors (not HTTP errors), so `client.ts` wraps calls to catch them explicitly, reads `retry_after` from the error, and sleeps `(retry_after * 1000) + 500ms` before retrying.
3. `users.info` calls are cached in a `Map<string, string>` per session to avoid hammering Tier 4 limits during exports.

When adding new API calls, always wrap them with the `withRateLimit` helper from `src/api/client.ts`.

### Pagination

All list-fetching functions (`listChannels`, `fetchHistory`, `fetchThread`) handle Slack's cursor-based pagination. They return `{ data, hasMore, nextCursor }` so the caller decides whether to fetch the next page. The CLI layer calls "load more" lazily — it does not pre-fetch all pages.

### User Display Names

Never display raw Slack user IDs to the user. Always resolve via `getDisplayName(client, userId)` from `src/api/users.ts`. Resolution order: `profile.display_name` → `real_name` → `id` (fallback).

### Export Pipeline

The CLI layer builds an `ExportDoc` (defined in `src/export/types.ts`) and passes it to `formatDoc(doc, format)`. Formatters never call the Slack API — they only transform the `ExportDoc`. To add a new export format, add a new file in `src/export/` and register it in `src/export/index.ts`.

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

## Development Notes

- Phase plan files live in `plan/` — consult them before starting a new phase
- The `workspaces.json` file used for testing is gitignored; never commit tokens
- When testing, use a real Slack token — there is no mock/stub layer for the API
