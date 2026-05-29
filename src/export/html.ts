import type { ExportDoc, ExportMessage } from './types.js'
import { mrkdwnToText } from '../utils/mrkdwn.js'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const CSS = `
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: system-ui, -apple-system, sans-serif;
  background: #1a1a2e;
  color: #e0e0e0;
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
  line-height: 1.5;
}
header {
  border-bottom: 1px solid #333;
  padding-bottom: 1rem;
  margin-bottom: 2rem;
}
h1 { font-size: 1.5rem; color: #7eb8d4; margin-bottom: 0.25rem; }
header p { color: #888; font-size: 0.9rem; }
.message {
  padding: 0.75rem 0;
  border-bottom: 1px solid #2a2a3e;
}
.meta {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  margin-bottom: 0.25rem;
}
.user { font-weight: 600; color: #7eb8d4; }
time { font-size: 0.8rem; color: #666; }
.text { color: #d0d0d0; white-space: pre-wrap; word-break: break-word; }
.text a { color: #7eb8d4; }
.text .mention { color: #9ecaed; font-weight: 500; }
.text a.mention { color: #9ecaed; font-weight: 500; text-decoration: none; }
.text a.mention:hover { text-decoration: underline; }
.text .channel { color: #7eb8d4; }
.text code { background: #2a2a3e; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.9em; }
.text pre { background: #2a2a3e; padding: 0.75rem; border-radius: 4px; overflow-x: auto; margin: 0.5rem 0; }
.text strong { color: #fff; }
.reactions { margin-top: 0.4rem; display: flex; flex-wrap: wrap; gap: 0.4rem; }
.reaction {
  background: #2a2a3e;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 0.1em 0.5em;
  font-size: 0.85rem;
  color: #aaa;
}
.files { margin-top: 0.4rem; }
.files a { color: #7eb8d4; font-size: 0.9rem; }
.img-attachment { margin-top: 0.5rem; }
.img-attachment img { max-width: 100%; max-height: 500px; border-radius: 4px; display: block; }
.reply-count { margin-top: 0.4rem; color: #666; font-size: 0.85rem; }
details.replies { margin-top: 0.5rem; }
details.replies summary {
  cursor: pointer;
  color: #7eb8d4;
  font-size: 0.85rem;
  user-select: none;
  margin-bottom: 0.5rem;
}
.reply {
  padding: 0.5rem 0 0.5rem 1rem;
  border-left: 2px solid #2a2a3e;
  margin-bottom: 0.5rem;
}
`.trim()

function renderMessage(msg: ExportMessage, isReply = false): string {
  const textHtml = mrkdwnToText(msg.text, { format: 'html' })

  const cls = isReply ? 'message reply' : 'message'
  let html = `<article class="${cls}">\n`
  html += `  <div class="meta"><span class="user">${esc(msg.user)}</span><time>${esc(msg.datetime)}</time></div>\n`

  if (textHtml.trim()) {
    html += `  <div class="text">${textHtml}</div>\n`
  }

  if (msg.reactions && msg.reactions.length > 0) {
    html += `  <div class="reactions">\n`
    for (const r of msg.reactions) {
      html += `    <span class="reaction">:${esc(r.name)}: ${r.count}</span>\n`
    }
    html += `  </div>\n`
  }

  if (msg.files && msg.files.length > 0) {
    html += `  <div class="files">\n`
    for (const f of msg.files) {
      if (f.mimetype?.startsWith('image/')) {
        html += `    <div class="img-attachment"><img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy"></div>\n`
      } else {
        html += `    <div>📎 <a href="${esc(f.url)}">${esc(f.name)}</a></div>\n`
      }
    }
    html += `  </div>\n`
  }

  if (msg.replies && msg.replies.length > 0) {
    const replyWord = msg.replies.length === 1 ? 'reply' : 'replies'
    html += `  <details class="replies" open>\n`
    html += `    <summary>${msg.replies.length} ${replyWord}</summary>\n`
    for (const reply of msg.replies) {
      html += renderMessage(reply, true)
    }
    html += `  </details>\n`
  } else if (msg.replyCount && msg.replyCount > 0) {
    const word = msg.replyCount === 1 ? 'reply' : 'replies'
    html += `  <div class="reply-count">↳ ${msg.replyCount} ${word}</div>\n`
  }

  html += `</article>`
  return html
}

export function toHtml(doc: ExportDoc): string {
  const title = `#${esc(doc.channel)} — ${esc(doc.workspace)}`
  const messagesHtml = doc.messages.map(m => renderMessage(m)).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base target="_blank" rel="noopener noreferrer">
  <title>${title}</title>
  <style>
${CSS.split('\n').map(l => '    ' + l).join('\n')}
  </style>
</head>
<body>
  <header>
    <h1>#${esc(doc.channel)}</h1>
    <p>${esc(doc.workspace)} · Exported ${esc(doc.exportedAt)} · ${doc.messageCount} messages</p>
  </header>
  <main>
${messagesHtml.split('\n').map(l => '    ' + l).join('\n')}
  </main>
</body>
</html>`
}
