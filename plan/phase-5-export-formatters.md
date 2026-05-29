# Phase 5 — Export Formatters

Implement the three output formatters. All formatters take the same `ExportDoc` intermediate representation and produce a string.

## Goals

- [ ] `ExportDoc` and `ExportMessage` types defined in `src/export/types.ts`
- [ ] JSON formatter produces valid, pretty-printed JSON with all fields (reactions, files, replies)
- [ ] Markdown formatter produces clean output: header, messages separated by `---`, replies as blockquotes
- [ ] HTML formatter produces a standalone file with no external dependencies (no CDN, no network requests)
- [ ] HTML font stack uses `system-ui, sans-serif` — no `Slack-Lato` (unavailable outside Slack's app)
- [ ] HTML opens correctly in a browser offline; `<details>` threads expand without JavaScript
- [ ] HTML text content is HTML-escaped (no XSS if message contains `<script>` etc.)
- [ ] All formatters pass message text through `mrkdwn` converter from `src/utils/mrkdwn.ts` before rendering
- [ ] `defaultFilename()` generates a sensible filename from channel name and export date; output defaults to `./exports/`
- [ ] Thread export (`ExportDoc` with a single thread) works correctly in all three formats
- [ ] Non-interactive `export` and `thread` subcommands (stubbed in Phase 4) are fully wired to the formatters
- [ ] All three formats verified against a real channel export and a real thread export
- [ ] `README.md` — Export Formats table updated with any format nuances discovered during implementation (e.g. HTML offline behaviour, JSON schema shape); non-interactive commands confirmed accurate
- [ ] `CLAUDE.md` — Phase 5 marked `complete`; update the Export Pipeline section with the actual `ExportDoc` shape if it changed; update "Adding New Features → New export format" steps if the pattern differs

## Files to Create

```
src/export/types.ts
src/export/json.ts
src/export/markdown.ts
src/export/html.ts
src/export/index.ts
```

---

## src/export/types.ts

The `ExportDoc` intermediate representation — populated by the CLI layer before passing to a formatter.

```ts
interface ExportDoc {
  workspace: string;
  channel: string;
  channelType: 'public' | 'private' | 'mpim' | 'im';
  exportedAt: string;       // ISO 8601
  messageCount: number;
  messages: ExportMessage[];
}

interface ExportMessage {
  ts: string;               // raw Slack timestamp
  datetime: string;         // human-readable, local timezone
  userId: string;
  user: string;             // resolved display name
  text: string;
  reactions?: ExportReaction[];
  files?: ExportFile[];
  replies?: ExportMessage[];  // only present when exporting a thread or with replies option
}

interface ExportReaction {
  name: string;
  count: number;
}

interface ExportFile {
  name: string;
  url: string;
  mimetype?: string;
}
```

---

## src/export/json.ts

```ts
function toJson(doc: ExportDoc): string
```

`JSON.stringify(doc, null, 2)` — the `ExportDoc` shape is already clean, no transformation needed.

File extension: `.json`

---

## src/export/markdown.ts

```ts
function toMarkdown(doc: ExportDoc): string
```

**Structure:**

```markdown
# #channel-name — My Workspace
Exported: 2026-05-29 14:30 UTC · 47 messages

---

**Alice** · 2026-05-28 09:12
Hello everyone, here's the update...

> :thumbsup: ×3  :heart: ×1

📎 quarterly-report.pdf

  > **Bob** · 2026-05-28 09:15 *(reply)*
  > Thanks Alice! I'll take a look.

---
```

Rules:
- Top-level messages separated by `---`
- Reactions on their own line, prefixed `> `, each as `:name: ×N`
- File attachments as `📎 name` with URL in parentheses if available
- Thread replies indented with `> ` blockquote, marked `*(reply)*`
- Nested replies (replies within replies) are not common in Slack; flatten to one level

File extension: `.md`

---

## src/export/html.ts

```ts
function toHtml(doc: ExportDoc): string
```

Self-contained single HTML file — no external dependencies, works offline.

**Design:**
- Dark theme inspired by Slack's colour scheme
- Font stack: `system-ui, -apple-system, sans-serif` — no `Slack-Lato` (proprietary, unavailable outside Slack's own app)
- Collapsible thread replies (native `<details>/<summary>` — no JavaScript needed)
- Emoji reactions as `<span class="reaction">:name: N</span>` badges
- File attachments as plaintext links

**HTML structure:**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>#channel — Workspace</title>
  <style>/* all styles inline */</style>
</head>
<body>
  <header>
    <h1>#channel-name</h1>
    <p>Workspace · Exported 2026-05-29</p>
  </header>
  <main>
    <article class="message">
      <div class="meta">
        <span class="user">Alice</span>
        <time>2026-05-28 09:12</time>
      </div>
      <div class="text">Hello everyone…</div>
      <div class="reactions">
        <span class="reaction">👍 3</span>
      </div>
      <details class="replies">
        <summary>2 replies</summary>
        <article class="message reply">…</article>
      </details>
    </article>
  </main>
</body>
</html>
```

All text is HTML-escaped to prevent XSS if the content is opened in a browser.

File extension: `.html`

---

## src/export/index.ts

Dispatcher and filename helpers:

```ts
type ExportFormat = 'json' | 'markdown' | 'html'

function formatDoc(doc: ExportDoc, format: ExportFormat): string
function getExtension(format: ExportFormat): string
function defaultFilename(channel: string, format: ExportFormat): string
  // e.g. "exports/general-2026-05-29.md"
function defaultOutputPath(channel: string, format: ExportFormat): string
  // creates ./exports/ directory if it doesn't exist, returns full path
```

This is also where the non-interactive `export` and `thread` subcommands (stubbed in Phase 4) are fully implemented:

```ts
async function runExportCommand(args: ParsedArgs): Promise<void>
  // --channel, --format, --output, --from, --to
async function runThreadCommand(args: ParsedArgs): Promise<void>
  // <url>, --format, --output
```

---

## Verification

For each format, export a real channel and check:

- **JSON**: valid JSON, all messages present, reactions/files included
- **Markdown**: renders correctly in a Markdown viewer; replies indented
- **HTML**: opens in browser without errors; no broken styles; `<details>` expand correctly; file is standalone (no network requests)
