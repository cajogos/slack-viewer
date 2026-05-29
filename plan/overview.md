# Slack Viewer CLI — Project Overview

A read-only CLI explorer and export tool for Slack. Navigate workspaces and channels interactively, view message history and threads, and export content as JSON, Markdown, or HTML. Built with TypeScript and pnpm.

## Goals

- Explore Slack channels and threads from the terminal
- Export conversations in structured formats (JSON, Markdown, HTML)
- Read-only — no ability to send messages, react, or modify anything
- Handles multiple workspace profiles
- Respects Slack API rate limits

## Non-goals

- Sending messages or reactions
- Real-time notifications or streaming
- File downloads (file metadata is exported, not the files themselves)
- Admin/management operations

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript 5 | Type safety, modern ESM support |
| Package manager | pnpm | Faster installs, strict dependency resolution |
| Slack API | `@slack/web-api` v7 | Official SDK, built-in retry/rate-limit support |
| Auth | User token (xoxp-) | Accesses all channels/DMs the user can see |
| TUI | `@inquirer/prompts` | Simple arrow-key navigation without heavy framework |
| Colours | `chalk` v5 | ESM-compatible terminal colours |
| Spinners | `ora` v8 | Loading indicators during API calls |
| Runtime | Node.js (ESM) | Native ESM modules |
| Dev runner | `tsx` | Run TypeScript directly without compilation step |

## Auth & Config

Workspace profiles are stored in `workspaces.json` at the project root (gitignored). Each profile maps a human name to a user token:

```json
{
  "my-company": "xoxp-...",
  "side-project": "xoxp-..."
}
```

See `workspaces.json.example` for the format.

## Project Structure

```
slack-viewer/
├── plan/                         ← this directory
│   ├── overview.md
│   ├── phase-1-scaffolding.md
│   ├── phase-2-api-client.md
│   ├── phase-3-channels-messages.md
│   ├── phase-4-cli-navigation.md
│   ├── phase-5-export-formatters.md
│   └── phase-6-polish.md
├── src/
│   ├── index.ts
│   ├── config/
│   ├── api/
│   ├── cli/
│   ├── export/
│   └── types/
├── workspaces.json.example
├── .env.example
├── package.json
└── tsconfig.json
```

## Development Phases

| Phase | Name | Key deliverable |
|---|---|---|
| 1 | Scaffolding | Project compiles and runs |
| 2 | API Client | Token auth, user cache, rate limiting |
| 3 | Channel & Message Fetching | Channel list, history, thread replies |
| 4 | CLI Navigation | Full interactive flow |
| 5 | Export Formatters | JSON / Markdown / HTML output |
| 6 | Polish | Error handling, help flags, README |

## Rate Limiting Summary

| API Method | Tier | Approx. limit |
|---|---|---|
| `users.conversations` | Tier 2 | ~20 req/min |
| `conversations.history` | Tier 3 | ~50 req/min |
| `conversations.replies` | Tier 3 | ~50 req/min |
| `users.info` | Tier 4 | ~100 req/min |

Strategy: SDK retries (3x), manual sleep on 429 (`retry_after` + 500 ms buffer), in-memory user cache per session, lazy pagination.
