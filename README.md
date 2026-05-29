# slack-viewer

A read-only CLI tool for navigating Slack workspaces and exporting conversations. Browse channels, view message history, load threads, and export to JSON, Markdown, or HTML — all from the terminal.

## Features

- Navigate public channels, private channels, DMs, and group DMs
- View message history with pagination
- Load threads by pasting a Slack thread URL
- Export conversations to JSON, Markdown, or HTML
- Multiple workspace profiles
- Fully read-only — no ability to send messages or react

## Requirements

- Node.js 24 or later (see `.nvmrc` — project uses v24.16.0)
- pnpm 9 or later

## Installation

```bash
git clone <repo-url>
cd slack-viewer
pnpm install
```

## Configuration

### 1. Get a Slack user token

You need a Slack **user token** (`xoxp-...`) with access to the channels you want to read.

**Option A — Use an existing Slack app**

If your workspace already has a custom Slack app you control:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and open your app
2. Go to **OAuth & Permissions**
3. Under **User Token Scopes**, add the scopes listed below
4. Click **Reinstall to Workspace**
5. Copy the **User OAuth Token** (`xoxp-...`)

**Option B — Create a new Slack app**

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**
2. Choose **From scratch**, give it a name, select your workspace
3. Go to **OAuth & Permissions** → **User Token Scopes** and add the scopes below
4. Click **Install to Workspace** and authorise
5. Copy the **User OAuth Token** (`xoxp-...`)

**Required OAuth scopes:**

| Scope | Purpose |
|---|---|
| `channels:read` | List public channels |
| `channels:history` | Read public channel messages |
| `groups:read` | List private channels |
| `groups:history` | Read private channel messages |
| `im:read` | List direct messages |
| `im:history` | Read direct message history |
| `mpim:read` | List group direct messages |
| `mpim:history` | Read group direct message history |
| `users:read` | Resolve user display names |
| `reactions:read` | Include emoji reactions in exports |
| `files:read` | Include file attachment metadata |

### 2. Create workspaces.json

Copy the example file and add your token(s):

```bash
cp workspaces.json.example workspaces.json
```

Edit `workspaces.json`:

```json
{
  "my-company": "xoxp-your-token-here"
}
```

For multiple workspaces:

```json
{
  "my-company": "xoxp-...",
  "side-project": "xoxp-..."
}
```

> `workspaces.json` is gitignored and will never be committed.

## Usage

```bash
# Development (run directly with tsx, no build step)
pnpm dev

# Production (compile first, then run)
pnpm build
pnpm start

# Or run the compiled binary directly
node dist/index.js
```

### Navigation

Use arrow keys to move through lists and Enter to select. Type to search/filter the channel list.

```
Select workspace (if multiple configured)
  → Select channel
      → View recent messages    — arrow keys, Enter to load more
      → Paste thread URL        — paste a Slack URL to load that thread
      → Export channel          — choose format and output path
      → Back
```

Press **Ctrl+C** at any point to exit cleanly.

### Pasting a thread URL

From any Slack message, right-click → **Copy link** (or use the `...` menu → **Copy link to message**). Paste it at the prompt. The tool accepts both message links and thread reply links.

Example URL format:
```
https://myworkspace.slack.com/archives/C12345678/p1234567890123456
```

### Non-interactive mode

For scripting (and for LLM tooling), the `export` and `thread` subcommands run without any menus:

```bash
# Export a channel
slack-viewer export --channel general --format json
slack-viewer export --channel general --format markdown --output ./out.md
slack-viewer export --channel C12345678 --format html --from 2026-01-01 --to 2026-03-31

# Export a thread
slack-viewer thread https://myworkspace.slack.com/archives/C12345678/p1234567890123456 --format markdown
```

- `--output` defaults to `./exports/<channel>-<date>.<ext>`
- `--from` / `--to` take `YYYY-MM-DD` and are **inclusive** date bounds interpreted in **UTC** (the `--to` day is fully included). Omit both to export all history
- Missing a required flag exits with code 1 and a usage hint

## Export Formats

| Format | Extension | Best for |
|---|---|---|
| JSON | `.json` | Programmatic processing, archiving |
| Markdown | `.md` | Readable plain text, git storage |
| HTML | `.html` | Sharing, offline browsing |

Exports include: message text, timestamps, sender names, emoji reactions, and file attachment names/URLs.

Reactions are shown by their Slack shortcode (e.g. `:thumbsup: ×3`), not as rendered emoji.

**Channel exports include top-level messages and a reply count (`↳ N replies`) for threaded messages, but not the reply text itself.** To capture a full thread, export that thread directly by pasting its URL.

HTML exports are self-contained (no external dependencies) and work offline. Thread replies are collapsible. Message content is HTML-escaped, so opening an export in a browser is safe even if a message contained markup.

Default output filename: `<channel>-<date>.<ext>` (e.g. `general-2026-05-29.md`)

## Security

**Never commit `workspaces.json`.** It contains your Slack user token and is gitignored by default. If you accidentally stage it, remove it before committing:

```bash
git rm --cached workspaces.json
```

Before pushing to a public repo, verify no tokens are present in git history:

```bash
git grep "xoxp-"        # should return nothing
git log --all -S "xoxp-" --oneline   # scan full history
```

If a token has been committed at any point in history, [revoke it immediately](https://api.slack.com/apps) and generate a new one — git history is permanent and public.

**Exports may contain private conversation data.** The `exports/` directory is gitignored. Do not commit exported files to a public repo.

## Limitations

- Read-only — cannot send messages, add reactions, or perform any write operations
- File contents are not downloaded — only metadata (filename, URL) is included in exports
- Channel exports do not include thread reply bodies (only a reply count) — export a thread directly for its full replies
- Public channels you haven't joined are listed but shown as `[no access]` and can't be opened until you join them in Slack. Private channels you aren't in are not visible to the tool at all
- No real-time updates — this is a point-in-time export tool
- Bot tokens (`xoxb-`) are not supported — user tokens (`xoxp-`) only
