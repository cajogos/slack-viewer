# Phase 4 — Interactive CLI Navigation

Wire up the interactive TUI using `@inquirer/prompts`. All navigation is arrow-key driven with searchable lists where useful.

## Goals

- [ ] Workspace selection is skipped when only one profile is configured
- [ ] Channel list is searchable (type to filter) and shows channel type prefix and member count
- [ ] Channel list groups channels by type using separator items: `── Channels ──` and `── Direct Messages ──`
- [ ] Channel list shows a `── Recent ──` section at the top with the last 5 visited channels (session-scoped, no persistence)
- [ ] Channel list includes a "Switch workspace" option at the top when multiple profiles are configured
- [ ] Spinner shown during all API calls
- [ ] "View recent messages" renders messages with colour: timestamp (dim), username (bold cyan), text (white), reactions (dim yellow)
- [ ] Each message is prefixed with a two-letter colored initials badge (e.g. `[AC]`), color derived deterministically from `userId` (hash → one of 6 chalk colors)
- [ ] Messages with `replyCount > 0` show a `↳ N replies` indicator on the following line (dim)
- [ ] Relative timestamps (`2h ago`, `yesterday`, `Mon`) shown alongside the absolute time in terminal view; absolute timestamps used in all exports
- [ ] A keyboard shortcut hint footer is printed after each `displayMessages` call (dim): `↑↓ scroll · L load more · T paste thread URL · E export · B back`
- [ ] The action menu header shows a breadcrumb: `workspace-name › #channel-name`
- [ ] "View recent messages" shows `(v)iew`, "Paste thread URL" shows `(t)hread`, "Export channel" shows `(e)xport`, "Back" shows `(b)ack` — shorthand hints in choice labels
- [ ] `mrkdwnToTextAsync` used in display paths where user mention resolution is needed (terminal render); sync `mrkdwnToText` used where async is inconvenient (export pre-processing done by the API layer)
- [ ] Date range input (`YYYY-MM-DD`) is converted to a Unix timestamp string before passing to `fetchHistory`. **`oldest`** = start-of-day; **`latest`** = end-of-day (start of the *next* day) so the end date is **inclusive** — using start-of-day for `latest` would drop the entire end day. Both boundaries are interpreted in UTC (a bare `YYYY-MM-DD` parses as UTC midnight); this is documented so it stays consistent with how timestamps are stored
- [ ] `selectChannel` return sentinel `'switch-workspace'` is handled in the main loop before calling `selectAction` — the loop re-runs `selectWorkspace()` when the sentinel is returned
- [ ] Spinner in `src/index.ts` uses the local variable name `spin` (not `spinner`) to avoid shadowing the imported `spinner()` helper from `prompts.ts`
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
- `userColor(userId)` — deterministic chalk color function for a user ID. Hash the ID to an index into a fixed palette of 6 colors (`cyan`, `green`, `yellow`, `magenta`, `blue`, `red`). Always returns the same color for the same ID within a session.
- `formatRelativeTime(ts)` — converts a Slack timestamp string to a relative label: `just now` (<1m), `Nm ago` (<1h), `Nh ago` (<24h), `yesterday`, day name (`Mon`–`Sun`) for the past week, or the absolute date for older. Used for terminal display only — exports always use absolute datetime. **Note:** Slack `ts` is float-*seconds* as a string, so convert with `parseFloat(ts) * 1000` before constructing a `Date` — passing the raw string to `new Date()` treats it as milliseconds.
- `displayMessages(client, teamId, messages)` — **async**; renders a list of messages to stdout using `chalk`. It needs `client` + `teamId` because message *text* still contains `<@U123>` mentions that must be resolved via `mrkdwnToTextAsync` (the resolved `user` display-name field only covers the author, not in-body mentions):
  - Initials badge `[XY]` in the user's deterministic color (first two letters of display name, uppercased)
  - Timestamp: absolute (`09:12`) in dim grey + relative (`2h ago`) in dim italic, separated by `·`
  - Username in bold, colored by `userColor(userId)`
  - Message text in white, wrapped at `process.stdout.columns - 4`
  - Reactions as `:emoji: ×N` in dim yellow
  - File attachments as `📎 filename` in dim
  - If `replyCount > 0`: a `↳ N replies` line below the message in dim
  - After all messages, prints a dim footer: `  ↑↓ scroll · L load more · T paste thread URL · E export · B back`

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
async function selectChannel(client: WebClient, profiles: WorkspaceProfile[], currentProfile: WorkspaceProfile, recentChannels: Channel[]): Promise<Channel | 'switch-workspace'>
```

- Shows a loading spinner while fetching channels
- Uses `search` prompt type from `@inquirer/prompts` — user types to filter the list
- **Separators + grouping inside `search`:** the `search` prompt resolves choices through a `source(term)` callback invoked on each keystroke. The Recent / `── Channels ──` / `── Direct Messages ──` separators and the "Switch workspace" entry must be rebuilt **inside** that callback for the current filter term — they are not static `choices`. When `term` is empty, return the full grouped structure (with separators); when filtering, return the matching channels (separators can be omitted or regrouped). A `Separator` is non-selectable, and disabled `[no access]` choices use `{ disabled: true }`.
- If multiple workspace profiles are configured, a "↩ Switch workspace" entry is shown at the top of the list; selecting it returns the sentinel `'switch-workspace'` so `main()` can re-run `selectWorkspace()` and loop again
- **Recent channels section:** if `recentChannels` is non-empty, inserts a `── Recent ──` separator followed by the last 5 visited channels (most-recent first) before the full list. `recentChannels` is maintained as a session-scoped array in `main()` — no file persistence.
- **Grouped list:** full channel list is split by type and rendered with separators:
  - `── Channels ──` — public and private channels
  - `── Direct Messages ──` — IMs and group DMs
- Displays channel type prefix:
  - `#` for public channels the user has joined (`isMember`)
  - `# [no access]` for public channels the user has **not** joined — visible via `conversations.list` but not readable until joined
  - `🔒` for private channels (always accessible — Slack only lists private channels the user belongs to)
  - `💬` for DMs and group DMs
- Shows member count for channels where available
- Channels marked `[no access]` are displayed but cannot be selected (disabled choice). Private channels are never `[no access]`: if Slack returned it, the user is a member. (See Phase 3 `channels.ts` for why `[no access]` only applies to public channels.)
- After the user selects a channel, the caller (`main()`) prepends it to the `recentChannels` array (capped at 5, deduped by channel ID)

---

## src/cli/selectAction.ts

```ts
async function selectAction(client: WebClient, workspace: string, channel: Channel): Promise<void>
```

A `select` prompt with four choices. Runs in a loop until "Back" is chosen.

The prompt header shows a breadcrumb using `chalk`:
```
workspace-name › #channel-name
```
e.g. `my-company › #engineering` — printed above the choices using `console.log` before the prompt renders.

Choice labels include shorthand hints:
- `(v)iew recent messages`
- `(t)hread — paste URL`
- `(e)xport channel…`
- `(b)ack to channels`

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
  let profile = await selectWorkspace(profiles)

  // session-scoped recent channels list (no file persistence)
  const recentChannels: Channel[] = []

  while (true) {
    const client = createClient(profile.token)

    // validate token — use local variable name `spin` to avoid shadowing the imported `spinner()` helper
    const spin = spinner('Connecting…')
    const auth = await client.auth.test()
    spin.succeed(`Connected to ${auth.team}`)

    // main loop
    while (true) {
      const result = await selectChannel(client, profiles, profile, recentChannels)

      if (result === 'switch-workspace') {
        profile = await selectWorkspace(profiles)
        recentChannels.length = 0   // clear recents when switching workspace
        break                        // restart outer loop with new profile
      }

      // prepend to recents (dedup by id, cap at 5)
      const channel = result
      const idx = recentChannels.findIndex(c => c.id === channel.id)
      if (idx !== -1) recentChannels.splice(idx, 1)
      recentChannels.unshift(channel)
      if (recentChannels.length > 5) recentChannels.pop()

      await selectAction(client, auth.team!, channel)
    }
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

**`parseArgs` config:** the subcommand name (`export`/`thread`) and the thread `<url>` are positionals, so `parseArgs` must be called with `allowPositionals: true` — the default is `false` and will throw on the first positional. Read the subcommand from `positionals[0]` and the thread URL from `positionals[1]`. Define `--channel`, `--format`, `--output`, `--from`, `--to` as `options` with `type: 'string'`.

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
- Timestamps: displayed in the system's local timezone using `Intl.DateTimeFormat`; relative labels via `formatRelativeTime()` for terminal view only
- Colored initials palette (6 colors): `chalk.cyan`, `chalk.green`, `chalk.yellow`, `chalk.magenta`, `chalk.blue`, `chalk.red` — index = `userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6`
- Date range `YYYY-MM-DD` → Unix timestamp, used in the export date-range flow before passing `oldest`/`latest` to `fetchHistory`:
  - `oldest` (start date): `(Date.parse(dateStr + 'T00:00:00Z') / 1000).toString()`
  - `latest` (end date, **inclusive**): add one day so the whole end day is included — `((Date.parse(dateStr + 'T00:00:00Z') + 86_400_000) / 1000).toString()`. Using start-of-day here would exclude every message on the end date (e.g. `--to 2026-03-31` would return nothing from March 31)
  - Boundaries are UTC; `Date.parse('2026-03-31T00:00:00Z')` is explicit about that rather than relying on the platform's local-vs-UTC parsing of bare dates
- `mrkdwnToTextAsync` is used in `displayMessages` (terminal render path) where full mention resolution is needed. `mrkdwnToText` (sync) is used in the export path — the API layer resolves user IDs before building `ExportMessage`, so the sync converter is sufficient for formatters

---

## Web UI Compatibility

`src/cli/` is the layer that will be **replaced** by a frontend in a future Web UI — not reused. That's expected and fine. What matters is that this phase doesn't let CLI concerns leak into the layers below it:

- `src/api/`, `src/export/`, `src/utils/`, and `src/types/` must remain import-free of anything in `src/cli/`
- `displayMessages`, `spinner`, `userColor`, `formatRelativeTime` are CLI-only helpers — do not call them from the API or export layers
- The `ExportDoc` type (built in this phase as a stub, completed in Phase 5) is the natural JSON payload a Web UI server would return for an export-preview endpoint

The navigation flow implemented here (workspace → channel → action loop) maps directly to browser page/route transitions. Documenting the flow clearly in this phase makes the Web UI routing design straightforward later.

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

## Developer Checkpoint

The interactive flow is now demonstrable directly — no probe needed (see the policy in `overview.md`):

- Walk the developer through a live `pnpm dev` session covering each path in the Navigation Flow: workspace select (if multiple), channel search, view + load more, paste thread URL, and the export flow (still stubbed — confirm it prints "coming in Phase 5").
- Demonstrate Ctrl+C exits cleanly and "Back" returns without crashing.
- Show the non-interactive stubs respond: `node dist/index.js export --channel general --format json` prints the Phase 5 stub and exits 0.
- Show `git diff --stat` and `pnpm test` (helper-function tests) passing, then pause for sign-off.

## Testing

`@inquirer/prompts` interactive menus require a real TTY and are not unit-testable. Tests cover the pure helper functions extracted into `src/cli/prompts.ts`.

**New file:**
```
tests/cli/prompts.test.ts
```

**`tests/cli/prompts.test.ts`** cases:

`formatRelativeTime(ts)`:
- `< 1 minute ago` → `"just now"`
- `30 minutes ago` → `"30m ago"`
- `3 hours ago` → `"3h ago"`
- `yesterday` boundary → `"yesterday"`
- Within the past 7 days → day name (`"Mon"`, `"Tue"`, etc.)
- Older than 7 days → absolute date string

`userColor(userId)`:
- Same `userId` always returns the same chalk color function
- The hash is deterministic: specific known IDs map to specific palette indices
- All 6 palette colors are reachable (test one per slot using crafted IDs)

**Note:** The interactive menus (`selectWorkspace`, `selectChannel`, `selectAction`) are validated manually during development and indirectly via Phase 5 export formatter tests that exercise the full `ExportDoc` pipeline.

**Run:** `pnpm test` — all cases pass.
