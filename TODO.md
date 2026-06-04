# TODO

## Features

- ~~**Recently visited channels toolbar**~~ — done.

- ~~**URL-based routing for channels**~~ — done.

- ~~**Clear button on channel search bar**~~ — done.

- ~~**Messages load anchored to bottom**~~ — done.

- ~~**Bottom action log toolbar**~~ — done.

- ~~**Layout improvements for wide screens**~~ — done.

- ~~**Image and media preview in web UI**~~ — done.

## Bugs

- ~~**Standard emoji not rendering in CLI or web UI**~~ — done. Standard emoji in
  reactions now resolved server-side to Unicode via `resolveEmojiShortcodes()` and
  surfaced as `reaction.unicode` on the API response. `MessageItem` renders the glyph
  directly; custom emoji fall back to the workspace emoji image map.
