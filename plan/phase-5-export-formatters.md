# Phase 5 — Export Formatters

Implement the three output formatters. All formatters take the same `ExportDoc` intermediate representation and produce a string.

## Goals

- [ ] `ExportDoc` and `ExportMessage` types defined in `src/export/types.ts`
- [ ] JSON formatter produces valid, pretty-printed JSON with all fields (reactions, files, replies)
- [ ] Markdown formatter produces clean output: header, messages separated by `---`, replies as blockquotes
- [ ] HTML formatter produces a standalone file with no external dependencies (no CDN, no network requests)
- [ ] HTML font stack uses `system-ui, sans-serif` — no `Slack-Lato` (unavailable outside Slack's app)
- [ ] HTML opens correctly in a browser offline; `<details>` threads expand without JavaScript
- [ ] HTML text content is HTML-escaped (no XSS if message contains `<script>` etc.) — escaping is performed by `mrkdwnToText(..., { format: 'html' })`, which escapes text segments while emitting its own safe tags; `html.ts` must **not** re-escape the converter's output (that would double-escape `<strong>` etc.)
- [ ] All formatters pass message text through the `mrkdwn` converter from `src/utils/mrkdwn.ts` before rendering — `format: 'plain'` is never used for exports; use `'markdown'` for `markdown.ts` and `'html'` for `html.ts`
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
  datetime: string;         // human-readable, local timezone (see datetime note below)
  userId: string;
  user: string;             // resolved display name
  text: string;
  reactions?: ExportReaction[];
  files?: ExportFile[];
  replyCount?: number;      // present on thread parents in a channel export; lets formatters show "N replies"
  replies?: ExportMessage[];  // populated ONLY for a thread export; channel exports leave this undefined (only replyCount is set) — see overview.md Non-goals
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
- Reactions on their own line, prefixed `> `, each as `:name: ×N` (`name` is the Slack shortcode — `thumbsup`, not 👍)
- File attachments as `📎 name` with URL in parentheses if available
- Thread replies indented with `> ` blockquote, marked `*(reply)*` — only present for thread exports
- For a channel export, a parent message with `replyCount > 0` shows a `↳ N replies` line (the reply bodies are not included — see `overview.md` Non-goals)
- Nested replies (replies within replies) are not common in Slack; flatten to one level

**Datetime consistency:** the per-message line uses `ExportMessage.datetime` (local timezone, as resolved by the API layer). The header's "Exported:" line uses `ExportDoc.exportedAt` (ISO 8601) — render it with an explicit `UTC` suffix only if it is actually UTC; otherwise label it with the local offset. Do not hard-code "UTC" next to a local-timezone value. Pick one convention and apply it identically in the JSON, Markdown, and HTML formatters.

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
        <span class="reaction">:thumbsup: 3</span>
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
  // Use: fs.mkdirSync('./exports', { recursive: true }) — safe to call even if the directory already exists
```

This is also where the non-interactive `export` and `thread` subcommands (stubbed in Phase 4) are fully implemented:

```ts
async function runExportCommand(args: ParsedArgs): Promise<void>
  // --channel, --format, --output, --from, --to
async function runThreadCommand(args: ParsedArgs): Promise<void>
  // <url>, --format, --output
```

---

## Web UI Compatibility

`src/export/` is fully reusable in a Web UI with no changes:

- `formatDoc(doc, format)` runs server-side and the result is streamed as a file download (`Content-Disposition: attachment`)
- `ExportDoc` is also a clean JSON payload — a Web UI could fetch it directly and render messages in the browser without going through a formatter at all; the formatters then become an optional download path
- The `toHtml()` output is already a self-contained standalone file, so "open in browser" in the Web UI context is just serving the formatter output inline

The one file-system concern (`defaultOutputPath` with `mkdirSync`) is CLI-specific. In a Web UI the output path concept goes away — the server writes to a temp file or streams directly. Keeping `defaultOutputPath` as a CLI-layer helper (called from `src/cli/`, not from `src/export/index.ts` internals) would make this cleaner. Consider accepting an explicit `outputPath` parameter in `runExportCommand` rather than computing it inside the export module.

## Verification

For each format, export a real channel and check:

- **JSON**: valid JSON, all messages present, reactions/files included
- **Markdown**: renders correctly in a Markdown viewer; replies indented
- **HTML**: opens in browser without errors; no broken styles; `<details>` expand correctly; file is standalone (no network requests)

## Developer Checkpoint

Hand the developer real, openable artifacts (see the policy in `overview.md`):

- Export the **same** real channel in all three formats (interactively and via the non-interactive `export` subcommand) and give the developer the three file paths under `./exports/`.
- Have them open the `.json` (valid, all fields), the `.md` (renders in a viewer, replies indented), and the `.html` (opens offline, `<details>` expand, no network requests — check devtools Network tab is empty).
- Verify a thread export too, via the `thread <url>` subcommand.
- Show `git diff --stat` and `pnpm test` passing, then pause for sign-off.

## Testing

Export formatters are pure `ExportDoc → string` functions — the most testable code in the project with zero mocking required.

**New files:**
```
tests/__fixtures__/exportDoc.ts    pre-built ExportDoc with messages, reactions, files, replies
tests/export/json.test.ts
tests/export/markdown.test.ts
tests/export/html.test.ts
```

**`tests/__fixtures__/exportDoc.ts`** — a realistic `ExportDoc` fixture covering all fields: messages with reactions, file attachments, and thread replies.

**`tests/export/json.test.ts`** cases:
- `JSON.parse(toJson(doc))` does not throw (valid JSON)
- All messages present with correct fields
- Reactions serialised as `{ name, count }`
- File attachments serialised with `name`, `url`, `mimetype`

**`tests/export/markdown.test.ts`** cases:
- Output starts with `# #channel-name —` header
- Each message contains the username and formatted datetime
- Reactions rendered as `:emoji: ×N`
- File attachments present with name and URL
- Thread replies rendered as `> **User** · datetime *(reply)*` blockquotes
- Top-level messages separated by `---`

**`tests/export/html.test.ts`** cases:
- Output contains `<!DOCTYPE html>` and `</html>`
- No external URLs: no `http://` or `https://` in `<link>`, `<script>`, or `@import` (fully offline)
- User-supplied text is HTML-escaped: a message containing `<script>alert(1)</script>` appears as `&lt;script&gt;` in output
- Thread replies are wrapped in `<details>` elements
- Dark theme: spot-check that a key CSS property (e.g. `background`) appears in the `<style>` block

**Run:** `pnpm test` — all cases pass without any network calls or file I/O.
