# TODO

## Bugs

- **Standard emoji not rendering in web UI** — `:tada:` `:fire:` etc. are resolved
  server-side to Unicode before the JSON response is sent, but they still display
  as raw `:name:` text in the browser. The server-side `resolveEmojiShortcodes()`
  call in `web/server/routes/messages.ts` and `threads.ts` needs investigation.
  The CLI renders them correctly via `mrkdwnToText`.
