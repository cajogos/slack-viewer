# Phase 4 — Interactive CLI Navigation

Wire up the interactive TUI using `@inquirer/prompts`. All navigation is arrow-key driven with searchable lists where useful.

## Goals

- [ ] Workspace selection is skipped when only one profile is configured
- [ ] Channel list is searchable (type to filter) and shows channel type prefix and member count
- [ ] Spinner shown during all API calls
- [ ] "View recent messages" renders messages with colour: timestamp (dim), username (bold cyan), text (white), reactions (dim yellow)
- [ ] "Load more" prompt appears when `hasMore` is true; stops when user declines or messages are exhausted
- [ ] "Paste thread URL" prompt parses the URL and renders the thread; shows a clear error for invalid URLs
- [ ] "Export channel" prompts for format and output path, fetches all pages with progress, writes the file
- [ ] Export success prints the saved file path in green
- [ ] "Back" at any level returns to the previous menu without crashing
- [ ] Ctrl+C at any prompt exits cleanly with code 0
- [ ] Long messages wrap at terminal width
- [ ] `README.md` — Usage section and Navigation walkthrough updated to reflect actual menu options and keyboard behaviour; "Pasting a thread URL" section verified
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
        selectChannel()
          └── selectAction()
                ├── [View recent messages]
                │     └── display messages → [Load more] / [Back]
                ├── [Paste thread URL]
                │     └── input prompt → fetchThread → display
                ├── [Export channel...]
                │     ├── selectFormat()   → JSON / Markdown / HTML
                │     ├── input output path (default: ./<channel>-<date>.<ext>)
                │     └── write file → "Saved to ./exports/..."
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
async function selectChannel(client: WebClient, workspaceName: string): Promise<Channel>
```

- Shows a loading spinner while fetching channels
- Uses `search` prompt type from `@inquirer/prompts` — user types to filter the list
- Displays channel type prefix:
  - `#` for public channels
  - `🔒` for private channels
  - `💬` for DMs and group DMs
- Shows member count for channels where available
- Returns the selected `Channel`

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
- `input` prompt for output file path (with sensible default)
- Spinner while fetching all history (with pagination progress: "Fetching messages (page N)…")
- Write file
- Print: `✓ Saved to <path>` in green

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
