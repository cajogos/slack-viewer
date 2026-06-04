# TODO

## Features

- **Image and media preview in web UI** — file attachments currently show as a
  filename + paperclip icon (`📎 filename`). The HTML export renders images inline
  using `url_private` with the token appended as a query param. The web UI should
  do the same: add a server-side proxy route `GET /api/workspaces/:ws/files?url=`
  that fetches the private Slack file URL (with auth) and streams it to the browser,
  then render `<img>`, `<video>`, or a download link in `MessageItem` depending on
  the mimetype. Requires `files:read` scope (already in the token).

## Bugs

- **Standard emoji not rendering in web UI** — `:tada:` `:fire:` etc. are resolved
  server-side to Unicode before the JSON response is sent, but they still display
  as raw `:name:` text in the browser. The server-side `resolveEmojiShortcodes()`
  call in `web/server/routes/messages.ts` and `threads.ts` needs investigation.
  The CLI renders them correctly via `mrkdwnToText`.
