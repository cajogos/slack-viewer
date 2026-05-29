import type { ExportDoc, ExportMessage } from './types.js'
import { mrkdwnToText } from '../utils/mrkdwn.js'

function formatMessage(msg: ExportMessage, lines: string[], isReply = false): void {
  const header = isReply
    ? `> **${msg.user}** · ${msg.datetime} *(reply)*`
    : `**${msg.user}** · ${msg.datetime}`
  lines.push(header)

  const text = mrkdwnToText(msg.text, { format: 'markdown' })
  if (text.trim()) {
    lines.push(isReply ? `> ${text}` : text)
  }

  if (msg.reactions && msg.reactions.length > 0) {
    const rxStr = msg.reactions.map(r => `:${r.name}: ×${r.count}`).join('  ')
    lines.push(`> ${rxStr}`)
  }

  if (msg.files && msg.files.length > 0) {
    for (const f of msg.files) {
      lines.push(`📎 ${f.name}${f.url ? ` (${f.url})` : ''}`)
    }
  }

  if (msg.replies && msg.replies.length > 0) {
    lines.push('')
    for (const reply of msg.replies) {
      formatMessage(reply, lines, true)
    }
  } else if (msg.replyCount && msg.replyCount > 0) {
    const word = msg.replyCount === 1 ? 'reply' : 'replies'
    lines.push(`↳ ${msg.replyCount} ${word}`)
  }
}

export function toMarkdown(doc: ExportDoc): string {
  const lines: string[] = []

  lines.push(`# #${doc.channel} — ${doc.workspace}`)
  lines.push(`Exported: ${doc.exportedAt}`)
  lines.push('')

  for (let i = 0; i < doc.messages.length; i++) {
    if (i > 0) {
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    formatMessage(doc.messages[i], lines)
  }

  lines.push('')
  return lines.join('\n')
}
