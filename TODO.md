# TODO

## Features

- **Recently visited channels toolbar** — a persistent top bar in the web UI showing
  the last N channels opened, for quick switching. Depends on the routing task below
  (channel state needs to live in the URL before history can be tracked reliably).
  Persist the list in `localStorage`.

- **URL-based routing for channels** — push channel selection into the browser history
  (`/workspaces/:ws/channels/:channelId`) so the back button works and deep links are
  shareable. Prerequisite for the recently visited toolbar and for the bottom action log.

- **Clear button on channel search bar** — small ✕ button inside the search input in
  `ChannelSidebar` that resets the query. Appears only when the field is non-empty.

- **Messages load anchored to bottom** — when a channel has few messages the content
  sits at the top of the scroll area. It should be bottom-anchored like a real chat
  client (flex-col-reverse or scroll to bottom immediately on load, before paint).

- **Bottom action log toolbar** — a persistent footer bar showing the latest actions
  taken in the session (channel opened, export downloaded, thread viewed, etc.).
  Persisted in `localStorage` so it survives page refresh.

- **Layout improvements for wide screens** — at 2K+ resolutions the content area has
  no max-width and messages stretch uncomfortably. Add a max-width cap on the message
  feed and/or increase padding so the layout feels intentional at large sizes.

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
