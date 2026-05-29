# Phase 4 — Interactive CLI Navigation

Wire up the interactive TUI using `@inquirer/prompts`. All navigation is arrow-key driven with searchable lists where useful.

## Goals

- [ ] Workspace selection is skipped when only one profile is configured
- [ ] Channel list is searchable (type to filter) and shows channel type prefix and member count
- [ ] Channel list includes a "Switch workspace" option at the top when multiple profiles are configured
- [ ] Spinner shown during all API calls
- [ ] "View recent messages" renders messages with colour: timestamp (dim), username (bold cyan), text (white), reactions (dim yellow)
- [ ] "Load more" prompt appears when `hasMore` is true; stops when user declines or messages are exhausted
- [ ] "Paste thread URL" prompt parses the URL and renders the thread; shows a clear error for invalid URLs
- [ ] After displaying a thread, an "Export this thread" option is offered alongside "Back"
- [ ] "Export channel" prompts for format, optional date range, and output path; fetches all pages with progress; writes the file to `./exports/` by default
- [ ] "Export thread" (from thread view) uses the same format/path flow as channel export
- [ ] Export is stubbed with "coming in Phase 5" until Phase 5 is complete
- [ ] Export success prints the saved file path in green
- [ ] "Back" at any level returns to the previous menu without crashing
- [ ] Ctrl+C at any prompt exits cleanly with code 0
- [ ] Long messages wrap at terminal width
- [ ] Non-interactive export mode works: `slack-viewer export --channel <name> --format json --output ./out.json`
- [ ] Non-interactive thread mode works: `slack-viewer thread <url> --format markdown --output ./out.md`
- [ ] Non-interactive mode is stubbed in this phase and completed in Phase 5
- [ ] `README.md` — Usage section and Navigation walkthrough updated to reflect actual menu options and keyboard behaviour; "Pasting a thread URL" section verified; non-interactive commands documented
- [ ] `CLAUDE.md` — Phase 4 marked `complete`; update the Navigation Flow diagram to match the actual implementation; update "Adding New Features → New CLI action" instructions if the pattern changed

## Files to Create

```
src/cli/selectWorkspace.ts
src/cli/selectChannel.ts
src/cli/selectAction.ts
src/cli/prompts.ts
src/index.ts              ← replace stub with real main()
```

---

## Navigation Flow

```
main()
  ├── validate workspaces.json exists
  ├── selectWorkspace()        ← skipped if only 1 workspace
  ├── auth.test() + spinner    ← "Connecting to <name>..."
  └── loop:
        selectChannel()        ← includes "Switch workspace" option if multiple profiles
          └── selectAction()
                ├── [View recent messages]
                │     └── display messages → [Load more] / [Back]
                ├── [Paste thread URL]
                │     └── input prompt → fetchThread → display
                │           └── [Export this thread] / [Back]
                ├── [Export channel...]
                │     ├── selectFormat()        → JSON / Markdown / HTML
                │     ├── selectDateRange()      → All time / Last 7d / Last 30d / Custom
                │     ├── input output path      (default: ./exports/<channel>-<date>.<ext>)
                │     └── write file → "✓ Saved to ./exports/..."
                └── [← Back to channels]
```

---

## src/cli/prompts.ts

Shared utilities:

- `spinner(text)` — returns an `ora` spinner; call `.succeed()` / `.fail()` to finish
- `confirm(message)` — yes/no prompt using `@inquirer/prompts` `confirm`
- `inputPath(defaultPath)` — text input with a default value for output file paths
- `displayMessages(messages)` — renders a list of messages to stdout using `chalk`:
  - Timestamp in dim grey
  - Username in bold cyan
  - Message text in white
  - Reactions as `:emoji: ×N` in dim yellow
  - File attachments as `📎 filename` in dim

---

## src/cli/selectWorkspace.ts

```ts
async function selectWorkspace(profiles: WorkspaceProfile[]): Promise<WorkspaceProfile>
```

- If 1 profile: return it immediately (no prompt)
- If multiple: `select` prompt with profile names as choices
- Shows workspace name and a truncated token hint (`xoxp-...xxxx`)

---

## src/cli/selectChannel.ts

```ts
async function selectChannel(client: WebClient, profiles: WorkspaceProfile[], currentProfile: WorkspaceProfile): Promise<Channel | 'switch-workspace'>
```

- Shows a loading spinner while fetching channels
- Uses `search` prompt type from `@inquirer/prompts` — user types to filter the list
- If multiple workspace profiles are configured, a "↩ Switch workspace" entry is shown at the top of the list; selecting it returns the sentinel `'switch-workspace'` so `main()` can re-run `selectWorkspace()`
- Displays channel type prefix:
  - `#` for public channels
  - `🔒` for private channels (accessible)
  - `🔒 [no access]` for private channels the user can see but is not a member of
  - `💬` for DMs and group DMs
- Shows member count for channels where available
- Channels marked `[no access]` are displayed but cannot be selected (disabled choice)

---

## src/cli/selectAction.ts

```ts
async function selectAction(client: WebClient, workspace: string, channel: Channel): Promise<void>
```

A `select` prompt with four choices. Runs in a loop until "Back" is chosen.

**View recent messages:**
- Spinner while fetching
- `displayMessages()` renders to stdout
- `confirm("Load more messages?")` → fetch next page if yes
- Repeat until no more pages or user declines

**Paste thread URL:**
- `input` prompt: "Paste Slack thread URL:"
- `parseThreadUrl()` on the input
- If invalid: print error, return to action menu
- If valid but wrong channel: warn but proceed
- Spinner while fetching thread
- `displayMessages()` for the thread

**Export channel:**
- `select` prompt: JSON / Markdown / HTML
- `select` prompt: date range — All time / Last 7 days / Last 30 days / Custom dates
  - Custom: two `input` prompts for start and end date (YYYY-MM-DD format)
  - Selection maps to `oldest`/`latest` values passed to `fetchHistory`
- `input` prompt for output file path (default: `./exports/<channel>-<date>.<ext>`)
- Spinner while fetching all history (with pagination progress: "Fetching messages (page N)…")
- Calls export stub — returns `"coming in Phase 5"` until Phase 5 is complete
- Print: `✓ Saved to <path>` in green

**Export thread** (shown after loading a thread via URL):
- Same format/path flow as channel export
- Calls the same export stub with a thread-scoped `ExportDoc`

**Back:**
- Return to channel selection

---

## src/index.ts

```ts
async function main() {
  const profiles = loadWorkspaces()      // exit with message if missing/empty
  const profile = await selectWorkspace(profiles)
  const client = createClient(profile.token)

  // validate token
  const spinner = spinner('Connecting…')
  const auth = await client.auth.test()
  spinner.succeed(`Connected to ${auth.team}`)

  // main loop
  while (true) {
    const channel = await selectChannel(client, auth.team)
    await selectAction(client, auth.team, channel)
  }
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message)
  process.exit(1)
})
```

---

## Non-interactive Mode (stub in this phase, completed in Phase 5)

Scriptable subcommands parsed via `parseArgs` from `node:util` (built into Node 24 — no third-party dep needed).

```
slack-viewer export --channel <name-or-id> --format json|markdown|html [--output <path>] [--from YYYY-MM-DD] [--to YYYY-MM-DD]
slack-viewer thread <slack-url> --format json|markdown|html [--output <path>]
```

- If `--output` is omitted: default to `./exports/<channel>-<date>.<ext>`
- If `--from`/`--to` are omitted: export all history
- No interactive prompts — exit 1 with a clear message if required flags are missing
- In Phase 4 these print `"Export coming in Phase 5"` and exit 0 (stub)

This mode is what allows LLMs and scripts to drive the tool without navigating menus.

## UX Details

- All prompts support Ctrl+C to exit cleanly (process exits with code 0)
- Long channel lists: `search` prompt handles filtering without truncation
- Terminal width: wrap message text at `process.stdout.columns - 4` characters
- Timestamps: displayed in the system's local timezone using `Intl.DateTimeFormat`

---

## Verification

```bash
pnpm dev
```

Full navigation flow manually tested:
1. Workspace selection (if multiple)
2. Channel search and selection
3. View messages → load more
4. Paste a real thread URL → displays replies
5. Export a channel → file exists with expected content
