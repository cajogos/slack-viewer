# Phase 6 — Polish & Edge Cases

Harden the tool: error handling, CLI flags, permission edge cases, and user-facing documentation.

## Goals

- [ ] `--help` flag prints usage, keyboard shortcuts, non-interactive commands, and config instructions then exits 0
- [ ] `--version` flag prints the version from `package.json` then exits 0
- [ ] Arg parsing uses `parseArgs` from Node's built-in `node:util` — no third-party CLI framework needed
- [ ] Missing `workspaces.json` shows setup instructions and exits 1
- [ ] Expired or invalid token shows a named error ("Token for 'workspace-name' is invalid") and exits 1
- [ ] Inaccessible private channels appear in the list with a `[no access]` marker and cannot be selected (rather than being silently hidden)
- [ ] Unparseable thread URL shows the expected format and returns to the action menu
- [ ] Export pagination shows progress ("page N, X messages so far") in the spinner text
- [ ] DM channels display participant names, not raw IDs
- [ ] Group DM channels list all participant names
- [ ] `README.md` fully reviewed end-to-end: Node 24 requirement confirmed, all commands tested, scope list confirmed, export format descriptions accurate, limitations up to date
- [ ] `CLAUDE.md` — Phase 6 marked `complete`; all Build Status entries updated; review every section for accuracy against the finished implementation; add any non-obvious gotchas or constraints discovered during development to the Development Notes section

## Changes Across Existing Files

```
src/index.ts          ← --help, --version flags
src/api/client.ts     ← better error messages
src/api/channels.ts   ← handle no-permission channels
src/cli/prompts.ts    ← progress indicator for large fetches
README.md             ← setup and usage guide
```

---

## CLI Flags

Use `parseArgs` from Node's built-in `node:util` — available and stable in Node 24, no third-party dependency needed:

```
slack-viewer --help      Print usage and exit
slack-viewer --version   Print package version and exit
```

`--help` output:

```
Usage: slack-viewer [options]

A read-only Slack explorer and export tool.

Options:
  --help       Show this help message
  --version    Show version

Configuration:
  Create workspaces.json in the project directory:
  {
    "my-workspace": "xoxp-your-token-here"
  }

Keyboard shortcuts (during navigation):
  Arrow keys   Navigate lists
  Enter        Select
  Ctrl+C       Exit
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| `workspaces.json` missing | Print setup instructions, exit 1 |
| Invalid/expired token | Print "Token for '<name>' is invalid. Check workspaces.json." exit 1 |
| Channel not accessible (no permission) | Show channel with `[no access]` label in list; cannot be selected |
| API rate limit hit (after retries exhausted) | Print "Rate limited. Wait and try again." exit 1 |
| Network error | Print error message, exit 1 |
| Thread URL doesn't parse | Print "Couldn't parse that URL. Expected format: https://workspace.slack.com/archives/..." |
| Export file write error | Print OS error message |
| Ctrl+C at any prompt | Exit cleanly (code 0) — `@inquirer/prompts` handles this natively |

---

## Pagination Progress

For large channel exports, the current spinner (`Fetching messages…`) gives no progress signal. Replace with a progress line:

```
⠋ Fetching messages (page 4, 200 messages so far)…
```

Implementation: update `ora` spinner text in the fetch loop inside `fetchHistory`.

---

## Private Channel / DM Handling

- If the user is not a member of a private channel, `conversations.history` returns `not_in_channel` — catch and display a clear message
- For DMs (`im` type), display the other user's name instead of a channel ID
- For group DMs (`mpim` type), list all participant names joined by `, `

---

## Token Scope Requirements

Document in README the minimum OAuth scopes required for a user token:

| Scope | Used for |
|---|---|
| `channels:read` | List public channels |
| `channels:history` | Read public channel messages |
| `groups:read` | List private channels |
| `groups:history` | Read private channel messages |
| `im:read` | List DMs |
| `im:history` | Read DM messages |
| `mpim:read` | List group DMs |
| `mpim:history` | Read group DM messages |
| `users:read` | Resolve user display names |
| `reactions:read` | Include emoji reactions |
| `files:read` | Include file attachment metadata |

---

## README.md

Sections:
1. **Overview** — one paragraph describing the tool
2. **Requirements** — Node.js ≥ 24 (see `.nvmrc`), pnpm ≥ 9
3. **Setup** — clone, `pnpm install`, create `workspaces.json`
4. **Getting a Slack token** — brief steps: create a Slack app → OAuth scopes (list above) → install to workspace → copy User OAuth Token
5. **Usage** — interactive mode (`pnpm dev`) and non-interactive mode (`slack-viewer export ...`, `slack-viewer thread ...`)
6. **Export formats** — what each format looks like
7. **Limitations** — read-only, no file downloads, no real-time

---

## Pre-publish Security Checklist

Before making the repository public or pushing for the first time:

- [ ] `git status` shows `workspaces.json` as untracked (not staged, not committed)
- [ ] `git grep "xoxp-"` returns no results across all tracked files
- [ ] `git log --all -S "xoxp-" --oneline` returns no results in history
- [ ] `exports/` directory is absent from git tracking (`git ls-files exports/` returns nothing)
- [ ] `workspaces.json.example` contains only the placeholder value `"xoxp-your-token-here"`, not a real token
- [ ] `.env.example` contains no real values
- [ ] No token, API key, or personal data appears in any file under `src/`, `plan/`, or root config files

If any real token is found in history: revoke it at api.slack.com/apps before doing anything else, then clean history with `git filter-repo`.

## Verification

```bash
pnpm build && node dist/index.js --help    # help text prints
pnpm build && node dist/index.js --version # version prints

# with an invalid token in workspaces.json:
pnpm dev    # prints clear error and exits 1

# with valid token, large channel:
# Export → pagination progress visible
# Output file opens cleanly in browser/editor
```
