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

- **Standard emoji not rendering in CLI or web UI** — `:tada:` `:fire:` etc. stay
  as raw `:name:` text in both interfaces. `resolveEmojiShortcodes()` in
  `src/utils/mrkdwn.ts` and the server-side calls in `messages.ts`/`threads.ts`
  need investigation. Smoke tests against the compiled output appeared to work but
  the live app does not.
